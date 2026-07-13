import type { ApplicationStatus, Chain } from '@apogee/shared';
import { ApplicationModel } from '../models/Application';

/** Distinct icon glyphs (lucide-style, 24×24 stroke paths) per project. */
const ICON = {
  sparkles: '<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.2L12 20.5l-2.2-6.3L3.5 12l6.3-2.2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 7 19z"/>',
  shield: '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/>',
  bridge: '<path d="M3 12h18M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  bank: '<path d="M3 9l9-5 9 5M5 9v10M19 9v10M9 19v-6M15 19v-6M3 21h18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M20.5 20a5.5 5.5 0 0 0-3.5-5.1"/>',
  wind: '<path d="M3 8h9a2.8 2.8 0 1 0-2.8-2.8M3 12h13a2.8 2.8 0 1 1-2.8 2.8M3 16h8.5a2.4 2.4 0 1 1-2.4 2.4"/>',
  flame: '<path d="M12 2C9 6 8 8 8 11a4 4 0 0 0 8 0c0-2-1-3.6-2.5-5C13 8 12.5 5 12 2z"/>',
  wave: '<path d="M2 10c2.5-3 5-3 7.5 0s5 3 7.5 0M2 15c2.5-3 5-3 7.5 0s5 3 7.5 0"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bolt: '<path d="M13 2L5 13h5l-1 9 8-12h-5z"/>',
} as const;

/** A gradient tile with a centered icon glyph, encoded as an SVG data URL. */
function svgLogo(icon: string, from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="256" height="256" rx="56" fill="url(#g)"/>` +
    `<g transform="translate(64,64) scale(5.333)" fill="none" stroke="#0A0B0E" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">${icon}</g>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

interface SampleApp {
  projectName: string;
  ticker: string;
  chain: Chain;
  website: string;
  contactEmail: string;
  pitch: string;
  raiseTarget: number;
  x: string;
  telegram: string;
  logo: string;
  status: ApplicationStatus;
  devHandle?: string;
  devEmail?: string;
}

const url = (host: string) => ({
  website: `https://${host}`,
  x: `https://x.com/${host.split('.')[0]}`,
  telegram: `https://t.me/${host.split('.')[0]}`,
  contactEmail: `team@${host}`,
});

// Samples seed across `pending` and `rejected` (no pre-approvals) — the
// operator approves the good ones from /admin. Grouped by rough quality.
export const SAMPLE_APPLICATIONS: SampleApp[] = [
  // ── Established projects · pending ────────────────────────────────
  {
    projectName: 'Aurora Finance',
    ticker: 'AURA',
    chain: 'BASE',
    ...url('aurora.finance'),
    pitch:
      'Aurora is a delta-neutral yield protocol on Base that turns idle stablecoins into sustainable, market-neutral returns. Audited by Zellic, live vaults with $6M TVL in beta and a clean 6-month track record.',
    raiseTarget: 420_000,
    logo: svgLogo(ICON.sparkles, '#EAD1A2', '#8A6A3B'),
    status: 'pending',
    devHandle: '@auroradev',
    devEmail: 'dev@aurora.finance',
  },
  {
    projectName: 'Solaris',
    ticker: 'SLR',
    chain: 'SOL',
    ...url('solaris.so'),
    pitch:
      'Solaris is a liquid staking protocol for Solana with instant unstake and MEV-boosted rewards. 40,000 SOL staked in private beta across validators in three regions.',
    raiseTarget: 300_000,
    logo: svgLogo(ICON.sun, '#FDBA74', '#C2410C'),
    status: 'pending',
  },
  {
    projectName: 'NimbusPay',
    ticker: 'NMB',
    chain: 'BASE',
    ...url('nimbuspay.app'),
    pitch:
      'NimbusPay is a stablecoin payments rail for merchants — one-tap checkout, instant settlement and on/off ramps in 20 countries. Processing $2M/month in pilot with 300 merchants.',
    raiseTarget: 500_000,
    logo: svgLogo(ICON.cloud, '#86EFAC', '#15803D'),
    status: 'pending',
    devEmail: 'dev@nimbuspay.app',
  },
  {
    projectName: 'Ironclad',
    ticker: 'CLAD',
    chain: 'ETH',
    ...url('ironclad.xyz'),
    pitch:
      'Ironclad is on-chain coverage for smart-contract risk — parametric payouts, a 4-signer claims committee and $12M in active cover. Audited by OpenZeppelin and Spearbit.',
    raiseTarget: 750_000,
    logo: svgLogo(ICON.shield, '#93C5FD', '#334155'),
    status: 'pending',
    devHandle: '@ironcladdev',
  },

  // ── Growth-stage projects · pending ──────────────────────────────
  {
    projectName: 'Helix Protocol',
    ticker: 'HLX',
    chain: 'ETH',
    ...url('helix.xyz'),
    pitch:
      'Helix is a restaking layer for Ethereum that lets operators secure multiple services with a single stake. Testnet live with 1,200 operators; mainnet targeted for next quarter.',
    raiseTarget: 650_000,
    logo: svgLogo(ICON.layers, '#93C5FD', '#1D4ED8'),
    status: 'pending',
    devHandle: '@helixdev',
  },
  {
    projectName: 'ByteVault',
    ticker: 'BYTE',
    chain: 'BNB',
    ...url('bytevault.io'),
    pitch:
      'ByteVault is decentralized, encrypted storage priced in stablecoins, with erasure-coded redundancy across 40 nodes. Early customers include three NFT platforms pinning metadata.',
    raiseTarget: 180_000,
    logo: svgLogo(ICON.database, '#5EEAD4', '#0F766E'),
    status: 'pending',
  },
  {
    projectName: 'Orbital RWA',
    ticker: 'ORB',
    chain: 'ETH',
    ...url('orbital.capital'),
    pitch:
      'Orbital tokenizes short-dated US treasuries with daily NAV and on-chain redemptions. Custody with a regulated trustee and a legal opinion completed for three jurisdictions.',
    raiseTarget: 1_200_000,
    logo: svgLogo(ICON.bank, '#A5B4FC', '#4338CA'),
    status: 'pending',
    devHandle: '@orbitaldev',
    devEmail: 'dev@orbital.capital',
  },
  {
    projectName: 'Vertex',
    ticker: 'VTX',
    chain: 'SOL',
    ...url('vertex.trade'),
    pitch:
      'Vertex is a high-throughput perps DEX on Solana with cross-margin and up to 20x leverage. Testnet is doing $40M daily notional across 30 markets.',
    raiseTarget: 400_000,
    logo: svgLogo(ICON.chart, '#C4B5FD', '#7C3AED'),
    status: 'pending',
  },
  {
    projectName: 'Lumina',
    ticker: 'LUM',
    chain: 'BASE',
    ...url('lumina.social'),
    pitch:
      'Lumina is a SocialFi network where creators tokenize access and fans earn from engagement. 18,000 wallets and 120,000 posts in closed beta.',
    raiseTarget: 220_000,
    logo: svgLogo(ICON.users, '#F0ABFC', '#A21CAF'),
    status: 'pending',
  },
  {
    projectName: 'Meridian',
    ticker: 'MRD',
    chain: 'BASE',
    ...url('meridian.bridge'),
    pitch:
      'Meridian is a canonical cross-chain bridge with fraud proofs and a 20-minute finality window. Moved $30M in audited testnet volume across four chains.',
    raiseTarget: 600_000,
    logo: svgLogo(ICON.bridge, '#67E8F9', '#0E7490'),
    status: 'pending',
    devHandle: '@meridiandev',
  },

  // ── Weaker submissions (operator will likely reject) ─────────────
  {
    projectName: 'Zephyr',
    ticker: 'ZPH',
    chain: 'SOL',
    ...url('zephyr.fun'),
    pitch:
      'Zephyr is a community memecoin with a wind-themed meta and a rewards mini-game. No product beyond the token and a Telegram community of 5,000 members.',
    raiseTarget: 80_000,
    logo: svgLogo(ICON.wind, '#C4B5FD', '#6D28D9'),
    status: 'rejected',
  },
  {
    projectName: 'Cinder',
    ticker: 'CNDR',
    chain: 'SOL',
    ...url('cinder.gg'),
    pitch:
      'Cinder is a fair-launch memecoin with a burn mechanic and a Discord of 2,000. Anonymous team, no product or roadmap beyond the token.',
    raiseTarget: 50_000,
    logo: svgLogo(ICON.flame, '#FCA5A5', '#B91C1C'),
    status: 'rejected',
  },
  {
    projectName: 'MoonDrift',
    ticker: 'DRIFT',
    chain: 'BNB',
    ...url('moondrift.io'),
    pitch:
      'MoonDrift is a reflection token that rewards holders on every transaction. The contract is an unaudited fork with liquidity locked for only 30 days.',
    raiseTarget: 40_000,
    logo: svgLogo(ICON.wave, '#CBD5E1', '#475569'),
    status: 'rejected',
  },
  {
    projectName: 'QuantumLeap',
    ticker: 'QLEAP',
    chain: 'ETH',
    ...url('quantumleap.ai'),
    pitch:
      'QuantumLeap is an AI-powered, quantum-resistant blockchain for the metaverse. No testnet, no demo, and a $2.5M raise backed by a three-line whitepaper.',
    raiseTarget: 2_500_000,
    logo: svgLogo(ICON.grid, '#D1D5DB', '#4B5563'),
    status: 'rejected',
  },
  {
    projectName: 'GigaChad',
    ticker: 'GIGA',
    chain: 'SOL',
    ...url('gigachad.wtf'),
    pitch:
      'GigaChad is a community meme token. No docs, no team and no utility — just vibes and a Telegram group.',
    raiseTarget: 30_000,
    logo: svgLogo(ICON.bolt, '#FDE68A', '#B45309'),
    status: 'rejected',
  },
];

/**
 * Upsert the sample applications (keyed by projectName so re-runs are
 * idempotent and real submissions are untouched). Timestamps are staggered
 * so the list looks organic. Returns the count.
 */
export async function seedApplications(now = Date.now()): Promise<number> {
  const ops = SAMPLE_APPLICATIONS.map((a, i) => ({
    updateOne: {
      filter: { projectName: a.projectName },
      update: {
        $set: {
          ...a,
          ts: new Date(now - (i + 1) * 3 * 60 * 60 * 1000),
          reviewedAt: a.status === 'pending' ? null : new Date(now - (i + 1) * 2 * 60 * 60 * 1000),
        },
      },
      upsert: true,
    },
  }));
  await ApplicationModel.bulkWrite(ops);
  return SAMPLE_APPLICATIONS.length;
}
