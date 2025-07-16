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

/// Calculates the current reward rate based on elapsed time since start_slot
///
/// Returns the reward rate per slot in micro-tokens based on the emission schedule:
/// - Days 1-30: 255,000 tokens/day (1,180,556 micro-tokens per slot)
/// - Days 31-60: 198,333 tokens/day (918,208 micro-tokens per slot)  
/// - Days 61-90: 141,667 tokens/day (655,847 micro-tokens per slot)
/// - After day 90: 0 (no more rewards)
pub fn calculate_current_reward_rate(current_slot: u64, start_slot: u64) -> u64 {
    if current_slot < start_slot {
        return 0;
    }

    let elapsed_slots = current_slot.saturating_sub(start_slot);

    if elapsed_slots < STAGE_1_DURATION_SLOTS {
        STAGE_1_REWARD_RATE
    } else if elapsed_slots < STAGE_1_DURATION_SLOTS + STAGE_2_DURATION_SLOTS {
        STAGE_2_REWARD_RATE
    } else if elapsed_slots
        < STAGE_1_DURATION_SLOTS + STAGE_2_DURATION_SLOTS + STAGE_3_DURATION_SLOTS
    {
        STAGE_3_REWARD_RATE
    } else {
        0 // After 90 days, no more rewards
    }
}

pub fn calculate_halvings(current_slot: u64, start_slot: u64, halving_interval: u64) -> u64 {
    current_slot.saturating_sub(start_slot) / halving_interval
}

pub fn calculate_max_halvings(initial_reward_rate: u64) -> u64 {
    if initial_reward_rate == 0 {
        return 0;
    }
    // Find position of highest set bit (effectively log2)
    64 - initial_reward_rate.leading_zeros() as u64
}

pub fn reward_after_halvings(initial: u64, halvings: u64) -> u64 {
    initial.checked_shr(halvings as u32).unwrap_or(0)
}
