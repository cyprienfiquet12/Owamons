import { query, queryOne, queryResult } from '../database/connection.js';
import { getVoteStats } from './captureService.js';
import { broadcastVoteResult, broadcastCaptureAttempt, broadcastBallSelection, broadcastBattleSelection, broadcastFleeResult } from '../websocket/handlers.js';
import { io } from '../server.js';

// Fonction pour envoyer un message dans le chat (évite l'import circulaire)
async function sendChatMessage(message) {
  const { sendChatMessage: sendMsg } = await import('../integrations/twitchChat.js');
  return await sendMsg(message);
}

const MAX_TEAM_SIZE = 6; // Taille maximale d'une équipe Pokémon

/**
 * Détermine le vote gagnant pour un événement
 * @param {number} eventId
 * @param {boolean} isArenaEvent - Si true, exclut 'capture' des votes possibles
 * @returns {Promise<string|null>} 'capture', 'battle', 'flee', ou null si égalité
 */
export async function determineWinningVote(eventId, isArenaEvent = false) {
  const stats = await getVoteStats(eventId);
  
  // Si aucun vote, retourner null
  if (stats.total === 0) {
    return null;
  }
  
  // Trouver le vote avec le plus de votes
  const votes = [];
  
  if (!isArenaEvent) {
    // Pour les spawns normaux, tous les votes sont possibles
    votes.push(
      { type: 'capture', count: stats.capture },
      { type: 'battle', count: stats.battle },
      { type: 'flee', count: stats.flee }
    );
  } else {
    // Pour les arènes, seulement 'battle' et 'flee'
    votes.push(
      { type: 'battle', count: stats.battle },
      { type: 'flee', count: stats.flee }
    );
  }
  
  // Trier par nombre de votes décroissant
  votes.sort((a, b) => b.count - a.count);
  
  // Si égalité entre le premier et le deuxième, retourner null (pas de vote gagnant)
  if (votes.length > 1 && votes[0].count === votes[1].count && votes[0].count > 0) {
    return null; // Égalité
  }
  
  return votes[0].count > 0 ? votes[0].type : null;
}

/**
 * Tire au sort un utilisateur parmi les votants d'un type de vote
 * @param {number} eventId
 * @param {string} voteType - 'capture', 'battle', ou 'flee'
 * @returns {Promise<Object|null>} Utilisateur sélectionné ou null
 */
export async function selectRandomVoter(eventId, voteType) {
  const voters = await query(`
    SELECT ev.user_id, u.username, u.twitch_id
    FROM event_votes ev
    JOIN users u ON ev.user_id = u.id
    WHERE ev.event_id = ? AND ev.vote_type = ?
  `, [eventId, voteType]);
  
  if (voters.length === 0) {
    return null;
  }
  
  // Tirage au sort
  const randomIndex = Math.floor(Math.random() * voters.length);
  return voters[randomIndex];
}

/**
 * Traite les votes à la fin du timer
 * @param {number} eventId
 */
export async function processVotes(eventId) {
  // Récupérer l'événement
  const event = await queryOne(`
    SELECT ae.*, p.*, p.id as pokemon_db_id, ae.id as event_id, ae.arena_id
    FROM active_events ae
    LEFT JOIN pokemons p ON ae.pokemon_id = p.id
    WHERE ae.id = ?
  `, [eventId]);
  
  if (!event) {
    console.error(`❌ Event ${eventId} not found`);
    return;
  }
  
  // Vérifier si c'est un événement d'arène
  const isArenaEvent = event.type === 'arena';
  
  // Déterminer le vote gagnant (exclure 'capture' pour les arènes)
  const winningVote = await determineWinningVote(eventId, isArenaEvent);
  
  if (!winningVote) {
    await query('UPDATE active_events SET status = ?, winning_vote = ? WHERE id = ?', 
      ['expired', null, eventId]);
    
    // Diffuser le résultat - aucun vote gagnant, cacher la popup
    if (io) {
      io.emit('vote_result', {
        eventId,
        winningVote: null,
        message: 'Aucun vote gagnant (égalité ou aucun vote)'
      });
      // Émettre un événement pour cacher la popup après un court délai
      io.emit('no_vote_winner', {
        eventId
      });
    }
    return;
  }

  // Mettre à jour l'événement avec le vote gagnant
  await query('UPDATE active_events SET winning_vote = ? WHERE id = ?', 
    [winningVote, eventId]);

  // Émettre un événement pour indiquer que les votes sont en cours de traitement
  // Cela permet au frontend de savoir qu'il ne doit pas cacher la popup
  if (io) {
    io.emit('votes_processing', {
      eventId,
      winningVote
    });
  }

  // Traiter selon le type d'événement et le vote gagnant
  if (isArenaEvent) {
    // Pour les arènes, seuls 'battle' et 'flee' sont possibles
    if (winningVote === 'battle') {
      await processArenaBattleVote(eventId, event);
    } else if (winningVote === 'flee') {
      await processFleeVote(eventId, event);
    }
  } else {
    // Pour les spawns normaux
    switch (winningVote) {
      case 'capture':
        await processCaptureVote(eventId, event);
        break;
      case 'battle':
        await processBattleVote(eventId, event);
        break;
      case 'flee':
        await processFleeVote(eventId, event);
        break;
      default:
        console.warn(`⚠️ Unknown winning vote type: ${winningVote}`);
    }
  }
}

/**
 * Traite un vote de capture
 */
async function processCaptureVote(eventId, event) {
  // Tirer au sort un viewer parmi les votants capture
  const selectedVoter = await selectRandomVoter(eventId, 'capture');
  
  if (!selectedVoter) {
    console.error(`❌ No voters for capture in event ${eventId}`);
    return;
  }

  // Récupérer les balls disponibles dans l'inventaire du viewer
  const availableBalls = await query(`
    SELECT ui.quantity, si.id as item_id, si.name, si.sprite_url, si.effect_value
    FROM user_inventory ui
    JOIN shop_items si ON ui.item_id = si.id
    WHERE ui.user_id = $1 
      AND si.effect_type = 'CAPTURE_BONUS'
      AND ui.quantity > 0
    ORDER BY si.price ASC
  `, [selectedVoter.user_id]);
  
  if (availableBalls.length === 0) {
    await sendChatMessage(`@${selectedVoter.username}, vous n'avez aucune ball disponible. La capture est annulée.`);
    await query('UPDATE active_events SET status = $1 WHERE id = $2', ['expired', eventId]);
    return;
  }
  
  // Mettre à jour l'événement avec le viewer sélectionné et demander le choix de la ball
  // Utiliser updated_at pour tracker le début de la sélection
  await query('UPDATE active_events SET selected_user_id = $1, processing_state = $2, updated_at = NOW() WHERE id = $3',
    [selectedVoter.user_id, 'ball_selection', eventId]);
  
  // Envoyer un message au viewer pour choisir sa ball
  const ballsList = availableBalls.map((ball, index) => `${index + 1}. ${ball.name} x${ball.quantity}`).join(' | ');
  await sendChatMessage(`@${selectedVoter.username}, choisissez une ball pour la capture (1 seul essai) : ${ballsList} | Utilisez !1, !2, !3, etc.`);
  
  // Diffuser l'événement de sélection de ball
  if (io) {
    const pokemon = {
      id: event.pokemon_db_id,
      pokedex_id: event.pokedex_id,
      name: event.name,
      type_1: event.type_1,
      type_2: event.type_2,
      base_hp: event.base_hp,
      base_attack: event.base_attack,
      rarity: event.rarity,
      capture_rate: event.capture_rate,
      sprite_url: event.sprite_url
    };
    
    broadcastBallSelection(io, {
      eventId,
      userId: selectedVoter.user_id,
      username: selectedVoter.username,
      pokemon,
      availableBalls: availableBalls.map((ball, index) => ({
        index: index + 1,
        id: ball.item_id,
        name: ball.name,
        sprite_url: ball.sprite_url,
        effect_value: ball.effect_value,
        quantity: ball.quantity
      }))
    });
  }
}

/**
 * Tente la capture pour le viewer sélectionné
 * @param {number} eventId - ID de l'événement
 * @param {number} userId - ID de l'utilisateur
 * @param {string} ballType - Type de ball utilisée
 * @param {number} ballBonus - Bonus de la ball
 */
export async function attemptCaptureForVoter(eventId, userId, ballType, ballBonus) {
  // Importer les fonctions nécessaires
  const { calculateCaptureRate } = await import('./captureService.js');
  const { rewardCapture } = await import('./economyService.js');
  
  // Récupérer l'événement et le pokémon
  const event = await queryOne(`
    SELECT ae.*, p.*, p.id as pokemon_db_id, p.base_hp as pokemon_base_hp
    FROM active_events ae
    LEFT JOIN pokemons p ON ae.pokemon_id = p.id
    WHERE ae.id = ?
  `, [eventId]);
  
  const pokemon = {
    id: event.pokemon_db_id,
    pokedex_id: event.pokedex_id,
    name: event.name,
    rarity: event.rarity,
    capture_rate: event.capture_rate,
    base_hp: event.pokemon_base_hp || event.base_hp
  };
  
  // Calculer le taux de capture
  const stats = await getVoteStats(eventId);
  const captureRate = calculateCaptureRate(pokemon, stats.total, ballBonus);
  
  // Tenter la capture
  const success = Math.random() < captureRate;
  
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  
  if (success) {
    // Capture réussie - Vérifier la taille de l'équipe
    const teamSize = await queryOne(`
      SELECT COUNT(*)::int as count FROM user_pokemons WHERE user_id = ?
    `, [userId]);
    
    const currentTeamSize = teamSize?.count || 0;
    
    if (currentTeamSize >= MAX_TEAM_SIZE) {
      // Équipe pleine, demander quel pokémon remplacer
      const userPokemons = await query(`
        SELECT up.*, p.name as pokemon_name, p.base_hp, p.base_attack
        FROM user_pokemons up
        JOIN pokemons p ON up.pokemon_id = p.id
        WHERE up.user_id = ?
        ORDER BY up.captured_at ASC
      `, [userId]);
      
      await sendChatMessage(`@${user.username}, votre équipe est pleine (6/6). Envoyez !1, !2, !3, !4, !5 ou !6 pour remplacer un pokémon.`);
      
      // Stocker l'état de remplacement
      // Utiliser updated_at pour tracker le début de la sélection
      await query('UPDATE active_events SET processing_state = ?, updated_at = NOW() WHERE id = ?',
        ['waiting_replacement', eventId]);
      
      // Diffuser la demande de remplacement
      if (io) {
        io.emit('team_full_replacement', {
          eventId,
          userId,
          username: user.username,
          pokemons: userPokemons.map((up, index) => ({
            index: index + 1,
            id: up.id,
            name: up.pokemon_name,
            level: up.level
          }))
        });
      }
      
      // Le remplacement sera géré par une autre fonction quand l'utilisateur répondra
      return;
    }
    
    // Ajouter le pokémon à l'équipe
    const pokemonLevel = event.level || 1;
    const currentHP = Math.floor(pokemon.base_hp * (1 + (pokemonLevel - 1) * 0.1));
    
    await query(`
      INSERT INTO user_pokemons (user_id, pokemon_id, level, xp, current_hp, is_ko)
      VALUES (?, ?, ?, 0, ?, false)
    `, [userId, event.pokemon_id, pokemonLevel, currentHP]);
    
    // Récompenser avec 100 pokédollars (comme demandé)
    const { addCoins } = await import('./economyService.js');
    await addCoins(userId, 100);
    
    // Consommer la ball
    const ballItem = await queryOne(`
      SELECT si.id FROM shop_items si
      WHERE LOWER(si.name) = LOWER(?)
    `, [ballType]);
    
    if (ballItem) {
      const inventory = await queryOne(`
        SELECT * FROM user_inventory 
        WHERE user_id = ? AND item_id = ?
      `, [userId, ballItem.id]);
      
      if (inventory) {
        await query('UPDATE user_inventory SET quantity = quantity - 1 WHERE id = ?',
          [inventory.id]);
      }
    }
    
    // Marquer l'événement comme complété
    await query('UPDATE active_events SET status = ?, processing_state = ? WHERE id = ?',
      ['completed', 'completed', eventId]);
    
    // Messages
    await sendChatMessage(`🎉 @${user.username} a capturé ${pokemon.name}! +100 Pokédollars`);
    
    // Attendre 3 secondes de suspense avant de diffuser le résultat
    setTimeout(() => {
      if (io) {
        io.emit('capture_success', {
          eventId,
          userId,
          username: user.username,
          pokemon: {
            ...pokemon,
            level: pokemonLevel
          }
        });
      }
    }, 3000); // 3 secondes de suspense après le bounce
  } else {
    // Capture échouée - Consommer quand même la ball
    const ballItem = await queryOne(`
      SELECT si.id FROM shop_items si
      WHERE LOWER(si.name) = LOWER(?)
    `, [ballType]);
    
    if (ballItem) {
      const inventory = await queryOne(`
        SELECT * FROM user_inventory 
        WHERE user_id = ? AND item_id = ?
      `, [userId, ballItem.id]);
      
      if (inventory) {
        await query('UPDATE user_inventory SET quantity = quantity - 1 WHERE id = ?',
          [inventory.id]);
      }
    }
    
    await sendChatMessage(`❌ @${user.username}, échec de la capture de ${pokemon.name}. Taux: ${(captureRate * 100).toFixed(1)}%`);
    
    // Attendre 3 secondes de suspense avant de diffuser le résultat
    setTimeout(() => {
      if (io) {
        io.emit('capture_fail', {
          eventId,
          userId,
          username: user.username,
          pokemon,
          captureRate
        });
      }
    }, 3000); // 3 secondes de suspense après le bounce
    
    // Marquer l'événement comme expiré
    await query('UPDATE active_events SET status = ?, processing_state = ? WHERE id = ?',
      ['expired', 'failed', eventId]);
  }
}

/**
 * Traite un vote de combat
 */
async function processBattleVote(eventId, event) {
  const selectedVoter = await selectRandomVoter(eventId, 'battle');

  if (!selectedVoter) {
    console.error(`❌ No voters for battle in event ${eventId}`);
    return;
  }

  // Mettre à jour l'événement (garder status = 'active' pour que l'utilisateur puisse répondre)
  // Utiliser updated_at pour tracker le début de la sélection
  await query('UPDATE active_events SET selected_user_id = ?, processing_state = ?, status = ?, updated_at = NOW() WHERE id = ?',
    [selectedVoter.user_id, 'battle_selection', 'active', eventId]);

  // Récupérer les pokémon non-KO du viewer
  const userPokemons = await query(`
    SELECT up.*, p.name as pokemon_name, p.type_1, p.type_2, p.base_hp, p.base_attack
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    WHERE up.user_id = ? AND up.is_ko = false
    ORDER BY up.level DESC, up.captured_at ASC
  `, [selectedVoter.user_id]);
  
  if (userPokemons.length === 0) {
    await sendChatMessage(`@${selectedVoter.username}, vous n'avez aucun pokémon disponible pour combattre.`);
    await query('UPDATE active_events SET status = ? WHERE id = ?', ['expired', eventId]);
    return;
  }
  
  // Demander au viewer de choisir un pokémon
  const pokemonList = userPokemons.map((p, index) => `${index + 1}. ${p.pokemon_name} (Niv. ${p.level})`).join(', ');
  await sendChatMessage(`@${selectedVoter.username}, choisissez un pokémon pour combattre: ${pokemonList}. Envoyez !1, !2, etc.`);
  
  // Diffuser la demande de sélection
  if (io) {
    const wildMaxHP = Math.floor(event.base_hp * (1 + (event.level - 1) * 0.1));
    const pokemon = {
      id: event.pokemon_db_id,
      pokedex_id: event.pokedex_id,
      name: event.name,
      type_1: event.type_1,
      type_2: event.type_2,
      level: event.level,
      sprite_url: event.sprite_url,
      base_hp: event.base_hp,
      current_hp: event.current_hp || wildMaxHP
    };
    
    broadcastBattleSelection(io, {
      eventId,
      userId: selectedVoter.user_id,
      username: selectedVoter.username,
      wildPokemon: pokemon,
      userPokemons: userPokemons.map((up, index) => ({
        index: index + 1,
        id: up.id,
        name: up.pokemon_name,
        level: up.level,
        type_1: up.type_1,
        type_2: up.type_2
      }))
    });
  }
  
  // Le combat sera géré quand l'utilisateur choisira son pokémon
}

/**
 * Traite un vote de combat pour une arène
 */
async function processArenaBattleVote(eventId, event) {
  const selectedVoter = await selectRandomVoter(eventId, 'battle');

  if (!selectedVoter) {
    console.error(`❌ No voters for battle in event ${eventId}`);
    return;
  }

  // Vérifier que le viewer a des Pokémon disponibles
  const userPokemons = await query(`
    SELECT COUNT(*)::int as count
    FROM user_pokemons
    WHERE user_id = $1 AND is_ko = false
  `, [selectedVoter.user_id]);
  
  const pokemonCount = userPokemons[0]?.count || 0;
  
  if (pokemonCount === 0) {
    await sendChatMessage(`@${selectedVoter.username}, vous n'avez aucun pokémon disponible pour combattre.`);
    await query('UPDATE active_events SET status = ? WHERE id = ?', ['expired', eventId]);
    return;
  }
  
  // Mettre à jour l'événement
  await query('UPDATE active_events SET selected_user_id = ?, processing_state = ? WHERE id = ?',
    [selectedVoter.user_id, 'arena_battle', eventId]);
  
  // Lancer directement le combat d'arène (utilise toute l'équipe)
  const { processArenaBattle } = await import('./arenaService.js');
  await processArenaBattle(eventId, selectedVoter.user_id);
}

/**
 * Traite un vote de fuite
 */
async function processFleeVote(eventId, event) {
  // Marquer l'événement comme expiré
  await query('UPDATE active_events SET status = ?, winning_vote = ? WHERE id = ?',
    ['expired', 'flee', eventId]);
  
  // Message dans le chat
  await sendChatMessage(`🏃 Le ${event.name} sauvage s'est enfui !`);
  
  // Diffuser le résultat
  if (io) {
    broadcastFleeResult(io, {
      eventId,
      pokemon: {
        name: event.name
      }
    });
  }
}

export { MAX_TEAM_SIZE };

