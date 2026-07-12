# Apogee API Contract

Base path: `/api`. All responses are JSON. Errors use `{ "error": { "code": string, "message": string } }`
with an appropriate HTTP status (400 validation, 401 auth, 403 forbidden, 404 not found, 409 conflict, 429 rate limited).

Authenticated routes require `Authorization: Bearer <jwt>` from the auth flow below.
The JWT payload is `{ wallet, chainType }`, expiry 2 hours.

## Public reads

### `GET /api/projects?status=&chain=`
Both filters optional. `status ∈ live|upcoming|tba|ended`, `chain ∈ SOL|ETH|BASE|BNB`.
→ `{ projects: Project[] }` (shape: `Project` from `@apogee/shared`), sorted live → upcoming → tba → ended,
then by `endAt`/`startAt` ascending.

### `GET /api/projects/:slug`
→ `{ project: Project }` or 404.

### `GET /api/stats`
→ `{ stats: StatsDTO }` — `totalRaised` (sum of `raised`), `totalParticipants` (sum of `participants`),
`projectsLaunched` (count of all projects), `avgRoi` (mean `roi` of ended projects, 1 decimal).

### `GET /api/activity`
→ `{ events: ActivityEventDTO[] }` — latest 20, newest first. `wallet` is pre-truncated for display.

### `GET /api/account/:wallet`
→ `{ account: Account }` — off-chain balances + staked + tierKey. 404 if the wallet has never authenticated.

### `GET /api/portfolio/:wallet`
→ `{ positions: PositionDTO[], summary: PortfolioSummary }`.
`vestedPct`/`claimableTokens` computed at read time via `vestedPctFor` / `claimableTokens` from `@apogee/shared`.
`summary.estValue` = Σ tokens × price × (project.roi ?? 1). `summary.claimableUsd` = Σ claimableTokens × price.
Empty arrays for unknown wallets (not a 404 — the UI shows the empty state).

## Auth (sign-message nonce flow)

### `GET /api/auth/nonce?wallet=<addr>&chainType=<sol|evm>`
→ `{ nonce, message }`. `message` is the exact string the client must sign:

```
Apoge wants you to sign in with your wallet:
{wallet}

Nonce: {nonce}
```

Nonces are single-use, expire after 5 minutes, stored server-side.

### `POST /api/auth/verify` `{ wallet, chainType, signature }`
Verifies the signature over the message for the stored nonce:
- `evm`: `viem` `verifyMessage({ address, message, signature })`
- `sol`: `tweetnacl` `nacl.sign.detached.verify` with base58-decoded pubkey + signature
- If `DEMO_MODE=1` and `signature === "demo"`, verification is skipped (local dev only).

On first verify, creates the User with starting demo balances: `usdcBalance: 25_000`, `apgBalance: 60_000`, stake 0.
→ `{ token, account: Account }`.

## Mutations (JWT required, wallet taken from the token — never from the body)

### `POST /api/sales/:slug/participate` `{ amountUsd }`
Validation order (fail with 400/409 + specific `code`):
1. project exists, `status === 'live'`, `startAt <= now <= endAt` — `SALE_NOT_LIVE`
2. user has a tier (staked ≥ 1,000) — `NO_TIER`
3. `amountUsd >= 50` — `MIN_BUY`
4. cumulative: existing invested in this sale + `amountUsd` ≤ tier `maxBuyUsd` — `TIER_MAX`
5. `raised + amountUsd <= hardCap` — `HARD_CAP`
6. `usdcBalance >= amountUsd + fee` where `fee = feeForBuy(amountUsd, tier)` — `INSUFFICIENT_FUNDS`

Effects (atomic): deduct `amountUsd + fee` from `usdcBalance`; upsert Position for (wallet, project)
adding `invested += amountUsd`, `tokens += amountUsd / price`; increment `project.raised`;
increment `project.participants` only if this is the wallet's first position in the sale;
insert ActivityEvent; generate `txRef` (`APG-` + 10 hex chars).

Emits `sale:progress` `{ slug, raised, participants }` and `activity:new` `ActivityEventDTO` to all sockets.

→ `{ position: PositionDTO, account: Account, sale: { slug, raised, participants } }`

### `POST /api/staking/stake` `{ amount }`
`amount > 0`, `apgBalance >= amount`. Moves wallet APG → stake.
→ `{ account: Account }` (with updated `staked`, `apgBalance`, `tierKey`).

### `POST /api/staking/unstake` `{ amount }`
`amount > 0`, `staked >= amount`. Moves stake → wallet APG.
→ `{ account: Account }`.

### `POST /api/positions/:id/claim`
Position must belong to the JWT wallet; `claimableTokens > 0` — else 400 `NOTHING_TO_CLAIM`.
Adds claimable to `claimedTokens` (Phase 1 book-keeping; Phase 3 will transfer real tokens).
→ `{ position: PositionDTO, claimedTokens: number }`.

## Launch applications & admin

### `POST /api/apply` `{ projectName, ticker, chain, website, contactEmail, pitch }`
Public intake for the "Apply for Launch" form. Zod-validated, 5/min per IP.
→ `{ application: ApplicationDTO }`.

### `POST /api/admin/login` `{ password }`
Compares against `ADMIN_PASSWORD` (timing-safe; 503 `ADMIN_DISABLED` when unset,
10/min per IP). → `{ token }` — a 4h JWT with `role: "admin"`.

### Admin-JWT-guarded (`Authorization: Bearer <admin token>`)
- `GET /api/admin/projects` → `{ projects: Project[] }`
- `POST /api/admin/projects` `{ ...full project }` → 201 `{ project }` (409 `SLUG_TAKEN`)
- `PUT /api/admin/projects/:slug` → `{ project }` — tokenomics must sum to 100
- `DELETE /api/admin/projects/:slug` → 409 `HAS_POSITIONS` if any wallet holds a position
- `GET /api/admin/applications` → `{ applications: ApplicationDTO[] }` (newest first)

### `GET /sitemap.xml`
Dynamic sitemap (core routes + every sale page) built from `PUBLIC_ORIGIN`.
Nginx proxies this path to the API.

## Socket.io

Server namespace `/`, path `/socket.io`. Events broadcast to all clients:
- `activity:new` → `ActivityEventDTO`
- `sale:progress` → `{ slug, raised, participants }`

## Non-functional

- Zod-validate every body/query/param. Never trust client amounts.
- `express-rate-limit` on all POST routes: 30 req/min per IP (participate: 10/min).
- CORS: allow the web origin (dev: Vite proxies, so same-origin; prod: same domain via Nginx).
- If `MONGO_URI` is unset, boot `mongodb-memory-server` and auto-seed so `npm run dev` works standalone.
- Seed script (`npm run seed -w apps/api`): wipes Project/ActivityEvent collections, inserts
  `buildSeedProjects(new Date())` from `@apogee/shared`, and inserts ~12 plausible recent ActivityEvents
  for the live sales (randomized wallets/amounts/timestamps within the last hour).
- Services: `SaleService`, `StakingService`, `VestingService` hold all business logic; routes stay thin.
  Phase 3 swaps their internals for on-chain calls without touching routes or the UI.
