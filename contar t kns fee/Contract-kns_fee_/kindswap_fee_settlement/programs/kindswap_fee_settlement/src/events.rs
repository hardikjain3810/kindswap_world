use anchor_lang::prelude::*;

// ── Fee Collection ──────────────────────────────────────────────────────────

#[event]
pub struct FeeCollected {
    pub mint: Pubkey,
    pub amount: u64,
    pub payer: Pubkey,
    pub ts: i64,
}

// ── Settlement ──────────────────────────────────────────────────────────────

#[event]
pub struct SettlementExecuted {
    pub total_usdc: u64,
    pub charity: u64,
    pub rebate: u64,
    pub platform: u64,
    pub staking: u64,
    pub ts: i64,
}

#[event]
pub struct SettlementSkipped {
    pub mint: Pubkey,
    pub reason: String,
    pub ts: i64,
}

// ── Config Updates ──────────────────────────────────────────────────────────

#[event]
pub struct ConfigInitialized {
    pub owner: Pubkey,
    pub multisig: Pubkey,
    pub ts: i64,
}

#[event]
pub struct ThresholdUpdated {
    pub old_threshold: u64,
    pub new_threshold: u64,
    pub ts: i64,
}

#[event]
pub struct AllocationsUpdated {
    pub charity_bps: u16,
    pub rebate_bps: u16,
    pub platform_bps: u16,
    pub staking_bps: u16,
    pub ts: i64,
}

#[event]
pub struct SettlementIntervalUpdated {
    pub old_interval: i64,
    pub new_interval: i64,
    pub ts: i64,
}

// ── Wallet Updates ──────────────────────────────────────────────────────────

#[event]
pub struct WalletUpdated {
    pub wallet_type: u8,
    pub old_address: Pubkey,
    pub new_address: Pubkey,
    pub ts: i64,
}

#[event]
pub struct WalletLocked {
    pub wallet_type: u8,
    pub ts: i64,
}

#[event]
pub struct WalletUnlocked {
    pub wallet_type: u8,
    pub ts: i64,
}

// ── Admin / Security ────────────────────────────────────────────────────────

#[event]
pub struct SystemPausedEvent {
    pub by: Pubkey,
    pub ts: i64,
}

#[event]
pub struct SystemResumedEvent {
    pub by: Pubkey,
    pub ts: i64,
}

#[event]
pub struct AdminRotated {
    pub old_owner: Pubkey,
    pub new_owner: Pubkey,
    pub ts: i64,
}

#[event]
pub struct EmergencyWithdrawEvent {
    pub mint: Pubkey,
    pub amount: u64,
    pub destination: Pubkey,
    pub by: Pubkey,
    pub ts: i64,
}
