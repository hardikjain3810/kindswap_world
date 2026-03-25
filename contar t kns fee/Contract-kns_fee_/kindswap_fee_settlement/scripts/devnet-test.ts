// ============================================================
//  scripts/devnet-test.ts
//
//  Manual devnet smoke-test for initialize_config and collect_fee.
//
//  Prerequisites:
//    - Program deployed on devnet at PROGRAM_ID
//    - Wallet has devnet SOL (use `solana airdrop 2`)
//
//  Usage:
//    npx ts-node scripts/devnet-test.ts
//
//  Environment overrides:
//    RPC_URL=<url>          Devnet RPC (default: api.devnet.solana.com)
//    WALLET_PATH=<path>     Signer keypair (default: ~/.config/solana/id.json)
//    PROGRAM_ID=<base58>    Override deployed program ID
//    SKIP_INIT=true         Skip initializeConfig if already deployed
// ============================================================
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// ── Config ────────────────────────────────────────────────────
const RPC_URL     = process.env.RPC_URL     || "https://api.devnet.solana.com";
const WALLET_PATH = process.env.WALLET_PATH || `${process.env.HOME}/phantom-devnet.json`;
const PROGRAM_ID  = new PublicKey(
  process.env.PROGRAM_ID || "83yzPgWLoiHjaKcwpqmN6EJdYMwFXVJLsHp5bLTFNr8X"
);
const SKIP_INIT   = process.env.SKIP_INIT === "true";

// Swap amount passed to collectFee. The program charges 0.10% (FEE_BPS=10).
// fee_per_call = COLLECT_AMOUNT * 10 / 10_000 = 1_000_000 * 10 / 10_000 = 1_000
const COLLECT_AMOUNT = new BN(1_000_000);
// How many tokens to mint to the test user ATA before collecting
const MINT_AMOUNT    = 10_000_000; // 10 tokens (6 decimals) — enough for 2 calls

// ── Helpers ──────────────────────────────────────────────────
function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function explorerLink(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function configPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  return pda;
}

function feeVaultPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  log("=== KindSwap Devnet Smoke Test ===");
  log(`RPC: ${RPC_URL}`);
  log(`Program: ${PROGRAM_ID.toBase58()}`);

  // ── Wallet & provider setup ─────────────────────────────
  const connection    = new Connection(RPC_URL, "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
  );
  const wallet   = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const solBalance = await connection.getBalance(walletKeypair.publicKey);
  log(`Wallet: ${walletKeypair.publicKey.toBase58()}  (${(solBalance / 1e9).toFixed(4)} SOL)`);

  if (solBalance < 0.1 * 1e9) {
    console.error("ERROR: Wallet SOL balance too low. Run: solana airdrop 2 --url devnet");
    process.exit(1);
  }

  // ── Load IDL ──────────────────────────────────────────
  const idl = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../target/idl/kindswap.json"), "utf-8")
  );
  const program = new anchor.Program(idl, provider);

  // ── Step 1: initialize_config ─────────────────────────
  const configAddress = configPda();
  log(`Config PDA: ${configAddress.toBase58()}`);

  const configInfo = await connection.getAccountInfo(configAddress);
  if (configInfo !== null) {
    log("Config already initialized — skipping initializeConfig.");
  } else if (SKIP_INIT) {
    log("SKIP_INIT=true but config not found. Proceeding with init.");
  }

  if (configInfo === null) {
    log("Calling initializeConfig...");

    // Use the same wallet as multisig for devnet testing
    const multisig       = walletKeypair.publicKey;
    const charityWallet  = walletKeypair.publicKey;
    const rebateWallet   = walletKeypair.publicKey;
    const platformWallet = walletKeypair.publicKey;
    const stakingContract = walletKeypair.publicKey;

    const initTx = await (program.methods as any)
      .initializeConfig({
        multisig,
        thresholdUsd:       new BN(2_000_000), // $2.00 in 6-decimal USDC units
        charityBps:         2500,              // 25%
        rebateBps:          2500,              // 25%
        platformBps:        2500,              // 25%
        stakingBps:         2500,              // 25%
        charityWallet,
        rebateWallet,
        platformWallet,
        stakingContract,
        settlementInterval: new BN(3_600),     // 1 hour
      })
      .accounts({
        owner: walletKeypair.publicKey,
      })
      .rpc({ commitment: "confirmed" });

    log(`initializeConfig OK — ${explorerLink(initTx)}`);
  }

  // ── Verify config state ────────────────────────────────
  const config = await (program.account as any).configAccount.fetch(configAddress);
  log("Config state:");
  log(`  authority:          ${config.authority.toBase58()}`);
  log(`  thresholdUsd:       ${config.thresholdUsd.toString()}`);
  log(`  charityBps:         ${config.charityBps}`);
  log(`  rebateBps:          ${config.rebateBps}`);
  log(`  platformBps:        ${config.platformBps}`);
  log(`  stakingBps:         ${config.stakingBps}`);
  log(`  settlementInterval: ${config.settlementInterval.toString()}s`);
  log(`  paused:             ${config.paused}`);

  if (config.paused) {
    console.error("ERROR: System is paused — cannot collect fees.");
    process.exit(1);
  }

  // ── Step 2: Create a test mint ────────────────────────
  log("Creating test mint (6 decimals)...");
  const testMint = await createMint(
    connection,
    walletKeypair,       // payer
    walletKeypair.publicKey, // mintAuthority
    null,                // freezeAuthority
    6                    // decimals
  );
  log(`Test mint: ${testMint.toBase58()}`);

  // ── Step 3: Create user ATA and mint tokens ───────────
  log("Creating user ATA and minting tokens...");
  const userAta = await createAssociatedTokenAccount(
    connection,
    walletKeypair,           // payer
    testMint,
    walletKeypair.publicKey  // owner
  );
  log(`User ATA: ${userAta.toBase58()}`);

  await mintTo(
    connection,
    walletKeypair,
    testMint,
    userAta,
    walletKeypair,   // mintAuthority
    MINT_AMOUNT
  );

  const userAtaInfoBefore = await getAccount(connection, userAta);
  log(`User ATA balance before collect_fee: ${userAtaInfoBefore.amount.toString()} tokens`);

  // ── Step 4: Derive fee vault PDA and ATA ─────────────
  const feeVaultAddress = feeVaultPda(testMint);
  const feeVaultAta     = await getAssociatedTokenAddress(
    testMint,
    feeVaultAddress,
    true // allowOwnerOffCurve = true (PDA owner)
  );
  log(`Fee vault PDA: ${feeVaultAddress.toBase58()}`);
  log(`Fee vault ATA: ${feeVaultAta.toBase58()}`);

  // ── Step 5: collect_fee ───────────────────────────────
  log(`Calling collectFee (amount = ${COLLECT_AMOUNT.toString()} tokens)...`);

  const collectTx = await (program.methods as any)
    .collectFee(COLLECT_AMOUNT)
    .accounts({
      payer:     walletKeypair.publicKey,
      sourceAta: userAta,
      mint:      testMint,
    })
    .rpc({ commitment: "confirmed" });

  log(`collectFee OK — ${explorerLink(collectTx)}`);

  // ── Step 6: Verify balances ────────────────────────────
  const userAtaInfoAfter = await getAccount(connection, userAta);
  log(`User ATA balance after collect_fee: ${userAtaInfoAfter.amount.toString()} tokens`);

  const feeVaultAtaInfo = await getAccount(connection, feeVaultAta);
  log(`Fee vault ATA balance: ${feeVaultAtaInfo.amount.toString()} tokens`);

  const feeVaultAccount = await (program.account as any).feeVault.fetch(feeVaultAddress);
  log(`FeeVault.accumulated: ${feeVaultAccount.accumulated.toString()} tokens`);

  // ── Step 7: Collect a second time to confirm accumulation
  log("Calling collectFee a second time...");
  const collectTx2 = await (program.methods as any)
    .collectFee(COLLECT_AMOUNT)
    .accounts({
      payer:     walletKeypair.publicKey,
      sourceAta: userAta,
      mint:      testMint,
    })
    .rpc({ commitment: "confirmed" });

  log(`collectFee (2nd) OK — ${explorerLink(collectTx2)}`);

  const feeVaultAtaInfoFinal = await getAccount(connection, feeVaultAta);
  const feeVaultFinal        = await (program.account as any).feeVault.fetch(feeVaultAddress);

  log("=== Final State ===");
  log(`User ATA balance:      ${(await getAccount(connection, userAta)).amount.toString()} tokens`);
  log(`Fee vault ATA balance: ${feeVaultAtaInfoFinal.amount.toString()} tokens`);
  log(`FeeVault.accumulated:  ${feeVaultFinal.accumulated.toString()} tokens`);

  // The program charges 0.10% (FEE_BPS=10): fee = swap_amount * 10 / 10_000
  const feePerCall   = (BigInt(COLLECT_AMOUNT.toString()) * 10n) / 10_000n;
  const expectedVault = feePerCall * 2n;
  if (feeVaultAtaInfoFinal.amount === expectedVault) {
    log(`PASS: vault balance (${feeVaultAtaInfoFinal.amount}) = 2 × fee (${feePerCall}) as expected`);
  } else {
    console.error(
      `FAIL: expected vault balance ${expectedVault}, got ${feeVaultAtaInfoFinal.amount}`
    );
    process.exit(1);
  }

  log("=== Smoke test PASSED ===");
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
