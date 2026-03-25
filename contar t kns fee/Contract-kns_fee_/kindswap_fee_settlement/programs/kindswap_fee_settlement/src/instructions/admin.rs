use crate::errors::KindSwapError;
use crate::events::*;
use crate::state::{ConfigAccount, FeeVault};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct AdminAction<'info> {
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ConfigAccount>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    pub signer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ConfigAccount>,
    #[account(mut, seeds = [b"fee_vault", mint.key().as_ref()], bump = fee_vault.bump)]
    pub fee_vault: Account<'info, FeeVault>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = fee_vault)]
    pub fee_vault_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_ata: Account<'info, TokenAccount>,
    /// CHECK: verified via ATA constraint
    pub mint: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateWalletsParams {
    pub charity: Option<Pubkey>,
    pub rebate: Option<Pubkey>,
    pub platform: Option<Pubkey>,
    pub staking: Option<Pubkey>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateAllocationsParams {
    pub charity_bps: u16,
    pub rebate_bps: u16,
    pub platform_bps: u16,
    pub staking_bps: u16,
}

fn require_authority(config: &ConfigAccount, signer: &Pubkey) -> Result<()> {
    require!(config.is_authorized(signer), KindSwapError::NotAuthorized);
    Ok(())
}

fn require_multisig(config: &ConfigAccount, signer: &Pubkey) -> Result<()> {
    require!(
        signer == &config.multisig,
        KindSwapError::NotAuthorized
    );
    Ok(())
}

pub fn update_threshold(ctx: Context<AdminAction>, new_threshold_usd: u64) -> Result<()> {
    require_authority(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    let config = &mut ctx.accounts.config;
    let old = config.threshold_usd;
    config.threshold_usd = new_threshold_usd;
    emit!(ThresholdUpdated {
        old_threshold: old,
        new_threshold: new_threshold_usd,
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}

pub fn update_wallets(ctx: Context<AdminAction>, params: UpdateWalletsParams) -> Result<()> {
    require_authority(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    let config = &mut ctx.accounts.config;
    let ts = Clock::get()?.unix_timestamp;
    if let Some(a) = params.charity {
        let old = config.charity_wallet;
        config.charity_wallet = a;
        emit!(WalletUpdated {
            wallet_type: 0,
            old_address: old,
            new_address: a,
            ts
        });
    }
    if let Some(a) = params.rebate {
        let old = config.rebate_wallet;
        config.rebate_wallet = a;
        emit!(WalletUpdated {
            wallet_type: 1,
            old_address: old,
            new_address: a,
            ts
        });
    }
    if let Some(a) = params.platform {
        let old = config.platform_wallet;
        config.platform_wallet = a;
        emit!(WalletUpdated {
            wallet_type: 2,
            old_address: old,
            new_address: a,
            ts
        });
    }
    if let Some(a) = params.staking {
        let old = config.staking_contract;
        config.staking_contract = a;
        emit!(WalletUpdated {
            wallet_type: 3,
            old_address: old,
            new_address: a,
            ts
        });
    }
    Ok(())
}

pub fn update_allocations(
    ctx: Context<AdminAction>,
    params: UpdateAllocationsParams,
) -> Result<()> {
    require_authority(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    let total = params.charity_bps as u32
        + params.rebate_bps as u32
        + params.platform_bps as u32
        + params.staking_bps as u32;
    require!(total == 10_000, KindSwapError::AllocationNot100);
    let config = &mut ctx.accounts.config;
    config.charity_bps = params.charity_bps;
    config.rebate_bps = params.rebate_bps;
    config.platform_bps = params.platform_bps;
    config.staking_bps = params.staking_bps;
    emit!(AllocationsUpdated {
        charity_bps: params.charity_bps,
        rebate_bps: params.rebate_bps,
        platform_bps: params.platform_bps,
        staking_bps: params.staking_bps,
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}

pub fn update_settlement_interval(ctx: Context<AdminAction>, new_interval_secs: i64) -> Result<()> {
    require_authority(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    require!(new_interval_secs >= 3_600, KindSwapError::IntervalTooShort);
    let config = &mut ctx.accounts.config;
    let old = config.settlement_interval;
    config.settlement_interval = new_interval_secs;
    emit!(SettlementIntervalUpdated {
        old_interval: old,
        new_interval: new_interval_secs,
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}

pub fn pause_system(ctx: Context<AdminAction>) -> Result<()> {
    require_authority(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    ctx.accounts.config.paused = true;
    emit!(SystemPausedEvent {
        by: ctx.accounts.signer.key(),
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}

pub fn resume_system(ctx: Context<AdminAction>) -> Result<()> {
    require_authority(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    ctx.accounts.config.paused = false;
    emit!(SystemResumedEvent {
        by: ctx.accounts.signer.key(),
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}

pub fn rotate_admin(ctx: Context<AdminAction>, new_owner: Pubkey) -> Result<()> {
    require_multisig(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    let config = &mut ctx.accounts.config;
    let old = config.authority;
    config.authority = new_owner;
    emit!(AdminRotated {
        old_owner: old,
        new_owner,
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}

pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>, amount: u64) -> Result<()> {
    require_multisig(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    let mint_key = ctx.accounts.fee_vault.mint;
    let vault_bump = ctx.accounts.fee_vault.bump;
    let seeds: &[&[u8]] = &[b"fee_vault", mint_key.as_ref(), &[vault_bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fee_vault_ata.to_account_info(),
                to: ctx.accounts.destination_ata.to_account_info(),
                authority: ctx.accounts.fee_vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;
    let vault = &mut ctx.accounts.fee_vault;
    vault.accumulated = vault.accumulated.saturating_sub(amount);
    emit!(EmergencyWithdrawEvent {
        mint: mint_key,
        amount,
        destination: ctx.accounts.destination_ata.key(),
        by: ctx.accounts.signer.key(),
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}

pub fn lock_wallet(ctx: Context<AdminAction>, wallet_type: u8) -> Result<()> {
    require_authority(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    require!(wallet_type <= 3, KindSwapError::InvalidWalletType);
    ctx.accounts.config.set_wallet_lock(wallet_type, true);
    emit!(WalletLocked {
        wallet_type: wallet_type,
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}

pub fn unlock_wallet(ctx: Context<AdminAction>, wallet_type: u8) -> Result<()> {
    require_authority(&ctx.accounts.config, &ctx.accounts.signer.key())?;
    require!(wallet_type <= 3, KindSwapError::InvalidWalletType);
    ctx.accounts.config.set_wallet_lock(wallet_type, false);
    emit!(WalletUnlocked {
        wallet_type: wallet_type,
        ts: Clock::get()?.unix_timestamp
    });
    Ok(())
}
