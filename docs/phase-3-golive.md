# Phase 3 — Mainnet Go-Live Checklist

Real funds. Every step is a gate: **do not open the next until the previous is
closed.** The engineering is done and tested; what remains is audit, capital,
legal, and a careful deploy. This file is the runbook.

## 0 · Preconditions (off-chain)

- [ ] **External audit complete.** The three contracts (`APGToken`,
      `ApogeeStaking`, `ApogeeSale` — ~400 lines) reviewed by a reputable firm
      or contest (OtterSec / Zellic / Trail of Bits / Sherlock / Code4rena).
      All High/Critical findings fixed and re-reviewed. Publish the report;
      link it on each sale page (`auditUrl`).
- [ ] The pre-audit adversarial review in this repo has been run and its
      confirmed findings fixed (`npm test -w packages/contracts` green).
- [ ] **Legal**: entity formed, Terms/Privacy/Risk reviewed by counsel (the
      in-app pages are templates), token-sale opinion for target jurisdictions.
- [ ] **KYC + geo-blocking** decided and wired (vendor: Sumsub / Persona /
      Veriff) if your jurisdictions require it.
- [ ] **Multisig ready**: a Safe (2-of-3 or better) that will own the sale
      contracts and hold the APG treasury. Signers' keys on hardware wallets.
- [ ] **Capital ready**: gas, plus the APG for DEX liquidity.

## 1 · Deploy the core (pick Base first — cheap, fast, native USDC)

```bash
cd packages/contracts
# dedicated deploy key with a little ETH on Base
export DEPLOYER_KEY=0x...
export TREASURY_ADDRESS=0xYourSafeMultisig
export CONFIRM_MAINNET=base
npm run deploy:core -w packages/contracts -- --network base
```

- Writes `deployments/base.json` (APG + staking + treasury).
- [ ] Fill in `usdc` in `deployments/base.json` (Base USDC:
      `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
- [ ] Verify: `ETHERSCAN_API_KEY=… npm run verify:core -w packages/contracts -- --network base`

## 2 · APG liquidity + token page

- [ ] Seed an APG/USDC (or APG/ETH) pool on a Base DEX (Aerodrome / Uniswap).
- [ ] Set `ONCHAIN_CONTRACTS` in the API `.env` from `deployments/base.json`:
      `{"8453":{"staking":"0x…","apg":"0x…","usdc":"0x833589…2913"}}`
      then `pm2 restart apogee-api`. The topbar pill flips to `$APOGE · LIVE`
      and the token page shows the real contract address automatically.
- [ ] Announce the CA on X (@Apogefun) and Telegram — **there only, first**.

## 3 · First real sale

```bash
# fill packages/contracts/sales/<slug>.json (copy example.json)
export DEPLOYER_KEY=0x...
export CONFIRM_MAINNET=base
SALE_CONFIG=./sales/<slug>.json npm run deploy:sale -w packages/contracts -- --network base
# then fund escrow from the token holder (FUND=1 to do it in the same run)
```

- [ ] Deploy the sale, `fund()` the escrow (hardCap/price worth of the project token).
- [ ] `npx hardhat verify --network base <saleAddr> ...` (constructor args).
- [ ] Transfer sale ownership to the multisig:
      `NEW_OWNER=0xSafe SALE=0xSale CONFIRM_MAINNET=base npm run transfer:ownership -w packages/contracts -- --network base`
      then **acceptOwnership()** from the Safe.
- [ ] In `/admin`, edit the project → Settlement `onchain`, set `chainId: 8453`
      and `saleContract`. The API indexer mirrors raised/participants live.
- [ ] Smoke-test with a small real buy from a fresh wallet before announcing.

## 4 · During & after the sale

- [ ] Monitor: `pm2 logs`, the indexer, and the sale on the explorer.
- [ ] After close, anyone can `finalize()` (or it auto-finalizes at hard cap).
- [ ] Success → multisig calls `setTgeTime()` at TGE, then `withdrawProceeds()`
      and `withdrawUnsoldTokens()`. Users claim from the portfolio as it vests.
- [ ] Failure (soft cap missed) → users `refund()` in full; multisig reclaims
      escrow with `withdrawUnsoldTokens()`.

## 5 · Expand

- [ ] Ethereum mainnet, then BNB (BNB USDC is 18-decimal — generalize the
      6-decimal payment assumption in the contracts/scripts first).
- [ ] Solana needs a separate Anchor/Rust program — treat as its own project.

## Ownership & keys — the rules

- The APG **token** has no owner/mint/pause — nothing to compromise.
- **Staking** has no owner (immutable ladder).
- Each **sale** is `Ownable2Step`; owner only does settlement (TGE, withdrawals).
  Owner MUST be the multisig on mainnet. The deploy scripts refuse an EOA
  treasury on mainnet and gate every mainnet run behind `CONFIRM_MAINNET`.
- Never put a mainnet-funded key in `.env` on a shared box; prefer a hardware
  wallet / dedicated deploy key with minimal balance.
- **Claims depend on the owner calling `setTgeTime()`** — until it's set,
  `vestedBps()` is 0 and no one can claim. It's one-shot and must be `>= now`.
  Set it at (or just before) the real TGE; treat it as a required launch step,
  not an afterthought.

## Pre-audit review note

An in-repo adversarial review was run before this checklist. One issue was
found and fixed: `withdrawProceeds()` used to zero `raised`/`feesAccrued`,
which would have made the off-chain indexer show `$0 raised` after settlement
and erased the on-chain record — it now guards with a `proceedsWithdrawn`
flag and leaves the totals intact. This in-repo pass does **not** replace the
external audit in step 0.
