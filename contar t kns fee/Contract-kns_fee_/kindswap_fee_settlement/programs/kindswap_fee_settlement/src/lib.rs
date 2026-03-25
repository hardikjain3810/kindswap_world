use anchor_lang::prelude::*;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;
use instructions::{admin::*, collect_fee::*, initialize::*, settle::*};

declare_id!("83yzPgWLoiHjaKcwpqmN6EJdYMwFXVJLsHp5bLTFNr8X");

#[program]
pub mod kindswap {
    use super::*;
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        params: InitializeConfigParams,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }
    pub fn collect_fee(ctx: Context<CollectFee>, amount: u64) -> Result<()> {
        instructions::collect_fee::handler(ctx, amount)
    }
    pub fn settle<'info>(ctx: Context<'_, '_, '_, 'info, Settle<'info>>, params: SettleParams) -> Result<()> {
        instructions::settle::handler(ctx, params)
    }
    pub fn update_threshold(ctx: Context<AdminAction>, new_threshold_usd: u64) -> Result<()> {
        instructions::admin::update_threshold(ctx, new_threshold_usd)
    }
    pub fn update_wallets(ctx: Context<AdminAction>, params: UpdateWalletsParams) -> Result<()> {
        instructions::admin::update_wallets(ctx, params)
    }
    pub fn update_allocations(
        ctx: Context<AdminAction>,
        params: UpdateAllocationsParams,
    ) -> Result<()> {
        instructions::admin::update_allocations(ctx, params)
    }
    pub fn update_settlement_interval(
        ctx: Context<AdminAction>,
        new_interval_secs: i64,
    ) -> Result<()> {
        instructions::admin::update_settlement_interval(ctx, new_interval_secs)
    }
    pub fn pause_system(ctx: Context<AdminAction>) -> Result<()> {
        instructions::admin::pause_system(ctx)
    }
    pub fn resume_system(ctx: Context<AdminAction>) -> Result<()> {
        instructions::admin::resume_system(ctx)
    }
    pub fn rotate_admin(ctx: Context<AdminAction>, new_owner: Pubkey) -> Result<()> {
        instructions::admin::rotate_admin(ctx, new_owner)
    }
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>, amount: u64) -> Result<()> {
        instructions::admin::emergency_withdraw(ctx, amount)
    }
    pub fn lock_wallet(ctx: Context<AdminAction>, wallet_type: u8) -> Result<()> {
        instructions::admin::lock_wallet(ctx, wallet_type)
    }
    pub fn unlock_wallet(ctx: Context<AdminAction>, wallet_type: u8) -> Result<()> {
        instructions::admin::unlock_wallet(ctx, wallet_type)
    }
}
