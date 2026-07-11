// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IApogeeStaking {
    function tierOf(address user) external view returns (uint8);
}

/// @title Apogee sale — one contract per launch (Phase 3).
/// @notice Tiered IDO with escrowed sale tokens, hard/soft caps, per-tier
///         limits and fees, all-or-refund settlement, and TGE + cliff +
///         linear vesting for claims.
///
/// Lifecycle:
///   deploy → fund() escrows sale tokens for the full hard cap
///   → buys inside [start, end]
///   → finalize() (anyone; early the moment the hard cap fills)
///     → success (raised ≥ softCap): owner setTgeTime → users claim() as it
///       vests; owner withdrawProceeds() + withdrawUnsoldTokens()
///     → failure: users refund() (full contribution + fee); owner reclaims
///       all escrowed tokens.
///
/// Deliberate constraints (small audit surface):
///   - No upgradeability, no pause, no config mutation after deploy.
///   - Sale tokens are escrowed UP FRONT for the full hard cap, so every
///     possible claim is always solvent.
///   - Fee-on-transfer / rebasing payment tokens are NOT supported.
///   - Tier is read at purchase time; unstaking afterwards does not affect
///     already-purchased allocations.
contract ApogeeSale is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    struct SaleConfig {
        IERC20 payment; // e.g. USDC (6 decimals)
        IERC20 saleToken; // 18-decimal project token
        IApogeeStaking staking;
        address treasury; // receives proceeds + fees on success
        uint256 price; // payment units per 1e18 sale tokens (e.g. $0.042 → 42_000)
        uint256 minBuy; // payment units (e.g. $50 → 50_000_000)
        uint256 softCap; // payment units
        uint256 hardCap; // payment units
        uint64 start;
        uint64 end;
        uint16 tgeBps; // unlocked at TGE, basis points
        uint64 cliff; // seconds after TGE before linear vesting starts
        uint64 vestDuration; // linear vesting length in seconds
    }

    /* ── Immutable configuration ─────────────────────────────────── */

    IERC20 public immutable payment;
    IERC20 public immutable saleToken;
    IApogeeStaking public immutable staking;
    address public immutable treasury;
    uint256 public immutable price;
    uint256 public immutable minBuy;
    uint256 public immutable softCap;
    uint256 public immutable hardCap;
    uint64 public immutable start;
    uint64 public immutable end;
    uint16 public immutable tgeBps;
    uint64 public immutable cliff;
    uint64 public immutable vestDuration;

    /// Cumulative payment-unit cap per tier (index 0 = IGNITION … 3 = APOGEE).
    uint256[4] public tierCap;
    /// Participation fee per tier in basis points.
    uint16[4] public tierFeeBps;

    /* ── Sale state ──────────────────────────────────────────────── */

    bool public funded;
    bool public finalized;
    bool public succeeded;
    uint64 public tgeTime;

    uint256 public raised; // payment units, fees excluded
    uint256 public feesAccrued; // payment units
    uint256 public totalTokensSold; // 18-decimal sale tokens
    uint256 public totalClaimed; // 18-decimal sale tokens
    uint256 public participants;

    mapping(address => uint256) public investedOf; // payment units, fees excluded
    mapping(address => uint256) public feePaidOf; // payment units
    mapping(address => uint256) public tokensOf; // 18-decimal sale tokens
    mapping(address => uint256) public claimedOf; // 18-decimal sale tokens

    /* ── Events ──────────────────────────────────────────────────── */

    event Funded(uint256 tokenAmount);
    event Purchased(
        address indexed buyer,
        uint8 tier,
        uint256 paymentAmount,
        uint256 fee,
        uint256 tokensOut,
        uint256 totalRaised
    );
    event Finalized(bool succeeded, uint256 raised);
    event TgeSet(uint64 tgeTime);
    event Claimed(address indexed buyer, uint256 tokenAmount);
    event Refunded(address indexed buyer, uint256 paymentAmount);
    event ProceedsWithdrawn(uint256 proceeds, uint256 fees);
    event UnsoldTokensWithdrawn(uint256 tokenAmount);

    /* ── Construction ────────────────────────────────────────────── */

    constructor(
        SaleConfig memory cfg,
        uint256[4] memory tierCap_,
        uint16[4] memory tierFeeBps_
    ) Ownable(msg.sender) {
        require(address(cfg.payment) != address(0), "Sale: zero payment");
        require(address(cfg.saleToken) != address(0), "Sale: zero token");
        require(address(cfg.staking) != address(0), "Sale: zero staking");
        require(cfg.treasury != address(0), "Sale: zero treasury");
        require(cfg.price > 0, "Sale: zero price");
        require(cfg.hardCap >= cfg.softCap && cfg.softCap > 0, "Sale: bad caps");
        require(cfg.end > cfg.start && cfg.start > 0, "Sale: bad window");
        require(cfg.tgeBps <= 10_000, "Sale: bad tgeBps");
        require(cfg.tgeBps == 10_000 || cfg.vestDuration > 0, "Sale: bad vesting");
        for (uint256 i = 1; i < 4; i++) {
            require(tierCap_[i] >= tierCap_[i - 1], "Sale: caps not ascending");
        }
        for (uint256 i = 0; i < 4; i++) {
            require(tierFeeBps_[i] <= 1_000, "Sale: fee > 10%");
        }

        payment = cfg.payment;
        saleToken = cfg.saleToken;
        staking = cfg.staking;
        treasury = cfg.treasury;
        price = cfg.price;
        minBuy = cfg.minBuy;
        softCap = cfg.softCap;
        hardCap = cfg.hardCap;
        start = cfg.start;
        end = cfg.end;
        tgeBps = cfg.tgeBps;
        cliff = cfg.cliff;
        vestDuration = cfg.vestDuration;
        tierCap = tierCap_;
        tierFeeBps = tierFeeBps_;
    }

    /* ── Views ───────────────────────────────────────────────────── */

    /// @notice Payment units → 18-decimal sale tokens at the fixed price.
    function tokensFor(uint256 paymentAmount) public view returns (uint256) {
        return (paymentAmount * 1e18) / price;
    }

    /// @notice Vested fraction of every allocation, in basis points.
    function vestedBps() public view returns (uint256) {
        if (tgeTime == 0 || block.timestamp < tgeTime) return 0;
        uint256 bps = tgeBps;
        uint256 linearStart = uint256(tgeTime) + cliff;
        if (block.timestamp > linearStart && vestDuration > 0) {
            uint256 elapsed = block.timestamp - linearStart;
            if (elapsed > vestDuration) elapsed = vestDuration;
            bps += ((10_000 - uint256(tgeBps)) * elapsed) / vestDuration;
        }
        return bps > 10_000 ? 10_000 : bps;
    }

    function claimableOf(address user) public view returns (uint256) {
        if (!succeeded) return 0;
        uint256 vested = (tokensOf[user] * vestedBps()) / 10_000;
        uint256 claimed = claimedOf[user];
        return vested > claimed ? vested - claimed : 0;
    }

    /* ── Sale flow ───────────────────────────────────────────────── */

    /// @notice Escrow sale tokens for the entire hard cap before any buy.
    function fund() external onlyOwner {
        require(!funded, "Sale: already funded");
        funded = true;
        uint256 required = tokensFor(hardCap);
        saleToken.safeTransferFrom(msg.sender, address(this), required);
        emit Funded(required);
    }

    /// @notice Buy `paymentAmount` worth of the sale (fee charged on top).
    function buy(uint256 paymentAmount) external nonReentrant {
        require(funded, "Sale: not funded");
        require(!finalized, "Sale: finalized");
        require(block.timestamp >= start, "Sale: not started");
        require(block.timestamp <= end, "Sale: ended");

        uint8 tier = staking.tierOf(msg.sender);
        require(tier > 0, "Sale: no tier");
        require(paymentAmount >= minBuy, "Sale: below min buy");

        uint256 newInvested = investedOf[msg.sender] + paymentAmount;
        require(newInvested <= tierCap[tier - 1], "Sale: over tier cap");
        require(raised + paymentAmount <= hardCap, "Sale: over hard cap");

        uint256 fee = (paymentAmount * tierFeeBps[tier - 1]) / 10_000;
        uint256 tokensOut = tokensFor(paymentAmount);

        if (investedOf[msg.sender] == 0) participants += 1;
        investedOf[msg.sender] = newInvested;
        feePaidOf[msg.sender] += fee;
        tokensOf[msg.sender] += tokensOut;
        raised += paymentAmount;
        feesAccrued += fee;
        totalTokensSold += tokensOut;

        payment.safeTransferFrom(msg.sender, address(this), paymentAmount + fee);
        emit Purchased(msg.sender, tier, paymentAmount, fee, tokensOut, raised);
    }

    /// @notice Callable by anyone once the window closed — or early, the
    ///         moment the hard cap is filled.
    function finalize() external {
        require(!finalized, "Sale: finalized");
        require(block.timestamp > end || raised == hardCap, "Sale: still open");
        finalized = true;
        succeeded = raised >= softCap;
        emit Finalized(succeeded, raised);
    }

    /// @notice Owner anchors vesting to the real TGE. One-shot.
    function setTgeTime(uint64 tgeTime_) external onlyOwner {
        require(finalized && succeeded, "Sale: not successful");
        require(tgeTime == 0, "Sale: TGE already set");
        require(tgeTime_ >= block.timestamp, "Sale: TGE in past");
        tgeTime = tgeTime_;
        emit TgeSet(tgeTime_);
    }

    function claim() external nonReentrant {
        require(finalized && succeeded, "Sale: not successful");
        uint256 amount = claimableOf(msg.sender);
        require(amount > 0, "Sale: nothing to claim");
        claimedOf[msg.sender] += amount;
        totalClaimed += amount;
        saleToken.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Failed sale: full refund of contribution + fee.
    function refund() external nonReentrant {
        require(finalized && !succeeded, "Sale: not refundable");
        uint256 amount = investedOf[msg.sender] + feePaidOf[msg.sender];
        require(amount > 0, "Sale: nothing to refund");
        investedOf[msg.sender] = 0;
        feePaidOf[msg.sender] = 0;
        tokensOf[msg.sender] = 0;
        payment.safeTransfer(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }

    /* ── Owner settlement ────────────────────────────────────────── */

    /// @notice Successful sale: proceeds + fees to the treasury.
    function withdrawProceeds() external onlyOwner nonReentrant {
        require(finalized && succeeded, "Sale: not successful");
        uint256 proceeds = raised;
        uint256 fees = feesAccrued;
        require(proceeds + fees > 0, "Sale: nothing to withdraw");
        raised = 0;
        feesAccrued = 0;
        payment.safeTransfer(treasury, proceeds + fees);
        emit ProceedsWithdrawn(proceeds, fees);
    }

    /// @notice Return escrowed tokens that can never be claimed:
    ///         the unsold remainder on success, everything on failure.
    ///         Sold-but-unclaimed tokens always stay escrowed.
    function withdrawUnsoldTokens() external onlyOwner nonReentrant {
        require(finalized, "Sale: not finalized");
        uint256 mustStay = succeeded ? totalTokensSold - totalClaimed : 0;
        uint256 balance = saleToken.balanceOf(address(this));
        require(balance > mustStay, "Sale: nothing to withdraw");
        uint256 withdrawable = balance - mustStay;
        saleToken.safeTransfer(treasury, withdrawable);
        emit UnsoldTokensWithdrawn(withdrawable);
    }
}
