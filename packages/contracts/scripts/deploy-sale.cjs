/*
 * Phase 3 — deploy ONE ApogeeSale for a launch, and optionally fund it.
 *
 * Reads a human-readable JSON config (SALE_CONFIG=path) so amounts are
 * entered in dollars/percent/dates and converted here — no hand-computed
 * raw units. `payment` and `staking` are pulled from deployments/<network>.json.
 *
 *   SALE_CONFIG=./sales/heliora.json DEPLOYER_KEY=0x… \
 *     npx hardhat run scripts/deploy-sale.cjs --network baseSepolia
 *
 *   # add FUND=1 to escrow the sale tokens in the same run (deployer must
 *   # hold hardCap/price worth of the sale token and it will be approved)
 *
 * See sales/example.json for the schema.
 */
const fs = require('node:fs');
const path = require('node:path');
const { ethers, network } = require('hardhat');
const { assertConfirmed, readDeployment, updateDeployment, line, rule } = require('./lib/io.cjs');

const PAYMENT_DECIMALS = 6; // USDC on every supported chain

function usd(n) {
  // dollars → 6-decimal payment units, exact integer
  return BigInt(Math.round(Number(n) * 10 ** PAYMENT_DECIMALS));
}
function unixFromIso(iso) {
  const t = Math.floor(new Date(iso).getTime() / 1000);
  if (!Number.isFinite(t)) throw new Error(`Bad date: ${iso}`);
  return BigInt(t);
}

async function main() {
  assertConfirmed(network.name);

  const cfgPath = process.env.SALE_CONFIG;
  if (!cfgPath) throw new Error('Set SALE_CONFIG=path/to/sale.json');
  const cfg = JSON.parse(fs.readFileSync(path.resolve(cfgPath), 'utf8'));

  const core = readDeployment(network.name);
  if (!core?.staking) throw new Error(`No core on ${network.name} — run deploy-core.cjs first`);

  const payment = cfg.payment || core.usdc;
  if (!payment || !ethers.isAddress(payment)) {
    throw new Error('Set "payment" (USDC address) in the sale config or "usdc" in the deployment file');
  }
  const saleToken = cfg.saleToken;
  const treasury = cfg.treasury || core.treasury;
  if (!ethers.isAddress(saleToken)) throw new Error(`Invalid saleToken: ${saleToken}`);
  if (!ethers.isAddress(treasury)) throw new Error(`Invalid treasury: ${treasury}`);

  // price = payment units per 1e18 sale tokens
  const price = usd(cfg.priceUsd);
  if (price <= 0n) throw new Error('priceUsd must be > 0');

  const saleConfig = {
    payment,
    saleToken,
    staking: core.staking,
    treasury,
    price,
    minBuy: usd(cfg.minBuyUsd),
    softCap: usd(cfg.softCapUsd),
    hardCap: usd(cfg.hardCapUsd),
    start: unixFromIso(cfg.startISO),
    end: unixFromIso(cfg.endISO),
    tgeBps: Math.round(cfg.tgePct * 100),
    cliff: BigInt(Math.round((cfg.cliffDays ?? 0) * 24 * 3600)),
    vestDuration: BigInt(Math.round((cfg.vestDays ?? 0) * 24 * 3600)),
  };
  const tierCaps = cfg.tierCapsUsd.map(usd);
  const tierFees = cfg.tierFeesPct.map((p) => Math.round(p * 100));
  if (tierCaps.length !== 4 || tierFees.length !== 4) {
    throw new Error('tierCapsUsd and tierFeesPct must each have 4 entries');
  }

  const [deployer] = await ethers.getSigners();
  rule();
  line(`Sale:     ${cfg.name || cfg.slug || '(unnamed)'} on ${network.name}`);
  line(`Deployer: ${deployer.address}`);
  line(`Payment:  ${payment} (USDC)`);
  line(`Token:    ${saleToken}`);
  line(`Treasury: ${treasury}`);
  line(`Price:    $${cfg.priceUsd}  ·  caps $${cfg.softCapUsd}–$${cfg.hardCapUsd}`);
  line(`Window:   ${cfg.startISO} → ${cfg.endISO}`);
  line(`Vesting:  ${cfg.tgePct}% TGE · ${cfg.cliffDays}d cliff · ${cfg.vestDays}d linear`);
  rule();

  const sale = await (await ethers.getContractFactory('ApogeeSale')).deploy(saleConfig, tierCaps, tierFees);
  await sale.waitForDeployment();
  line(`ApogeeSale ${sale.target}`);

  if (process.env.FUND === '1') {
    const token = await ethers.getContractAt('IERC20', saleToken);
    const required = (saleConfig.hardCap * 10n ** 18n) / price;
    line(`Funding escrow: ${ethers.formatEther(required)} sale tokens…`);
    await (await token.approve(sale.target, required)).wait();
    await (await sale.fund()).wait();
    line('  funded ✓');
  } else {
    line('Not funded yet — run fund() from the token holder before the sale opens.');
  }

  // Record the sale in the deployment file (append to a sales array).
  const core2 = readDeployment(network.name);
  const sales = core2.sales ?? [];
  sales.push({
    slug: cfg.slug,
    name: cfg.name,
    address: sale.target,
    saleToken,
    funded: process.env.FUND === '1',
    deployedAtBlock: await ethers.provider.getBlockNumber(),
  });
  updateDeployment(network.name, { sales });

  rule();
  line('In /admin, edit the project → Settlement: onchain, and set:');
  line(`  chainId:      ${core2.chainId}`);
  line(`  saleContract: ${sale.target}`);
  line('The API ChainIndexer will mirror raised/participants automatically.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
