# Apogee Phase 2 → 3 Runbook

The goal: move from simulated (off-chain) money to real on-chain raises **without ever
exposing users to unaudited code**. The smart-contract core is built and fully tested
(`packages/contracts`); this runbook is the ordered path to production.

## What exists now

| Contract | Purpose | Status |
|----------|---------|--------|
| `APGToken` | Fixed-supply 1B APG, ERC20 + Permit, no owner/mint/pause | ✅ built + tested |
| `ApogeeStaking` | Stake/unstake APG; `tierOf()` = the product's exact tier ladder | ✅ built + tested |
| `ApogeeSale` | Per-launch: escrowed tokens, tiered caps/fees, hard/soft cap, early finalize, TGE + cliff + linear vesting, all-or-refund | ✅ built + tested (12 tests) |
| `MockUSDC` | 6-decimal test dollar (testnets only) | ✅ |

Design guarantees worth repeating to auditors: no upgradeability, no pause, no
post-deploy config mutation; sale tokens escrowed up-front for the full hard cap
(claims always solvent); refunds return contribution **plus** fee; CEI + reentrancy
guards + SafeERC20 throughout; fee-on-transfer payment tokens unsupported by design.

## Phase 2 — testnet, compliance, audit (no public funds)

1. **Testnet dry-run** (engineering, ~1 day)
   - Fund a fresh key with Base Sepolia ETH (faucet), set `DEPLOYER_KEY` in root `.env`.
   - `npm run deploy:testnet -w packages/contracts` — deploys mock USDC, APG, staking,
     and a demo sale, fully funded.
   - Exercise every path with real wallets: stake → tier → approve → buy → finalize →
     TGE → claim; plus a failed sale → refund.
2. **Wire the web app to on-chain sales** — ✅ DONE
   - `Project` has `settlement: 'offchain' | 'onchain'` + `saleContract` + `chainId`
     (set per project in `/admin`); both modes coexist.
   - On-chain BuyPanel (lazy chunk): connect EVM wallet → switch network → inline
     APG staking when tier-less → USDC approve → buy → claim/refund after finalize.
   - API `ChainIndexer` polls `Purchased` events (cursor persisted, idempotent via
     a unique dedupe key, 2k-block backfill on first sighting) and mirrors
     raised/participants into Mongo → same sockets/stats as off-chain sales.
   - Infra addresses served from `ONCHAIN_CONTRACTS` env via `GET /api/onchain/config`.
   - Verified end-to-end against a local Hardhat chain: buys from a real wallet
     appeared in the feed exactly once, raise bar mirrored contract state.
3. **KYC + geo-blocking** (operations + engineering)
   - Pick a vendor (Sumsub, Persona, Veriff — all have crypto templates). Gate
     `participate`/`buy` behind a `kycApproved` flag on the account; block restricted
     jurisdictions at Cloudflare + in the UI.
4. **Legal** (operations)
   - Entity formation, reviewed Terms/Privacy/Risk (the current pages are templates),
     token-sale legal opinion for target jurisdictions.
5. **Audit** (external, budget 2–6 weeks)
   - Options: a boutique firm (OtterSec, Zellic, Trail of Bits), an OpenZeppelin audit,
     or a Sherlock/Code4rena contest. Scope: the three contracts (~400 lines total —
     deliberately small).
   - Freeze contract code after the audit; redeploy only what was audited.

## Phase 3 — mainnet go-live gates

Do not pass a gate with the one before it open:

1. ✅ All Phase 2 items complete; audit findings fixed and re-reviewed.
2. Deploy `APGToken` + `ApogeeStaking` to the first chain (recommendation: **Base** —
   cheap, fast, real USDC via Circle). Use a hardware-wallet or multisig owner
   (Safe) for every ownable contract; never a hot key.
3. Seed APG liquidity (DEX pool) and publish the token address everywhere official.
4. First real sale: deploy `ApogeeSale` per launch with the project's real token,
   `fund()` from the project's escrow, list it in the admin panel as `onchain`.
5. Announce with the contract addresses + audit report linked on the sale page
   (`auditUrl` field already exists).
6. Post-launch: `withdrawProceeds` to the treasury multisig; set TGE; monitor claims.
7. Expand chain-by-chain (BNB next, then Ethereum; Solana requires a separate
   Anchor/Rust program — treat it as its own project).

## Costs to expect

- Audit: $10k–$60k (firm) or contest pot; the small surface keeps this at the low end.
- Deployments: negligible on Base/BNB (<$50 total); Ethereum mainnet more.
- KYC: per-verification pricing (~$1–2/user typical).
- Liquidity: business decision — the pool is the real capital requirement.
