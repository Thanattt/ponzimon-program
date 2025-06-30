use crate::{constants::*, errors::PonzimonError};
use anchor_lang::prelude::*;

// Security helper functions

/// Validates that a card index is within bounds for a player's cards
pub fn validate_card_index(card_index: u8, cards_len: usize) -> Result<()> {
    require!(
        (card_index as usize) < cards_len,
        PonzimonError::CardIndexOutOfBounds
    );
    Ok(())
}

/// Safely adds berry consumption to total, checking for overflow
pub fn safe_add_berries(current: u64, to_add: u64) -> Result<u64> {
    current
        .checked_add(to_add)
        .ok_or(PonzimonError::ArithmeticOverflow.into())
}

/// Safely subtracts berry consumption from total, checking for underflow
pub fn safe_sub_berries(current: u64, to_sub: u64) -> Result<u64> {
    current
        .checked_sub(to_sub)
        .ok_or(PonzimonError::ArithmeticOverflow.into())
}

/// Safely adds hashpower to total, checking for overflow
pub fn safe_add_hashpower(current: u64, to_add: u64) -> Result<u64> {
    current
        .checked_add(to_add)
        .ok_or(PonzimonError::ArithmeticOverflow.into())
}

/// Safely subtracts hashpower from total, checking for underflow
pub fn safe_sub_hashpower(current: u64, to_sub: u64) -> Result<u64> {
    current
        .checked_sub(to_sub)
        .ok_or(PonzimonError::ArithmeticOverflow.into())
}

/// Gets the next higher rarity for card recycling
pub fn get_next_rarity(current_rarity: u8) -> Option<u8> {
    match current_rarity {
        COMMON => Some(UNCOMMON),
        UNCOMMON => Some(RARE),
        RARE => Some(DOUBLE_RARE),
        DOUBLE_RARE => Some(VERY_RARE),
        VERY_RARE => Some(SUPER_RARE),
        SUPER_RARE => Some(MEGA_RARE),
        MEGA_RARE => Some(MEGA_RARE), // Already at max rarity
        _ => None,                    // Invalid rarity
    }
}
