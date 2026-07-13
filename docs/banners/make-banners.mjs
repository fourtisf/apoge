/*
 * Render the Apoge announcement banners (1200×675, @2x → 2400×1350 PNG).
 *
 *   CHROME_BIN=/path/to/chrome node docs/banners/make-banners.mjs
 *
 * Needs a Chromium/Chrome binary (headless). On the build sandbox that is
 * under /opt/pw-browsers/chromium-<version>/chrome-linux/chrome. Edit the
 * copy below and re-run.
 */
import { writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ICON = {
  sparkles: '<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.2L12 20.5l-2.2-6.3L3.5 12l6.3-2.2z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  wind: '<path d="M3 8h9a2.8 2.8 0 1 0-2.8-2.8M3 12h13a2.8 2.8 0 1 1-2.8 2.8M3 16h8.5a2.4 2.4 0 1 1-2.4 2.4"/>',
};

const MARK = `<svg width="34" height="34" viewBox="0 0 32 32" fill="none" style="display:block">
  <path d="M16 3 29 27H3L16 3Z" fill="url(#m)"/><path d="M16 11 23 24H9L16 11Z" fill="#0A0B0E"/>
  <defs><linearGradient id="m" x1="16" y1="3" x2="16" y2="27" gradientUnits="userSpaceOnUse">
    <stop stop-color="#EAD1A2"/><stop offset="1" stop-color="#8A6A3B"/></linearGradient></defs></svg>`;

const logoTile = (icon, from, to, n) =>
  `<svg width="48" height="48" viewBox="0 0 48 48" style="display:block"><defs>
    <linearGradient id="G${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
    <rect width="48" height="48" rx="13" fill="url(#G${n})"/>
    <g transform="translate(12,12)" fill="none" stroke="#0A0B0E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9">${icon}</g></svg>`;

const chip = (t) =>
  `<span style="font-family:'Liberation Mono',monospace;font-size:15px;letter-spacing:.12em;color:#9aa0a8;border:1px solid #2a2e37;border-radius:999px;padding:7px 15px;background:#15171d">${t}</span>`;

const BASE = `*{margin:0;box-sizing:border-box}
  body{width:1200px;height:675px;overflow:hidden;font-family:'Liberation Sans','DejaVu Sans',Arial,sans-serif;background:#0A0B0E;color:#EDE6D6;position:relative}
  .glow{position:absolute;inset:0;background:radial-gradient(1100px 620px at 88% -12%,rgba(201,163,102,.20),transparent 58%),radial-gradient(900px 600px at 0% 120%,rgba(201,163,102,.07),transparent 55%)}
  .frame{position:absolute;inset:22px;border:1px solid rgba(201,163,102,.16);border-radius:26px}
  .topbar{position:absolute;top:56px;left:72px;right:72px;display:flex;align-items:center;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:12px}
  .word{font-size:20px;font-weight:600;letter-spacing:.30em;color:#EDE6D6}
  .url{font-family:'Liberation Mono',monospace;font-size:18px;letter-spacing:.06em;color:#C9A366}
  .kick{font-family:'Liberation Mono',monospace;font-size:16px;letter-spacing:.24em;color:#C9A366;text-transform:uppercase}
  .g{background:linear-gradient(100deg,#EAD1A2,#C9A366 55%,#8A6A3B);-webkit-background-clip:text;background-clip:text;color:transparent}`;

// Generic centred banner (headline + sub + chips).
function banner({ kicker, head, gold, tail, sub, chips, url }) {
  return `<!doctype html><html><head><meta charset="utf8"><style>${BASE}
  .peak{position:absolute;right:-40px;bottom:-150px;opacity:.045}
  .mid{position:absolute;left:72px;right:72px;top:50%;transform:translateY(-50%)}
  h1{font-size:62px;line-height:1.04;font-weight:700;letter-spacing:-.02em;color:#F3EEE2;margin-top:18px;max-width:980px}
  .sub{font-size:22px;line-height:1.5;color:#9aa0a8;max-width:840px;margin-top:22px}
  .chips{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap}
  </style></head><body>
  <div class="glow"></div><div class="peak"><svg width="500" height="500" viewBox="0 0 32 32"><path d="M16 3 29 27H3L16 3Z" fill="#C9A366"/></svg></div><div class="frame"></div>
  <div class="topbar"><div class="brand">${MARK}<span class="word">APOGE</span></div><span class="url">${url}</span></div>
  <div class="mid"><div class="kick">${kicker}</div>
    <h1>${head} <span class="g">${gold}</span>${tail ? ' ' + tail : ''}</h1>
    <p class="sub">${sub}</p><div class="chips">${chips.map(chip).join('')}</div></div>
  </body></html>`;
}

// Showcase banner: headline on the left, three real status cards on the right.
function showcase() {
  const cards = [
    { icon: ICON.sparkles, from: '#EAD1A2', to: '#8A6A3B', name: 'Aurora Finance', ticker: 'AURA', chain: 'BASE', raise: '$420K', status: 'approved' },
    { icon: ICON.layers, from: '#93C5FD', to: '#1D4ED8', name: 'Helix Protocol', ticker: 'HLX', chain: 'ETH', raise: '$650K', status: 'pending' },
    { icon: ICON.wind, from: '#C4B5FD', to: '#6D28D9', name: 'Zephyr', ticker: 'ZPH', chain: 'SOL', raise: '$80K', status: 'rejected' },
  ];
  const label = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected' };
  const card = (c, i) => `<div class="card">
    <div class="tile">${logoTile(c.icon, c.from, c.to, i)}</div>
    <div class="ci"><div class="cn">${c.name}<span class="ct">${c.ticker}</span></div>
      <div class="cm"><span class="cp">${c.chain}</span><span class="cp gold">${c.raise}</span></div></div>
    <span class="badge ${c.status}">${label[c.status]}</span></div>`;
  const legend = ['pending', 'approved', 'rejected']
    .map((s) => `<span class="lg"><span class="dot ${s}"></span>${label[s]}</span>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf8"><style>${BASE}
  .left{position:absolute;left:72px;top:50%;transform:translateY(-50%);width:530px}
  h1{font-size:50px;line-height:1.06;font-weight:700;letter-spacing:-.02em;color:#F3EEE2;margin-top:16px}
  .sub{font-size:20px;line-height:1.5;color:#9aa0a8;margin-top:18px;max-width:500px}
  .legend{display:flex;gap:10px;margin-top:26px}
  .lg{display:flex;align-items:center;gap:8px;font-family:'Liberation Mono',monospace;font-size:13px;letter-spacing:.06em;color:#9aa0a8;border:1px solid #23262d;border-radius:999px;padding:8px 13px}
  .dot{width:8px;height:8px;border-radius:99px}
  .dot.pending{background:#c9a366}.dot.approved{background:#3dd68c}.dot.rejected{background:#e5484d}
  .cards{position:absolute;right:60px;top:50%;transform:translateY(-50%);width:456px;display:flex;flex-direction:column;gap:16px}
  .card{display:flex;align-items:center;gap:14px;background:#111318;border:1px solid #23262d;border-radius:16px;padding:17px 18px}
  .tile{flex:none}
  .ci{flex:1;min-width:0}
  .cn{font-size:17px;font-weight:600;color:#EDE6D6}
  .ct{font-family:'Liberation Mono',monospace;font-size:12px;color:#6b7280;margin-left:7px}
  .cm{display:flex;gap:8px;margin-top:8px}
  .cp{font-family:'Liberation Mono',monospace;font-size:11px;letter-spacing:.08em;color:#9aa0a8;border:1px solid #2a2e37;border-radius:999px;padding:4px 10px}
  .cp.gold{color:#ead1a2;border-color:rgba(201,163,102,.35);background:linear-gradient(180deg,rgba(201,163,102,.14),rgba(201,163,102,.05))}
  .badge{font-family:'Liberation Mono',monospace;font-size:12px;letter-spacing:.1em;border-radius:999px;padding:6px 12px;text-transform:uppercase;border:1px solid;white-space:nowrap}
  .badge.approved{color:#3dd68c;border-color:rgba(61,214,140,.32);background:rgba(61,214,140,.09)}
  .badge.pending{color:#c9a366;border-color:rgba(201,163,102,.34);background:rgba(201,163,102,.09)}
  .badge.rejected{color:#e5484d;border-color:rgba(229,72,77,.34);background:rgba(229,72,77,.09)}
  </style></head><body>
  <div class="glow"></div><div class="frame"></div>
  <div class="topbar"><div class="brand">${MARK}<span class="word">APOGE</span></div><span class="url">apoge.fun/applications</span></div>
  <div class="left"><div class="kick">Transparent review</div>
    <h1>Every application,<br><span class="g">in the open.</span></h1>
    <p class="sub">Every project that applies is public — you see exactly where each one stands.</p>
    <div class="legend">${legend}</div></div>
  <div class="cards">${cards.map(card).join('')}</div>
  </body></html>`;
}

const JOBS = [
  {
    name: 'banner-apply',
    html: banner({
      kicker: 'Now live · For builders',
      head: 'Launch your token on',
      gold: 'Apoge.',
      tail: '',
      sub: 'Submit once — our team reviews every application, and you track your status live from Pending to Approved.',
      chips: ['SOL', 'ETH', 'BASE', 'BNB'],
      url: 'apoge.fun/apply',
    }),
  },
  { name: 'banner-applications', html: showcase() },
  {
    name: 'banner-launchpad',
    html: banner({
      kicker: 'Multi-chain IDO launchpad',
      head: 'Where the next',
      gold: 'blue chips',
      tail: 'launch.',
      sub: 'Stake APG, unlock your tier, and claim guaranteed allocations across every launch. Custodial, vested, all-or-refund.',
      chips: ['SOL', 'ETH', 'BASE', 'BNB'],
      url: 'apoge.fun',
    }),
  },
];

for (const j of JOBS) {
  const htmlPath = join(DIR, `${j.name}.html`);
  const pngPath = join(DIR, `${j.name}.png`);
  writeFileSync(htmlPath, j.html);
  execFileSync(
    CHROME,
    ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
      '--force-device-scale-factor=2', '--window-size=1200,675', `--screenshot=${pngPath}`, `file://${htmlPath}`],
    { stdio: 'ignore' },
  );
  rmSync(htmlPath, { force: true });
  console.log(`rendered ${pngPath}`);
}
