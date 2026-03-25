use anchor_lang::prelude::*;

#[error_code]
pub enum KindSwapError {
    #[msg("Signer is not the owner or a valid multisig signer")]
    NotAuthorized,

    #[msg("Allocation percentages must sum to exactly 10000 bps (100%)")]
    AllocationNot100,

    #[msg("Settlement interval has not elapsed since last settlement")]
    SettlementNotDue,

    #[msg("The system is currently paused by admin")]
    SystemPaused,

    #[msg("Insufficient SOL balance to cover transaction gas")]
    InsufficientGas,

    #[msg("Token USD value is below the configured conversion threshold")]
    BelowThreshold,

    #[msg("Pyth price feed is stale (older than max allowed age)")]
    OracleStale,

    #[msg("Pyth price is invalid, negative, or confidence interval too wide")]
    OraclePriceBad,

    #[msg("Partial settlement is not allowed; full atomic execution required")]
    PartialSettlementNotAllowed,

    #[msg("Calculated fee amount is zero; swap amount too small")]
    ZeroFeeAmount,

    #[msg("Settlement interval must be at least 3600 seconds (1 hour)")]
    IntervalTooShort,

    #[msg("Jupiter swap returned less USDC than the required minimum output")]
    SlippageExceeded,

    #[msg("USDC vault has zero balance after conversion; nothing to distribute")]
    NothingToDistribute,

    #[msg("A destination wallet is currently locked by admin")]
    WalletLocked,

    #[msg("Wallet Type should be less than 4")]
    InvalidWalletType,

    #[msg("Arithmetic overflow or underflow detected")]
    MathError,
}
