import { getActiveEvent, spawnPokemon, expireEvent, cleanupExpiredEvents } from '../services/spawnService.js';
import { registerVote, getVoteStats, attemptCapture, getEventVotes } from '../services/captureService.js';
import { query, queryOne, queryResult } from '../database/connection.js';
import { simulateBattle } from '../services/battleService.js';
import { sendChatMessage } from '../integrations/twitchChat.js';

/**
 * Gère les connexions WebSocket
 * @param {Socket} socket - Instance Socket.io
 * @param {Server} io - Instance Socket.io Server
 */
export function setupWebSocketHandlers(socket, io) {
  // Demander l'événement actif au moment de la connexion
  socket.on('get_active_event', async () => {
    await cleanupExpiredEvents();
    
    // Vérifier d'abord les spawns normaux
    const spawnEvent = await getActiveEvent();
    
    if (spawnEvent) {
      const voteStats = await getVoteStats(spawnEvent.id);
      socket.emit('pokemon_spawn', {
        ...spawnEvent,
        voteStats
      });
      return;
    }
    
    // Sinon, vérifier les arènes
    const { getActiveArenaEvent } = await import('../services/arenaService.js');
    const arenaEvent = await getActiveArenaEvent();
    
    if (arenaEvent) {
      const voteStats = await getVoteStats(arenaEvent.id);
      socket.emit('arena_spawn', {
        ...arenaEvent,
        voteStats
      });
      return;
    }
    
    // Aucun événement actif
    socket.emit('no_active_event');
  });

  // Vote pour capture/battle/flee
  socket.on('vote', async (data) => {
    try {
      const { eventId, userId, voteType } = data;
      
      if (!eventId || !userId || !voteType) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      const result = await registerVote(eventId, userId, voteType);
      
      if (!result.success) {
        let errorMessage = 'You have already voted';
        if (result.reason === 'already_has_badge') {
          errorMessage = 'You already have this arena badge and cannot participate';
        }
        socket.emit('vote_error', { message: errorMessage });
        return;
      }

      const voteStats = await getVoteStats(eventId);
      
      // Diffuser la mise à jour des votes à tous les clients
      io.emit('vote_update', {
        eventId,
        voteStats
      });

      socket.emit('vote_success', { voteType });
    } catch (error) {
      console.error('Error handling vote:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Tentative de capture
  socket.on('attempt_capture', async (data) => {
    try {
      const { eventId, userId, ballBonus } = data;
      
      if (!eventId || !userId) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      const result = await attemptCapture(eventId, userId, ballBonus || 0);
      
      if (result.success) {
        // Diffuser le succès à tous les clients
        io.emit('capture_success', {
          eventId,
          userId,
          pokemon: result.pokemon,
          rewards: result.rewards
        });
        
        socket.emit('capture_result', result);
      } else {
        socket.emit('capture_fail', {
          eventId,
          captureRate: result.captureRate,
          pokemon: result.pokemon
        });
      }
    } catch (error) {
      console.error('Error handling capture:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Écouter l'expiration d'un événement depuis le frontend
  socket.on('event_expired', async (data) => {
    try {
      const { eventId, pokemonName } = data;

      if (!eventId) {
        console.warn('⚠️  event_expired received without eventId');
        return;
      }

      // Vérifier que l'événement existe (spawn ou arène)
      const event = await queryOne(`
        SELECT ae.*, p.name as pokemon_name, p.rarity, a.name as arena_name
        FROM active_events ae
        LEFT JOIN pokemons p ON ae.pokemon_id = p.id
        LEFT JOIN arenas a ON ae.arena_id = a.id
        WHERE ae.id = ?
      `, [eventId]);

      if (!event) {
        console.warn(`⚠️  Event ${eventId} not found`);
        return;
      }

      // Traiter les votes AVANT de marquer l'événement comme expiré
      // Sinon processVotes ne pourra pas trouver l'événement
      const { processVotes } = await import('../services/voteProcessingService.js');
      await processVotes(eventId);

      // Vérifier l'état de l'événement après le traitement des votes
      const updatedEvent = await queryOne('SELECT * FROM active_events WHERE id = ?', [eventId]);

      // Si l'événement est en cours de traitement (battle_selection, capture_in_progress, etc.)
      // Ne PAS le marquer comme expiré, il sera marqué comme expiré quand le traitement sera terminé
      if (updatedEvent && updatedEvent.processing_state && updatedEvent.processing_state !== 'voting') {
        return;
      }

      // Si aucun traitement n'est en cours, marquer comme expiré et envoyer le message
      await expireEvent(eventId);

      // Message selon le type d'événement
      let message = '';
      let eventName = '';
      if (event.type === 'arena') {
        eventName = data.arenaName || event.arena_name || 'Champion';
        message = `⏰ ${eventName} a quitté l'arène !`;
      } else {
        eventName = pokemonName || event.pokemon_name || 'Pokémon';
        message = `⏰ Le ${eventName} sauvage a disparu !`;
      }

      const messageSent = await sendChatMessage(message);
      if (!messageSent) {
        console.error(`❌ Failed to send chat message for expired event ${eventId}: ${eventName}`);
      }
    } catch (error) {
      console.error('❌ Error handling event_expired:', error);
      console.error('❌ Error stack:', error.stack);
    }
  });

  // Obtenir ou créer un utilisateur
  socket.on('get_or_create_user', async (data) => {
    try {
      const { twitchId, username } = data;
      
      if (!twitchId || !username) {
        socket.emit('error', { message: 'Missing twitchId or username' });
        return;
      }

      let user = await queryOne('SELECT * FROM users WHERE twitch_id = ?', [twitchId]);
      
      if (!user) {
        // Créer l'utilisateur
        await query(
          'INSERT INTO users (twitch_id, username, xp, level, poke_coins) VALUES (?, ?, 0, 1, 0)',
          [twitchId, username]
        );
        user = await queryOne('SELECT * FROM users WHERE twitch_id = ?', [twitchId]);
      }

      socket.emit('user_data', user);
    } catch (error) {
      console.error('Error getting/creating user:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {});
}

/**
 * Émet un événement de spawn à tous les clients connectés
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} event - Événement de spawn
 */
export async function broadcastSpawn(io, event) {
  const voteStats = await getVoteStats(event.id);
  io.emit('pokemon_spawn', {
    ...event,
    voteStats
  });
}

/**
 * Émet une mise à jour de vote à tous les clients
 * @param {Server} io - Instance Socket.io Server
 * @param {number} eventId - ID de l'événement
 */
export async function broadcastVoteUpdate(io, eventId) {
  const voteStats = await getVoteStats(eventId);
  io.emit('vote_update', {
    eventId,
    voteStats
  });
}

/**
 * Émet le résultat d'une capture à tous les clients
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} result - Résultat de la capture
 */
export function broadcastCaptureResult(io, result) {
  io.emit('capture_success', result);
}

/**
 * Émet un événement de combat à tous les clients
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} battleResult - Résultat du combat
 */
export function broadcastBattleResult(io, battleResult) {
  io.emit('battle_end', battleResult);
}

/**
 * Émet un événement de déblocage de badge
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} badgeData - Données du badge
 */
export function broadcastBadgeUnlock(io, badgeData) {
  io.emit('badge_unlock', badgeData);
}

/**
 * Émet le résultat du vote
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} result - Résultat du vote
 */
export function broadcastVoteResult(io, result) {
  io.emit('vote_result', result);
}

/**
 * Émet une tentative de capture
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} data - Données de la capture
 */
export function broadcastCaptureAttempt(io, data) {
  io.emit('capture_attempt', data);
}

/**
 * Émet une demande de sélection de ball pour la capture
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} data - Données de la sélection
 */
export function broadcastBallSelection(io, data) {
  io.emit('ball_selection', data);
}

/**
 * Émet une demande de sélection de pokémon pour le combat
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} data - Données de la sélection
 */
export function broadcastBattleSelection(io, data) {
  io.emit('battle_selection', data);
}

/**
 * Émet le résultat de la fuite
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} data - Données de la fuite
 */
export function broadcastFleeResult(io, data) {
  io.emit('flee_result', data);
}

/**
 * Émet un événement de spawn d'arène à tous les clients connectés
 * @param {Server} io - Instance Socket.io Server
 * @param {Object} arenaEvent - Événement d'arène
 */
export async function broadcastArenaSpawn(io, arenaEvent) {
  const { getVoteStats } = await import('../services/captureService.js');
  const voteStats = await getVoteStats(arenaEvent.id);
  io.emit('arena_spawn', {
    ...arenaEvent,
    voteStats
  });
}
