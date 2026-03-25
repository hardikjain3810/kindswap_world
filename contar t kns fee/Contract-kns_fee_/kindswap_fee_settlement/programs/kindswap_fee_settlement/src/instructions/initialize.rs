use crate::errors::KindSwapError;
use crate::events::ConfigInitialized;
use crate::state::ConfigAccount;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeConfigParams {
    pub multisig: Pubkey,
    pub threshold_usd: u64,
    pub charity_bps: u16,
    pub rebate_bps: u16,
    pub platform_bps: u16,
    pub staking_bps: u16,
    pub charity_wallet: Pubkey,
    pub rebate_wallet: Pubkey,
    pub platform_wallet: Pubkey,
    pub staking_contract: Pubkey,
    pub settlement_interval: i64,
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = ConfigAccount::LEN, seeds = [b"config"], bump)]
    pub config: Account<'info, ConfigAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeConfig>, p: InitializeConfigParams) -> Result<()> {
    let total =
        p.charity_bps as u32 + p.rebate_bps as u32 + p.platform_bps as u32 + p.staking_bps as u32;
    require!(total == 10_000, KindSwapError::AllocationNot100);
    require!(
        p.settlement_interval >= 3_600,
        KindSwapError::IntervalTooShort
    );
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.owner.key();
    config.multisig = p.multisig;
    config.threshold_usd = p.threshold_usd;
    config.charity_bps = p.charity_bps;
    config.rebate_bps = p.rebate_bps;
    config.platform_bps = p.platform_bps;
    config.staking_bps = p.staking_bps;
    config.charity_wallet = p.charity_wallet;
    config.rebate_wallet = p.rebate_wallet;
    config.platform_wallet = p.platform_wallet;
    config.staking_contract = p.staking_contract;
    config.settlement_interval = p.settlement_interval;
    config.last_settlement_ts = 0;
    config.paused = false;
    config.bump = ctx.bumps.config;
    emit!(ConfigInitialized {
        owner: config.authority,
        multisig: config.multisig,
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}
