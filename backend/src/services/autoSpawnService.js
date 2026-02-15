import { spawnPokemon, getActiveEvent } from './spawnService.js';
import { broadcastSpawn } from '../websocket/handlers.js';
import { io } from '../server.js';

let autoSpawnTimeout = null;
let isAutoSpawnEnabled = false;

// Configuration par défaut (en minutes)
const DEFAULT_MIN_INTERVAL = 5; // 5 minutes minimum
const DEFAULT_MAX_INTERVAL = 15; // 15 minutes maximum
const MIN_INTERVAL_LIMIT = 1; // 1 minute minimum absolu
const MAX_INTERVAL_LIMIT = 60; // 60 minutes maximum absolu

/**
 * Génère un délai aléatoire entre min et max (en minutes)
 * @param {number} minMinutes - Minimum en minutes
 * @param {number} maxMinutes - Maximum en minutes
 * @returns {number} Délai en millisecondes
 */
function getRandomDelay(minMinutes, maxMinutes) {
  const min = Math.max(MIN_INTERVAL_LIMIT, minMinutes);
  const max = Math.min(MAX_INTERVAL_LIMIT, maxMinutes);
  
  if (min >= max) {
    console.warn(`⚠️  Min interval (${min}) >= Max interval (${max}). Using ${min} minutes.`);
    return min * 60 * 1000;
  }
  
  const randomMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomMinutes * 60 * 1000;
}

/**
 * Démarre le système de spawn automatique avec délai aléatoire
 * @param {number} minMinutes - Intervalle minimum en minutes (défaut: 5)
 * @param {number} maxMinutes - Intervalle maximum en minutes (défaut: 15)
 */
export function startAutoSpawn(minMinutes = DEFAULT_MIN_INTERVAL, maxMinutes = DEFAULT_MAX_INTERVAL) {
  if (isAutoSpawnEnabled) {
    return;
  }

  isAutoSpawnEnabled = true;

  // Spawner immédiatement au démarrage
  scheduleNextSpawn(minMinutes, maxMinutes);
}

/**
 * Arrête le système de spawn automatique
 */
export function stopAutoSpawn() {
  if (autoSpawnTimeout) {
    clearTimeout(autoSpawnTimeout);
    autoSpawnTimeout = null;
    isAutoSpawnEnabled = false;
  }
}

/**
 * Programme le prochain spawn avec un délai aléatoire
 * @param {number} minMinutes - Intervalle minimum en minutes
 * @param {number} maxMinutes - Intervalle maximum en minutes
 */
function scheduleNextSpawn(minMinutes, maxMinutes) {
  if (!isAutoSpawnEnabled) {
    return;
  }

  const delayMs = getRandomDelay(minMinutes, maxMinutes);

  autoSpawnTimeout = setTimeout(async () => {
    await spawnNextPokemon(minMinutes, maxMinutes);
  }, delayMs);
}

/**
 * Spawne le prochain Pokémon et programme le suivant
 * @param {number} minMinutes - Intervalle minimum en minutes
 * @param {number} maxMinutes - Intervalle maximum en minutes
 */
async function spawnNextPokemon(minMinutes, maxMinutes) {
  try {
    // Vérifier s'il y a déjà un événement actif (spawn ou arène)
    const { hasActiveEvent } = await import('./spawnService.js');
    const activeEvent = await hasActiveEvent();
    
    if (activeEvent) {
      // Réessayer dans 30 secondes si un événement est actif
      setTimeout(() => {
        scheduleNextSpawn(minMinutes, maxMinutes);
      }, 30 * 1000);
      return;
    }

    const event = await spawnPokemon();

    // Diffuser l'événement via Socket.io
    if (io) {
      await broadcastSpawn(io, event);
    }

    // Programmer le prochain spawn avec un délai aléatoire
    scheduleNextSpawn(minMinutes, maxMinutes);
  } catch (error) {
    console.error('❌ Error in auto-spawn:', error.message);
    
    // Si c'est juste qu'un événement est actif, réessayer plus tard
    if (error.message.includes('already in progress')) {
      setTimeout(() => {
        scheduleNextSpawn(minMinutes, maxMinutes);
      }, 30 * 1000);
    } else {
      console.error('   Full error:', error);
      // En cas d'erreur, réessayer quand même après un délai
      setTimeout(() => {
        scheduleNextSpawn(minMinutes, maxMinutes);
      }, 60 * 1000); // 1 minute en cas d'erreur
    }
  }
}

/**
 * Vérifie si le spawn automatique est activé
 * @returns {boolean}
 */
export function isAutoSpawnActive() {
  return isAutoSpawnEnabled;
}

/**
 * Obtient la configuration actuelle du spawn automatique
 * @returns {Object|null} Configuration avec min/max, ou null si désactivé
 */
export function getAutoSpawnConfig() {
  if (!isAutoSpawnEnabled) {
    return null;
  }
  
  const minMinutes = parseInt(process.env.AUTO_SPAWN_MIN_MINUTES) || DEFAULT_MIN_INTERVAL;
  const maxMinutes = parseInt(process.env.AUTO_SPAWN_MAX_MINUTES) || DEFAULT_MAX_INTERVAL;
  
  return {
    minMinutes,
    maxMinutes,
    enabled: true
  };
}

