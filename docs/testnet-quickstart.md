# Testnet Quickstart — see the on-chain utility working (Base Sepolia)

A ~10-minute dry-run on a **free public testnet**, driven with MetaMask, that
exercises the exact mainnet flow with play money. Run this **on your VPS**
(the deploy needs open network access — the build sandbox blocks RPCs).

Nothing here touches mainnet, and no real funds are involved.

## 0 · A throwaway deploy key (never a real-funds key)

In MetaMask, create a **new account** just for testnet deploys. Copy its
private key (Account → Details → Show private key). Fund it with free Base
Sepolia ETH from a faucet:
- https://www.alchemy.com/faucets/base-sepolia
- or https://docs.base.org/tools/network-faucets

## 1 · Deploy everything with one command

On the VPS:

```bash
cd /srv/apogee
export DEPLOYER_KEY=0xYOUR_TESTNET_KEY      # the throwaway account
npm run deploy:testnet -w packages/contracts
```

`deploy-testnet.cjs` deploys a **MockUSDC** (mintable test dollars), the APG
token, the staking contract, and a demo sale — fully funded and opening in
~10 minutes. It prints all four addresses. Copy them.

## 2 · Point the API at the testnet + list the sale

Add the addresses to `/srv/apogee/.env` (chainId 84532 = Base Sepolia):

```
ONCHAIN_CONTRACTS={"84532":{"staking":"0xSTAKING","apg":"0xAPG","usdc":"0xMOCKUSDC"}}
RPC_BASE_SEPOLIA=https://sepolia.base.org
```

```bash
pm2 restart apogee-api
```

Then in **apoge.fun/admin** → New project (or edit one):
- Settlement: **onchain**
- Sale chain: **Base Sepolia (84532)**
- ApogeeSale contract address: the sale address from step 1
- set the same price/caps/dates you deployed with, status **live**

The topbar pill flips to `$APOGE · LIVE`, the token page shows the real
address, and the indexer starts mirroring the sale.

## 3 · Drive it with MetaMask

1. Add **Base Sepolia** to MetaMask (chainlist.org, or it auto-prompts).
2. **Mint yourself test USDC** — on Base Sepolia's explorer
   (sepolia.basescan.org), open the MockUSDC contract → Write → `mint(yourAddr,
   25000000000)` (25,000 with 6 decimals). Or from the VPS:
   `SALE_CONFIG=… ` isn't needed — just call mint via a small cast/ethers call.
3. Get some **test APG** the same way (the deployer holds the full supply;
   send yourself 60,000e18), then on **apoge.fun/staking** stake it → you hit
   ZENITH.
4. On the sale page: **approve USDC → buy**. Watch the raise bar move live,
   then check **Portfolio** — your on-chain allocation shows up.
5. After the window, anyone can `finalize()`. On success the owner calls
   `setTgeTime()`, then you **claim** as it vests.

That is the complete mainnet experience, on testnet, for free.

## What this proves — and what still gates real mainnet

This dry-run exercises every contract function and the full web flow. Going
to **real mainnet** additionally requires (see `phase-3-golive.md`):
external audit, a multisig owner, legal/KYC, and APG liquidity. Those are
business/security gates, not code — the code is done and rehearsed
(`npm run demo:lifecycle` runs the whole lifecycle with assertions).
