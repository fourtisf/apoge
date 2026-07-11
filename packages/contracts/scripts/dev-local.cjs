/* Local end-to-end fixture: run against `npx hardhat node`, then point the
 * API at chain 31337 to exercise the on-chain indexer + web panel.
 *
 *   npx hardhat node                       # terminal 1
 *   npx hardhat run scripts/dev-local.cjs --network localhost
 *
 * Deploys USDC/APG/staking + a sale that opens in ~15s, and prepares
 * account #1 (hardhat's second default key) as a ZENITH buyer with
 * approvals already in place. Prints machine-readable JSON at the end.
 */
const { ethers } = require('hardhat');

const USDC = (n) => BigInt(Math.round(n * 1e6));
const APG = (n) => BigInt(n) * 10n ** 18n;

async function main() {
  const [deployer, buyer] = await ethers.getSigners();

  const usdc = await (await ethers.getContractFactory('MockUSDC')).deploy();
  const apgToken = await (await ethers.getContractFactory('APGToken')).deploy(deployer.address);
  const staking = await (await ethers.getContractFactory('ApogeeStaking')).deploy(apgToken.target);

  const now = (await ethers.provider.getBlock('latest')).timestamp;
  const sale = await (
    await ethers.getContractFactory('ApogeeSale')
  ).deploy(
    {
      payment: usdc.target,
      saleToken: apgToken.target,
      staking: staking.target,
      treasury: deployer.address,
      price: 42_000n,
      minBuy: USDC(50),
      softCap: USDC(250_000),
      hardCap: USDC(850_000),
      start: now + 15,
      end: now + 30 * 24 * 3600,
      tgeBps: 2_000,
      cliff: 30 * 24 * 3600,
      vestDuration: 180 * 24 * 3600,
    },
    [USDC(250), USDC(1_250), USDC(5_000), USDC(15_000)],
    [100, 100, 50, 0],
  );

  await (await apgToken.approve(sale.target, ethers.MaxUint256)).wait();
  await (await sale.fund()).wait();

  // Buyer: 25k USDC, 60k APG staked (ZENITH), approvals ready.
  await (await usdc.mint(buyer.address, USDC(25_000))).wait();
  await (await apgToken.transfer(buyer.address, APG(60_000))).wait();
  await (await apgToken.connect(buyer).approve(staking.target, ethers.MaxUint256)).wait();
  await (await staking.connect(buyer).stake(APG(60_000))).wait();
  await (await usdc.connect(buyer).approve(sale.target, ethers.MaxUint256)).wait();

  console.log(
    JSON.stringify({
      chainId: 31337,
      usdc: usdc.target,
      apg: apgToken.target,
      staking: staking.target,
      sale: sale.target,
      buyer: buyer.address,
      saleStartsAt: now + 15,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
