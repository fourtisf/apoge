# Deployments

One JSON per network, written by the deploy scripts. These files are the
source of truth for the API's `ONCHAIN_CONTRACTS` env and the admin panel's
per-sale `chainId` + `saleContract`. Addresses are public — commit them.

```
{
  "network": "base",
  "chainId": 8453,
  "apg":      "0x…",   // APGToken
  "staking":  "0x…",   // ApogeeStaking
  "usdc":     "0x…",   // canonical USDC on this chain (fill in manually)
  "treasury": "0x…",   // multisig that holds supply + receives proceeds
  "sales": [ { "slug": "heliora", "address": "0x…", "funded": true } ]
}
```

Canonical USDC addresses to paste into `usdc`:
- Base:      `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Ethereum:  `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- BNB Chain: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` (18-decimal — see note)

> Note: BNB-chain USDC is 18 decimals, not 6. The current contracts/scripts
> assume 6-decimal payment. Deploy on Base/Ethereum first; add BNB only after
> generalizing the decimals handling.
