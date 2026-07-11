// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Apogee tier staking.
/// @notice Stake APG to hold a launchpad tier. Deliberately minimal:
///         no lockups, no on-chain rewards, no admin — the tier ladder is
///         constant and the contract can never touch more than a user staked.
///         Sale contracts read `tierOf(user)` at purchase time.
contract ApogeeStaking is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable apg;

    mapping(address => uint256) public stakedOf;
    uint256 public totalStaked;

    // Tier ladder — mirrors the product spec exactly (18-decimal APG).
    uint256 public constant IGNITION_MIN = 1_000e18;
    uint256 public constant ORBIT_MIN = 10_000e18;
    uint256 public constant ZENITH_MIN = 50_000e18;
    uint256 public constant APOGEE_MIN = 250_000e18;

    event Staked(address indexed user, uint256 amount, uint256 stakedTotal);
    event Unstaked(address indexed user, uint256 amount, uint256 stakedTotal);

    constructor(IERC20 apg_) {
        require(address(apg_) != address(0), "Staking: zero token");
        apg = apg_;
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Staking: zero amount");
        stakedOf[msg.sender] += amount;
        totalStaked += amount;
        apg.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount, stakedOf[msg.sender]);
    }

    function unstake(uint256 amount) external nonReentrant {
        uint256 balance = stakedOf[msg.sender];
        require(amount > 0 && amount <= balance, "Staking: invalid amount");
        unchecked {
            stakedOf[msg.sender] = balance - amount;
            totalStaked -= amount;
        }
        apg.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, stakedOf[msg.sender]);
    }

    /// @return tier 0 = none, 1 = IGNITION, 2 = ORBIT, 3 = ZENITH, 4 = APOGEE.
    function tierOf(address user) external view returns (uint8) {
        uint256 staked = stakedOf[user];
        if (staked >= APOGEE_MIN) return 4;
        if (staked >= ZENITH_MIN) return 3;
        if (staked >= ORBIT_MIN) return 2;
        if (staked >= IGNITION_MIN) return 1;
        return 0;
    }
}
