/* Deploys the full Apogee on-chain core to a TESTNET (default: Base Sepolia)
 * with a mock USDC and a demo sale you can exercise end-to-end.
 *
 *   export DEPLOYER_KEY=0x…           # funded testnet key (never a mainnet key!)
 *   npm run deploy:testnet -w packages/contracts
 */
const { ethers, network } = require('hardhat');

const USDC = (n) => BigInt(Math.round(n * 1e6));

async function main() {
  if (['base', 'mainnet', 'bsc'].includes(network.name)) {
    throw new Error(`Refusing: ${network.name} is a MAINNET. This script is testnet-only.`);
  }
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('Set DEPLOYER_KEY in the root .env');
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const usdc = await (await ethers.getContractFactory('MockUSDC')).deploy();
  await usdc.waitForDeployment();
  console.log(`MockUSDC:      ${usdc.target}`);

  const apg = await (await ethers.getContractFactory('APGToken')).deploy(deployer.address);
  await apg.waitForDeployment();
  console.log(`APGToken:      ${apg.target}`);

  const staking = await (await ethers.getContractFactory('ApogeeStaking')).deploy(apg.target);
  await staking.waitForDeployment();
  console.log(`ApogeeStaking: ${staking.target}`);

  // Demo sale: opens in 10 minutes, runs 3 days, Heliora-like parameters.
  const now = Math.floor(Date.now() / 1000);
  const sale = await (
    await ethers.getContractFactory('ApogeeSale')
  ).deploy(
    {
      payment: usdc.target,
      saleToken: apg.target, // stand-in project token on testnet
      staking: staking.target,
      treasury: deployer.address,
      price: 42_000n, // $0.042
      minBuy: USDC(50),
      softCap: USDC(250_000),
      hardCap: USDC(850_000),
      start: now + 600,
      end: now + 3 * 24 * 3600,
      tgeBps: 2_000,
      cliff: 30 * 24 * 3600,
      vestDuration: 180 * 24 * 3600,
    },
    [USDC(250), USDC(1_250), USDC(5_000), USDC(15_000)],
    [100, 100, 50, 0],
  );
  await sale.waitForDeployment();
  console.log(`ApogeeSale:    ${sale.target}`);

  // Escrow the sale tokens so buys work immediately.
  const escrow = (USDC(850_000) * 10n ** 18n) / 42_000n;
  await (await apg.approve(sale.target, escrow)).wait();
  await (await sale.fund()).wait();
  console.log(`Escrowed ${ethers.formatEther(escrow)} tokens — sale opens in 10 minutes.`);

  console.log('\nTry it:');
  console.log(`  usdc.mint(<you>, 25_000e6)  → test dollars`);
  console.log(`  apg.transfer + staking.stake(1_000e18+) → get a tier`);
  console.log(`  usdc.approve(sale, max) then sale.buy(100e6)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
