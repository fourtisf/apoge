import type { ApplicationStatus, Chain } from '@apogee/shared';
import { ApplicationModel } from '../models/Application';

/** A small gradient tile + letter, encoded as an SVG data URL (crisp, tiny). */
function svgLogo(letter: string, from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="256" height="256" rx="56" fill="url(#g)"/>` +
    `<text x="128" y="150" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-size="132" font-weight="700" fill="#0A0B0E">${letter}</text></svg>`;
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

const SAMPLES: SampleApp[] = [
  {
    projectName: 'Aurora Finance',
    ticker: 'AURA',
    chain: 'BASE',
    website: 'https://aurora.finance',
    contactEmail: 'team@aurora.finance',
    pitch:
      'Aurora is a delta-neutral yield protocol on Base that turns idle stablecoins into sustainable, market-neutral returns. Audited by Zellic, live vaults with $6M TVL in beta and a clean 6-month track record.',
    raiseTarget: 420_000,
    x: 'https://x.com/aurorafi',
    telegram: 'https://t.me/aurorafi',
    logo: svgLogo('A', '#EAD1A2', '#8A6A3B'),
    status: 'accepted',
    devHandle: '@auroradev',
    devEmail: 'dev@aurora.finance',
  },
  {
    projectName: 'Solaris',
    ticker: 'SLR',
    chain: 'SOL',
    website: 'https://solaris.so',
    contactEmail: 'founders@solaris.so',
    pitch:
      'Solaris is a liquid staking protocol for Solana with instant unstake and MEV-boosted rewards. 40,000 SOL staked in private beta across validators in three regions.',
    raiseTarget: 300_000,
    x: 'https://x.com/solarisso',
    telegram: 'https://t.me/solarisso',
    logo: svgLogo('S', '#FDBA74', '#C2410C'),
    status: 'accepted',
  },
  {
    projectName: 'NimbusPay',
    ticker: 'NMB',
    chain: 'BASE',
    website: 'https://nimbuspay.app',
    contactEmail: 'hello@nimbuspay.app',
    pitch:
      'NimbusPay is a stablecoin payments rail for merchants — one-tap checkout, instant settlement and on/off ramps in 20 countries. Processing $2M/month in pilot with 300 merchants.',
    raiseTarget: 500_000,
    x: 'https://x.com/nimbuspay',
    telegram: 'https://t.me/nimbuspay',
    logo: svgLogo('N', '#86EFAC', '#15803D'),
    status: 'accepted',
    devEmail: 'dev@nimbuspay.app',
  },
  {
    projectName: 'Helix Protocol',
    ticker: 'HLX',
    chain: 'ETH',
    website: 'https://helix.xyz',
    contactEmail: 'team@helix.xyz',
    pitch:
      'Helix is a restaking layer for Ethereum that lets operators secure multiple services with a single stake. Testnet live with 1,200 operators; mainnet targeted for next quarter.',
    raiseTarget: 650_000,
    x: 'https://x.com/helixproto',
    telegram: 'https://t.me/helixproto',
    logo: svgLogo('H', '#93C5FD', '#1D4ED8'),
    status: 'pending',
    devHandle: '@helixdev',
  },
  {
    projectName: 'ByteVault',
    ticker: 'BYTE',
    chain: 'BNB',
    website: 'https://bytevault.io',
    contactEmail: 'team@bytevault.io',
    pitch:
      'ByteVault is decentralized, encrypted storage priced in stablecoins, with erasure-coded redundancy across 40 nodes. Early customers include three NFT platforms pinning metadata.',
    raiseTarget: 180_000,
    x: 'https://x.com/bytevault',
    telegram: 'https://t.me/bytevault',
    logo: svgLogo('B', '#5EEAD4', '#0F766E'),
    status: 'pending',
  },
  {
    projectName: 'Orbital RWA',
    ticker: 'ORB',
    chain: 'ETH',
    website: 'https://orbital.capital',
    contactEmail: 'ir@orbital.capital',
    pitch:
      'Orbital tokenizes short-dated US treasuries with daily NAV and on-chain redemptions. Custody with a regulated trustee and a legal opinion completed for three jurisdictions.',
    raiseTarget: 1_200_000,
    x: 'https://x.com/orbitalrwa',
    telegram: 'https://t.me/orbitalrwa',
    logo: svgLogo('O', '#A5B4FC', '#4338CA'),
    status: 'pending',
    devHandle: '@orbitaldev',
    devEmail: 'dev@orbital.capital',
  },
  {
    projectName: 'Zephyr',
    ticker: 'ZPH',
    chain: 'SOL',
    website: 'https://zephyr.fun',
    contactEmail: 'gm@zephyr.fun',
    pitch:
      'Zephyr is a community memecoin with a wind-themed meta and a rewards mini-game. No product beyond the token and a Telegram community of 5,000 members.',
    raiseTarget: 80_000,
    x: 'https://x.com/zephyrfun',
    telegram: 'https://t.me/zephyrfun',
    logo: svgLogo('Z', '#C4B5FD', '#6D28D9'),
    status: 'rejected',
  },
];

/**
 * Upsert a set of professional-looking sample applications (keyed by
 * projectName so re-runs are idempotent and real submissions are untouched).
 * Timestamps are staggered so the list looks organic. Returns the count.
 */
export async function seedApplications(now = Date.now()): Promise<number> {
  const ops = SAMPLES.map((a, i) => ({
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
  return SAMPLES.length;
}
