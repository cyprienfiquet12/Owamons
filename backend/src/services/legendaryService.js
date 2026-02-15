import { RARITY, VOTE_TIMERS, LEGENDARY_CAPTURE_CAP } from '../utils/rarity.js';

// Cooldown global pour les légendaires (en millisecondes)
const LEGENDARY_COOLDOWN = 60 * 60 * 1000; // 1 heure
let lastLegendarySpawn = null;

/**
 * Vérifie si un légendaire peut spawner (cooldown global)
 * @returns {boolean}
 */
export function canSpawnLegendary() {
  if (!lastLegendarySpawn) {
    return true;
  }
  
  const timeSinceLastSpawn = Date.now() - lastLegendarySpawn;
  return timeSinceLastSpawn >= LEGENDARY_COOLDOWN;
}

/**
 * Enregistre qu'un légendaire a spawné
 */
export function recordLegendarySpawn() {
  lastLegendarySpawn = Date.now();
}

/**
 * Obtient le temps restant avant le prochain spawn légendaire possible
 * @returns {number} Temps en millisecondes, 0 si disponible
 */
export function getLegendaryCooldownRemaining() {
  if (!lastLegendarySpawn) {
    return 0;
  }
  
  const timeSinceLastSpawn = Date.now() - lastLegendarySpawn;
  const remaining = LEGENDARY_COOLDOWN - timeSinceLastSpawn;
  
  return Math.max(0, remaining);
}

/**
 * Vérifie si un Pokémon est légendaire
 * @param {Object} pokemon 
 * @returns {boolean}
 */
export function isLegendary(pokemon) {
  return pokemon.rarity === RARITY.LEGENDARY;
}

/**
 * Applique les règles spéciales pour les légendaires lors du spawn
 * @param {Object} pokemon 
 * @returns {Object} Événement avec règles spéciales appliquées
 */
export function applyLegendarySpawnRules(pokemon) {
  if (!isLegendary(pokemon)) {
    return null;
  }
  
  // Vérifier le cooldown
  if (!canSpawnLegendary()) {
    const remaining = getLegendaryCooldownRemaining();
    const minutes = Math.ceil(remaining / (60 * 1000));
    throw new Error(`Légendaire en cooldown. Prochain spawn possible dans ${minutes} minutes`);
  }
  
  // Enregistrer le spawn
  recordLegendarySpawn();
  
  return {
    isLegendary: true,
    voteDuration: VOTE_TIMERS.legendary,
    captureCap: LEGENDARY_CAPTURE_CAP,
    specialAnimation: true
  };
}

/**
 * Applique le plafond de capture pour les légendaires
 * @param {number} calculatedRate - Taux calculé
 * @returns {number} Taux plafonné
 */
export function applyLegendaryCaptureCap(calculatedRate) {
  return Math.min(calculatedRate, LEGENDARY_CAPTURE_CAP);
}

/**
 * Obtient les statistiques de spawn légendaire
 * @returns {Object}
 */
export function getLegendaryStats() {
  const canSpawn = canSpawnLegendary();
  const cooldownRemaining = getLegendaryCooldownRemaining();
  
  return {
    canSpawn,
    cooldownRemaining,
    cooldownMinutes: Math.ceil(cooldownRemaining / (60 * 1000)),
    lastSpawn: lastLegendarySpawn ? new Date(lastLegendarySpawn).toISOString() : null
  };
}

