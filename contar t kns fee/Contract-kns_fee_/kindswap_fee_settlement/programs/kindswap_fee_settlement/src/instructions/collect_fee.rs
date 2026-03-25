//! collect_fee — called by the KindSwap backend after every successful Jupiter swap.
//! Deducts 0.10% from the user's token account and deposits it into the fee vault ATA.

use crate::errors::KindSwapError;
use crate::events::FeeCollected;
use crate::state::{ConfigAccount, FeeVault};
use crate::utils::math::calculate_fee;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

pub const FEE_BPS: u16 = 10; // 0.10%

#[derive(Accounts)]
pub struct CollectFee<'info> {
    /// The user / relayer paying for the transaction
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Global config (read-only for validation)
    #[account(
        seeds = [b"config"],
        bump  = config.bump,
    )]
    pub config: Box<Account<'info, ConfigAccount>>,

    /// Per-token fee vault state (created on first collection for a new token)
    #[account(
        init_if_needed,
        payer  = payer,
        space  = FeeVault::LEN,
        seeds  = [b"fee_vault", mint.key().as_ref()],
        bump,
    )]
    pub fee_vault: Box<Account<'info, FeeVault>>,

    /// Token account owned by the fee_vault PDA — accumulates raw fees
    #[account(
        init_if_needed,
        payer             = payer,
        associated_token::mint      = mint,
        associated_token::authority = fee_vault,
    )]
    pub fee_vault_ata: Box<Account<'info, TokenAccount>>,

    /// Source: user's token account to debit
    #[account(
        mut,
        constraint = source_ata.mint == mint.key(),
        constraint = source_ata.owner == payer.key(),
    )]
    pub source_ata: Box<Account<'info, TokenAccount>>,

    pub mint: Box<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CollectFee>, swap_amount: u64) -> Result<()> {
    // System must not be paused
    require!(!ctx.accounts.config.paused, KindSwapError::SystemPaused);

    // Calculate 0.10% fee
    let fee_amount = calculate_fee(swap_amount, FEE_BPS)?;
    require!(fee_amount > 0, KindSwapError::ZeroFeeAmount);

    // Ensure user has enough balance
    require!(
        ctx.accounts.source_ata.amount >= fee_amount,
        anchor_lang::error::ErrorCode::AccountNotEnoughKeys
    );

    // Transfer fee from user ATA → fee vault ATA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.source_ata.to_account_info(),
            to: ctx.accounts.fee_vault_ata.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, fee_amount)?;

    // Update vault accumulator
    let vault = &mut ctx.accounts.fee_vault;
    vault.mint = ctx.accounts.mint.key();
    vault.accumulated = vault
        .accumulated
        .checked_add(fee_amount)
        .ok_or(KindSwapError::MathError)?;

    let clock = Clock::get()?;
    emit!(FeeCollected {
        mint: ctx.accounts.mint.key(),
        amount: fee_amount,
        payer: ctx.accounts.payer.key(),
        ts: clock.unix_timestamp,
    });

    Ok(())
}
