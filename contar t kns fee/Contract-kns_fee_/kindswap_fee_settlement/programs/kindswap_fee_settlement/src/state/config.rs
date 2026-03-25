use anchor_lang::prelude::*;

/// Global configuration account (singleton PDA: seeds = [b"config"])
#[account]
#[derive(Default)]
pub struct ConfigAccount {
    /// Program owner
    pub authority: Pubkey,
    /// Squads multisig PDA — required for high-risk actions
    pub multisig: Pubkey,
    /// Minimum token USD value (6-decimal USDC units). Default $2 = 2_000_000
    pub threshold_usd: u64,
    /// Fee allocations in basis points (must sum to 10_000)
    pub charity_bps: u16,
    pub rebate_bps: u16,
    pub platform_bps: u16,
    pub staking_bps: u16,
    /// Destination wallets
    pub charity_wallet: Pubkey,
    pub rebate_wallet: Pubkey,
    pub platform_wallet: Pubkey,
    pub staking_contract: Pubkey,
    /// Emergency wallet lock flags
    pub charity_locked: bool,
    pub rebate_locked: bool,
    pub platform_locked: bool,
    pub staking_locked: bool,
    /// Settlement schedule
    pub settlement_interval: i64, // seconds; default 604_800 (1 week)
    pub last_settlement_ts: i64, // unix timestamp of last successful run
    /// Emergency pause
    pub paused: bool,
    /// PDA bump
    pub bump: u8,
}

impl ConfigAccount {
    pub const LEN: usize = 8   // discriminator
        + 32 + 32              // owner, multisig
        + 8                    // threshold_usd
        + 2 + 2 + 2 + 2        // bps fields
        + 32 + 32 + 32 + 32    // wallets
        + 1 + 1 + 1 + 1        // lock flags
        + 8 + 8                // interval, last_ts
        + 1                    // paused
        + 1                    // bump
        + 64; // padding

    pub fn validate_allocations(&self) -> bool {
        (self.charity_bps as u32
            + self.rebate_bps as u32
            + self.platform_bps as u32
            + self.staking_bps as u32)
            == 10_000
    }

    pub fn is_authorized(&self, signer: &Pubkey) -> bool {
        signer == &self.authority || signer == &self.multisig
    }

    pub fn set_wallet_lock(&mut self, wallet_type: u8, locked: bool) {
        match wallet_type {
            0 => self.charity_locked = locked,
            1 => self.rebate_locked = locked,
            2 => self.platform_locked = locked,
            3 => self.staking_locked = locked,
            _ => {}
        }
    }
}
