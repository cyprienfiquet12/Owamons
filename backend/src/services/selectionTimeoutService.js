import { query, queryOne } from '../database/connection.js';

const SELECTION_TIMEOUT_SECONDS = 120; // 2 minutes

/**
 * Vérifie les événements en attente de sélection et fait fuir le Pokémon si le timeout est dépassé
 */
export async function checkSelectionTimeouts() {
  try {
    // Récupérer tous les événements en attente de sélection
    const pendingEvents = await query(`
      SELECT id, type, processing_state, selected_user_id, updated_at, started_at
      FROM active_events
      WHERE status = 'active'
        AND processing_state IN ('ball_selection', 'battle_selection', 'waiting_replacement')
        AND selected_user_id IS NOT NULL
    `);

    if (pendingEvents.length === 0) {
      return;
    }

    const now = new Date();
    const timeoutEvents = [];

    for (const event of pendingEvents) {
      // Utiliser updated_at pour déterminer quand la sélection a commencé
      const selectionStartTime = event.updated_at || event.started_at;
      if (!selectionStartTime) {
        continue;
      }

      const selectionStart = new Date(selectionStartTime);
      const elapsedSeconds = (now - selectionStart) / 1000;

      if (elapsedSeconds >= SELECTION_TIMEOUT_SECONDS) {
        timeoutEvents.push(event);
      }
    }

    if (timeoutEvents.length === 0) {
      return;
    }

    // Importer les fonctions nécessaires
    const { sendChatMessage } = await import('../integrations/twitchChat.js');
    const { io } = await import('../server.js');

    for (const event of timeoutEvents) {
      try {
        // Récupérer les infos de l'utilisateur
        const user = await queryOne('SELECT username FROM users WHERE id = $1', [event.selected_user_id]);
        const username = user?.username || 'Viewer';

        // Récupérer les infos du Pokémon
        const eventDetails = await queryOne(`
          SELECT ae.*, p.name as pokemon_name
          FROM active_events ae
          LEFT JOIN pokemons p ON ae.pokemon_id = p.id
          WHERE ae.id = $1
        `, [event.id]);

        const pokemonName = eventDetails?.pokemon_name || 'Pokémon';

        // Message selon le type de sélection
        let timeoutMessage = '';
        if (event.processing_state === 'ball_selection') {
          timeoutMessage = `@${username}, temps écoulé pour choisir une ball. ${pokemonName} s'est enfui!`;
        } else if (event.processing_state === 'battle_selection') {
          timeoutMessage = `@${username}, temps écoulé pour choisir un Pokémon. ${pokemonName} s'est enfui!`;
        } else if (event.processing_state === 'waiting_replacement') {
          timeoutMessage = `@${username}, temps écoulé pour remplacer un Pokémon. ${pokemonName} s'est enfui!`;
        }

        // Envoyer le message dans le chat
        if (timeoutMessage) {
          await sendChatMessage(timeoutMessage);
        }

        // Marquer l'événement comme expiré
        await query('UPDATE active_events SET status = $1, processing_state = $2 WHERE id = $3',
          ['expired', 'timeout', event.id]);

        // Diffuser l'événement de fuite au frontend
        if (io) {
          io.emit('flee_result', {
            eventId: event.id,
            reason: 'timeout',
            pokemonName
          });
        }
      } catch (error) {
        console.error(`❌ Error processing timeout for event ${event.id}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error checking selection timeouts:', error);
  }
}


