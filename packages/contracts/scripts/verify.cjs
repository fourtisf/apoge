/*
 * Phase 3 — verify deployed core contracts on the block explorer.
 * Requires ETHERSCAN_API_KEY (Etherscan v2 multichain key works for Base/BNB too).
 *
 *   ETHERSCAN_API_KEY=… npx hardhat run scripts/verify.cjs --network base
 *
 * Verifies APGToken + ApogeeStaking from deployments/<network>.json.
 * Verify sale contracts individually (their constructor args are complex):
 *   npx hardhat verify --network base <saleAddr> <...constructorArgs>
 */
const { run, network } = require('hardhat');
const { readDeployment, line } = require('./lib/io.cjs');

async function verify(address, args) {
  try {
    await run('verify:verify', { address, constructorArguments: args });
    line(`  verified ${address}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already verified/i.test(msg)) line(`  already verified ${address}`);
    else line(`  ⚠ ${address}: ${msg.split('\n')[0]}`);
  }
}

async function main() {
  const d = readDeployment(network.name);
  if (!d) throw new Error(`No deployments/${network.name}.json`);
  if (d.apg) {
    line('APGToken…');
    await verify(d.apg, [d.treasury]);
  }
  if (d.staking) {
    line('ApogeeStaking…');
    await verify(d.staking, [d.apg]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
