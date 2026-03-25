import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import idl from "../target/idl/kns_staking.json";
import { getProvider, getProgram, derivePDAs, KNS_MINT, USDC_MINT } from "./setup";

describe("initialize", () => {
  it("initializes the global config (or verifies existing state on devnet)", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config } = derivePDAs(wallet, program.programId);

    try {
      await program.methods
        .initialize(wallet, KNS_MINT, USDC_MINT, wallet)
        .accounts({
          config,
          payer: wallet,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (_) {
      // Config PDA already exists on devnet — skip init, assert state below
    }

    const cfg = await (program.account as any).config.fetch(config);
    assert.ok(cfg.knsMint.equals(KNS_MINT),   "kns_mint mismatch");
    assert.ok(cfg.usdcMint.equals(USDC_MINT), "usdc_mint mismatch");
    assert.isFalse(cfg.pausedDeposits, "deposits should not be paused after init");
    assert.isFalse(cfg.pausedClaims,   "claims should not be paused after init");
  });
});
