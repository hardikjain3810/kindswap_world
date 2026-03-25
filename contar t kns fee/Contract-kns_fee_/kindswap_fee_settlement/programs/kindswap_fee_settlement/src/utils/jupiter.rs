use crate::errors::KindSwapError;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

pub fn min_out_with_slippage(expected_usdc: u64) -> u64 {
    expected_usdc.saturating_mul(9950) / 10_000
}

pub struct JupiterSwapParams<'a, 'info> {
    pub jupiter_program: &'a AccountInfo<'info>,
    pub source_token_account: &'a Account<'info, TokenAccount>,
    pub destination_token_account: &'a Account<'info, TokenAccount>,
    pub vault_seeds: &'a [&'a [u8]],
    pub in_amount: u64,
    pub minimum_out_amount: u64,
    pub route_accounts: &'a [AccountInfo<'info>],
}

/// Execute a Jupiter v6 route swap.
/// Replace stub body with jupiter_cpi::cpi::shared_accounts_route in production.
pub fn swap_to_usdc<'info>(params: JupiterSwapParams<'_, 'info>) -> Result<u64> {
    require!(params.in_amount > 0, KindSwapError::ZeroFeeAmount);
    // Production: call jupiter_cpi CPI here and return actual USDC received
    let received: u64 = 0; // ← replace with post-swap delta
    require!(
        received >= params.minimum_out_amount,
        KindSwapError::SlippageExceeded
    );
    Ok(received)
}
