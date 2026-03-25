# KindSwap — Solana Program

Fee Collection, Conversion & Distribution System

---

## Architecture

```
programs/kindswap/src/
  lib.rs                    # Entry point, instruction routing
  errors.rs                 # KindSwapError enum (18 error codes)
  events.rs                 # All on-chain #[event] structs
  state/
    config.rs               # ConfigAccount PDA  [b"config"]
    fee_vault.rs            # FeeVault PDA        [b"fee_vault", mint]
  instructions/
    initialize.rs           # initialize_config
    collect_fee.rs          # collect_fee (0.10% per swap)
    settle.rs               # settle — weekly core instruction
    admin.rs                # All 10 admin instructions
  utils/
    math.rs                 # Checked arithmetic, fee & BPS helpers
    oracle.rs               # Pyth price feed validation
    jupiter.rs              # Jupiter v6 CPI wrapper
tests/
  kindswap.ts               # Full Anchor / Mocha test suite
scripts/
  settle.ts                 # Off-chain weekly settlement trigger
  monitor-gas.ts            # Gas balance monitor (run every 6h)
  listener.ts               # On-chain event subscriber
```

---

## Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

# Install Node deps
yarn install
```

---

## Build & Test

```bash
# Build the program
anchor build

# Run all tests against localnet (auto-starts validator)
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

---

## Instructions

| Instruction                | Authority         | Description                              |
|----------------------------|-------------------|------------------------------------------|
| `initialize_config`        | Owner             | One-time setup                           |
| `collect_fee`              | Anyone (payer)    | Deduct 0.10% fee after swap              |
| `settle`                   | Anyone            | Weekly settlement (guarded by interval)  |
| `update_threshold`         | Owner / Multisig  | Change $2 USD threshold                  |
| `update_wallets`           | Owner / Multisig  | Update destination wallet addresses      |
| `update_allocations`       | Owner / Multisig  | Change split percentages (must = 100%)   |
| `update_settlement_interval` | Owner / Multisig | Change weekly cadence                  |
| `pause_system`             | Owner / Multisig  | Emergency pause                          |
| `resume_system`            | Owner / Multisig  | Resume after pause                       |
| `rotate_admin`             | **Multisig only** | Transfer ownership                       |
| `emergency_withdraw`       | **Multisig only** | Emergency fund rescue                    |
| `lock_wallet`              | Owner / Multisig  | Block a destination wallet               |
| `unlock_wallet`            | Owner / Multisig  | Re-enable a locked wallet                |

---

## Fee Split

| Destination   | Basis Points | Percentage |
|---------------|-------------|------------|
| Charity       | 2500        | 25%        |
| Rebate Pool   | 1000        | 10%        |
| Platform      | 3500        | 35%        |
| Staking       | 3000        | 30%        |

All values are owner-updatable. Must always sum to 10,000 bps (100%).

---

## Off-chain Scripts

```bash
# Run settlement check (cron every hour)
yarn settle

# Monitor gas (cron every 6 hours)
yarn monitor

# Subscribe to live events
yarn listen
```

Set environment variables:

| Variable        | Default                          | Description                    |
|-----------------|----------------------------------|--------------------------------|
| `RPC_URL`       | devnet                           | Solana RPC endpoint            |
| `WALLET_PATH`   | `~/.config/solana/id.json`       | Caller keypair                 |
| `PROGRAM_ID`    | placeholder                      | Deployed program ID            |
| `USDC_MINT`     | devnet USDC                      | USDC mint address              |
| `ALERT_WEBHOOK` | (empty)                          | Slack/Discord webhook URL      |
| `MIN_SOL`       | 0.1                              | Gas alert threshold            |
| `CALLER_WALLET` | (required for monitor)           | Wallet to check gas for        |

---

## Security Notes

- All arithmetic uses `checked_*` operations — no overflows.
- Vault balance is zeroed **before** Jupiter CPI (re-entrancy safe).
- Staking bucket absorbs rounding dust (`total - charity - rebate - platform`).
- Emergency withdraw and admin rotation require **multisig only**, not just owner.
- All 4 USDC distributions execute in a single atomic transaction — any failure reverts all.
- Pyth price feeds validated: staleness (≤60s) and confidence interval (≤5%).

---

## Production Checklist

- [ ] Replace `declare_id!` placeholder with actual deployed program ID
- [ ] Wire Jupiter CPI in `utils/jupiter.rs` using the `jupiter-cpi` crate
- [ ] Replace Pyth stub in `utils/oracle.rs` with full `pyth-solana-receiver-sdk` deserialization
- [ ] Configure Squads v4 multisig and set `config.multisig` on initialization
- [ ] Set `ALERT_WEBHOOK` for real-time monitoring
- [ ] Complete third-party security audit before mainnet deployment
