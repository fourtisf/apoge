/** Chains supported by the launchpad. */
export type Chain = 'SOL' | 'ETH' | 'BASE' | 'BNB';

export type ChainType = 'sol' | 'evm';

export type ProjectStatus = 'live' | 'upcoming' | 'tba' | 'ended';

export interface TokenomicsSlice {
  label: string;
  pct: number;
}

export interface VestingConfig {
  /** Percent of allocation unlocked at TGE. */
  tgePct: number;
  /** Cliff before linear vesting starts, in months. */
  cliffMonths: number;
  /** Linear vesting duration after the cliff, in months. */
  linearMonths: number;
}

export interface ProjectSocials {
  website?: string;
  x?: string;
  discord?: string;
  docs?: string;
}

export interface ProjectLogo {
  /** Single display letter used until real artwork exists. */
  letter: string;
  /** Gradient stops for the letter tile. */
  from: string;
  to: string;
}

export interface Project {
  slug: string;
  name: string;
  ticker: string;
  chain: Chain;
  sector: string;
  status: ProjectStatus;
  description: string;
  about: string;
  highlights: string[];
  logo: ProjectLogo;
  contract: string | null;
  socials: ProjectSocials;
  tokenomics: TokenomicsSlice[];
  vesting: VestingConfig;
  /** Total token supply. */
  supply: number;
  /** Initial market cap, USD. */
  initMcap: number;
  /** Fully diluted valuation, USD. */
  fdv: number;
  /** Listing venue / date copy, e.g. "DEX + CEX · T+2 days". */
  listing: string;
  softCap: number;
  hardCap: number;
  /** Sale price per token, USD. */
  price: number;
  /** ISO timestamps. Null for TBA projects. */
  startAt: string | null;
  endAt: string | null;
  raised: number;
  participants: number;
  audited: boolean;
  kycTeam: boolean;
  /** Link to the published audit report, when available. */
  auditUrl?: string;
  /** Admin-pinned featured launch (falls back to live sale ending soonest). */
  featured?: boolean;
  /** Phase 3: how buys settle. Default 'offchain' (simulated Phase 1). */
  settlement?: 'offchain' | 'onchain';
  /** EVM chain id of the sale contract (onchain settlement only). */
  chainId?: number;
  /** ApogeeSale contract address (onchain settlement only). */
  saleContract?: string;
  /** Post-listing performance — only for ended sales. */
  roi?: number;
  ath?: number;
  cex?: string[];
}

/** Review state of a launch application, set by an operator in /admin. */
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

/** "Apply for launch" submission from a project team. */
export interface ApplicationDTO {
  id: string;
  projectName: string;
  ticker: string;
  chain: Chain;
  website: string;
  contactEmail: string;
  pitch: string;
  /** Target raise, USD. */
  raiseTarget: number;
  /** Project socials (URLs). */
  x?: string;
  telegram?: string;
  /** Uploaded project logo, stored as a data URL (square, resized). */
  logo?: string;
  /** Lead developer's Telegram handle (optional). */
  devHandle?: string;
  devEmail?: string;
  ts: string;
  /** Operator decision — new applications start 'pending'. */
  status: ApplicationStatus;
  /** When an operator last accepted/rejected it (ISO). Absent while pending. */
  reviewedAt?: string;
}

/** Public, PII-free view of an application for the /applications page. */
export interface PublicApplicationDTO {
  id: string;
  projectName: string;
  ticker: string;
  chain: Chain;
  website: string;
  pitch: string;
  raiseTarget: number;
  x?: string;
  telegram?: string;
  /** URL to the logo image endpoint (not the raw data URL). */
  logo?: string;
  status: ApplicationStatus;
  ts: string;
}

export interface Account {
  wallet: string;
  chainType: ChainType;
  /** Off-chain accounted balances (Phase 1). */
  usdcBalance: number;
  apgBalance: number;
  staked: number;
  tierKey: TierKey | null;
}

export interface PositionDTO {
  id: string;
  wallet: string;
  projectSlug: string;
  projectName: string;
  ticker: string;
  chain: Chain;
  logo: ProjectLogo;
  invested: number;
  tokens: number;
  price: number;
  vestedPct: number;
  claimableTokens: number;
  claimedTokens: number;
  txRef: string;
  createdAt: string;
  /** On-chain (Phase 3) position — claims happen on the sale contract, not the API. */
  onchain?: boolean;
  /** Sale contract + chain for on-chain positions (so the UI can link/claim). */
  chainId?: number;
  saleContract?: string;
}

export interface PortfolioSummary {
  invested: number;
  estValue: number;
  claimableUsd: number;
}

export interface ActivityEventDTO {
  id: string;
  /** Truncated for display, e.g. "7xF3…9kQd". */
  wallet: string;
  projectSlug: string;
  projectName: string;
  ticker: string;
  amountUsd: number;
  ts: string;
}

export interface StatsDTO {
  totalRaised: number;
  totalParticipants: number;
  projectsLaunched: number;
  avgRoi: number;
}

/** Leaderboard rows (wallets pre-truncated for display). */
export interface StakerEntry {
  wallet: string;
  staked: number;
  tierKey: TierKey | null;
}

export interface BuyerEntry {
  wallet: string;
  invested: number;
  buys: number;
}

export interface LeaderboardDTO {
  stakers: StakerEntry[];
  buyers: BuyerEntry[];
}

/** Analytics for the Stats page. */
export interface StatsDetailDTO {
  byChain: { chain: Chain; raised: number; projects: number }[];
  endedRoi: { name: string; ticker: string; roi: number; ath?: number }[];
  volumeByDay: { day: string; volume: number; buys: number }[];
  tierDistribution: { tierKey: TierKey; count: number }[];
}

/** Operator announcement. */
export interface AnnouncementDTO {
  id: string;
  title: string;
  body: string;
  tag: 'news' | 'update' | 'alert';
  ts: string;
}

export type TierKey = 'ignition' | 'orbit' | 'zenith' | 'apogee';

export interface Tier {
  key: TierKey;
  name: string;
  /** Minimum staked APG to qualify. */
  minStake: number;
  /** Allocation weight copy, e.g. "Lottery", "1×". */
  multiplier: string;
  /** Max cumulative buy per sale, USD. */
  maxBuyUsd: number;
  /** Participation fee, percent of buy amount. */
  feePct: number;
}

/** Socket.io event payloads. */
export interface SaleProgressEvent {
  slug: string;
  raised: number;
  participants: number;
}

export const SOCKET_EVENTS = {
  activityNew: 'activity:new',
  saleProgress: 'sale:progress',
  /** A sale's status flipped (scheduler or admin) — clients refetch lists. */
  projectsChanged: 'projects:changed',
} as const;

export const CHAIN_META: Record<Chain, { label: string; color: string }> = {
  SOL: { label: 'Solana', color: '#9945FF' },
  ETH: { label: 'Ethereum', color: '#627EEA' },
  BASE: { label: 'Base', color: '#3773F5' },
  BNB: { label: 'BNB Chain', color: '#F0B90B' },
};
