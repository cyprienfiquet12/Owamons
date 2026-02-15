import { query, queryOne, queryResult } from '../database/connection.js';
import { COIN_REWARDS_CAPTURE, COIN_REWARDS_BATTLE, XP_REWARDS } from '../utils/rarity.js';

/**
 * Calcule l'XP requis pour un niveau donné
 * Formule: 100 × level^1.5
 * @param {number} level 
 * @returns {number}
 */
export function getRequiredXP(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Calcule le niveau d'un utilisateur basé sur son XP
 * @param {number} xp 
 * @returns {number}
 */
export function calculateLevel(xp) {
  let level = 1;
  let requiredXP = getRequiredXP(level);
  
  while (xp >= requiredXP) {
    level++;
    requiredXP = getRequiredXP(level);
  }
  
  return level;
}

/**
 * Ajoute de l'XP à un utilisateur et met à jour son niveau si nécessaire
 * @param {number} userId 
 * @param {number} xpAmount 
 * @returns {Promise<Object>} { newXP, newLevel, leveledUp }
 */
export async function addXP(userId, xpAmount) {
  const user = await queryOne('SELECT xp, level FROM users WHERE id = ?', [userId]);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const oldLevel = user.level;
  const newXP = user.xp + xpAmount;
  const newLevel = calculateLevel(newXP);
  const leveledUp = newLevel > oldLevel;
  
  await query('UPDATE users SET xp = ?, level = ? WHERE id = ?', [newXP, newLevel, userId]);
  
  return {
    newXP,
    newLevel,
    leveledUp,
    oldLevel
  };
}

/**
 * Ajoute des Pokécoins à un utilisateur (atomique pour la concurrence).
 * @param {number} userId 
 * @param {number} amount 
 * @returns {Promise<number>} Nouveau solde
 */
export async function addCoins(userId, amount) {
  const result = await queryResult(
    'UPDATE users SET poke_coins = poke_coins + ? WHERE id = ? RETURNING poke_coins',
    [amount, userId]
  );
  const row = result.rows?.[0];
  if (!row) {
    throw new Error('User not found');
  }
  return row.poke_coins;
}

/**
 * Retire des Pokécoins à un utilisateur (atomique : évite les race conditions en concurrence).
 * @param {number} userId 
 * @param {number} amount 
 * @returns {Promise<number>} Nouveau solde
 * @throws {Error} Si solde insuffisant ou utilisateur introuvable
 */
export async function deductCoins(userId, amount) {
  const result = await queryResult(
    'UPDATE users SET poke_coins = poke_coins - ? WHERE id = ? AND poke_coins >= ? RETURNING poke_coins',
    [amount, userId, amount]
  );
  const row = result.rows?.[0];
  if (!row) {
    const user = await queryOne('SELECT poke_coins FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error('User not found');
    }
    throw new Error('Insufficient coins');
  }
  return row.poke_coins;
}

/**
 * Récompense un utilisateur pour une capture réussie
 * @param {number} userId 
 * @param {string} rarity 
 * @returns {Promise<Object>} Récompenses accordées
 */
export async function rewardCapture(userId, rarity) {
  const coins = COIN_REWARDS_CAPTURE[rarity] || 0;
  const xp = XP_REWARDS.capture;
  
  await addCoins(userId, coins);
  const xpResult = await addXP(userId, xp);
  
  return {
    coins,
    xp,
    ...xpResult
  };
}

/**
 * Récompense un utilisateur pour une victoire en combat
 * @param {number} userId 
 * @param {string} battleType - 'wild', 'arena', ou 'boss'
 * @returns {Promise<Object>} Récompenses accordées
 */
export async function rewardBattleVictory(userId, battleType) {
  const coins = COIN_REWARDS_BATTLE[battleType] || 0;
  const xp = XP_REWARDS.victory;
  
  await addCoins(userId, coins);
  const xpResult = await addXP(userId, xp);
  
  return {
    coins,
    xp,
    ...xpResult
  };
}

/**
 * Récompense un utilisateur pour une simple participation
 * @param {number} userId 
 * @returns {Promise<Object>} Récompenses accordées
 */
export async function rewardParticipation(userId) {
  const coins = 2; // Optionnel selon la doc
  const xp = XP_REWARDS.participation;
  
  await addCoins(userId, coins);
  const xpResult = await addXP(userId, xp);
  
  return {
    coins,
    xp,
    ...xpResult
  };
}

/**
 * Obtient le solde de Pokécoins d'un utilisateur
 * @param {number} userId 
 * @returns {Promise<number>}
 */
export async function getCoins(userId) {
  const user = await queryOne('SELECT poke_coins FROM users WHERE id = ?', [userId]);
  return user ? user.poke_coins : 0;
}

/**
 * Obtient les statistiques d'un utilisateur (XP, niveau, coins)
 * @param {number} userId 
 * @returns {Promise<Object>}
 */
export async function getUserStats(userId) {
  const user = await queryOne('SELECT xp, level, poke_coins FROM users WHERE id = ?', [userId]);
  
  if (!user) {
    return null;
  }
  
  return {
    xp: user.xp,
    level: user.level,
    coins: user.poke_coins,
    requiredXP: getRequiredXP(user.level),
    nextLevelXP: getRequiredXP(user.level + 1)
  };
}
