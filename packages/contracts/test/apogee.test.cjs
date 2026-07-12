const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time, loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');

const E18 = 10n ** 18n;
const USDC = (n) => BigInt(Math.round(n * 1e6)); // dollars → 6-decimal units
const APG = (n) => BigInt(n) * E18;

/* Sale parameters mirroring the product spec (Heliora-like). */
const PRICE = 42_000n; // $0.042 per token, in USDC units per 1e18 tokens
const MIN_BUY = USDC(50);
const SOFT_CAP = USDC(250_000);
const HARD_CAP = USDC(850_000);
const TGE_BPS = 2_000; // 20%
const CLIFF = 30n * 24n * 3600n; // 1 month
const VEST = 180n * 24n * 3600n; // 6 months
const TIER_CAPS = [USDC(250), USDC(1_250), USDC(5_000), USDC(15_000)];
const TIER_FEES = [100, 100, 50, 0]; // bps

describe('Apogee on-chain core', () => {
  async function deployFixture() {
    const [owner, treasury, alice, bob, carol] = await ethers.getSigners();

    const usdc = await (await ethers.getContractFactory('MockUSDC')).deploy();
    const apg = await (await ethers.getContractFactory('APGToken')).deploy(owner.address);
    const staking = await (await ethers.getContractFactory('ApogeeStaking')).deploy(apg.target);

    const now = BigInt(await time.latest());
    const start = now + 3600n;
    const end = start + 72n * 3600n;

    const sale = await (
      await ethers.getContractFactory('ApogeeSale')
    ).deploy(
      {
        payment: usdc.target,
        saleToken: apg.target, // reuse APG as the "project token" in tests
        staking: staking.target,
        treasury: treasury.address,
        price: PRICE,
        minBuy: MIN_BUY,
        softCap: SOFT_CAP,
        hardCap: HARD_CAP,
        start,
        end,
        tgeBps: TGE_BPS,
        cliff: CLIFF,
        vestDuration: VEST,
      },
      TIER_CAPS,
      TIER_FEES,
    );

    // Escrow the full hard cap worth of sale tokens.
    const escrow = (HARD_CAP * E18) / PRICE;
    await apg.approve(sale.target, escrow);
    await sale.fund();

    // Give buyers USDC + APG stakes.
    for (const [user, stakeApg, dollars] of [
      [alice, 60_000, 20_000], // ZENITH
      [bob, 1_000, 5_000], // IGNITION
      [carol, 250_000, 50_000], // APOGEE
    ]) {
      await usdc.mint(user.address, USDC(dollars));
      await usdc.connect(user).approve(sale.target, ethers.MaxUint256);
      await apg.transfer(user.address, APG(stakeApg));
      await apg.connect(user).approve(staking.target, ethers.MaxUint256);
      await staking.connect(user).stake(APG(stakeApg));
    }

    return { owner, treasury, alice, bob, carol, usdc, apg, staking, sale, start, end, escrow };
  }

  /* ── Token ─────────────────────────────────────────────────────── */

  describe('APGToken', () => {
    it('mints the full fixed supply to the treasury and nothing else', async () => {
      const { apg } = await loadFixture(deployFixture);
      expect(await apg.totalSupply()).to.equal(APG(1_000_000_000));
      const hasMint = apg.interface.fragments.some(
        (f) => f.type === 'function' && f.name === 'mint',
      );
      expect(hasMint).to.equal(false); // fixed supply — no mint function exists
    });
  });

  /* ── Staking ───────────────────────────────────────────────────── */

  describe('ApogeeStaking', () => {
    it('maps stake balances to the exact tier ladder', async () => {
      const { staking, apg, owner } = await loadFixture(deployFixture);
      const probe = async (amount) => {
        // fresh wallet per probe
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther('1') });
        if (amount > 0n) {
          await apg.transfer(wallet.address, amount);
          await apg.connect(wallet).approve(staking.target, amount);
          await staking.connect(wallet).stake(amount);
        }
        return staking.tierOf(wallet.address);
      };
      expect(await probe(APG(999))).to.equal(0);
      expect(await probe(APG(1_000))).to.equal(1);
      expect(await probe(APG(10_000))).to.equal(2);
      expect(await probe(APG(49_999))).to.equal(2);
      expect(await probe(APG(50_000))).to.equal(3);
      expect(await probe(APG(250_000))).to.equal(4);
    });

    it('unstake returns tokens and drops the tier immediately', async () => {
      const { staking, apg, alice } = await loadFixture(deployFixture);
      const before = await apg.balanceOf(alice.address);
      await staking.connect(alice).unstake(APG(55_000));
      expect(await apg.balanceOf(alice.address)).to.equal(before + APG(55_000));
      expect(await staking.tierOf(alice.address)).to.equal(1); // 5,000 left → IGNITION
      await expect(staking.connect(alice).unstake(APG(10_000))).to.be.revertedWith(
        'Staking: invalid amount',
      );
    });
  });

  /* ── Sale: buying ──────────────────────────────────────────────── */

  describe('ApogeeSale · buy', () => {
    it('rejects buys outside the window, without a tier, or below min', async () => {
      const { sale, alice, owner, usdc, start } = await loadFixture(deployFixture);
      await expect(sale.connect(alice).buy(USDC(100))).to.be.revertedWith('Sale: not started');
      await time.increaseTo(start + 1n);
      await usdc.mint(owner.address, USDC(1000));
      await usdc.approve(sale.target, ethers.MaxUint256);
      await expect(sale.buy(USDC(100))).to.be.revertedWith('Sale: no tier'); // owner unstaked
      await expect(sale.connect(alice).buy(USDC(49))).to.be.revertedWith('Sale: below min buy');
    });

    it('charges the right per-tier fee and mints the right token amount', async () => {
      const { sale, alice, bob, carol, usdc, start } = await loadFixture(deployFixture);
      await time.increaseTo(start + 1n);

      // ZENITH (0.5%): $1,000 → fee $5, tokens = 1000e6 * 1e18 / 42000
      const before = await usdc.balanceOf(alice.address);
      await expect(sale.connect(alice).buy(USDC(1_000)))
        .to.emit(sale, 'Purchased')
        .withArgs(alice.address, 3, USDC(1_000), USDC(5), (USDC(1_000) * E18) / PRICE, USDC(1_000));
      expect(before - (await usdc.balanceOf(alice.address))).to.equal(USDC(1_005));

      // IGNITION (1%): $250 → fee $2.50
      await sale.connect(bob).buy(USDC(250));
      expect(await sale.feePaidOf(bob.address)).to.equal(USDC(2.5));

      // APOGEE (0%): no fee
      await sale.connect(carol).buy(USDC(15_000));
      expect(await sale.feePaidOf(carol.address)).to.equal(0n);

      expect(await sale.raised()).to.equal(USDC(16_250));
      expect(await sale.participants()).to.equal(3n);
    });

    it('enforces cumulative tier caps and tier at time of purchase', async () => {
      const { sale, bob, staking, apg, start } = await loadFixture(deployFixture);
      await time.increaseTo(start + 1n);
      await sale.connect(bob).buy(USDC(200)); // IGNITION cap $250
      await expect(sale.connect(bob).buy(USDC(51))).to.be.revertedWith('Sale: over tier cap');
      // climbing to ORBIT raises the cap for the SAME wallet
      await apg.transfer(bob.address, APG(9_000)); // top up from treasury (owner)
      await apg.connect(bob).approve(staking.target, APG(9_000));
      await staking.connect(bob).stake(APG(9_000)); // 10,000 total → ORBIT
      await sale.connect(bob).buy(USDC(1_000)); // 1,200 ≤ 1,250 ✓
      await expect(sale.connect(bob).buy(USDC(51))).to.be.revertedWith('Sale: over tier cap');
    });

    it('never exceeds the hard cap and allows early finalize exactly at it', async () => {
      const { sale, usdc, apg, staking, owner, start } = await loadFixture(deployFixture);
      // Build a whale army: 57 APOGEE wallets × $15,000 fills $855k > $850k cap.
      await time.increaseTo(start + 1n);
      let raised = 0n;
      for (let i = 0; i < 57; i++) {
        const w = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: w.address, value: ethers.parseEther('1') });
        await apg.transfer(w.address, APG(250_000));
        await apg.connect(w).approve(staking.target, ethers.MaxUint256);
        await staking.connect(w).stake(APG(250_000));
        await usdc.mint(w.address, USDC(15_000));
        await usdc.connect(w).approve(sale.target, ethers.MaxUint256);
        const room = HARD_CAP - raised;
        if (room === 0n) break;
        const amount = room < USDC(15_000) ? room : USDC(15_000);
        await sale.connect(w).buy(amount);
        raised += amount;
      }
      expect(await sale.raised()).to.equal(HARD_CAP);

      // one more wallet trying even $50 must fail — cap is exact
      const extra = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({ to: extra.address, value: ethers.parseEther('1') });
      await apg.transfer(extra.address, APG(250_000));
      await apg.connect(extra).approve(staking.target, ethers.MaxUint256);
      await staking.connect(extra).stake(APG(250_000));
      await usdc.mint(extra.address, USDC(100));
      await usdc.connect(extra).approve(sale.target, ethers.MaxUint256);
      await expect(sale.connect(extra).buy(USDC(50))).to.be.revertedWith('Sale: over hard cap');

      // hard cap filled → anyone can finalize early, before the window ends
      await expect(sale.finalize()).to.emit(sale, 'Finalized').withArgs(true, HARD_CAP);
    });
  });

  /* ── Sale: settlement ──────────────────────────────────────────── */

  describe('ApogeeSale · success, vesting, claims', () => {
    async function successfulSale() {
      const fx = await loadFixture(deployFixture);
      const { sale, alice, carol, usdc, owner, staking, apg, start, end } = fx;
      await time.increaseTo(start + 1n);
      // Raise past the soft cap: 17 APOGEE wallets × $15k = $255k ≥ $250k
      for (let i = 0; i < 17; i++) {
        const w = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: w.address, value: ethers.parseEther('1') });
        await apg.transfer(w.address, APG(250_000));
        await apg.connect(w).approve(staking.target, ethers.MaxUint256);
        await staking.connect(w).stake(APG(250_000));
        await usdc.mint(w.address, USDC(15_000));
        await usdc.connect(w).approve(sale.target, ethers.MaxUint256);
        await sale.connect(w).buy(USDC(15_000));
      }
      await sale.connect(alice).buy(USDC(4_200)); // 100,000 tokens exactly
      await time.increaseTo(end + 1n);
      await sale.finalize();
      return { ...fx };
    }

    it('claims exactly TGE% at TGE, then vests linearly after the cliff', async () => {
      const { sale, alice, apg } = await successfulSale();
      const tge = BigInt(await time.latest()) + 1000n;
      await sale.setTgeTime(tge);
      const owed = await sale.tokensOf(alice.address); // 100,000e18

      expect(await sale.claimableOf(alice.address)).to.equal(0n); // pre-TGE

      await time.increaseTo(tge + 1n);
      const balBefore = await apg.balanceOf(alice.address);
      await sale.connect(alice).claim();
      expect((await apg.balanceOf(alice.address)) - balBefore).to.equal((owed * 2000n) / 10000n);

      // inside cliff: nothing new
      await time.increaseTo(tge + CLIFF - 10n);
      await expect(sale.connect(alice).claim()).to.be.revertedWith('Sale: nothing to claim');

      // halfway through linear vesting: 20% + 40% = 60%
      await time.increaseTo(tge + CLIFF + VEST / 2n);
      await sale.connect(alice).claim();
      const claimed = await sale.claimedOf(alice.address);
      expect(claimed).to.be.closeTo((owed * 6000n) / 10000n, owed / 10000n);

      // fully vested: everything, and never more than owed
      await time.increaseTo(tge + CLIFF + VEST + 1n);
      await sale.connect(alice).claim();
      expect(await sale.claimedOf(alice.address)).to.equal(owed);
      await expect(sale.connect(alice).claim()).to.be.revertedWith('Sale: nothing to claim');
    });

    it('pays proceeds + fees to the treasury and returns only unsold tokens', async () => {
      const { sale, usdc, apg, treasury, escrow } = await successfulSale();
      const raised = await sale.raised();
      const fees = await sale.feesAccrued();
      await sale.withdrawProceeds();
      expect(await usdc.balanceOf(treasury.address)).to.equal(raised + fees);
      // one-shot, and the on-chain `raised` record survives withdrawal so the
      // indexer keeps mirroring the true total (not 0).
      await expect(sale.withdrawProceeds()).to.be.revertedWith('Sale: already withdrawn');
      expect(await sale.raised()).to.equal(raised);
      expect(await sale.feesAccrued()).to.equal(fees);
      expect(await sale.proceedsWithdrawn()).to.equal(true);

      const sold = await sale.totalTokensSold();
      await sale.withdrawUnsoldTokens();
      expect(await apg.balanceOf(treasury.address)).to.equal(escrow - sold);
      // escrow still covers every outstanding claim
      expect(await apg.balanceOf(sale.target)).to.equal(sold - (await sale.totalClaimed()));
    });

    it('locks settlement functions to the owner', async () => {
      const { sale, alice } = await successfulSale();
      for (const call of [
        sale.connect(alice).setTgeTime(BigInt(await time.latest()) + 100n),
        sale.connect(alice).withdrawProceeds(),
        sale.connect(alice).withdrawUnsoldTokens(),
      ]) {
        await expect(call).to.be.revertedWithCustomError(sale, 'OwnableUnauthorizedAccount');
      }
    });
  });

  describe('ApogeeSale · failure & refunds', () => {
    it('refunds contribution + fee in full when the soft cap is missed', async () => {
      const { sale, alice, usdc, apg, treasury, end, escrow } = await loadFixture(deployFixture);
      await time.increaseTo(BigInt(await sale.start()) + 1n);
      await sale.connect(alice).buy(USDC(1_000)); // fee $5
      await time.increaseTo(end + 1n);
      await sale.finalize();
      expect(await sale.succeeded()).to.equal(false);

      await expect(sale.connect(alice).claim()).to.be.revertedWith('Sale: not successful');

      const before = await usdc.balanceOf(alice.address);
      await sale.connect(alice).refund();
      expect((await usdc.balanceOf(alice.address)) - before).to.equal(USDC(1_005));
      await expect(sale.connect(alice).refund()).to.be.revertedWith('Sale: nothing to refund');

      // owner reclaims the ENTIRE escrow on failure
      await sale.withdrawUnsoldTokens();
      expect(await apg.balanceOf(treasury.address)).to.equal(escrow);
    });

    it('blocks buys until funded and forbids double funding', async () => {
      const [owner, treasury, user] = await ethers.getSigners();
      const usdc = await (await ethers.getContractFactory('MockUSDC')).deploy();
      const apg = await (await ethers.getContractFactory('APGToken')).deploy(owner.address);
      const staking = await (await ethers.getContractFactory('ApogeeStaking')).deploy(apg.target);
      const now = BigInt(await time.latest());
      const sale = await (
        await ethers.getContractFactory('ApogeeSale')
      ).deploy(
        {
          payment: usdc.target, saleToken: apg.target, staking: staking.target,
          treasury: treasury.address, price: PRICE, minBuy: MIN_BUY,
          softCap: SOFT_CAP, hardCap: HARD_CAP, start: now + 10n, end: now + 100n,
          tgeBps: TGE_BPS, cliff: CLIFF, vestDuration: VEST,
        },
        TIER_CAPS, TIER_FEES,
      );
      await time.increaseTo(now + 11n);
      await expect(sale.connect(user).buy(USDC(100))).to.be.revertedWith('Sale: not funded');
      await apg.approve(sale.target, ethers.MaxUint256);
      await sale.fund();
      await expect(sale.fund()).to.be.revertedWith('Sale: already funded');
    });
  });
});
