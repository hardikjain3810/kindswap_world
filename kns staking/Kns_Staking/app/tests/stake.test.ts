import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import idl from "../target/idl/kns_staking.json";
import { getProvider, getProgram, derivePDAs, KNS_MINT } from "./setup";

describe("stake", () => {
  it("stakes KNS tokens with M1 lock tier and verifies on-chain state", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config, userStake, stakeVault } = derivePDAs(wallet, program.programId);

    const ownerKnsAta = anchor.utils.token.associatedAddress({
      mint: KNS_MINT,
      owner: wallet,
    });

    const stakeAmount = new anchor.BN(1_000_000_000); // 1 KNS (9 decimals)

    try {
      await program.methods
        .stake(stakeAmount, { m1: {} })
        .accounts({
          config,
          knsMint: KNS_MINT,
          owner: wallet,
          userStake,
          stakeVault,
          ownerKnsAta,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
    } catch (e: any) {
      // On devnet, a stake from a previous run may already be active — that is fine,
      // we just verify the existing on-chain state below
      if (!e.message.includes("StakeAlreadyActive")) throw e;
    }

    const state = await (program.account as any).userStake.fetch(userStake);
    assert.isTrue(state.active,                              "stake should be active");
    assert.ok(state.amount.eq(stakeAmount),                  "staked amount mismatch");
    assert.ok(state.owner.equals(wallet),                    "owner mismatch");
    assert.isAbove(
      state.lockEndTs.toNumber(),
      Math.floor(Date.now() / 1000),
      "lock_end_ts should be in the future"
    );
  });

  it("rejects a second stake while one is already active", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config, userStake, stakeVault } = derivePDAs(wallet, program.programId);

    const ownerKnsAta = anchor.utils.token.associatedAddress({
      mint: KNS_MINT,
      owner: wallet,
    });

    try {
      await program.methods
        .stake(new anchor.BN(1_000_000_000), { m1: {} })
        .accounts({
          config,
          knsMint: KNS_MINT,
          owner: wallet,
          userStake,
          stakeVault,
          ownerKnsAta,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      assert.fail("Expected StakeAlreadyActive error");
    } catch (e: any) {
      assert.include(e.message, "StakeAlreadyActive", "should reject duplicate stake");
    }
  });
});
