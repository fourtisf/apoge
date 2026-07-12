/*
 * Phase 3 — hand ownership of the Ownable2Step contracts to a multisig.
 *
 * ApogeeStaking has no owner (nothing to transfer). ApogeeSale is
 * Ownable2Step: this initiates the transfer; the multisig must then call
 * acceptOwnership() to complete it (two-step = no accidental hand-off to a
 * wrong/uncontrolled address).
 *
 *   NEW_OWNER=0xSafe… SALE=0xSaleAddr… DEPLOYER_KEY=0x… CONFIRM_MAINNET=base \
 *     npx hardhat run scripts/transfer-ownership.cjs --network base
 */
const { ethers, network } = require('hardhat');
const { assertConfirmed, line, rule } = require('./lib/io.cjs');

async function main() {
  assertConfirmed(network.name);

  const newOwner = process.env.NEW_OWNER;
  const saleAddr = process.env.SALE;
  if (!ethers.isAddress(newOwner)) throw new Error('Set NEW_OWNER to the multisig address');
  if (!ethers.isAddress(saleAddr)) throw new Error('Set SALE to the ApogeeSale address');

  const sale = await ethers.getContractAt('ApogeeSale', saleAddr);
  const current = await sale.owner();
  const [signer] = await ethers.getSigners();

  rule();
  line(`Sale:      ${saleAddr}`);
  line(`Current:   ${current}`);
  line(`Signer:    ${signer.address}`);
  line(`New owner: ${newOwner}  (must call acceptOwnership afterwards)`);
  rule();

  if (current.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error('Signer is not the current owner — cannot initiate transfer');
  }

  await (await sale.transferOwnership(newOwner)).wait();
  line('transferOwnership sent ✓');
  line(`pendingOwner is now ${await sale.pendingOwner()}`);
  line('');
  line(`Finish from the multisig: ApogeeSale(${saleAddr}).acceptOwnership()`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
