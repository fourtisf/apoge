// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title APG — the Apogee launchpad token.
/// @notice Fixed supply, minted once to the treasury at deployment.
///         No owner, no mint function, no pause: nothing to rug.
contract APGToken is ERC20, ERC20Permit {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;

    constructor(address treasury) ERC20("Apogee", "APG") ERC20Permit("Apogee") {
        require(treasury != address(0), "APG: zero treasury");
        _mint(treasury, TOTAL_SUPPLY);
    }
}
