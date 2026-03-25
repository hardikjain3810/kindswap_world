import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import idl from "../target/idl/kns_staking.json";
import { getProvider, getProgram, derivePDAs, KNS_MINT } from "./setup";

describe("unstake", () => {
  it("rejects unstake before the lock period expires (StillLocked)", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config, userStake, stakeVault } = derivePDAs(wallet, program.programId);

    const ownerKnsAta = anchor.utils.token.associatedAddress({
      mint: KNS_MINT,
      owner: wallet,
    });

    // Verify there is an active stake before attempting unstake
    const state = await (program.account as any).userStake.fetch(userStake);
    assert.isTrue(state.active, "expected an active stake to be present");
    assert.isAbove(
      state.lockEndTs.toNumber(),
      Math.floor(Date.now() / 1000),
      "lock should still be active for this test to be meaningful"
    );

    try {
      await program.methods
        .unstake()
        .accounts({
          config,
          knsMint: KNS_MINT,
          owner: wallet,
          userStake,
          stakeVault,
          ownerKnsAta,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected StillLocked error");
    } catch (e: any) {
      assert.include(e.message, "StillLocked", "should reject early unstake");
    }
  });
});
