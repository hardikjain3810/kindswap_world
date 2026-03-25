import { assert } from "chai";
import idl from "../target/idl/kns_staking.json";
import { getProvider, getProgram, derivePDAs } from "./setup";

describe("set_pause", () => {
  it("pauses both deposits and claims and verifies on-chain state", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config } = derivePDAs(wallet, program.programId);

    await program.methods
      .setPause(true, true)
      .accounts({ config, admin: wallet })
      .rpc();

    const cfg = await (program.account as any).config.fetch(config);
    assert.isTrue(cfg.pausedDeposits, "pausedDeposits should be true");
    assert.isTrue(cfg.pausedClaims,   "pausedClaims should be true");
  });

  it("unpauses both deposits and claims and verifies on-chain state", async () => {
    const provider = getProvider();
    const program  = getProgram(provider, idl);
    const wallet   = provider.wallet.publicKey;
    const { config } = derivePDAs(wallet, program.programId);

    await program.methods
      .setPause(false, false)
      .accounts({ config, admin: wallet })
      .rpc();

    const cfg = await (program.account as any).config.fetch(config);
    assert.isFalse(cfg.pausedDeposits, "pausedDeposits should be false");
    assert.isFalse(cfg.pausedClaims,   "pausedClaims should be false");
  });
});
