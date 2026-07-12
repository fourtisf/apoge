/*
 * Phase 3 — deploy the shared on-chain core to ONE chain:
 *   • APGToken        (fixed-supply ERC20, minted to TREASURY_ADDRESS)
 *   • ApogeeStaking   (tier staking, reads APG)
 *
 * Records addresses to deployments/<network>.json and prints the
 * ONCHAIN_CONTRACTS env snippet the API needs. Per-launch sale contracts
 * are deployed separately with deploy-sale.cjs.
 *
 *   # testnet
 *   DEPLOYER_KEY=0x… npx hardhat run scripts/deploy-core.cjs --network baseSepolia
 *
 *   # mainnet (requires the confirmation rail + a completed audit)
 *   DEPLOYER_KEY=0x… TREASURY_ADDRESS=0xSafe… CONFIRM_MAINNET=base \
 *     npx hardhat run scripts/deploy-core.cjs --network base
 */
const { ethers, network } = require('hardhat');
const { assertConfirmed, isMainnet, updateDeployment, readDeployment, line, rule } = require('./lib/io.cjs');

async function main() {
  assertConfirmed(network.name);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No signer — set DEPLOYER_KEY in the repo-root .env');

  // Token supply goes to the treasury. On mainnet this MUST be a multisig.
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  if (!ethers.isAddress(treasury)) throw new Error(`Invalid TREASURY_ADDRESS: ${treasury}`);
  if (isMainnet(network.name) && treasury.toLowerCase() === deployer.address.toLowerCase()) {
    throw new Error('On mainnet, set TREASURY_ADDRESS to a multisig — not the deployer EOA.');
  }

  const existing = readDeployment(network.name);
  if (existing?.apg || existing?.staking) {
    line(`⚠ deployments/${network.name}.json already has core addresses:`);
    line(`   apg:     ${existing.apg ?? '—'}`);
    line(`   staking: ${existing.staking ?? '—'}`);
    line('   Re-running will OVERWRITE the record. Ctrl-C now to abort.');
  }

  rule();
  line(`Network:  ${network.name} (chainId ${(await ethers.provider.getNetwork()).chainId})`);
  line(`Deployer: ${deployer.address}`);
  line(`Treasury: ${treasury}`);
  line(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} (native)`);
  rule();

  line('Deploying APGToken…');
  const apg = await (await ethers.getContractFactory('APGToken')).deploy(treasury);
  await apg.waitForDeployment();
  line(`  APGToken     ${apg.target}`);

  line('Deploying ApogeeStaking…');
  const staking = await (await ethers.getContractFactory('ApogeeStaking')).deploy(apg.target);
  await staking.waitForDeployment();
  line(`  ApogeeStaking ${staking.target}`);

  const record = updateDeployment(network.name, {
    apg: apg.target,
    staking: staking.target,
    treasury,
    deployer: deployer.address,
    coreDeployedAtBlock: await ethers.provider.getBlockNumber(),
  });

  rule();
  line('Saved → deployments/' + network.name + '.json');
  line('');
  line('Add to the API .env (merge with other chains if present):');
  line(
    `ONCHAIN_CONTRACTS={"${record.chainId}":{"staking":"${staking.target}","apg":"${apg.target}","usdc":"<USDC_ADDRESS_ON_${network.name.toUpperCase()}>"}}`,
  );
  line('');
  line('Next: verify (scripts/verify.cjs), seed APG liquidity, then deploy a sale.');
  if (isMainnet(network.name)) {
    line('Then transfer ownership of staking/sales to the multisig (transfer-ownership.cjs).');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
