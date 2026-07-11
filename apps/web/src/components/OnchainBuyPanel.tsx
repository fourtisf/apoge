/**
 * On-chain buy panel (Phase 3) — approve → buy → claim/refund against the
 * ApogeeSale contract, plus an inline stake flow for wallets without a tier.
 *
 * Lazy-loaded: this file (and its wagmi/viem imports) stays out of the
 * startup bundle. It brings its own WagmiProvider — wagmi v2 state lives in
 * the shared `wagmiConfig` object, so connection state is shared with the
 * WalletHost stack.
 */
import { useEffect, useMemo, useState } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  WagmiProvider,
  useAccount,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';
import {
  ERC20_ABI,
  ONCHAIN_CHAINS,
  PAYMENT_DECIMALS,
  SALE_ABI,
  STAKING_ABI,
  fmtNum2,
  fmtUsd,
  fmtUsdCents,
  truncAddr,
  type OnchainConfig,
  type Project,
} from '@apogee/shared';
import { queryClient } from '../lib/queries';
import { toast, useUi } from '../state/store';
import { wagmiConfig } from '../wallet/wagmi';
import { IconCheck, IconWallet } from './icons';

const TIER_NAMES = ['—', 'IGNITION', 'ORBIT', 'ZENITH', 'APOGEE'];
const E18 = 10n ** 18n;

const usd = (n: number) => BigInt(Math.round(n * 10 ** PAYMENT_DECIMALS));
const toDollars = (units: bigint) => Number(units) / 10 ** PAYMENT_DECIMALS;
const apg = (n: number) => BigInt(Math.round(n)) * E18;

function explorerTx(chainId: number, hash: string): string | null {
  const explorer = ONCHAIN_CHAINS[chainId]?.explorer;
  return explorer ? `${explorer}/tx/${hash}` : null;
}

function errText(err: unknown): string {
  const raw =
    (err as { shortMessage?: string })?.shortMessage ??
    (err instanceof Error ? err.message : 'Transaction failed');
  return raw.split('\n')[0]!.slice(0, 140);
}

function Inner({ project }: { project: Project }) {
  const chainId = project.chainId!;
  const sale = project.saleContract as `0x${string}`;

  const { data: cfgData } = useQuery({
    queryKey: ['onchain-config'],
    queryFn: async () => {
      const res = await fetch('/api/onchain/config');
      return (await res.json()) as { chains: OnchainConfig };
    },
    staleTime: 5 * 60_000,
  });
  const cfg = cfgData?.chains?.[String(chainId)];

  const { address, chainId: connectedChain, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });
  const setConnectOpen = useUi((s) => s.setConnectOpen);

  const [amount, setAmount] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const staking = cfg?.staking as `0x${string}` | undefined;
  const usdcAddr = cfg?.usdc as `0x${string}` | undefined;
  const apgAddr = cfg?.apg as `0x${string}` | undefined;
  const ready = Boolean(address && staking && usdcAddr && apgAddr);

  const reads = useReadContracts({
    contracts: ready
      ? [
          { address: staking!, abi: STAKING_ABI, functionName: 'tierOf', args: [address!], chainId },
          { address: staking!, abi: STAKING_ABI, functionName: 'stakedOf', args: [address!], chainId },
          { address: usdcAddr!, abi: ERC20_ABI, functionName: 'balanceOf', args: [address!], chainId },
          { address: usdcAddr!, abi: ERC20_ABI, functionName: 'allowance', args: [address!, sale], chainId },
          { address: apgAddr!, abi: ERC20_ABI, functionName: 'balanceOf', args: [address!], chainId },
          { address: apgAddr!, abi: ERC20_ABI, functionName: 'allowance', args: [address!, staking!], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'raised', chainId },
          { address: sale, abi: SALE_ABI, functionName: 'hardCap', chainId },
          { address: sale, abi: SALE_ABI, functionName: 'minBuy', chainId },
          { address: sale, abi: SALE_ABI, functionName: 'funded', chainId },
          { address: sale, abi: SALE_ABI, functionName: 'finalized', chainId },
          { address: sale, abi: SALE_ABI, functionName: 'succeeded', chainId },
          { address: sale, abi: SALE_ABI, functionName: 'investedOf', args: [address!], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tokensOf', args: [address!], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'claimableOf', args: [address!], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tierCap', args: [0n], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tierCap', args: [1n], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tierCap', args: [2n], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tierCap', args: [3n], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tierFeeBps', args: [0n], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tierFeeBps', args: [1n], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tierFeeBps', args: [2n], chainId },
          { address: sale, abi: SALE_ABI, functionName: 'tierFeeBps', args: [3n], chainId },
        ]
      : [],
    query: { enabled: ready, refetchInterval: 8_000 },
  });

  const r = (i: number) => reads.data?.[i]?.result;
  const tier = Number(r(0) ?? 0);
  const stakedApg = (r(1) as bigint | undefined) ?? 0n;
  const usdcBal = (r(2) as bigint | undefined) ?? 0n;
  const usdcAllowance = (r(3) as bigint | undefined) ?? 0n;
  const apgBal = (r(4) as bigint | undefined) ?? 0n;
  const apgAllowance = (r(5) as bigint | undefined) ?? 0n;
  const raised = (r(6) as bigint | undefined) ?? 0n;
  const hardCap = (r(7) as bigint | undefined) ?? 0n;
  const minBuy = (r(8) as bigint | undefined) ?? 0n;
  const funded = Boolean(r(9));
  const finalized = Boolean(r(10));
  const succeeded = Boolean(r(11));
  const invested = (r(12) as bigint | undefined) ?? 0n;
  const tokensOwed = (r(13) as bigint | undefined) ?? 0n;
  const claimable = (r(14) as bigint | undefined) ?? 0n;
  const tierCapUnits = tier > 0 ? ((r(14 + tier) as bigint | undefined) ?? 0n) : 0n;
  const feeBps = tier > 0 ? BigInt(Number(r(18 + tier) ?? 0)) : 0n;

  const amountUnits = usd(Number(amount) || 0);
  const feeUnits = (amountUnits * feeBps) / 10_000n;
  const totalUnits = amountUnits + feeUnits;
  const needsApproval = usdcAllowance < totalUnits;

  const stakeUnits = apg(Number(stakeAmount) || 0);
  const needsStakeApproval = apgAllowance < stakeUnits;

  const maxSpendable = useMemo(() => {
    if (tier === 0) return 0n;
    const tierRoom = tierCapUnits > invested ? tierCapUnits - invested : 0n;
    const capRoom = hardCap > raised ? hardCap - raised : 0n;
    const byBalance = feeBps > 0n ? (usdcBal * 10_000n) / (10_000n + feeBps) : usdcBal;
    const m = tierRoom < capRoom ? tierRoom : capRoom;
    return m < byBalance ? m : byBalance;
  }, [tier, tierCapUnits, invested, hardCap, raised, usdcBal, feeBps]);

  const now = Date.now();
  const windowOpen =
    project.startAt !== null &&
    project.endAt !== null &&
    now >= new Date(project.startAt).getTime() &&
    now <= new Date(project.endAt).getTime();

  async function tx(label: string, fn: () => Promise<`0x${string}`>) {
    setBusy(label);
    try {
      const hash = await fn();
      await publicClient?.waitForTransactionReceipt({ hash });
      setLastTx(hash);
      await reads.refetch();
      return true;
    } catch (err) {
      toast.error('Transaction failed', errText(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  /* ── Render states ─────────────────────────────────────────────── */

  if (!cfg) {
    return (
      <p className="mt-5 rounded-xl border border-red/30 bg-red/5 p-4 text-[12px] text-muted">
        On-chain infrastructure for chain {chainId} isn’t configured yet
        (ONCHAIN_CONTRACTS). Ask the operator.
      </p>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="mt-5 rounded-xl border border-line bg-panel2 p-5 text-center">
        <p className="text-[12.5px] leading-relaxed text-muted">
          This sale settles <span className="text-gold">on-chain</span>. Connect an EVM wallet
          (MetaMask / Coinbase) to participate.
        </p>
        <button onClick={() => setConnectOpen(true)} className="btn btn-gold mt-3.5 w-full">
          <IconWallet size={15} />
          Connect Wallet
        </button>
      </div>
    );
  }

  if (connectedChain !== chainId) {
    return (
      <div className="mt-5 rounded-xl border border-gold/25 bg-gold/5 p-5 text-center">
        <p className="text-[12.5px] text-muted">
          Wrong network — this sale lives on{' '}
          <span className="text-gold">{ONCHAIN_CHAINS[chainId]?.name ?? `chain ${chainId}`}</span>.
        </p>
        <button
          className="btn btn-gold mt-3.5 w-full"
          disabled={busy !== null}
          onClick={() =>
            switchChainAsync({ chainId }).catch((err) => toast.error('Switch failed', errText(err)))
          }
        >
          Switch network
        </button>
      </div>
    );
  }

  const txLink = lastTx && explorerTx(chainId, lastTx);
  const successBanner = lastTx && (
    <p className="num mt-2 break-all text-center text-[10px] text-faint">
      tx {truncAddr(lastTx, 10, 8)}{' '}
      {txLink && (
        <a href={txLink} target="_blank" rel="noreferrer noopener" className="text-gold hover:underline">
          view ↗
        </a>
      )}
    </p>
  );

  /* Post-sale: claim or refund. */
  if (finalized) {
    return (
      <div className="mt-5 rounded-xl border border-line bg-panel2 p-5">
        {succeeded ? (
          <>
            <div className="kv !py-2">
              <span className="k text-[11.5px]">Your allocation</span>
              <span className="num text-[11.5px] text-ivory">
                {fmtNum2(Number(tokensOwed / (E18 / 100n)) / 100)} {project.ticker}
              </span>
            </div>
            <div className="kv !py-2">
              <span className="k text-[11.5px]">Claimable now</span>
              <span className="num text-[11.5px] text-mint">
                {fmtNum2(Number(claimable / (E18 / 100n)) / 100)}
              </span>
            </div>
            <button
              className="btn btn-gold mt-3 w-full"
              disabled={claimable === 0n || busy !== null}
              onClick={() =>
                void tx('claim', () =>
                  writeContractAsync({ address: sale, abi: SALE_ABI, functionName: 'claim', chainId }),
                ).then((ok) => ok && toast.success('Claimed on-chain'))
              }
            >
              {busy === 'claim' ? <span className="spinner" /> : 'Claim tokens'}
            </button>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-muted">
              The sale missed its soft cap — refunds are open ({fmtUsd(toDollars(invested))}{' '}
              contributed).
            </p>
            <button
              className="btn btn-gold mt-3 w-full"
              disabled={invested === 0n || busy !== null}
              onClick={() =>
                void tx('refund', () =>
                  writeContractAsync({ address: sale, abi: SALE_ABI, functionName: 'refund', chainId }),
                ).then((ok) => ok && toast.success('Refunded in full'))
              }
            >
              {busy === 'refund' ? <span className="spinner" /> : 'Refund'}
            </button>
          </>
        )}
        {successBanner}
      </div>
    );
  }

  /* No tier: inline on-chain staking. */
  if (tier === 0) {
    return (
      <div className="mt-5 rounded-xl border border-gold/25 bg-gold/5 p-5">
        <div className="label !text-gold">Tier required · on-chain</div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Stake at least <span className="num text-ivory">1,000 APG</span> in the staking
          contract. Wallet balance: <span className="num text-ivory">{fmtNum2(Number(apgBal / E18))}</span> APG
        </p>
        <div className="input-wrap mt-3">
          <input
            type="number"
            inputMode="decimal"
            placeholder="1000"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            aria-label="APG amount to stake"
            disabled={busy !== null}
          />
          <button className="max-btn" onClick={() => setStakeAmount(String(Number(apgBal / E18)))}>
            MAX
          </button>
        </div>
        <button
          className="btn btn-gold mt-3 w-full"
          disabled={stakeUnits === 0n || stakeUnits > apgBal || busy !== null}
          onClick={() => {
            if (needsStakeApproval) {
              void tx('approve-apg', () =>
                writeContractAsync({
                  address: apgAddr!, abi: ERC20_ABI, functionName: 'approve',
                  args: [staking!, stakeUnits], chainId,
                }),
              );
            } else {
              void tx('stake', () =>
                writeContractAsync({
                  address: staking!, abi: STAKING_ABI, functionName: 'stake',
                  args: [stakeUnits], chainId,
                }),
              ).then((ok) => ok && toast.success('Staked on-chain'));
            }
          }}
        >
          {busy ? <span className="spinner" /> : needsStakeApproval ? 'Approve APG' : 'Stake APG'}
        </button>
        {successBanner}
      </div>
    );
  }

  /* Live buy flow. */
  const validation = !amount
    ? null
    : amountUnits < minBuy
      ? `Minimum buy is ${fmtUsd(toDollars(minBuy))}`
      : invested + amountUnits > tierCapUnits
        ? `Your ${TIER_NAMES[tier]} cap has ${fmtUsd(toDollars(tierCapUnits - invested))} left`
        : raised + amountUnits > hardCap
          ? `Only ${fmtUsd(toDollars(hardCap - raised))} left before hard cap`
          : totalUnits > usdcBal
            ? 'Insufficient USDC balance'
            : null;

  const canSubmit = windowOpen && funded && !!amount && !validation && busy === null;

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Amount · USDC (on-chain)</span>
        <span className="num text-[10.5px] text-faint">Balance {fmtUsd(toDollars(usdcBal))}</span>
      </div>
      <div className="input-wrap">
        <input
          type="number"
          inputMode="decimal"
          placeholder={`Min ${fmtUsd(toDollars(minBuy))}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Amount in USDC"
          disabled={busy !== null}
        />
        <button className="max-btn" onClick={() => setAmount(String(Math.floor(toDollars(maxSpendable))))}>
          MAX
        </button>
      </div>
      {validation && <p className="mt-2 text-[11.5px] text-red">{validation}</p>}
      {!funded && (
        <p className="mt-2 text-[11.5px] text-red">Sale tokens not escrowed yet — buys open once funded.</p>
      )}

      <div className="mt-3 border-t border-line pt-1">
        <div className="kv !py-2">
          <span className="k text-[11.5px]">
            Your tier · <span className="text-gold">{TIER_NAMES[tier]}</span>
            <span className="num text-faint"> ({fmtNum2(Number(stakedApg / E18))} APG)</span>
          </span>
          <span className="num text-[11.5px]">
            {fmtUsd(toDollars(invested))} / {fmtUsd(toDollars(tierCapUnits))}
          </span>
        </div>
        <div className="kv !py-2">
          <span className="k text-[11.5px]">Fee ({Number(feeBps) / 100}%)</span>
          <span className="num text-[11.5px]">{amountUnits > 0n ? fmtUsdCents(toDollars(feeUnits)) : '—'}</span>
        </div>
        <div className="kv !py-2">
          <span className="k text-[11.5px]">Settlement</span>
          <span className="num flex items-center gap-1 text-[11.5px] text-mint">
            <IconCheck size={11} />
            {ONCHAIN_CHAINS[chainId]?.name ?? `Chain ${chainId}`}
          </span>
        </div>
      </div>

      <button
        className="btn btn-gold mt-3 w-full !py-3"
        disabled={!canSubmit}
        onClick={() => {
          if (needsApproval) {
            void tx('approve', () =>
              writeContractAsync({
                address: usdcAddr!, abi: ERC20_ABI, functionName: 'approve',
                args: [sale, totalUnits], chainId,
              }),
            );
          } else {
            void tx('buy', () =>
              writeContractAsync({
                address: sale, abi: SALE_ABI, functionName: 'buy',
                args: [amountUnits], chainId,
              }),
            ).then((ok) => {
              if (ok) {
                toast.success('Allocation secured on-chain', `${fmtUsd(toDollars(amountUnits))} in ${project.ticker}`);
                setAmount('');
              }
            });
          }
        }}
      >
        {busy ? (
          <>
            <span className="spinner" />
            {busy === 'approve' ? 'Approving…' : 'Confirming…'}
          </>
        ) : !amount ? (
          'Enter an amount'
        ) : needsApproval ? (
          `Approve ${fmtUsdCents(toDollars(totalUnits))} USDC`
        ) : (
          `Buy ${fmtUsd(Number(amount) || 0)} of ${project.ticker}`
        )}
      </button>
      {successBanner}
    </div>
  );
}

export default function OnchainBuyPanel({ project }: { project: Project }) {
  /* Preload the shared wallet stack so the connect modal + bridge exist. */
  const requestWalletStack = useUi((s) => s.requestWalletStack);
  useEffect(() => {
    requestWalletStack();
  }, [requestWalletStack]);

  if (!project.chainId || !project.saleContract) {
    return (
      <p className="mt-5 rounded-xl border border-red/30 bg-red/5 p-4 text-[12px] text-muted">
        This on-chain sale is missing its contract configuration.
      </p>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Inner project={project} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
