// ============================================================
//  scripts/listener.ts
//
//  Subscribes to all KindSwap program events and logs / alerts.
//  Run continuously:  npx ts-node scripts/listener.ts
// ============================================================
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const RPC_URL       = process.env.RPC_URL      || "https://api.devnet.solana.com";
const WALLET_PATH   = process.env.WALLET_PATH  || `${process.env.HOME}/.config/solana/id.json`;
const PROGRAM_ID    = new PublicKey(process.env.PROGRAM_ID || "KSWPxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK || "";

const HIGH_SEVERITY_EVENTS = new Set([
  "SystemPausedEvent",
  "AdminRotated",
  "EmergencyWithdrawEvent",
  "WalletLocked",
]);

async function sendAlert(eventName: string, data: Record<string, unknown>) {
  const msg = `🔔 ${eventName}: ${JSON.stringify(data, null, 2)}`;
  console.warn("[HIGH SEVERITY]", msg);
  if (ALERT_WEBHOOK) {
    await fetch(ALERT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🚨 KindSwap Event: *${eventName}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\`` }),
    });
  }
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const keypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
  );
  const wallet   = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idl = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../target/idl/kindswap.json"), "utf-8")
  );
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  console.log(`[${new Date().toISOString()}] KindSwap event listener started. Program: ${PROGRAM_ID.toBase58()}`);

  // Subscribe to all events
  program.eventNames().forEach((eventName) => {
    program.addEventListener(eventName, (event: Record<string, unknown>, slot: number, sig: string) => {
      const ts = new Date().toISOString();
      const logEntry = { ts, eventName, slot, sig, data: event };
      console.log(JSON.stringify(logEntry));

      // Optionally write to a log file
      fs.appendFileSync("events.log", JSON.stringify(logEntry) + "\n");

      // High-severity events → alert immediately
      if (HIGH_SEVERITY_EVENTS.has(eventName)) {
        sendAlert(eventName, event).catch(console.error);
      }

      // SettlementSkipped — log as warning
      if (eventName === "SettlementSkipped") {
        console.warn(`[WARN] Settlement skipped for mint ${(event as any).mint}: ${(event as any).reason}`);
      }

      // SettlementExecuted — log summary
      if (eventName === "SettlementExecuted") {
        const e = event as any;
        const totalUsdc = (e.totalUsdc?.toNumber?.() ?? 0) / 1e6;
        console.log(`[SETTLEMENT] Total: $${totalUsdc.toFixed(2)} USDC distributed`);
        console.log(`  Charity:  $${(e.charity?.toNumber?.() ?? 0) / 1e6}`);
        console.log(`  Rebate:   $${(e.rebate?.toNumber?.()  ?? 0) / 1e6}`);
        console.log(`  Platform: $${(e.platform?.toNumber?.() ?? 0) / 1e6}`);
        console.log(`  Staking:  $${(e.staking?.toNumber?.()  ?? 0) / 1e6}`);
      }
    });
  });

  console.log("Listening for events... (Ctrl+C to stop)");

  // Keep process alive
  await new Promise(() => {});
}

main().catch((e) => { console.error(e); process.exit(1); });
