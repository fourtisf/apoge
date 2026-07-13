/*
 * Full-lifecycle rehearsal of the Apoge on-chain utility, end to end, on a
 * real EVM (in-process Hardhat network with time-travel). It proves every
 * function a mainnet launch depends on — no faucet, no real funds:
 *
 *   deploy core + sale  →  fund escrow  →  stake (3 tiers)  →  buy
 *     →  finalize (success)  →  set TGE  →  claim at TGE / mid-vest / full
 *     →  withdraw proceeds + unsold
 *   and a second sale:  under soft cap  →  finalize (fail)  →  full refund
 *
 * Run:  npm run demo:lifecycle -w packages/contracts
 * Every check is asserted; it exits non-zero on any mismatch.
 */
const assert = require('node:assert/strict');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-toolbox/network-helpers');

const E18 = 10n ** 18n;
const USDC = (n) => BigInt(Math.round(n * 1e6));
const APG = (n) => BigInt(n) * E18;
const usdStr = (v) => `$${(Number(v) / 1e6).toLocaleString('en-US')}`;
const tokStr = (v) => `${(Number(v) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
let step = 0;
const ok = (msg) => console.log(`  \x1b[32m✔\x1b[0m ${msg}`);
const head = (msg) => console.log(`\n\x1b[1m${++step}. ${msg}\x1b[0m`);

const PRICE = 42_000n; // $0.042
const CAPS = [USDC(250), USDC(1_250), USDC(5_000), USDC(15_000)];
const FEES = [100, 100, 50, 0];

async function deployStack(deployer) {
  const usdc = await (await ethers.getContractFactory('MockUSDC')).deploy();
  const proj = await (await ethers.getContractFactory('APGToken')).deploy(deployer.address); // project token
  const apg = await (await ethers.getContractFactory('APGToken')).deploy(deployer.address); // staking token
  const staking = await (await ethers.getContractFactory('ApogeeStaking')).deploy(apg.target);
  return { usdc, proj, apg, staking };
}

async function makeSale({ usdc, proj, staking }, deployer, { start, end, soft, hard }) {
  const sale = await (
    await ethers.getContractFactory('ApogeeSale')
  ).deploy(
    {
      payment: usdc.target, saleToken: proj.target, staking: staking.target,
      treasury: deployer.address, price: PRICE, minBuy: USDC(50),
      softCap: soft, hardCap: hard, start, end,
      tgeBps: 2_000, cliff: 30 * 24 * 3600, vestDuration: 180 * 24 * 3600,
    },
    CAPS, FEES,
  );
  const escrow = (hard * E18) / PRICE;
  await (await proj.approve(sale.target, escrow)).wait();
  await (await sale.fund()).wait();
  return { sale, escrow };
}

async function fundBuyer({ usdc, apg, staking }, deployer, buyer, stakeApg, dollars) {
  await (await apg.transfer(buyer.address, stakeApg)).wait();
  await (await apg.connect(buyer).approve(staking.target, ethers.MaxUint256)).wait();
  await (await staking.connect(buyer).stake(stakeApg)).wait();
  await (await usdc.mint(buyer.address, USDC(dollars))).wait();
  await (await usdc.connect(buyer).approve(deployer.saleFor, ethers.MaxUint256)).wait();
}

async function main() {
  const [deployer, alice, bob, carol, dave] = await ethers.getSigners();
  console.log('\x1b[1m═══ Apoge on-chain utility · full lifecycle rehearsal ═══\x1b[0m');

  const stack = await deployStack(deployer);
  const { usdc, proj, apg, staking } = stack;

  head('Deploy core + a live sale, escrow the sale tokens');
  const now = await time.latest();
  const { sale, escrow } = await makeSale(stack, deployer, {
    start: now - 10, end: now + 7 * 24 * 3600, soft: USDC(5_000), hard: USDC(50_000),
  });
  assert.equal(await sale.funded(), true);
  ok(`sale funded with ${tokStr(escrow)} project tokens (hardCap/price)`);

  head('Three buyers stake into different tiers and buy');
  // Alice ZENITH (50k), Bob ORBIT (10k), Carol IGNITION (1k)
  for (const [who, stake] of [[alice, APG(50_000)], [bob, APG(10_000)], [carol, APG(1_000)]]) {
    await (await apg.transfer(who.address, stake)).wait();
    await (await apg.connect(who).approve(staking.target, ethers.MaxUint256)).wait();
    await (await staking.connect(who).stake(stake)).wait();
    await (await usdc.mint(who.address, USDC(25_000))).wait();
    await (await usdc.connect(who).approve(sale.target, ethers.MaxUint256)).wait();
  }
  assert.equal(await staking.tierOf(alice.address), 3n);
  assert.equal(await staking.tierOf(bob.address), 2n);
  assert.equal(await staking.tierOf(carol.address), 1n);
  ok('tiers: Alice ZENITH, Bob ORBIT, Carol IGNITION');

  await (await sale.connect(alice).buy(USDC(5_000))).wait(); // ZENITH cap 5000, fee 0.5%
  await (await sale.connect(bob).buy(USDC(1_250))).wait(); // ORBIT cap 1250, fee 1%
  await (await sale.connect(carol).buy(USDC(250))).wait(); // IGNITION cap 250, fee 1%
  const raised = await sale.raised();
  assert.equal(raised, USDC(6_500));
  assert.equal(await sale.participants(), 3n);
  ok(`raised ${usdStr(raised)} from 3 participants (fees on top)`);
  // over-cap must revert (Carol already used her full $250 IGNITION cap)
  await assert.rejects(sale.connect(carol).buy(USDC(50)), /over tier cap/);
  ok('over-tier-cap buy correctly reverts');

  head('Close the sale window and finalize (success — over soft cap)');
  await time.increaseTo((await sale.end()) + 1n);
  await (await sale.finalize()).wait();
  assert.equal(await sale.finalized(), true);
  assert.equal(await sale.succeeded(), true);
  ok('finalized · succeeded = true');

  head('Owner sets TGE; claims follow the 20% + cliff + linear curve');
  const tge = BigInt(await time.latest()) + 100n;
  await (await sale.setTgeTime(tge)).wait();
  const owed = await sale.tokensOf(alice.address);

  assert.equal(await sale.claimableOf(alice.address), 0n); // pre-TGE
  await time.increaseTo(tge + 1n);
  let bal0 = await proj.balanceOf(alice.address);
  await (await sale.connect(alice).claim()).wait();
  const tgeClaim = (await proj.balanceOf(alice.address)) - bal0;
  assert.equal(tgeClaim, (owed * 2000n) / 10000n);
  ok(`Alice claimed ${tokStr(tgeClaim)} at TGE (20% of ${tokStr(owed)})`);

  const CLIFF = 30n * 24n * 3600n;
  const VEST = 180n * 24n * 3600n;
  await time.increaseTo(tge + CLIFF + VEST / 2n); // 20% + 40% = 60%
  await (await sale.connect(alice).claim()).wait();
  const mid = await sale.claimedOf(alice.address);
  assert.ok(mid >= (owed * 5990n) / 10000n && mid <= (owed * 6010n) / 10000n);
  ok(`mid-vesting: total claimed ≈ ${tokStr(mid)} (~60%)`);

  await time.increaseTo(tge + CLIFF + VEST + 1n);
  await (await sale.connect(alice).claim()).wait();
  assert.equal(await sale.claimedOf(alice.address), owed);
  await assert.rejects(sale.connect(alice).claim(), /nothing to claim/);
  ok(`fully vested: Alice has all ${tokStr(owed)}; further claim reverts`);

  head('Owner withdraws proceeds + unsold tokens');
  const before = await usdc.balanceOf(deployer.address);
  const fees = await sale.feesAccrued();
  await (await sale.withdrawProceeds()).wait();
  assert.equal((await usdc.balanceOf(deployer.address)) - before, raised + fees);
  ok(`treasury received ${usdStr(raised + fees)} (raised + fees)`);
  // the review fix: raised is preserved for the indexer, double-withdraw blocked
  assert.equal(await sale.raised(), raised);
  await assert.rejects(sale.withdrawProceeds(), /already withdrawn/);
  ok('raised preserved on-chain · double-withdraw blocked (audit-fix verified)');

  const sold = await sale.totalTokensSold();
  await (await sale.withdrawUnsoldTokens()).wait();
  const stillHeld = await proj.balanceOf(sale.target);
  assert.equal(stillHeld, sold - (await sale.totalClaimed()));
  ok(`unsold returned; escrow still covers outstanding claims (${tokStr(stillHeld)})`);

  head('Failure path: a second sale misses soft cap → full refunds');
  const now2 = await time.latest();
  const { sale: sale2 } = await makeSale(stack, deployer, {
    start: now2 - 10, end: now2 + 3600, soft: USDC(100_000), hard: USDC(200_000),
  });
  await (await apg.transfer(dave.address, APG(10_000))).wait();
  await (await apg.connect(dave).approve(staking.target, ethers.MaxUint256)).wait();
  await (await staking.connect(dave).stake(APG(10_000))).wait();
  await (await usdc.mint(dave.address, USDC(5_000))).wait();
  await (await usdc.connect(dave).approve(sale2.target, ethers.MaxUint256)).wait();
  await (await sale2.connect(dave).buy(USDC(1_000))).wait(); // fee $10
  await time.increaseTo((await sale2.end()) + 1n);
  await (await sale2.finalize()).wait();
  assert.equal(await sale2.succeeded(), false);
  await assert.rejects(sale2.connect(dave).claim(), /not successful/);
  const daveBefore = await usdc.balanceOf(dave.address);
  await (await sale2.connect(dave).refund()).wait();
  assert.equal((await usdc.balanceOf(dave.address)) - daveBefore, USDC(1_010)); // contribution + fee
  ok('soft-cap miss → Dave refunded $1,010 in full (contribution + fee)');

  console.log('\n\x1b[1;32m═══ ALL LIFECYCLE CHECKS PASSED ═══\x1b[0m');
  console.log('Every function a mainnet launch relies on works end to end.');
}

main().catch((e) => { console.error('\n\x1b[31mFAILED:\x1b[0m', e.message); process.exitCode = 1; });
