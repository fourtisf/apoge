# Apogee — Multi-chain IDO Launchpad

Production implementation of the approved Apogee prototype: a launchpad for token sales on
**Solana, Ethereum, Base and BNB**, with tiered access driven by staked APG.

```
apps/web         React 18 + Vite + TypeScript + Tailwind (the product UI)
apps/api         Express + TypeScript + Mongoose + socket.io (REST + realtime)
packages/shared  Types, tier logic, vesting math, formatters, seed data (shared FE/BE)
docs/            API contract
```

## How the systems link (the core UX)

Staked APG determines **tier** → tier determines **max buy + fee** in the sale panel →
buying **reduces the USDC balance** in the sidebar, **creates a Portfolio position**, and
**pushes an entry into the live activity feed** (socket broadcast, all open tabs update).

| Tier | Stake | Allocation | Max buy | Fee |
|------|-------|------------|---------|-----|
| IGNITION | 1,000 APG | Lottery | $250 | 1% |
| ORBIT | 10,000 APG | 1× | $1,250 | 1% |
| ZENITH | 50,000 APG | 4× | $5,000 | 0.5% |
| APOGEE | 250,000 APG | 12× | $15,000 | 0% |

**Phase 1 is off-chain accounting**: wallets are used for identity (sign-message nonce auth →
short-lived JWT); balances, buys, stakes and claims are tracked in MongoDB. `SaleService`,
`StakingService` and `VestingService` in `apps/api/src/services/` are the seams where Phase 3
on-chain contracts will be swapped in without touching the UI.

## Quick start

Requires Node ≥ 20.

```bash
npm install
npm run seed    # loads the 9 launch projects + recent activity
npm run dev     # api on :4000, web on :5173 (proxied /api + /socket.io)
```

No MongoDB? Leave `MONGO_URI` unset — the API boots an in-memory MongoDB
(`mongodb-memory-server`) and auto-seeds, so the two commands above are all you need.
First run downloads a mongod binary (~100 MB, cached in `.mongodb-binaries/`).

Open http://localhost:5173. In local dev a **Demo wallet** appears in the connect modal so
you can drive the full flow (stake → tier → buy → claim) without a browser extension.
Real Phantom / MetaMask / Coinbase connections work the same way — connect, sign the
nonce message, done.

## Environment

Copy `.env.example` to `.env` at the repo root:

| Var | Purpose |
|-----|---------|
| `MONGO_URI` | MongoDB Atlas connection string (unset = in-memory dev DB) |
| `PORT` | API port (default 4000) |
| `JWT_SECRET` | Session token signing secret — set a real one in production |
| `DEMO_MODE` | `1` allows the demo-wallet signature bypass. **Must be `0` in production** |
| `RPC_SOLANA/ETH/BASE/BNB` | RPC endpoints (Phase 1: reserved for balance reads) |
| `VITE_WALLETCONNECT_PROJECT_ID` | Enables the WalletConnect option (cloud.walletconnect.com) |
| `VITE_DEMO_WALLET` | `1` shows the demo wallet in the connect modal |

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | API (tsx watch) + web (Vite) concurrently |
| `npm run seed` | Wipe + reload projects and activity events |
| `npm run build` | Typecheck API + typecheck & bundle web to `apps/web/dist` |
| `npm run typecheck` | All workspaces |
| `npm run start:api` | Run the API (used under PM2) |

## API

See [`docs/api-contract.md`](docs/api-contract.md) for every endpoint, error code and
socket event. Highlights:

- `GET /api/projects?status=&chain=` · `GET /api/projects/:slug` · `GET /api/stats` · `GET /api/activity`
- `GET /api/auth/nonce` → sign → `POST /api/auth/verify` → JWT (required for all mutations)
- `POST /api/sales/:slug/participate` — validates min $50, tier max, live window, hard cap,
  balance **server-side**; emits `sale:progress` + `activity:new` to every socket
- `POST /api/staking/stake|unstake` · `GET /api/portfolio/:wallet` · `POST /api/positions/:id/claim`
- All POST routes rate-limited; all input Zod-validated. The client is never trusted.

## One-command VPS deploy

On a fresh Ubuntu VPS (as root), with your domain's A record already pointing at the server:

```bash
git clone -b claude/new-session-sragu8 https://github.com/fourtisf/launchpad.git /srv/apogee
cd /srv/apogee && DOMAIN=apoge.fun bash deploy/setup-vps.sh
```

`deploy/setup-vps.sh` installs Node 22 + pm2 + MongoDB + nginx + certbot, retires the previous
pm2 app (with confirmation before deleting its files), builds, seeds, starts the API under pm2,
configures nginx for the domain, and issues the Let's Encrypt cert. Re-running it is safe.

## Deploying manually (Ubuntu VPS · PM2 · Nginx · Cloudflare)

```bash
# 1 · System
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

# 2 · App
git clone <repo> /srv/apogee && cd /srv/apogee
npm install
cp .env.example .env   # set MONGO_URI (Atlas), a strong JWT_SECRET, DEMO_MODE=0
npm run build          # web bundle -> apps/web/dist
npm run seed           # first deploy only

# 3 · API under PM2
pm2 start "npm run start:api" --name apogee-api --cwd /srv/apogee
pm2 save && pm2 startup
```

Nginx (`/etc/nginx/sites-available/apogee`, then `ln -s` into `sites-enabled`, `nginx -s reload`):

```nginx
server {
    listen 80;
    server_name apogee.example.com;

    root /srv/apogee/apps/web/dist;
    index index.html;

    # SPA deep links
    location / {
        try_files $uri /index.html;
    }

    # Static assets — long cache, hashed filenames
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # socket.io needs websocket upgrade headers
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Cloudflare: point the DNS record at the VPS (proxied ✅). Set SSL/TLS mode to **Full (strict)**
after installing a cert (`certbot --nginx`). WebSockets are supported on all plans — no extra
config beyond the Nginx upgrade headers above.

Deploy updates:

```bash
cd /srv/apogee && git pull && npm install && npm run build && pm2 restart apogee-api
```

## Admin panel

`/admin` (linked in the footer) manages projects without touching the seed: create/edit/delete
launches, pin the featured hero, set audit-report links, and read "Apply for Launch"
submissions. It's enabled by setting `ADMIN_PASSWORD` in `.env` — the deploy script generates
one on first run and prints it. Deleting a sale that wallets hold positions in is blocked.

## Operations

The deploy script wires these up automatically:

- **Nightly DB backup** — `deploy/backup-mongo.sh` via `/etc/cron.d/apogee-backup`
  (03:15, 7-day retention, restore command documented inside the script).
- **pm2 log rotation** — `pm2-logrotate`, 10 MB per file, 14 files retained.
- **Recommended, one-time manual setup:** an [UptimeRobot](https://uptimerobot.com) monitor on
  `https://apoge.fun/api/health`, and [Sentry](https://sentry.io) if you want error tracking
  (add the SDK to `apps/api/src/index.ts` + `apps/web/src/main.tsx` with your DSN).

## Automatic sale windows & Telegram alerts

Sale statuses flip themselves — `upcoming → live` at `startAt`, `live → ended` at `endAt`
(featured pin cleared) — via a one-minute scheduler in the API; every open browser refreshes
through the `projects:changed` socket event.

Optional Telegram ops alerts (new launch applications, buys ≥ $1,000, sales opening/closing):
create a bot with [@BotFather](https://t.me/BotFather), add it to a private group, find the
chat id via `https://api.telegram.org/bot<TOKEN>/getUpdates`, then set `TELEGRAM_BOT_TOKEN`
and `TELEGRAM_CHAT_ID` in `.env` and restart the API. Unset = silently off.

## Mobile wallets (WalletConnect)

Browser-extension wallets don't exist on phones, so mobile users need WalletConnect:
get a free project id at [cloud.reown.com](https://cloud.reown.com), set
`VITE_WALLETCONNECT_PROJECT_ID` in the root `.env`, rebuild (`npm run build`), and the
WalletConnect option appears in the connect modal automatically.

## Phase roadmap

- **Phase 1 (this repo)** — real wallet connections + signature auth, off-chain accounting,
  realtime raise/activity, full UI.
- **Phase 3** — sale/staking/vesting contracts per chain behind the existing service
  interfaces; `RPC_*` env vars feed live balance reads and gas estimates.
