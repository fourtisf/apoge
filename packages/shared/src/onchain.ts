/** On-chain settlement (Phase 3) — ABIs and chain metadata shared FE/BE.
 *  Hand-written minimal ABIs so neither app depends on hardhat artifacts. */

export type SettlementMode = 'offchain' | 'onchain';

export interface ChainInfo {
  name: string;
  explorer: string;
  testnet: boolean;
}

/** Chains a sale contract may live on. */
export const ONCHAIN_CHAINS: Record<number, ChainInfo> = {
  1: { name: 'Ethereum', explorer: 'https://etherscan.io', testnet: false },
  8453: { name: 'Base', explorer: 'https://basescan.org', testnet: false },
  56: { name: 'BNB Chain', explorer: 'https://bscscan.com', testnet: false },
  84532: { name: 'Base Sepolia', explorer: 'https://sepolia.basescan.org', testnet: true },
  31337: { name: 'Local Hardhat', explorer: '', testnet: true },
};

export const SALE_ABI = [
  { type: 'function', name: 'raised', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'participants', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'finalized', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'succeeded', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'funded', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'tgeTime', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint64' }] },
  { type: 'function', name: 'minBuy', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'price', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'hardCap', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'investedOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokensOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'claimedOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'claimableOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tierCap', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tierFeeBps', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'buy', stateMutability: 'nonpayable', inputs: [{ name: 'paymentAmount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'refund', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'event',
    name: 'Purchased',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'tier', type: 'uint8', indexed: false },
      { name: 'paymentAmount', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'tokensOut', type: 'uint256', indexed: false },
      { name: 'totalRaised', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const STAKING_ABI = [
  { type: 'function', name: 'stakedOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tierOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'stake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'unstake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

export const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const;

/** Per-chain deployed infrastructure (staking / payment / APG addresses). */
export interface OnchainChainConfig {
  staking: string;
  usdc: string;
  apg: string;
}

export type OnchainConfig = Record<string, OnchainChainConfig>;

/** USDC has 6 decimals on every supported chain. */
export const PAYMENT_DECIMALS = 6;
