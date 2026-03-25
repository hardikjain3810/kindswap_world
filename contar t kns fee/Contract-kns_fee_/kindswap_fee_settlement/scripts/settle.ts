// ============================================================
//  scripts/settle.ts
//
//  Off-chain cron that checks if settlement is due and fires it.
//  Run every hour via cron:  0 * * * * npx ts-node scripts/settle.ts
// ============================================================
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// ── Config ───────────────────────────────────────────────────
const RPC_URL       = process.env.RPC_URL || "https://api.devnet.solana.com";
const WALLET_PATH   = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;
const PROGRAM_ID    = new PublicKey(process.env.PROGRAM_ID || "KSWPxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const USDC_MINT     = new PublicKey(process.env.USDC_MINT  || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK || "";

// ── Setup ────────────────────────────────────────────────────
const connection = new Connection(RPC_URL, "confirmed");
const walletKeypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
);
const wallet = new anchor.Wallet(walletKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });

async function sendAlert(message: string) {
  console.error("[ALERT]", message);
  if (ALERT_WEBHOOK) {
    try {
      await fetch(ALERT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `🚨 KindSwap Settler: ${message}` }),
      });
    } catch (e) {
      console.error("Failed to send webhook alert:", e);
    }
  }
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

async function isSettlementDue(): Promise<boolean> {
  const idl = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../target/idl/kindswap.json"), "utf-8")
  );
  const program = new anchor.Program(idl, PROGRAM_ID, provider);
  const config = await (program.account as any).configAccount.fetch(configPda());

  if (config.paused) {
    console.log("System is paused. Skipping.");
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const due = config.lastSettlementTs.toNumber() + config.settlementInterval.toNumber();
  console.log(`Now: ${now} | Due at: ${due} | Remaining: ${due - now}s`);
  return now >= due;
}

async function runSettle() {
  console.log("=== KindSwap Settler ===", new Date().toISOString());

  // ── Gas check ────────────────────────────────────────────
  const balance = await connection.getBalance(walletKeypair.publicKey);
  const MIN_SOL = 0.05 * 1e9;
  if (balance < MIN_SOL) {
    await sendAlert(`Caller wallet SOL balance too low: ${balance / 1e9} SOL`);
    process.exit(1);
  }

  const due = await isSettlementDue();
  if (!due) {
    console.log("Settlement not due yet. Exiting.");
    return;
  }

  console.log("Settlement is due. Executing...");

  try {
    const idl = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../target/idl/kindswap.json"), "utf-8")
    );
    const program = new anchor.Program(idl, PROGRAM_ID, provider);
    const config = await (program.account as any).configAccount.fetch(configPda());

    const usdcFeeVaultPDA = feeVaultPda(USDC_MINT);
    const usdcVaultAta    = await getAssociatedTokenAddress(USDC_MINT, usdcFeeVaultPDA, true);
    const charityAta      = await getAssociatedTokenAddress(USDC_MINT, config.charityWallet);
    const rebateAta       = await getAssociatedTokenAddress(USDC_MINT, config.rebateWallet);
    const platformAta     = await getAssociatedTokenAddress(USDC_MINT, config.platformWallet);
    const stakingAta      = await getAssociatedTokenAddress(USDC_MINT, config.stakingContract);

    const tx = await (program.methods as any)
      .settle()
      .accounts({
        caller:                 walletKeypair.publicKey,
        config:                 configPda(),
        usdcVault:              usdcFeeVaultPDA,
        usdcVaultAta:           usdcVaultAta,
        usdcMint:               USDC_MINT,
        charityAta,
        rebateAta,
        platformAta,
        stakingAta,
        tokenProgram:           anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram:          anchor.web3.SystemProgram.programId,
      })
      // NOTE: pass fee vault accounts as remaining_accounts in production
      .rpc({ commitment: "confirmed" });

    console.log("✅ Settlement executed. Tx:", tx);
  } catch (e: any) {
    const msg = e?.message || String(e);
    await sendAlert(`Settlement failed: ${msg}`);
    console.error("Settlement error:", e);
    process.exit(1);
  }
}

runSettle().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
