/*
 * Render the Apoge announcement banners (1200×675, @2x → 2400×1350 PNG).
 *
 *   CHROME_BIN=/path/to/chrome node docs/banners/make-banners.mjs
 *
 * Needs a Chromium/Chrome binary (headless). On the build sandbox that is
 * /opt/pw-browsers/chromium-*/chrome-linux/chrome. Edit the copy/text below
 * and re-run to regenerate.
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const CHROME =
  process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MARK = `<svg width="34" height="34" viewBox="0 0 32 32" fill="none" style="display:block">
  <path d="M16 3 29 27H3L16 3Z" fill="url(#m)"/>
  <path d="M16 11 23 24H9L16 11Z" fill="#0A0B0E"/>
  <defs><linearGradient id="m" x1="16" y1="3" x2="16" y2="27" gradientUnits="userSpaceOnUse">
    <stop stop-color="#EAD1A2"/><stop offset="1" stop-color="#8A6A3B"/></linearGradient></defs>
</svg>`;

const chip = (t) =>
  `<span style="font-family:'Liberation Mono',monospace;font-size:15px;letter-spacing:.12em;color:#9aa0a8;border:1px solid #2a2e37;border-radius:999px;padding:7px 15px;background:#15171d">${t}</span>`;

function banner({ kicker, head, gold, tail, sub, chips, url }) {
  return `<!doctype html><html><head><meta charset="utf8"><style>
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:675px;overflow:hidden;font-family:'Liberation Sans','DejaVu Sans',Arial,sans-serif;
    background:#0A0B0E;color:#EDE6D6;position:relative}
  .glow{position:absolute;inset:0;background:
    radial-gradient(1100px 620px at 88% -12%, rgba(201,163,102,.20), transparent 58%),
    radial-gradient(900px 600px at 0% 120%, rgba(201,163,102,.07), transparent 55%)}
  .peak{position:absolute;right:-40px;bottom:-150px;opacity:.045}
  .frame{position:absolute;inset:22px;border:1px solid rgba(201,163,102,.16);border-radius:26px}
  .topbar{position:absolute;top:56px;left:72px;right:72px;display:flex;align-items:center;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:12px}
  .word{font-size:20px;font-weight:600;letter-spacing:.30em;color:#EDE6D6}
  .url{font-family:'Liberation Mono',monospace;font-size:18px;letter-spacing:.06em;color:#C9A366}
  .mid{position:absolute;left:72px;right:72px;top:50%;transform:translateY(-50%)}
  .kick{font-family:'Liberation Mono',monospace;font-size:16px;letter-spacing:.24em;color:#C9A366;text-transform:uppercase}
  h1{font-size:62px;line-height:1.04;font-weight:700;letter-spacing:-.02em;color:#F3EEE2;margin-top:18px;max-width:980px}
  .g{background:linear-gradient(100deg,#EAD1A2,#C9A366 55%,#8A6A3B);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{font-size:22px;line-height:1.5;color:#9aa0a8;max-width:840px;margin-top:22px}
  .chips{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap}
  </style></head><body>
  <div class="glow"></div>
  <div class="peak"><svg width="500" height="500" viewBox="0 0 32 32" fill="none"><path d="M16 3 29 27H3L16 3Z" fill="#C9A366"/></svg></div>
  <div class="frame"></div>
  <div class="topbar">
    <div class="brand">${MARK}<span class="word">APOGE</span></div>
    <span class="url">${url}</span>
  </div>
  <div class="mid">
    <div class="kick">${kicker}</div>
    <h1>${head} <span class="g">${gold}</span>${tail ? ' ' + tail : ''}</h1>
    <p class="sub">${sub}</p>
    <div class="chips">${chips.map(chip).join('')}</div>
  </div>
  </body></html>`;
}

const BANNERS = [
  {
    name: 'banner-apply',
    kicker: 'Now live · For builders',
    head: 'Launch your token on',
    gold: 'Apoge.',
    tail: '',
    sub: 'Submit once — our team reviews every application, and you track your status live from Pending to Approved.',
    chips: ['SOL', 'ETH', 'BASE', 'BNB'],
    url: 'apoge.fun/apply',
  },
  {
    name: 'banner-applications',
    kicker: 'Transparent review',
    head: 'Every application,',
    gold: 'in the open.',
    tail: '',
    sub: 'Pending · Approved · Rejected. See exactly where each project stands in review — no black box.',
    chips: ['LIVE STATUS', 'PUBLIC'],
    url: 'apoge.fun/applications',
  },
  {
    name: 'banner-launchpad',
    kicker: 'Multi-chain IDO launchpad',
    head: 'Where the next',
    gold: 'blue chips',
    tail: 'launch.',
    sub: 'Stake APG, unlock your tier, and claim guaranteed allocations across every launch. Custodial, vested, all-or-refund.',
    chips: ['SOL', 'ETH', 'BASE', 'BNB'],
    url: 'apoge.fun',
  },
];

for (const b of BANNERS) {
  const htmlPath = join(DIR, `${b.name}.html`);
  const pngPath = join(DIR, `${b.name}.png`);
  writeFileSync(htmlPath, banner(b));
  execFileSync(
    CHROME,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--force-device-scale-factor=2',
      '--window-size=1200,675',
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'ignore' },
  );
  console.log(`rendered ${pngPath}`);
}
