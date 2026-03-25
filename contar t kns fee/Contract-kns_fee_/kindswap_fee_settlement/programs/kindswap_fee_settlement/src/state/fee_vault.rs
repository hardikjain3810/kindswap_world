use anchor_lang::prelude::*;

/// Per-token fee accumulation vault
/// PDA seeds: [b"fee_vault", mint.key().as_ref()]
#[account]
#[derive(Default)]
pub struct FeeVault {
    /// Token mint this vault accumulates
    pub mint: Pubkey,
    /// Raw token amount stored (not yet converted)
    pub accumulated: u64,
    /// PDA bump
    pub bump: u8,
}

impl FeeVault {
    pub const LEN: usize = 8   // discriminator
        + 32                   // mint
        + 8                    // accumulated
        + 1                    // bump
        + 32; // padding
}
