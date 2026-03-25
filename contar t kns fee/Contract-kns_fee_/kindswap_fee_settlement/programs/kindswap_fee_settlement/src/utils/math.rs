use crate::errors::KindSwapError;
use anchor_lang::prelude::*;

pub fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    let fee = (amount as u128)
        .checked_mul(fee_bps.into())
        .ok_or(KindSwapError::MathError)?
        .checked_div(10_000)
        .ok_or(KindSwapError::MathError)? as u64;
    Ok(fee)
}

pub fn split_usdc(
    total: u64,
    charity_bps: u16,
    rebate_bps: u16,
    platform_bps: u16,
) -> Result<(u64, u64, u64, u64)> {
    let charity = bps_of(total, charity_bps)?;
    let rebate = bps_of(total, rebate_bps)?;
    let platform = bps_of(total, platform_bps)?;
    let staking = total
        .checked_sub(charity)
        .and_then(|v| v.checked_sub(rebate))
        .and_then(|v| v.checked_sub(platform))
        .ok_or(KindSwapError::MathError)?;
    Ok((charity, rebate, platform, staking))
}

pub fn bps_of(amount: u64, bps: u16) -> Result<u64> {
    let result = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(KindSwapError::MathError)?
        .checked_div(10_000)
        .ok_or(KindSwapError::MathError)? as u64;
    Ok(result)
}

pub fn token_amount_to_usd_e6(token_amount: u64, price_e8: u64, token_decimals: u8) -> Result<u64> {
    let numerator = (token_amount as u128)
        .checked_mul(price_e8 as u128)
        .ok_or(KindSwapError::MathError)?
        .checked_mul(1_000_000)
        .ok_or(KindSwapError::MathError)?;
    let denominator = 10u128
        .checked_pow(token_decimals as u32 + 8)
        .ok_or(KindSwapError::MathError)?;
    Ok(numerator
        .checked_div(denominator)
        .ok_or(KindSwapError::MathError)? as u64)
}

