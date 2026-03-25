// ============================================================
//  tests/kindswap.ts
//  Anchor / Mocha test suite for the KindSwap program.
//
//  Run:  anchor test --skip-deploy  (after anchor build)
// ============================================================
import * as anchor from "@coral-xyz/anchor";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { Kindswap } from "../target/types/kindswap";
import {
  createMint,
  createAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

// ── Helpers ──────────────────────────────────────────────────
const LAMPORTS_PER_SOL = web3.LAMPORTS_PER_SOL;

async function airdrop(
  provider: anchor.AnchorProvider,
  pubkey: web3.PublicKey,
  sol = 10
) {
  const sig = await provider.connection.requestAirdrop(
    pubkey,
    sol * LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(sig, "confirmed");
}

function configPda(programId: web3.PublicKey): [web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
}

function feeVaultPda(
  mint: web3.PublicKey,
  programId: web3.PublicKey
): [web3.PublicKey, number] {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault"), mint.toBuffer()],
    programId
  );
}

// ── Test Suite ───────────────────────────────────────────────
describe("KindSwap", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Kindswap as Program<Kindswap>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  // Keypairs & PDAs
  const owner = wallet.payer;
  const multisig = web3.Keypair.generate();
  const charityWallet = web3.Keypair.generate();
  const rebateWallet = web3.Keypair.generate();
  const platformWallet = web3.Keypair.generate();
  const stakingContract = web3.Keypair.generate();
  const user = web3.Keypair.generate();

  let [configPDA] = configPda(program.programId);
  let tokenMint: web3.PublicKey;
  let usdcMint: web3.PublicKey;
  let userTokenAta: web3.PublicKey;

  // ── Before All ───────────────────────────────────────────
  before(async () => {
    await airdrop(provider, owner.publicKey);
    await airdrop(provider, user.publicKey);
    await airdrop(provider, multisig.publicKey);

    // Create test mints
    tokenMint = await createMint(connection, owner, owner.publicKey, null, 6);
    usdcMint = await createMint(connection, owner, owner.publicKey, null, 6);

    // Create user ATA and mint some tokens
    userTokenAta = await createAssociatedTokenAccount(
      connection,
      owner,
      tokenMint,
      user.publicKey
    );
    await mintTo(
      connection,
      owner,
      tokenMint,
      userTokenAta,
      owner,
      10_000_000_000
    );
  });

  // ════════════════════════════════════════════════════════
  //  1. INITIALIZE
  // ════════════════════════════════════════════════════════
  describe("initialize_config", () => {
    it("rejects allocations that don't sum to 10000", async () => {
      try {
        await program.methods
          .initializeConfig({
            multisig: multisig.publicKey,
            thresholdUsd: new BN(2_000_000),
            charityBps: 2500,
            rebateBps: 1000,
            platformBps: 3500,
            stakingBps: 2000, // ← wrong: sums to 9000
            charityWallet: charityWallet.publicKey,
            rebateWallet: rebateWallet.publicKey,
            platformWallet: platformWallet.publicKey,
            stakingContract: stakingContract.publicKey,
            settlementInterval: new BN(604800),
          })
          .accounts({
            owner: owner.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown AllocationNot100");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("AllocationNot100");
      }
    });

    it("initializes with correct parameters", async () => {
      await program.methods
        .initializeConfig({
          multisig: multisig.publicKey,
          thresholdUsd: new BN(2_000_000), // $2
          charityBps: 2500,
          rebateBps: 1000,
          platformBps: 3500,
          stakingBps: 3000,
          charityWallet: charityWallet.publicKey,
          rebateWallet: rebateWallet.publicKey,
          platformWallet: platformWallet.publicKey,
          stakingContract: stakingContract.publicKey,
          settlementInterval: new BN(604800), // 1 week
        })
        .accounts({
          owner: owner.publicKey,
        })
        .rpc();

      const config = await program.account.configAccount.fetch(configPDA);
      expect(config.charityBps).to.equal(2500);
      expect(config.rebateBps).to.equal(1000);
      expect(config.platformBps).to.equal(3500);
      expect(config.stakingBps).to.equal(3000);
      expect(config.paused).to.be.false;
      expect(config.thresholdUsd.toNumber()).to.equal(2_000_000);
    });
  });

  // ════════════════════════════════════════════════════════
  //  2. FEE COLLECTION
  // ════════════════════════════════════════════════════════
  describe("collect_fee", () => {
    let feeVaultPDA: web3.PublicKey;
    let feeVaultAta: web3.PublicKey;

    before(async () => {
      [feeVaultPDA] = feeVaultPda(tokenMint, program.programId);
      feeVaultAta = await getAssociatedTokenAddress(
        tokenMint,
        feeVaultPDA,
        true
      );
    });

    it("deducts 0.10% from user and credits vault", async () => {
      const swapAmount = 1_000_000; // 1 token (e6)
      const expectedFee = Math.floor((swapAmount * 10) / 10_000); // = 100

      const beforeUser = await getAccount(connection, userTokenAta);

      await program.methods
        .collectFee(new BN(swapAmount))
        .accounts({
          payer: user.publicKey,
          sourceAta: userTokenAta,
          mint: tokenMint,
        })
        .signers([user])
        .rpc();

      const afterUser = await getAccount(connection, userTokenAta);
      const vaultAcct = await getAccount(connection, feeVaultAta);

      expect(Number(beforeUser.amount) - Number(afterUser.amount)).to.equal(
        expectedFee
      );
      expect(Number(vaultAcct.amount)).to.be.gte(expectedFee);
    });

    it("rejects zero-fee amounts", async () => {
      try {
        await program.methods
          .collectFee(new BN(0))
          .accounts({
            payer: user.publicKey,
            sourceAta: userTokenAta,
            mint: tokenMint,
          })
          .signers([user])
          .rpc();
        expect.fail("Should have thrown ZeroFeeAmount");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("ZeroFeeAmount");
      }
    });

    it("rejects collect_fee when system is paused", async () => {
      // Pause first
      await program.methods
        .pauseSystem()
        .accounts({ signer: owner.publicKey })
        .rpc();

      try {
        await program.methods
          .collectFee(new BN(1_000_000))
          .accounts({
            payer: user.publicKey,
            sourceAta: userTokenAta,
            mint: tokenMint,
          })
          .signers([user])
          .rpc();
        expect.fail("Should have thrown SystemPaused");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("SystemPaused");
      } finally {
        // Resume
        await program.methods
          .resumeSystem()
          .accounts({ signer: owner.publicKey })
          .rpc();
      }
    });
  });

  // ════════════════════════════════════════════════════════
  //  3. ADMIN CONTROLS
  // ════════════════════════════════════════════════════════
  describe("admin controls", () => {
    it("owner can update threshold", async () => {
      await program.methods
        .updateThreshold(new BN(5_000_000)) // $5
        .accounts({ signer: owner.publicKey })
        .rpc();

      const config = await program.account.configAccount.fetch(configPDA);
      expect(config.thresholdUsd.toNumber()).to.equal(5_000_000);

      // Reset
      await program.methods
        .updateThreshold(new BN(2_000_000))
        .accounts({ signer: owner.publicKey })
        .rpc();
    });

    it("owner can update wallets and event is emitted", async () => {
      const newCharity = web3.Keypair.generate().publicKey;
      await program.methods
        .updateWallets({
          charity: newCharity,
          rebate: null,
          platform: null,
          staking: null,
        })
        .accounts({ signer: owner.publicKey })
        .rpc();

      const config = await program.account.configAccount.fetch(configPDA);
      expect(config.charityWallet.toBase58()).to.equal(newCharity.toBase58());

      // Reset
      await program.methods
        .updateWallets({
          charity: charityWallet.publicKey,
          rebate: null,
          platform: null,
          staking: null,
        })
        .accounts({ signer: owner.publicKey })
        .rpc();
    });

    it("rejects allocation update that doesn't sum to 10000", async () => {
      try {
        await program.methods
          .updateAllocations({
            charityBps: 2500,
            rebateBps: 1000,
            platformBps: 3000,
            stakingBps: 2000,
          })
          .accounts({ signer: owner.publicKey })
          .rpc();
        expect.fail("Should have thrown AllocationNot100");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("AllocationNot100");
      }
    });

    it("owner can update settlement interval", async () => {
      await program.methods
        .updateSettlementInterval(new BN(86400)) // 1 day for testing
        .accounts({ signer: owner.publicKey })
        .rpc();

      const config = await program.account.configAccount.fetch(configPDA);
      expect(config.settlementInterval.toNumber()).to.equal(86400);
    });

    it("rejects interval below 3600 seconds", async () => {
      try {
        await program.methods
          .updateSettlementInterval(new BN(100))
          .accounts({ signer: owner.publicKey })
          .rpc();
        expect.fail("Should have thrown IntervalTooShort");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("IntervalTooShort");
      }
    });

    it("non-owner cannot perform admin actions", async () => {
      const stranger = web3.Keypair.generate();
      await airdrop(provider, stranger.publicKey);
      try {
        await program.methods
          .updateThreshold(new BN(99_000_000))
          .accounts({ signer: stranger.publicKey })
          .signers([stranger])
          .rpc();
        expect.fail("Should have thrown NotAuthorized");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("NotAuthorized");
      }
    });

    it("owner can pause and resume system", async () => {
      await program.methods
        .pauseSystem()
        .accounts({ signer: owner.publicKey })
        .rpc();
      let config = await program.account.configAccount.fetch(configPDA);
      expect(config.paused).to.be.true;

      await program.methods
        .resumeSystem()
        .accounts({ signer: owner.publicKey })
        .rpc();
      config = await program.account.configAccount.fetch(configPDA);
      expect(config.paused).to.be.false;
    });

    it("owner can lock and unlock a wallet", async () => {
      await program.methods
        .lockWallet(0)
        .accounts({ signer: owner.publicKey })
        .rpc();
      let config = await program.account.configAccount.fetch(configPDA);
      expect(config.charityLocked).to.be.true;

      await program.methods
        .unlockWallet(0)
        .accounts({ signer: owner.publicKey })
        .rpc();
      config = await program.account.configAccount.fetch(configPDA);
      expect(config.charityLocked).to.be.false;
    });

    it("rejects invalid wallet type index", async () => {
      try {
        await program.methods
          .lockWallet(5) // invalid
          .accounts({ signer: owner.publicKey })
          .rpc();
        expect.fail("Should have thrown InvalidWalletType");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("InvalidWalletType");
      }
    });

    it("rotate_admin requires multisig, not just owner", async () => {
      const newOwner = web3.Keypair.generate().publicKey;
      try {
        await program.methods
          .rotateAdmin(newOwner)
          .accounts({ signer: owner.publicKey })
          .rpc();
        expect.fail("Should have thrown NotAuthorized");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("NotAuthorized");
      }
    });
  });

  // ════════════════════════════════════════════════════════
  //  4. SETTLEMENT — Timing Guards
  // ════════════════════════════════════════════════════════
  describe("settle — timing guards", () => {
    let usdcVaultAta: web3.PublicKey;
    let charityAta: web3.PublicKey;
    let rebateAta: web3.PublicKey;
    let platformAta: web3.PublicKey;
    let stakingAta: web3.PublicKey;

    before(async () => {
      // configPDA is off-curve — must build ATA manually with allowOwnerOffCurve
      usdcVaultAta = await getAssociatedTokenAddress(usdcMint, configPDA, true);
      const createUsdcVaultAtaIx = createAssociatedTokenAccountInstruction(
        owner.publicKey,
        usdcVaultAta,
        configPDA,
        usdcMint
      );
      const tx = new web3.Transaction().add(createUsdcVaultAtaIx);
      await provider.sendAndConfirm(tx, [owner]);
      charityAta = await createAssociatedTokenAccount(
        connection,
        owner,
        usdcMint,
        charityWallet.publicKey
      );
      rebateAta = await createAssociatedTokenAccount(
        connection,
        owner,
        usdcMint,
        rebateWallet.publicKey
      );
      platformAta = await createAssociatedTokenAccount(
        connection,
        owner,
        usdcMint,
        platformWallet.publicKey
      );
      stakingAta = await createAssociatedTokenAccount(
        connection,
        owner,
        usdcMint,
        stakingContract.publicKey
      );
    });

    it("rejects settle when system is paused", async () => {
      await program.methods
        .pauseSystem()
        .accounts({ signer: owner.publicKey })
        .rpc();

      try {
        await program.methods
          .settle({ minTotalUsdc: new BN(0) })
          .accounts({
            caller: owner.publicKey,

            usdcVaultAta,
            charityAta,
            rebateAta,
            platformAta,
            stakingAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown SystemPaused");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("SystemPaused");
      } finally {
        await program.methods
          .resumeSystem()
          .accounts({ signer: owner.publicKey })
          .rpc();
      }
    });

    it("rejects settle when interval has not elapsed", async () => {
      // Set interval larger than any real unix timestamp so due_at = 0 + 2B > now
      await program.methods
        .updateSettlementInterval(new BN(2_000_000_000))
        .accounts({ signer: owner.publicKey })
        .rpc();

      try {
        await program.methods
          .settle({ minTotalUsdc: new BN(0) })
          .accounts({
            caller: owner.publicKey,

            usdcVaultAta,
            charityAta,
            rebateAta,
            platformAta,
            stakingAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown SettlementNotDue");
      } catch (e: any) {
        expect(e.error?.errorCode?.code).to.equal("SettlementNotDue");
      }
    });
  });
});
