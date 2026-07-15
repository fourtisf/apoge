/*
 * Render the Apoge announcement banners (1200x675, @2x -> 2400x1350 PNG).
 *
 *   CHROME_BIN=/path/to/chrome node docs/banners/make-banners.mjs
 *
 * Needs a headless Chromium/Chrome binary. On the build sandbox it lives
 * under /opt/pw-browsers (see CHROME below). Edit the copy and re-run.
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

const shell = (css, body, url) =>
  `<!doctype html><html><head><meta charset="utf8"><style>${BASE}${css}</style></head><body>
  <div class="glow"></div><div class="frame"></div>
  <div class="topbar"><div class="brand">${MARK}<span class="word">APOGE</span></div><span class="url">${url}</span></div>
  ${body}</body></html>`;

// ── Banner 1 · Apply: centred, a 3-step flow + a gold CTA ──────────────
function applyBanner() {
  const steps = [['1', 'Submit'], ['2', 'Review'], ['3', 'Launch']];
  const stepEls = steps
    .map(([n, t], i) => `${i ? '<span class="arrow">&#8594;</span>' : ''}<span class="step"><span class="n">${n}</span>${t}</span>`)
    .join('');
  const css = `
    .mid{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;padding:0 110px}
    h1{font-size:58px;line-height:1.05;font-weight:700;letter-spacing:-.02em;color:#F3EEE2;margin-top:16px}
    .sub{font-size:21px;line-height:1.5;color:#9aa0a8;margin:20px auto 0;max-width:780px}
    .steps{display:flex;justify-content:center;align-items:center;gap:14px;margin-top:36px}
    .step{display:inline-flex;align-items:center;gap:12px;font-family:'Liberation Mono',monospace;font-size:15px;letter-spacing:.08em;color:#EDE6D6;border:1px solid #2a2e37;background:#15171d;border-radius:999px;padding:12px 22px}
    .n{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:99px;font-size:13px;font-weight:700;color:#0A0B0E;background:linear-gradient(180deg,#EAD1A2,#C9A366)}
    .arrow{color:#C9A366;font-size:22px}
    .cta{display:inline-block;margin-top:38px;font-size:18px;font-weight:700;color:#0A0B0E;background:linear-gradient(180deg,#EAD1A2,#C9A366 60%,#8A6A3B);border-radius:13px;padding:16px 34px;letter-spacing:.01em}`;
  const body = `<div class="mid">
    <div class="kick">Now live &#183; For builders</div>
    <h1>Launch your token on <span class="g">Apoge.</span></h1>
    <p class="sub">Submit once. Our team reviews every application &#8212; and you track your status live, from Pending to Approved.</p>
    <div class="steps">${stepEls}</div>
    <div><span class="cta">Apply for Launch  &#8594;</span></div>
  </div>`;
  return shell(css, body, 'apoge.fun/apply');
}

// ── Banner 2 · Applications: headline + three real status cards ────────
function applicationsBanner() {
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
  const legend = ['pending', 'approved', 'rejected'].map((s) => `<span class="lg"><span class="dot ${s}"></span>${label[s]}</span>`).join('');
  const css = `
    .left{position:absolute;left:72px;top:50%;transform:translateY(-50%);width:530px}
    h1{font-size:50px;line-height:1.06;font-weight:700;letter-spacing:-.02em;color:#F3EEE2;margin-top:16px}
    .sub{font-size:20px;line-height:1.5;color:#9aa0a8;margin-top:18px;max-width:500px}
    .legend{display:flex;gap:10px;margin-top:26px}
    .lg{display:flex;align-items:center;gap:8px;font-family:'Liberation Mono',monospace;font-size:13px;letter-spacing:.06em;color:#9aa0a8;border:1px solid #23262d;border-radius:999px;padding:8px 13px}
    .dot{width:8px;height:8px;border-radius:99px}
    .dot.pending{background:#c9a366}.dot.approved{background:#3dd68c}.dot.rejected{background:#e5484d}
    .cards{position:absolute;right:60px;top:50%;transform:translateY(-50%);width:456px;display:flex;flex-direction:column;gap:16px}
    .card{display:flex;align-items:center;gap:14px;background:#111318;border:1px solid #23262d;border-radius:16px;padding:17px 18px}
    .tile{flex:none}.ci{flex:1;min-width:0}
    .cn{font-size:17px;font-weight:600;color:#EDE6D6}
    .ct{font-family:'Liberation Mono',monospace;font-size:12px;color:#6b7280;margin-left:7px}
    .cm{display:flex;gap:8px;margin-top:8px}
    .cp{font-family:'Liberation Mono',monospace;font-size:11px;letter-spacing:.08em;color:#9aa0a8;border:1px solid #2a2e37;border-radius:999px;padding:4px 10px}
    .cp.gold{color:#ead1a2;border-color:rgba(201,163,102,.35);background:linear-gradient(180deg,rgba(201,163,102,.14),rgba(201,163,102,.05))}
    .badge{font-family:'Liberation Mono',monospace;font-size:12px;letter-spacing:.1em;border-radius:999px;padding:6px 12px;text-transform:uppercase;border:1px solid;white-space:nowrap}
    .badge.approved{color:#3dd68c;border-color:rgba(61,214,140,.32);background:rgba(61,214,140,.09)}
    .badge.pending{color:#c9a366;border-color:rgba(201,163,102,.34);background:rgba(201,163,102,.09)}
    .badge.rejected{color:#e5484d;border-color:rgba(229,72,77,.34);background:rgba(229,72,77,.09)}`;
  const body = `<div class="left"><div class="kick">Transparent review</div>
    <h1>Every application,<br><span class="g">in the open.</span></h1>
    <p class="sub">Every project that applies is public &#8212; you see exactly where each one stands.</p>
    <div class="legend">${legend}</div></div>
    <div class="cards">${cards.map(card).join('')}</div>`;
  return shell(css, body, 'apoge.fun/applications');
}

// ── Banner 3 · Launchpad: headline + a tier ladder on the right ────────
function launchpadBanner() {
  const tiers = [
    ['APOGEE', 'Top allocation', '100%', true],
    ['ZENITH', 'Guaranteed', '72%', false],
    ['ORBIT', 'Guaranteed', '48%', false],
    ['IGNITION', 'Lottery', '26%', false],
  ];
  const row = ([name, meta, w, top]) => `<div class="tier${top ? ' top' : ''}">
    <span class="tname">${name}</span>
    <span class="tbar"><i style="width:${w}"></i></span>
    <span class="tmeta">${meta}</span></div>`;
  const css = `
    .peak{position:absolute;left:-70px;bottom:-160px;opacity:.05}
    .left{position:absolute;left:72px;top:50%;transform:translateY(-50%);width:520px}
    h1{font-size:50px;line-height:1.05;font-weight:700;letter-spacing:-.02em;color:#F3EEE2;margin-top:16px}
    .sub{font-size:20px;line-height:1.5;color:#9aa0a8;margin-top:18px;max-width:470px}
    .tiers{position:absolute;right:64px;top:50%;transform:translateY(-50%);width:456px;display:flex;flex-direction:column;gap:13px}
    .tier{display:flex;align-items:center;gap:18px;background:#111318;border:1px solid #23262d;border-radius:14px;padding:19px 22px}
    .tier.top{border-color:rgba(201,163,102,.42);background:linear-gradient(180deg,rgba(201,163,102,.12),rgba(201,163,102,.03))}
    .tname{width:118px;font-size:17px;font-weight:600;letter-spacing:.08em;color:#c7ccd4}
    .tier.top .tname{color:#F3EEE2}
    .tbar{flex:1;height:8px;border-radius:99px;background:#23262d;overflow:hidden}
    .tbar i{display:block;height:100%;background:linear-gradient(90deg,#8A6A3B,#EAD1A2);border-radius:99px}
    .tmeta{width:118px;text-align:right;font-family:'Liberation Mono',monospace;font-size:12px;letter-spacing:.05em;color:#9aa0a8}
    .tier.top .tmeta{color:#ead1a2}`;
  const body = `<div class="peak"><svg width="520" height="520" viewBox="0 0 32 32"><path d="M16 3 29 27H3L16 3Z" fill="#C9A366"/></svg></div>
    <div class="left"><div class="kick">Multi-chain IDO launchpad</div>
    <h1>Where the next <span class="g">blue chips</span> launch.</h1>
    <p class="sub">Stake APG, unlock your tier, and claim guaranteed allocations across every launch.</p></div>
    <div class="tiers">${tiers.map(row).join('')}</div>`;
  return shell(css, body, 'apoge.fun');
}

// ── Token launch: "$APOGE is live" with a LIVE pill, CA chip + CTAs ────
function tokenLiveBanner() {
  // Bake the real address in at launch:  APG_CA=0x... node make-banners.mjs
  const CA = process.env.APG_CA;
  const caChip = CA
    ? `<div class="ca"><span class="lbl">CA</span>${CA}</div>`
    : `<div class="ca"><span class="lbl">CA</span>Contract address live at apoge.fun/token</div>`;
  const css = `
    .mid{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;padding:0 90px}
    .live{display:inline-flex;align-items:center;gap:11px;font-family:'Liberation Mono',monospace;font-size:15px;letter-spacing:.2em;color:#3dd68c;border:1px solid rgba(61,214,140,.30);background:rgba(61,214,140,.08);border-radius:999px;padding:9px 18px;text-transform:uppercase}
    .live .dot{width:9px;height:9px;border-radius:99px;background:#3dd68c;box-shadow:0 0 0 5px rgba(61,214,140,.16)}
    h1{font-size:80px;line-height:1.0;font-weight:800;letter-spacing:-.03em;color:#F3EEE2;margin-top:22px}
    .sub{font-size:21px;line-height:1.5;color:#9aa0a8;margin:20px auto 0;max-width:720px}
    .ca{display:inline-flex;align-items:center;gap:14px;margin-top:30px;font-family:'Liberation Mono',monospace;font-size:17px;letter-spacing:.03em;color:#EDE6D6;border:1px solid rgba(201,163,102,.35);background:linear-gradient(180deg,rgba(201,163,102,.10),rgba(201,163,102,.03));border-radius:14px;padding:15px 22px}
    .ca .lbl{color:#C9A366;letter-spacing:.16em;font-size:13px}
    .ctas{display:flex;justify-content:center;gap:14px;margin-top:30px}
    .cta{font-size:17px;font-weight:700;color:#0A0B0E;background:linear-gradient(180deg,#EAD1A2,#C9A366 60%,#8A6A3B);border-radius:12px;padding:15px 30px}
    .cta.ghost{color:#EDE6D6;background:none;border:1px solid #2a2e37}
    .chips{display:flex;justify-content:center;gap:12px;margin-top:30px}
    .chip{font-family:'Liberation Mono',monospace;font-size:14px;letter-spacing:.12em;color:#9aa0a8;border:1px solid #2a2e37;border-radius:999px;padding:6px 14px;background:#15171d}`;
  const chips = ['SOL', 'ETH', 'BASE', 'BNB'].map((c) => `<span class="chip">${c}</span>`).join('');
  const body = `<div class="mid">
    <div><span class="live"><span class="dot"></span>Now live</span></div>
    <h1><span class="g">$APOGE</span> is live.</h1>
    <p class="sub">The token that powers every Apoge launch &#8212; stake to unlock your tier and claim guaranteed allocations.</p>
    ${caChip}
    <div class="ctas"><span class="cta">Trade $APOGE  &#8594;</span><span class="cta ghost">Stake now</span></div>
    <div class="chips">${chips}</div>
  </div>`;
  return shell(css, body, 'apoge.fun/token');
}

const JOBS = [
  { name: 'banner-token-live', html: tokenLiveBanner() },
  { name: 'banner-apply', html: applyBanner() },
  { name: 'banner-applications', html: applicationsBanner() },
  { name: 'banner-launchpad', html: launchpadBanner() },
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
