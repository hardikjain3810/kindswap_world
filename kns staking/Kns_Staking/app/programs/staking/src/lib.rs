use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};
use solana_program::keccak;

declare_id!("C9GxYtuuY61heBvnTpPhNkEyaofcCPUgJwcL14mwceU1");

// -------- Constants --------
const USDC_MIN_CLAIM: u64 = 1_000_000; // 1 USDC (6 decimals)
const SECONDS_PER_DAY: i64 = 86_400;
const MIN_STAKE: u64 = 1_000_000_000; // 1 KNS (9 decimals)

#[program]
pub mod kns_staking {
    use super::*;

    // -------------------------
    // 1) Initialize global config
    // -------------------------
    pub fn initialize(
        ctx: Context<Initialize>,
        admin: Pubkey,
        kns_mint: Pubkey,
        usdc_mint: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = admin;
        cfg.kns_mint = kns_mint;
        cfg.usdc_mint = usdc_mint;
        cfg.treasury = treasury;
        cfg.paused_deposits = false;
        cfg.paused_claims = false;
        cfg.total_weighted_stake = 0;
        cfg.distribution_period = 14 * SECONDS_PER_DAY;
        cfg.bump = ctx.bumps.config;
        Ok(())
    }

    // -------------------------
    // 2) Stake KNS (1 stake per wallet)
    // -------------------------
    pub fn stake(ctx: Context<Stake>, amount: u64, lock: LockTier) -> Result<()> {
        require!(amount >= MIN_STAKE, StakingError::StakeTooSmall);

        let cfg = &mut ctx.accounts.config;
        require!(!cfg.paused_deposits, StakingError::DepositsPaused);
        require_keys_eq!(
            ctx.accounts.kns_mint.key(),
            cfg.kns_mint,
            StakingError::InvalidMint
        );

        let expected_kns_ata = get_associated_token_address(
            &ctx.accounts.owner.key(),
            &ctx.accounts.kns_mint.key(),
        );
        require!(
            ctx.accounts.owner_kns_ata.key() == expected_kns_ata,
            StakingError::InvalidTokenAccount
        );
        require!(
            ctx.accounts.owner_kns_ata.owner == ctx.accounts.owner.key(),
            StakingError::InvalidTokenOwner
        );

        let stake_state = &mut ctx.accounts.user_stake;
        require!(!stake_state.active, StakingError::StakeAlreadyActive);

        let now = Clock::get()?.unix_timestamp;
        stake_state.owner = ctx.accounts.owner.key();
        stake_state.amount = amount;
        stake_state.lock = lock;
        stake_state.start_ts = now;
        stake_state.lock_end_ts = now
            .checked_add(lock_seconds(lock))
            .ok_or(StakingError::MathOverflow)?;
        stake_state.active = true;
        stake_state.bump = ctx.bumps.user_stake;
        stake_state.multiplier_bps = lock_multiplier_bps(lock);
        stake_state.weighted_amount = weighted_amount(amount, stake_state.multiplier_bps)?;

        cfg.total_weighted_stake = cfg
            .total_weighted_stake
            .checked_add(stake_state.weighted_amount)
            .ok_or(StakingError::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_kns_ata.to_account_info(),
                    to: ctx.accounts.stake_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    // -------------------------
    // 3) Unstake KNS (only after lock expiry)
    //    Closes both UserStake account and stake_vault (returns rent)
    // -------------------------
    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        let stake_state = &mut ctx.accounts.user_stake;

        require!(stake_state.active, StakingError::NoActiveStake);
        require_keys_eq!(
            stake_state.owner,
            ctx.accounts.owner.key(),
            StakingError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.kns_mint.key(),
            cfg.kns_mint,
            StakingError::InvalidMint
        );

        let expected_kns_ata = get_associated_token_address(
            &ctx.accounts.owner.key(),
            &ctx.accounts.kns_mint.key(),
        );
        require!(
            ctx.accounts.owner_kns_ata.key() == expected_kns_ata,
            StakingError::InvalidTokenAccount
        );
        require!(
            ctx.accounts.owner_kns_ata.owner == ctx.accounts.owner.key(),
            StakingError::InvalidTokenOwner
        );

        let now = Clock::get()?.unix_timestamp;
        require!(now >= stake_state.lock_end_ts, StakingError::StillLocked);

        cfg.total_weighted_stake = cfg
            .total_weighted_stake
            .checked_sub(stake_state.weighted_amount)
            .ok_or(StakingError::MathOverflow)?;

        let amount = stake_state.amount;
        let config_bump = ctx.bumps.config;
        let signer_seeds: &[&[&[u8]]] = &[&[b"config", &[config_bump]]];

        // Transfer KNS back to owner
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.stake_vault.to_account_info(),
                    to: ctx.accounts.owner_kns_ata.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // Close stake_vault token account — returns rent lamports to owner
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.stake_vault.to_account_info(),
                destination: ctx.accounts.owner.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        ))?;

        // UserStake account is closed via Anchor `close = owner` attribute
        Ok(())
    }

    // -------------------------
    // 4) Initialize epoch (admin only)
    //    Creates Epoch account + per-epoch USDC vault PDA
    // -------------------------
    pub fn initialize_epoch(
        ctx: Context<InitializeEpoch>,
        epoch_id: u64,
        merkle_root: [u8; 32],
        total_rewards: u64,
        snapshot_ts: i64,
    ) -> Result<()> {
        require!(total_rewards > 0, StakingError::InvalidAmount);
        let cfg = &ctx.accounts.config;
        require_admin(cfg, &ctx.accounts.admin)?;

        let now = Clock::get()?.unix_timestamp;
        // snapshot_ts must be in the past (already occurred) so it is a frozen, auditable anchor
        require!(snapshot_ts <= now, StakingError::InvalidSnapshotTs);

        // Deadline is always now + distribution_period — enforces the configured window
        let claim_deadline = now
            .checked_add(cfg.distribution_period)
            .ok_or(StakingError::MathOverflow)?;

        let epoch = &mut ctx.accounts.epoch;
        epoch.epoch_id = epoch_id;
        epoch.merkle_root = merkle_root;
        epoch.total_rewards = total_rewards;
        epoch.funded_amount = 0;
        epoch.snapshot_ts = snapshot_ts;
        epoch.claim_deadline = claim_deadline;
        epoch.status = EpochStatus::Pending;
        epoch.bump = ctx.bumps.epoch;
        epoch.vault_bump = ctx.bumps.epoch_vault;

        Ok(())
    }

    // -------------------------
    // 5) Fund epoch (admin only)
    //    Transfers USDC into epoch vault; amount must exactly match total_rewards
    //    Transitions epoch status: Pending → Active
    // -------------------------
    pub fn fund_epoch(ctx: Context<FundEpoch>, _epoch_id: u64, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_admin(cfg, &ctx.accounts.admin)?;
        require_keys_eq!(
            ctx.accounts.usdc_mint.key(),
            cfg.usdc_mint,
            StakingError::InvalidMint
        );

        let expected_admin_ata = get_associated_token_address(
            &ctx.accounts.admin.key(),
            &ctx.accounts.usdc_mint.key(),
        );
        require!(
            ctx.accounts.admin_usdc_ata.key() == expected_admin_ata,
            StakingError::InvalidTokenAccount
        );
        require!(
            ctx.accounts.admin_usdc_ata.owner == ctx.accounts.admin.key(),
            StakingError::InvalidTokenOwner
        );

        let epoch = &mut ctx.accounts.epoch;
        require!(
            epoch.status == EpochStatus::Pending,
            StakingError::InvalidEpochStatus
        );
        require!(
            amount == epoch.total_rewards,
            StakingError::FundAmountMismatch
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.admin_usdc_ata.to_account_info(),
                    to: ctx.accounts.epoch_vault.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            amount,
        )?;

        epoch.funded_amount = amount;
        epoch.status = EpochStatus::Active;

        Ok(())
    }

    // -------------------------
    // 6) Close epoch (admin only)
    //    Enforces deadline; sweeps unclaimed USDC to treasury
    //    Transitions epoch status: Active → Closed
    // -------------------------
    pub fn close_epoch(ctx: Context<CloseEpoch>, epoch_id: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_admin(cfg, &ctx.accounts.admin)?;

        let expected_treasury_ata = get_associated_token_address(
            &cfg.treasury,
            &ctx.accounts.usdc_mint.key(),
        );
        require!(
            ctx.accounts.treasury_usdc_ata.key() == expected_treasury_ata,
            StakingError::InvalidTokenAccount
        );
        require!(
            ctx.accounts.treasury_usdc_ata.owner == cfg.treasury,
            StakingError::InvalidTreasuryAccount
        );

        let epoch = &ctx.accounts.epoch;
        require!(
            epoch.status == EpochStatus::Active,
            StakingError::InvalidEpochStatus
        );

        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= epoch.claim_deadline,
            StakingError::DeadlineNotReached
        );

        // Sweep unclaimed USDC to treasury
        let vault_balance = ctx.accounts.epoch_vault.amount;
        if vault_balance > 0 {
            let epoch_id_bytes = epoch_id.to_le_bytes();
            let epoch_bump = ctx.bumps.epoch;
            let signer_seeds: &[&[&[u8]]] = &[&[b"epoch", epoch_id_bytes.as_ref(), &[epoch_bump]]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.epoch_vault.to_account_info(),
                        to: ctx.accounts.treasury_usdc_ata.to_account_info(),
                        authority: ctx.accounts.epoch.to_account_info(),
                    },
                    signer_seeds,
                ),
                vault_balance,
            )?;
        }

        ctx.accounts.epoch.status = EpochStatus::Closed;

        Ok(())
    }

    // -------------------------
    // 7) Claim (Jupiter-style Merkle proof per epoch)
    //    - epoch must be Active and within deadline
    //    - Verifies Merkle proof on-chain
    //    - Creates EpochClaimRecord PDA (init ensures one-time-per-wallet-per-epoch)
    //    - Transfers USDC from epoch vault to user
    // -------------------------
    pub fn claim(
        ctx: Context<Claim>,
        epoch_id: u64,
        amount: u64,
        merkle_proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused_claims, StakingError::ClaimsPaused);
        require_keys_eq!(
            ctx.accounts.usdc_mint.key(),
            cfg.usdc_mint,
            StakingError::InvalidMint
        );

        let expected_usdc_ata = get_associated_token_address(
            &ctx.accounts.owner.key(),
            &ctx.accounts.usdc_mint.key(),
        );
        require!(
            ctx.accounts.owner_usdc_ata.key() == expected_usdc_ata,
            StakingError::InvalidTokenAccount
        );
        require!(
            ctx.accounts.owner_usdc_ata.owner == ctx.accounts.owner.key(),
            StakingError::InvalidTokenOwner
        );

        let epoch = &ctx.accounts.epoch;
        require!(
            epoch.status == EpochStatus::Active,
            StakingError::InvalidEpochStatus
        );
        require!(
            Clock::get()?.unix_timestamp < epoch.claim_deadline,
            StakingError::EpochExpired
        );
        require!(amount >= USDC_MIN_CLAIM, StakingError::BelowMinClaim);

        // Verify Merkle proof: leaf = SHA256(epoch_id || claimer || amount)
        let claimer = ctx.accounts.owner.key();
        let leaf = compute_leaf(epoch_id, &claimer, amount);
        require!(
            verify_merkle_proof(&merkle_proof, epoch.merkle_root, leaf),
            StakingError::InvalidMerkleProof
        );

        // Init epoch_claim_record — Anchor's `init` errors if it already exists,
        // acting as the duplicate-claim guard.
        let claim_record = &mut ctx.accounts.epoch_claim_record;
        claim_record.epoch_id = epoch_id;
        claim_record.claimer = claimer;
        claim_record.amount_claimed = amount;
        claim_record.bump = ctx.bumps.epoch_claim_record;

        // Transfer USDC from epoch vault to user (epoch PDA signs)
        let epoch_id_bytes = epoch_id.to_le_bytes();
        let epoch_bump = ctx.bumps.epoch;
        let signer_seeds: &[&[&[u8]]] = &[&[b"epoch", epoch_id_bytes.as_ref(), &[epoch_bump]]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.epoch_vault.to_account_info(),
                    to: ctx.accounts.owner_usdc_ata.to_account_info(),
                    authority: ctx.accounts.epoch.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        Ok(())
    }

    pub fn set_pause(
        ctx: Context<SetPause>,
        pause_deposits: bool,
        pause_claims: bool,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require_admin(cfg, &ctx.accounts.admin)?;
        cfg.paused_deposits = pause_deposits;
        cfg.paused_claims = pause_claims;
        Ok(())
    }

    // -------------------------
    // 8) Transfer admin authority (current admin only)
    //    One-step transfer — new_admin takes effect immediately
    // -------------------------
    pub fn transfer_admin(ctx: Context<TransferAdmin>, new_admin: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require_admin(cfg, &ctx.accounts.admin)?;
        cfg.admin = new_admin;
        Ok(())
    }

    // -------------------------
    // 9) Update distribution period (admin only)
    //    Takes effect for future epochs only
    // -------------------------
    pub fn update_distribution_period(
        ctx: Context<UpdateConfig>,
        new_period_days: i64,
    ) -> Result<()> {
        require!(new_period_days > 0, StakingError::InvalidAmount);
        let cfg = &mut ctx.accounts.config;
        require_admin(cfg, &ctx.accounts.admin)?;
        cfg.distribution_period = new_period_days
            .checked_mul(SECONDS_PER_DAY)
            .ok_or(StakingError::MathOverflow)?;
        Ok(())
    }

    // -------------------------
    // 10) View: user weight (off-chain engine snapshot support)
    // -------------------------
    pub fn get_user_weight(ctx: Context<GetWeight>) -> Result<u128> {
        Ok(ctx.accounts.user_stake.weighted_amount)
    }

    // -------------------------
    // 11) View: total weight (off-chain engine snapshot support)
    // -------------------------
    pub fn get_total_weight(ctx: Context<GetTotalWeight>) -> Result<u128> {
        Ok(ctx.accounts.config.total_weighted_stake)
    }
}

// -------- Account Structs --------

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub kns_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub treasury: Pubkey,
    pub paused_deposits: bool,
    pub paused_claims: bool,
    pub total_weighted_stake: u128,
    pub distribution_period: i64,
    pub bump: u8,
}

#[account]
pub struct UserStake {
    pub owner: Pubkey,
    pub active: bool,
    pub amount: u64,
    pub lock: LockTier,
    pub start_ts: i64,
    pub lock_end_ts: i64,
    pub multiplier_bps: u16,
    pub weighted_amount: u128,
    pub bump: u8,
}

#[account]
pub struct Epoch {
    pub epoch_id: u64,
    pub merkle_root: [u8; 32],
    pub total_rewards: u64,
    pub funded_amount: u64,
    pub snapshot_ts: i64,
    pub claim_deadline: i64,
    pub status: EpochStatus,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
pub struct EpochClaimRecord {
    pub epoch_id: u64,
    pub claimer: Pubkey,
    pub amount_claimed: u64,
    pub bump: u8,
}

// -------- Enums --------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LockTier {
    M1,  // 1 month  (30 days)  — 1.0×
    M3,  // 3 months (90 days)  — 1.5×
    M6,  // 6 months (180 days) — 2.0×
    M12, // 12 months (365 days) — 3.0×
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum EpochStatus {
    Pending, // initialized, awaiting funding
    Active,  // funded, claims open
    Closed,  // deadline passed, unclaimed funds swept to treasury
}

// -------- Contexts --------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 155,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    pub kns_mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + 77,
        seeds = [b"user_stake", owner.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(
        init_if_needed,
        payer = owner,
        token::mint = kns_mint,
        token::authority = config,
        seeds = [b"stake_vault", owner.key().as_ref()],
        bump
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = owner_kns_ata.mint == kns_mint.key())]
    pub owner_kns_ata: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    pub kns_mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    // `close = owner` returns rent to owner after instruction ← M16
    #[account(
        mut,
        close = owner,
        seeds = [b"user_stake", owner.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(
        mut,
        seeds = [b"stake_vault", owner.key().as_ref()],
        bump
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = owner_kns_ata.mint == kns_mint.key())]
    pub owner_kns_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct InitializeEpoch<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + 75,  // +8 for snapshot_ts field
        seeds = [b"epoch", epoch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch: Account<'info, Epoch>,

    // Per-epoch isolated USDC vault — authority is the epoch PDA ← M6
    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = epoch,
        seeds = [b"epoch_vault", epoch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct FundEpoch<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"epoch", epoch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch: Account<'info, Epoch>,

    #[account(
        mut,
        seeds = [b"epoch_vault", epoch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = admin_usdc_ata.mint == usdc_mint.key())]
    pub admin_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct CloseEpoch<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"epoch", epoch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch: Account<'info, Epoch>,

    #[account(
        mut,
        seeds = [b"epoch_vault", epoch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch_vault: Account<'info, TokenAccount>,

    #[account(mut, constraint = treasury_usdc_ata.mint == usdc_mint.key())]
    pub treasury_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct Claim<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"epoch", epoch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch: Account<'info, Epoch>,

    #[account(
        mut,
        seeds = [b"epoch_vault", epoch_id.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch_vault: Account<'info, TokenAccount>,

    // Init creates this account — fails if already exists = duplicate-claim guard ← M5/M8
    #[account(
        init,
        payer = owner,
        space = 8 + 49,
        seeds = [b"epoch_claim", epoch_id.to_le_bytes().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub epoch_claim_record: Account<'info, EpochClaimRecord>,

    #[account(mut, constraint = owner_usdc_ata.mint == usdc_mint.key())]
    pub owner_usdc_ata: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetWeight<'info> {
    #[account(seeds = [b"user_stake", owner.key().as_ref()], bump)]
    pub user_stake: Account<'info, UserStake>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetTotalWeight<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
}

// -------- Helpers --------

fn require_admin(cfg: &Config, admin: &Signer) -> Result<()> {
    require_keys_eq!(cfg.admin, admin.key(), StakingError::Unauthorized);
    Ok(())
}

fn lock_seconds(lock: LockTier) -> i64 {
    match lock {
        LockTier::M1  =>  30 * SECONDS_PER_DAY,
        LockTier::M3  =>  90 * SECONDS_PER_DAY,
        LockTier::M6  => 180 * SECONDS_PER_DAY,
        LockTier::M12 => 365 * SECONDS_PER_DAY,
    }
}

fn lock_multiplier_bps(lock: LockTier) -> u16 {
    match lock {
        LockTier::M1 => 10_000,
        LockTier::M3 => 15_000,
        LockTier::M6 => 20_000,
        LockTier::M12 => 30_000,
    }
}

fn weighted_amount(amount: u64, multiplier_bps: u16) -> Result<u128> {
    (amount as u128)
        .checked_mul(multiplier_bps as u128)
        .ok_or(StakingError::MathOverflow.into())
        .and_then(|v| {
            v.checked_div(10_000)
                .ok_or(StakingError::MathOverflow.into())
        })
}

/// Leaf = Keccak256(epoch_id_le ++ claimer_pubkey ++ amount_le)
fn compute_leaf(epoch_id: u64, claimer: &Pubkey, amount: u64) -> [u8; 32] {
    let mut buf = [0u8; 48]; // 8 + 32 + 8
    buf[..8].copy_from_slice(&epoch_id.to_le_bytes());
    buf[8..40].copy_from_slice(claimer.as_ref());
    buf[40..48].copy_from_slice(&amount.to_le_bytes());
    keccak::hash(&buf).0
}

/// Sorted-pair Keccak256 Merkle proof verification
fn verify_merkle_proof(proof: &[[u8; 32]], root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut computed = leaf;
    for node in proof {
        let mut buf = [0u8; 64];
        if computed <= *node {
            buf[..32].copy_from_slice(&computed);
            buf[32..].copy_from_slice(node);
        } else {
            buf[..32].copy_from_slice(node);
            buf[32..].copy_from_slice(&computed);
        }
        computed = keccak::hash(&buf).0;
    }
    computed == root
}

// -------- Errors --------

#[error_code]
pub enum StakingError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Deposits are paused")]
    DepositsPaused,
    #[msg("Claims are paused")]
    ClaimsPaused,
    #[msg("Stake already active (one stake per wallet)")]
    StakeAlreadyActive,
    #[msg("No active stake")]
    NoActiveStake,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Stake is still locked")]
    StillLocked,
    #[msg("Below minimum claim amount (1 USDC)")]
    BelowMinClaim,
    #[msg("Invalid mint provided")]
    InvalidMint,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid epoch status for this operation")]
    InvalidEpochStatus,
    #[msg("Fund amount does not match epoch total_rewards")]
    FundAmountMismatch,
    #[msg("Claim deadline has not been reached yet")]
    DeadlineNotReached,
    #[msg("Epoch claim deadline has passed")]
    EpochExpired,
    #[msg("Claim deadline must be in the future")]
    InvalidDeadline,
    #[msg("snapshot_ts must be in the past")]
    InvalidSnapshotTs,
    #[msg("Invalid Merkle proof")]
    InvalidMerkleProof,
    #[msg("Token account address does not match expected ATA")]
    InvalidTokenAccount,
    #[msg("Token account authority does not match expected wallet")]
    InvalidTokenOwner,
    #[msg("Stake amount below minimum (1 KNS)")]
    StakeTooSmall,
    #[msg("Treasury token account does not belong to configured treasury")]
    InvalidTreasuryAccount,
}
