// ============================================================
//  scripts/monitor-gas.ts
//
//  Monitors caller wallet SOL balance every 6 hours.
//  Run via cron:  0 */6 * * * npx ts-node scripts/monitor-gas.ts
// ============================================================
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL        = process.env.RPC_URL    || "https://api.devnet.solana.com";
const CALLER_WALLET  = process.env.CALLER_WALLET || "";
const ALERT_WEBHOOK  = process.env.ALERT_WEBHOOK  || "";
const MIN_SOL        = parseFloat(process.env.MIN_SOL || "0.1"); // alert threshold

async function sendAlert(msg: string) {
  console.warn("[GAS ALERT]", msg);
  if (ALERT_WEBHOOK) {
    await fetch(ALERT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `⛽ KindSwap Gas Monitor: ${msg}` }),
    });
  }
}

async function main() {
  if (!CALLER_WALLET) {
    console.error("CALLER_WALLET env var not set");
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const pubkey = new PublicKey(CALLER_WALLET);
  const lamports = await connection.getBalance(pubkey);
  const sol = lamports / 1e9;

  console.log(`[${new Date().toISOString()}] Caller wallet: ${sol.toFixed(4)} SOL`);

  if (sol < MIN_SOL) {
    await sendAlert(
      `Caller wallet ${CALLER_WALLET} has only ${sol.toFixed(4)} SOL — below minimum ${MIN_SOL} SOL. Top up immediately or the next settlement will revert.`
    );
  } else {
    console.log(`Gas OK: ${sol.toFixed(4)} SOL (min: ${MIN_SOL})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
