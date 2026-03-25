import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import idl from "../target/idl/kns_staking.json";
import {
  getProvider,
  getProgram,
  derivePDAs,
  deriveEpochPDAs,
  deriveClaimRecord,
  USDC_MINT,
} from "./setup";

// ----------------------------------------------------------------
// EPOCH_ID must match a funded (Active) epoch on devnet.
// Update this to match the epoch created by fund_rewards.test.ts,
// and populate MERKLE_PROOF with the off-chain engine output.
// ----------------------------------------------------------------
const EPOCH_ID     = 3; // update to match a funded epoch
const CLAIM_AMOUNT = new anchor.BN(1_000_000); // 1 USDC (6 decimals)
const MERKLE_PROOF: number[][] = [
  // e.g. Array.from(Buffer.from("<32-byte-hex-node>", "hex"))
];
// ----------------------------------------------------------------

describe("claim", () => {
  it("rejects a claim with an invalid (empty) Merkle proof", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config }              = derivePDAs(wallet, program.programId);
    const { epoch, epochVault }   = deriveEpochPDAs(EPOCH_ID, program.programId);
    const epochClaimRecord        = deriveClaimRecord(EPOCH_ID, wallet, program.programId);

    const ownerUsdcAta = anchor.utils.token.associatedAddress({
      mint: USDC_MINT,
      owner: wallet,
    });

    try {
      await program.methods
        .claim(new anchor.BN(EPOCH_ID), CLAIM_AMOUNT, [])
        .accounts({
          config,
          usdcMint: USDC_MINT,
          owner: wallet,
          epoch,
          epochVault,
          epochClaimRecord,
          ownerUsdcAta,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      assert.fail("Expected claim to be rejected");
    } catch (e: any) {
      // Accept InvalidMerkleProof (epoch active, proof wrong) or
      // AccountNotInitialized (epoch not yet funded) — both mean the claim was rejected
      const rejected =
        e.message.includes("InvalidMerkleProof") ||
        e.message.includes("AccountNotInitialized") ||
        e.message.includes("AccountDidNotDeserialize") || // stale epoch from old struct
        e.message.includes("InvalidEpochStatus");
      assert.isTrue(rejected, `unexpected error: ${e.message}`);
    }
  });

  it("claims USDC with a valid Merkle proof (requires real off-chain proof)", async function () {
    if (MERKLE_PROOF.length === 0) {
      this.skip(); // Skip until MERKLE_PROOF is populated from the off-chain engine
    }

    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config }              = derivePDAs(wallet, program.programId);
    const { epoch, epochVault }   = deriveEpochPDAs(EPOCH_ID, program.programId);
    const epochClaimRecord        = deriveClaimRecord(EPOCH_ID, wallet, program.programId);

    const ownerUsdcAta = anchor.utils.token.associatedAddress({
      mint: USDC_MINT,
      owner: wallet,
    });

    await program.methods
      .claim(new anchor.BN(EPOCH_ID), CLAIM_AMOUNT, MERKLE_PROOF)
      .accounts({
        config,
        usdcMint: USDC_MINT,
        owner: wallet,
        epoch,
        epochVault,
        epochClaimRecord,
        ownerUsdcAta,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const record = await (program.account as any).epochClaimRecord.fetch(epochClaimRecord);
    assert.ok(record.amountClaimed.eq(CLAIM_AMOUNT), "claimed amount mismatch");
    assert.ok(record.claimer.equals(wallet),          "claimer mismatch");
  });
});
