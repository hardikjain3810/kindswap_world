import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import idl from "../target/idl/kns_staking.json";
import {
  getProvider,
  getProgram,
  derivePDAs,
  deriveEpochPDAs,
  USDC_MINT,
} from "./setup";

// Use a timestamp-based epoch ID so every test run creates a fresh epoch
const EPOCH_ID    = Math.floor(Date.now() / 1000);
const TOTAL_REWARDS = new anchor.BN(1_000_000); // 1 USDC (6 decimals)
const MERKLE_ROOT = Buffer.alloc(32, 0xab);      // placeholder root

describe("epoch lifecycle: initialize_epoch → fund_epoch", () => {
  it("initializes a new epoch with snapshot_ts and verifies Pending state", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config }           = derivePDAs(wallet, program.programId);
    const { epoch, epochVault } = deriveEpochPDAs(EPOCH_ID, program.programId);

    // snapshot_ts must be strictly in the past — subtract 120s buffer to account
    // for devnet block time and transaction processing latency
    const snapshotTs = new anchor.BN(Math.floor(Date.now() / 1000) - 120);

    await program.methods
      .initializeEpoch(
        new anchor.BN(EPOCH_ID),
        Array.from(MERKLE_ROOT),
        TOTAL_REWARDS,
        snapshotTs
      )
      .accounts({
        config,
        admin: wallet,
        usdcMint: USDC_MINT,
        epoch,
        epochVault,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const epochState = await (program.account as any).epoch.fetch(epoch);
    assert.equal(epochState.epochId.toNumber(), EPOCH_ID,   "epoch_id mismatch");
    assert.ok(epochState.totalRewards.eq(TOTAL_REWARDS),    "total_rewards mismatch");
    assert.ok(epochState.snapshotTs.eq(snapshotTs), "snapshot_ts mismatch");
    assert.deepEqual(
      Array.from(epochState.merkleRoot),
      Array.from(MERKLE_ROOT),
      "merkle_root mismatch"
    );
    assert.isDefined(epochState.status.pending, "status should be Pending");
  });

  it("funds the epoch and transitions status to Active", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config }           = derivePDAs(wallet, program.programId);
    const { epoch, epochVault } = deriveEpochPDAs(EPOCH_ID, program.programId);

    const adminUsdcAta = anchor.utils.token.associatedAddress({
      mint: USDC_MINT,
      owner: wallet,
    });

    await program.methods
      .fundEpoch(new anchor.BN(EPOCH_ID), TOTAL_REWARDS)
      .accounts({
        config,
        admin: wallet,
        usdcMint: USDC_MINT,
        epoch,
        epochVault,
        adminUsdcAta,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();

    const epochState = await (program.account as any).epoch.fetch(epoch);
    assert.ok(epochState.fundedAmount.eq(TOTAL_REWARDS), "funded_amount mismatch");
    assert.isDefined(epochState.status.active,           "status should be Active");
  });
});
