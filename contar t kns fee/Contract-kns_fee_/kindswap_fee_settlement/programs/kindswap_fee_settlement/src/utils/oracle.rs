use crate::errors::KindSwapError;
use crate::utils::math::token_amount_to_usd_e6;
use anchor_lang::prelude::*;

pub const MAX_PRICE_AGE_SECS: i64 = 60;
pub const MAX_CONF_RATIO_BPS: u64 = 500;

pub struct PythPrice {
    pub price_e8: u64,
}

/// Validate a Pyth PriceUpdateV2 account and extract a safe price.
/// In production replace with: pyth_solana_receiver_sdk::price_update::PriceUpdateV2
pub fn get_validated_price(price_account: &AccountInfo, clock: &Clock) -> Result<PythPrice> {
    let data = price_account.try_borrow_data()?;
    require!(data.len() >= 32, KindSwapError::OraclePriceBad);

    let publish_time = i64::from_le_bytes(data[8..16].try_into().unwrap());
    let age = clock.unix_timestamp.saturating_sub(publish_time);
    require!(age <= MAX_PRICE_AGE_SECS, KindSwapError::OracleStale);

    let raw_price = i64::from_le_bytes(data[16..24].try_into().unwrap());
    require!(raw_price > 0, KindSwapError::OraclePriceBad);

    let confidence = u64::from_le_bytes(data[24..32].try_into().unwrap());
    let price_u64 = raw_price as u64;
    let conf_bps = confidence
        .checked_mul(10_000)
        .unwrap_or(u64::MAX)
        .checked_div(price_u64)
        .unwrap_or(u64::MAX);
    require!(
        conf_bps < MAX_CONF_RATIO_BPS,
        KindSwapError::OraclePriceBad
    );

    Ok(PythPrice {
        price_e8: price_u64,
    })
}

pub fn usd_value_of_token(token_amount: u64, price: &PythPrice, token_decimals: u8) -> Result<u64> {
    token_amount_to_usd_e6(token_amount, price.price_e8, token_decimals)
}
