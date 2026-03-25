/**
 * devnet_setup.ts
 *
 * Creates test KNS and USDC mints on devnet, mints tokens to the wallet,
 * and prints the mint addresses to paste into setup.ts.
 *
 * Run once before any other tests:
 *   yarn devnet:setup
 */
import * as anchor from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";

(async () => {
  const walletPath = process.env.ANCHOR_WALLET ?? `${os.homedir()}/.config/solana/id.json`;
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL ?? clusterApiUrl("devnet");

  const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(raw));
  const connection = new Connection(rpcUrl, "confirmed");

  console.log("Wallet:", payer.publicKey.toBase58());
  console.log("RPC:   ", rpcUrl);

  // ---- Create KNS mint (9 decimals) ----
  console.log("\nCreating KNS mint...");
  const knsMint = await createMint(
    connection,
    payer,
    payer.publicKey,   // mint authority
    payer.publicKey,   // freeze authority
    9                  // decimals
  );
  console.log("KNS mint:", knsMint.toBase58());

  // ---- Create USDC mint (6 decimals) ----
  console.log("Creating USDC mint...");
  const usdcMint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6
  );
  console.log("USDC mint:", usdcMint.toBase58());

  // ---- Create ATAs ----
  console.log("\nCreating ATAs...");
  const knsAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, knsMint, payer.publicKey
  );
  const usdcAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, usdcMint, payer.publicKey
  );
  console.log("KNS ATA: ", knsAta.address.toBase58());
  console.log("USDC ATA:", usdcAta.address.toBase58());

  // ---- Mint test tokens ----
  // 100 KNS = 100 * 10^9
  await mintTo(connection, payer, knsMint, knsAta.address, payer, 100_000_000_000);
  console.log("Minted 100 KNS to wallet");

  // 10,000 USDC = 10,000 * 10^6
  await mintTo(connection, payer, usdcMint, usdcAta.address, payer, 10_000_000_000);
  console.log("Minted 10,000 USDC to wallet");

  console.log("\n==============================================");
  console.log("Update tests/setup.ts with these values:");
  console.log("==============================================");
  console.log(`export const KNS_MINT  = new PublicKey("${knsMint.toBase58()}");`);
  console.log(`export const USDC_MINT = new PublicKey("${usdcMint.toBase58()}");`);
  console.log("==============================================\n");
})();
