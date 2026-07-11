#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Apogee — one-command VPS deploy (Ubuntu 22.04/24.04, run as root).
#
#   git clone -b claude/new-session-sragu8 https://github.com/fourtisf/launchpad.git /srv/apogee
#   cd /srv/apogee && DOMAIN=apoge.fun bash deploy/setup-vps.sh
#
# What it does, in order:
#   1. Installs base packages, Node 22, pm2, MongoDB, nginx, certbot
#   2. Cleans up the old "parktopia-stats" app (pm2 + files, with confirmation)
#   3. Builds Apogee (web bundle + API), writes .env, seeds the DB
#   4. Starts the API under pm2 (boot-persistent)
#   5. Configures nginx for the domain + issues a Let's Encrypt cert
#   6. Enables pm2 log rotation + nightly MongoDB backups
#
# Re-running is safe: every step is idempotent, and destructive steps ask.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-apoge.fun}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT=4000
OLD_APP="${OLD_APP:-parktopia-stats}"

say()  { echo -e "\n\033[1;33m▸ $*\033[0m"; }
ok()   { echo -e "\033[1;32m✔ $*\033[0m"; }
warn() { echo -e "\033[1;31m! $*\033[0m"; }

[[ $EUID -eq 0 ]] || { warn "Run as root (sudo -i)"; exit 1; }
say "Deploying Apogee from $APP_DIR to https://$DOMAIN"

# ── 1 · Packages ─────────────────────────────────────────────────────
say "Installing base packages (nginx, git, jq, certbot)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx git jq curl gnupg ca-certificates certbot python3-certbot-nginx >/dev/null

if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  say "Installing Node.js 22…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v), npm $(npm -v)"

command -v pm2 >/dev/null || { say "Installing pm2…"; npm install -g pm2 >/dev/null; }

if ! systemctl is-active --quiet mongod; then
  say "Installing MongoDB…"
  . /etc/os-release
  case "${VERSION_CODENAME:-jammy}" in
    noble) MVER=8.0 ;;
    *)     MVER=7.0 ;;
  esac
  curl -fsSL "https://www.mongodb.org/static/pgp/server-$MVER.asc" \
    | gpg --dearmor -o "/usr/share/keyrings/mongodb-$MVER.gpg"
  echo "deb [signed-by=/usr/share/keyrings/mongodb-$MVER.gpg] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/$MVER multiverse" \
    > /etc/apt/sources.list.d/mongodb-org.list
  apt-get update -qq && apt-get install -y -qq mongodb-org >/dev/null
  systemctl enable --now mongod
fi
ok "MongoDB active ($(mongod --version | head -1))"

# ── 2 · Retire the old app (parktopia) ───────────────────────────────
if pm2 describe "$OLD_APP" >/dev/null 2>&1; then
  PARK_DIR="$(pm2 jlist | jq -r --arg n "$OLD_APP" '.[] | select(.name==$n) | .pm2_env.pm_cwd // empty' | head -1)"
  say "Old app '$OLD_APP' found (directory: ${PARK_DIR:-not detected})"
  pm2 delete "$OLD_APP" >/dev/null && pm2 save --force >/dev/null
  ok "pm2: $OLD_APP stopped and removed from the process list"
  if [[ -n "$PARK_DIR" && "$PARK_DIR" == /* && "$PARK_DIR" != "/" && "$PARK_DIR" != "/root" && -d "$PARK_DIR" ]]; then
    echo "Contents of $PARK_DIR:"; ls -la "$PARK_DIR" | head -8
    read -r -p "Permanently delete directory $PARK_DIR ? [y/N] " CONFIRM
    if [[ "${CONFIRM,,}" == "y" ]]; then rm -rf "$PARK_DIR"; ok "Directory deleted"; else warn "Directory kept"; fi
  fi
else
  ok "No '$OLD_APP' app in pm2 — skipping"
fi
# Disable any old nginx sites that mention parktopia
grep -l -i parktopia /etc/nginx/sites-enabled/* 2>/dev/null | while read -r f; do
  rm -f "$f"; warn "Old nginx site disabled: $f"
done || true

# ── 3 · Build + env + seed ───────────────────────────────────────────
cd "$APP_DIR"
say "npm install (full workspace)…"
npm install --no-audit --no-fund >/dev/null

GENERATED_ADMIN_PASSWORD=""
if [[ ! -f .env ]]; then
  say "Writing production .env…"
  GENERATED_ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')"
  cat > .env <<EOF
MONGO_URI=mongodb://127.0.0.1:27017/apogee
PORT=$API_PORT
JWT_SECRET=$(openssl rand -hex 32)
DEMO_MODE=0
ADMIN_PASSWORD=$GENERATED_ADMIN_PASSWORD
PUBLIC_ORIGIN=https://$DOMAIN
RPC_SOLANA=https://api.mainnet-beta.solana.com
RPC_ETH=https://eth.llamarpc.com
RPC_BASE=https://mainnet.base.org
RPC_BNB=https://bsc-dataseed.binance.org
# Telegram ops alerts — fill both to enable (see README):
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHAT_ID=
EOF
  ok ".env created (random JWT_SECRET, DEMO_MODE=0)"
else
  ok ".env already exists — left untouched"
  if ! grep -q '^ADMIN_PASSWORD=' .env; then
    GENERATED_ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')"
    echo "ADMIN_PASSWORD=$GENERATED_ADMIN_PASSWORD" >> .env
    ok "ADMIN_PASSWORD added to .env"
  fi
  grep -q '^PUBLIC_ORIGIN=' .env || echo "PUBLIC_ORIGIN=https://$DOMAIN" >> .env
fi

say "Building web bundle + typechecking API…"
npm run build

if ! mongosh --quiet --eval 'db.getSiblingDB("apogee").projects.countDocuments()' 2>/dev/null | grep -qv '^0$'; then
  say "Seeding database (9 projects + activity)…"
  npm run seed
else
  read -r -p "Database already has projects. Reseed (wipes projects/positions/activity)? [y/N] " RESEED
  [[ "${RESEED,,}" == "y" ]] && npm run seed || ok "Seed skipped"
fi

# ── 4 · API under pm2 ────────────────────────────────────────────────
say "Starting the API under pm2…"
if pm2 describe apogee-api >/dev/null 2>&1; then
  pm2 restart apogee-api --update-env >/dev/null
else
  NODE_ENV=production pm2 start npm --name apogee-api --cwd "$APP_DIR" -- run start:api >/dev/null
fi
pm2 save --force >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
sleep 3
curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null && ok "API healthy on :$API_PORT" \
  || { warn "API not responding — check: pm2 logs apogee-api"; exit 1; }

# ── 5 · nginx + SSL ──────────────────────────────────────────────────
say "Writing nginx config for $DOMAIN…"
cat > "/etc/nginx/sites-available/$DOMAIN" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $APP_DIR/apps/web/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    # Dynamic sitemap served by the API.
    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
    }
}
EOF
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "nginx serving http://$DOMAIN"

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null; ufw allow OpenSSH >/dev/null
  ok "ufw: Nginx Full + OpenSSH allowed"
fi

if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
  say "Issuing Let's Encrypt certificate…"
  read -r -p "Email for Let's Encrypt (leave empty for none): " LE_EMAIL
  if [[ -n "$LE_EMAIL" ]]; then
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect -m "$LE_EMAIL" --agree-tos -n
  else
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --register-unsafely-without-email --agree-tos -n
  fi
  ok "HTTPS enabled"
else
  ok "Certificate already present — skipping certbot"
fi

# ── 6 · Ops: log rotation + nightly backup ───────────────────────────
say "Enabling pm2 log rotation + nightly MongoDB backup…"
pm2 install pm2-logrotate >/dev/null 2>&1 || true
pm2 set pm2-logrotate:max_size 10M >/dev/null 2>&1 || true
pm2 set pm2-logrotate:retain 14 >/dev/null 2>&1 || true

chmod +x "$APP_DIR/deploy/backup-mongo.sh"
cat > /etc/cron.d/apogee-backup <<EOF
# Nightly Apogee MongoDB backup (03:15), 7-day retention.
15 3 * * * root $APP_DIR/deploy/backup-mongo.sh >> /var/log/apogee-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/apogee-backup
ok "Nightly backup 03:15 → /var/backups/apogee (7-day retention)"

echo
ok "DONE → https://$DOMAIN"
echo "  Quick checks:"
echo "    curl -s https://$DOMAIN/api/health"
echo "    pm2 status · pm2 logs apogee-api"
if [[ -n "$GENERATED_ADMIN_PASSWORD" ]]; then
  echo
  echo "  ┌──────────────────────────────────────────────────────────┐"
  echo "    ADMIN PASSWORD (https://$DOMAIN/admin) — save it now:"
  echo "    $GENERATED_ADMIN_PASSWORD"
  echo "  └──────────────────────────────────────────────────────────┘"
fi
echo "  Next updates: cd $APP_DIR && git pull && npm install && npm run build && pm2 restart apogee-api"
