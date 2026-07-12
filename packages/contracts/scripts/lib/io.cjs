/* Shared helpers for the Apoge deployment scripts. */
const fs = require('node:fs');
const path = require('node:path');

const DEPLOYMENTS_DIR = path.join(__dirname, '..', '..', 'deployments');

/** Chains we treat as MAINNET — a deploy here demands an explicit confirmation. */
const MAINNETS = new Set(['base', 'mainnet', 'bsc']);

const CHAIN_IDS = {
  mainnet: 1,
  base: 8453,
  bsc: 56,
  baseSepolia: 84532,
  sepolia: 11155111,
  bscTestnet: 97,
  localhost: 31337,
  hardhat: 31337,
};

function chainIdFor(network) {
  return CHAIN_IDS[network] ?? 0;
}

function isMainnet(network) {
  return MAINNETS.has(network);
}

/**
 * Hard safety rail: a mainnet deploy only proceeds when
 * CONFIRM_MAINNET exactly equals the target network name. Prevents a
 * fat-fingered `--network base` from ever spending real gas by accident.
 */
function assertConfirmed(network) {
  if (!isMainnet(network)) return;
  if (process.env.CONFIRM_MAINNET !== network) {
    throw new Error(
      `Refusing to deploy to MAINNET "${network}" without confirmation.\n` +
        `  Re-run with:  CONFIRM_MAINNET=${network} <command>\n` +
        `  And make sure an external audit is complete (see docs/phase-3-golive.md).`,
    );
  }
}

function deploymentPath(network) {
  return path.join(DEPLOYMENTS_DIR, `${network}.json`);
}

function readDeployment(network) {
  const p = deploymentPath(network);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeDeployment(network, data) {
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  fs.writeFileSync(deploymentPath(network), `${JSON.stringify(data, null, 2)}\n`);
}

/** Merge a patch into deployments/<network>.json, preserving existing keys. */
function updateDeployment(network, patch) {
  const current = readDeployment(network) ?? { network, chainId: chainIdFor(network) };
  const next = { ...current, ...patch, network, chainId: chainIdFor(network) };
  writeDeployment(network, next);
  return next;
}

const line = (s = '') => console.log(s);
const rule = () => line('─'.repeat(60));

module.exports = {
  DEPLOYMENTS_DIR,
  MAINNETS,
  chainIdFor,
  isMainnet,
  assertConfirmed,
  deploymentPath,
  readDeployment,
  writeDeployment,
  updateDeployment,
  line,
  rule,
};
