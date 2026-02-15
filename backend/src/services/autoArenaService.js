import { spawnArena } from './arenaService.js';
import { broadcastArenaSpawn } from '../websocket/handlers.js';
import { io } from '../server.js';
import { sendChatMessage } from '../integrations/twitchChat.js';

let arenaSpawnTimer = null;
let isArenaSpawnActive = false;
let lastArenaSpawnTime = null;

/**
 * Planifie le prochain spawn d'arène
 * @param {number} minMinutes - Minutes minimum avant le prochain spawn
 * @param {number} maxMinutes - Minutes maximum avant le prochain spawn
 */
function scheduleNextArenaSpawn(minMinutes = 45, maxMinutes = 180) {
  if (arenaSpawnTimer) {
    clearTimeout(arenaSpawnTimer);
  }

  // Calculer un délai aléatoire entre minMinutes et maxMinutes
  const delayMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
  const delayMs = delayMinutes * 60 * 1000;

  arenaSpawnTimer = setTimeout(async () => {
    await spawnNextArena(minMinutes, maxMinutes);
  }, delayMs);
}

/**
 * Spawne la prochaine arène
 */
async function spawnNextArena(minMinutes, maxMinutes) {
  try {
    // Vérifier s'il y a déjà un événement actif avant de tenter de spawner
    const { hasActiveEvent } = await import('./spawnService.js');
    const activeEvent = await hasActiveEvent();
    
    if (activeEvent) {
      // Réessayer dans 30 secondes si un événement est actif
      setTimeout(() => {
        scheduleNextArenaSpawn(minMinutes, maxMinutes);
      }, 30 * 1000);
      return;
    }

    const arenaEvent = await spawnArena();
    
    if (!arenaEvent) {
      console.error('❌ Failed to spawn arena');
      scheduleNextArenaSpawn(minMinutes, maxMinutes);
      return;
    }

    lastArenaSpawnTime = new Date();
    
    // Envoyer un message dans le chat
    await sendChatMessage(`🏟️ Un champion d'arène ${arenaEvent.arena.type} apparaît ! ${arenaEvent.arena.name} défie les dresseurs ! Utilisez !combat ou !fuite`);
    
    // Diffuser l'événement au frontend
    if (io) {
      await broadcastArenaSpawn(io, arenaEvent);
    }

    // Planifier le prochain spawn
    scheduleNextArenaSpawn(minMinutes, maxMinutes);
  } catch (error) {
    console.error('❌ Error spawning arena:', error.message);
    
    // Si c'est juste qu'un événement est actif, réessayer plus tard
    if (error.message.includes('déjà actif') || error.message.includes('already active')) {
      setTimeout(() => {
        scheduleNextArenaSpawn(minMinutes, maxMinutes);
      }, 30 * 1000);
    } else {
      // En cas d'erreur autre, réessayer après 5 minutes
      setTimeout(() => {
        scheduleNextArenaSpawn(minMinutes, maxMinutes);
      }, 5 * 60 * 1000);
    }
  }
}

/**
 * Démarre le système de spawn automatique d'arène
 * @param {number} minMinutes - Minutes minimum entre les spawns (défaut: 45)
 * @param {number} maxMinutes - Minutes maximum entre les spawns (défaut: 180 = 3h)
 */
export function startAutoArenaSpawn(minMinutes = 45, maxMinutes = 180) {
  if (isArenaSpawnActive) {
    return;
  }

  isArenaSpawnActive = true;
  
  // Planifier le premier spawn immédiatement (pour les tests) ou après un délai
  // Pour la production, on peut attendre un peu avant le premier spawn
  const initialDelay = 5 * 60 * 1000; // 5 minutes avant le premier spawn
  setTimeout(() => {
    scheduleNextArenaSpawn(minMinutes, maxMinutes);
  }, initialDelay);
}

/**
 * Arrête le système de spawn automatique d'arène
 */
export function stopAutoArenaSpawn() {
  if (arenaSpawnTimer) {
    clearTimeout(arenaSpawnTimer);
    arenaSpawnTimer = null;
  }
  isArenaSpawnActive = false;
}

/**
 * Vérifie si le spawn automatique d'arène est actif
 */
export function isAutoArenaSpawnActive() {
  return isArenaSpawnActive;
}

/**
 * Obtient le temps du dernier spawn d'arène
 */
export function getLastArenaSpawnTime() {
  return lastArenaSpawnTime;
}

