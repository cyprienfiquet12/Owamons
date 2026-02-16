/**
 * Constantes de rareté
 */
export const RARITY = {
  COMMON: 'COMMON',
  RARE: 'RARE',
  EPIC: 'EPIC',
  LEGENDARY: 'LEGENDARY'
};

/**
 * Probabilités de spawn par rareté
 */
export const SPAWN_PROBABILITIES = {
  [RARITY.COMMON]: 0.70,
  [RARITY.RARE]: 0.20,
  [RARITY.EPIC]: 0.09,
  [RARITY.LEGENDARY]: 0.01
};

/**
 * Taux de capture de base par rareté
 */
export const BASE_CAPTURE_RATES = {
  [RARITY.COMMON]: 0.65,
  [RARITY.RARE]: 0.40,
  [RARITY.EPIC]: 0.20,
  [RARITY.LEGENDARY]: 0.05
};

/**
 * Gains Pokécoins par rareté (capture réussie)
 */
export const COIN_REWARDS_CAPTURE = {
  [RARITY.COMMON]: 10,
  [RARITY.RARE]: 25,
  [RARITY.EPIC]: 50,
  [RARITY.LEGENDARY]: 200
};

/**
 * Gains Pokécoins par type de combat
 */
export const COIN_REWARDS_BATTLE = {
  wild: 15,
  arena: 50,
  boss: 100
};

/**
 * Gains XP par action
 */
export const XP_REWARDS = {
  participation: 5,
  capture: 20,
  victory: 30
};

/**
 * Plafond de capture pour les légendaires
 */
export const LEGENDARY_CAPTURE_CAP = 0.25;

/**
 * Timer de vote par type d'événement (en secondes)
 */
export const VOTE_TIMERS = {
  normal: 90,    // 1m30 pour Pokémon sauvage
  legendary: 90  // 1m30 pour légendaire
};


