require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: `${__dirname}/../../.env` });

const {
  subtask,
} = require('hardhat/config');
const {
  TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD,
} = require('hardhat/builtin-tasks/task-names');

const SOLC_VERSION = '0.8.24';

/**
 * Use the solc compiler from the npm `solc` package (WASM) instead of
 * downloading a native binary from binaries.soliditylang.org — keeps the
 * build fully reproducible from the npm lockfile and works in restricted
 * networks. The npm dependency is pinned to exactly SOLC_VERSION.
 */
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, _hre, runSuper) => {
  if (args.solcVersion === SOLC_VERSION) {
    return {
      compilerPath: require.resolve('solc/soljson.js'),
      isSolcJs: true,
      version: SOLC_VERSION,
      longVersion: `${SOLC_VERSION} (npm solc/soljson)`,
    };
  }
  return runSuper(args);
});

const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

module.exports = {
  solidity: {
    version: SOLC_VERSION,
    settings: {
      optimizer: { enabled: true, runs: 500 },
      // OZ v5 uses mcopy (Cancun). ETH, Base and BNB mainnets all support it.
      evmVersion: 'cancun',
    },
  },
  networks: {
    // Testnets first — nothing touches mainnet until audits pass.
    baseSepolia: {
      url: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
      accounts,
    },
    sepolia: {
      url: process.env.RPC_SEPOLIA || 'https://ethereum-sepolia-rpc.publicnode.com',
      accounts,
    },
    bscTestnet: {
      url: process.env.RPC_BSC_TESTNET || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts,
    },
    base: { url: process.env.RPC_BASE || 'https://mainnet.base.org', accounts },
    mainnet: { url: process.env.RPC_ETH || 'https://eth.llamarpc.com', accounts },
    bsc: { url: process.env.RPC_BNB || 'https://bsc-dataseed.binance.org', accounts },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
};
