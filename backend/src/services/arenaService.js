import { query, queryOne } from '../database/connection.js';
import { simulateBattleBetweenPokemon } from './battleService.js';
import { addCoins } from './economyService.js';
import { sendChatMessage } from '../integrations/twitchChat.js';
import { io } from '../server.js';

/**
 * Sélectionne une arène aléatoire
 * @returns {Promise<Object|null>} Arène sélectionnée avec son équipe
 */
export async function selectRandomArena() {
  const arenas = await query('SELECT * FROM arenas ORDER BY RANDOM() LIMIT 1');
  
  if (arenas.length === 0) {
    return null;
  }
  
  const arena = arenas[0];
  
  // Récupérer l'équipe de l'arène avec les détails des Pokémon
  const team = await query(`
    SELECT 
      at.id,
      at.level,
      at.team_order,
      p.id as pokemon_id,
      p.pokedex_id,
      p.name,
      p.base_hp,
      p.base_attack,
      p.base_defense,
      p.sprite_url
    FROM arena_teams at
    JOIN pokemons p ON at.pokemon_id = p.id
    WHERE at.arena_id = $1
    ORDER BY at.team_order ASC
  `, [arena.id]);
  
  // Récupérer le badge
  const badge = await queryOne('SELECT * FROM badges WHERE id = $1', [arena.badge_id]);
  
  // Récupérer le sprite du type
  const typeRecord = await queryOne('SELECT sprite_url FROM types WHERE LOWER(name) = LOWER($1)', [arena.type]);
  
  return {
    ...arena,
    type_sprite_url: typeRecord?.sprite_url || null,
    team: team.map(t => ({
      id: t.pokemon_id,
      pokedex_id: t.pokedex_id,
      name: t.name,
      level: t.level,
      base_hp: t.base_hp,
      base_attack: t.base_attack,
      base_defense: t.base_defense,
      sprite_url: t.sprite_url,
      team_order: t.team_order
    })),
    badge: badge || null
  };
}

/**
 * Crée un événement d'arène
 * @returns {Promise<Object>} Événement d'arène créé
 */
export async function spawnArena() {
  // Vérifier s'il y a déjà un événement actif (spawn ou arène)
  // Utiliser la même logique que spawnPokemon pour être cohérent
  const { hasActiveEvent } = await import('./spawnService.js');
  const activeEvent = await hasActiveEvent();
  
  if (activeEvent) {
    const eventType = activeEvent.type === 'arena' ? 'arène' : 'spawn';
    throw new Error(`Un événement est déjà actif (${eventType}). Attendez qu'il se termine.`);
  }
  
  const arena = await selectRandomArena();
  
  if (!arena) {
    throw new Error('Aucune arène disponible');
  }
  
  // Créer l'événement d'arène (30 secondes comme les spawns normaux)
  const result = await query(`
    INSERT INTO active_events (type, arena_id, status, processing_state, expires_at)
    VALUES ($1, $2, 'active', 'voting', NOW() + INTERVAL '30 seconds')
    RETURNING id, expires_at
  `, ['arena', arena.id]);
  
  const eventId = result[0].id;
  
  return {
    id: eventId,
    type: 'arena',
    arena: arena,
    expires_at: result[0].expires_at
  };
}

/**
 * Récupère l'événement d'arène actif
 * @returns {Promise<Object|null>} Événement d'arène actif ou null
 */
export async function getActiveArenaEvent() {
  const event = await queryOne(`
    SELECT ae.*, a.name as arena_name, a.type as arena_type, a.sprite_url as arena_sprite, a.badge_id
    FROM active_events ae
    JOIN arenas a ON ae.arena_id = a.id
    WHERE ae.status = 'active' 
      AND ae.type = 'arena'
    ORDER BY ae.started_at DESC
    LIMIT 1
  `);
  
  if (!event) {
    return null;
  }
  
  // Récupérer l'équipe de l'arène
  const team = await query(`
    SELECT 
      at.level,
      at.team_order,
      p.id as pokemon_id,
      p.pokedex_id,
      p.name,
      p.base_hp,
      p.base_attack,
      p.base_defense,
      p.sprite_url
    FROM arena_teams at
    JOIN pokemons p ON at.pokemon_id = p.id
    WHERE at.arena_id = $1
    ORDER BY at.team_order ASC
  `, [event.arena_id]);
  
  // Récupérer le badge
  const badge = event.badge_id ? await queryOne('SELECT * FROM badges WHERE id = $1', [event.badge_id]) : null;
  
  // Récupérer le sprite du type
  const typeRecord = await queryOne('SELECT sprite_url FROM types WHERE LOWER(name) = LOWER($1)', [event.arena_type]);
  
  const arena = {
    id: event.arena_id,
    name: event.arena_name,
    type: event.arena_type,
    type_sprite_url: typeRecord?.sprite_url || null,
    sprite_url: event.arena_sprite,
    badge: badge,
    team: team.map(t => ({
      id: t.pokemon_id,
      pokedex_id: t.pokedex_id,
      name: t.name,
      level: t.level,
      base_hp: t.base_hp,
      base_attack: t.base_attack,
      base_defense: t.base_defense,
      sprite_url: t.sprite_url,
      team_order: t.team_order
    }))
  };
  
  const expiresAtISO = event.expires_at instanceof Date 
    ? event.expires_at.toISOString() 
    : new Date(event.expires_at).toISOString();
  
  return {
    id: event.id,
    type: 'arena',
    status: event.status,
    started_at: event.started_at,
    expires_at: expiresAtISO,
    arena: arena
  };
}

/**
 * Simule un combat d'arène complet (équipe du viewer vs équipe du champion)
 * @param {number} eventId - ID de l'événement d'arène
 * @param {number} userId - ID de l'utilisateur qui combat
 * @returns {Promise<Object>} Résultat du combat
 */
export async function simulateArenaBattle(eventId, userId) {
  // Récupérer l'arène et son équipe
  const event = await queryOne(`
    SELECT ae.*, a.name as arena_name, a.type as arena_type, a.sprite_url as arena_sprite, a.badge_id
    FROM active_events ae
    JOIN arenas a ON ae.arena_id = a.id
    WHERE ae.id = $1
  `, [eventId]);
  
  if (!event) {
    throw new Error('Arena event not found');
  }
  
  const arenaTeam = await query(`
    SELECT 
      at.level,
      at.team_order,
      p.id as pokemon_id,
      p.pokedex_id,
      p.name,
      p.base_hp,
      p.base_attack,
      p.base_defense,
      p.sprite_url,
      p.experience_growth
    FROM arena_teams at
    JOIN pokemons p ON at.pokemon_id = p.id
    WHERE at.arena_id = $1
    ORDER BY at.team_order ASC
  `, [event.arena_id]);
  
  // Récupérer l'équipe du viewer (tous les Pokémon non-KO)
  const userTeam = await query(`
    SELECT 
      up.id,
      up.pokemon_id,
      up.level,
      up.current_hp,
      p.pokedex_id,
      p.name,
      p.base_hp,
      p.base_attack,
      p.base_defense,
      p.sprite_url
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    WHERE up.user_id = $1 AND up.is_ko = false
    ORDER BY up.level DESC, up.captured_at ASC
  `, [userId]);
  
  if (userTeam.length === 0) {
    throw new Error('User has no available Pokémon');
  }
  
  // Calculer les HP max pour chaque Pokémon
  const userTeamWithMaxHP = userTeam.map(p => ({
    ...p,
    max_hp: Math.floor(p.base_hp * (1 + (p.level - 1) * 0.1)),
    current_hp: p.current_hp || Math.floor(p.base_hp * (1 + (p.level - 1) * 0.1))
  }));
  
  const arenaTeamWithMaxHP = arenaTeam.map(p => ({
    ...p,
    max_hp: Math.floor(p.base_hp * (1 + (p.level - 1) * 0.1)),
    current_hp: Math.floor(p.base_hp * (1 + (p.level - 1) * 0.1))
  }));
  
  // Combat en chaîne : le perdant envoie son Pokémon suivant, le gagnant reste sur le terrain
  let userIndex = 0;
  let arenaIndex = 0;
  const battleLog = [];
  const expGains = []; // { userPokemonId, defeatedLevel, defeatedGrowthType } pour chaque Pokémon adverse vaincu
  let roundNumber = 1;
  
  // Fonction pour diffuser un événement de combat au frontend
  const broadcastBattleRound = async (userPokemon, arenaPokemon, roundNum) => {
    if (io) {
      io.emit('arena_battle_round', {
        eventId,
        round: roundNum,
        userPokemon: {
          id: userPokemon.pokemon_id,
          pokedex_id: userPokemon.pokedex_id,
          name: userPokemon.name,
          level: userPokemon.level,
          sprite_url: userPokemon.sprite_url,
          current_hp: userPokemon.current_hp,
          max_hp: userPokemon.max_hp
        },
        arenaPokemon: {
          id: arenaPokemon.pokemon_id,
          pokedex_id: arenaPokemon.pokedex_id,
          name: arenaPokemon.name,
          level: arenaPokemon.level,
          sprite_url: arenaPokemon.sprite_url,
          current_hp: arenaPokemon.current_hp,
          max_hp: arenaPokemon.max_hp
        }
      });
      
      // Attendre un peu pour que le frontend affiche le round
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };
  
  // Fonction pour diffuser le résultat d'un round
  const broadcastRoundResult = async (userPokemon, arenaPokemon, userWon) => {
    if (io) {
      io.emit('arena_battle_round_result', {
        eventId,
        userPokemon: {
          name: userPokemon.name,
          current_hp: userPokemon.current_hp,
          max_hp: userPokemon.max_hp,
          isKO: userPokemon.current_hp <= 0
        },
        arenaPokemon: {
          name: arenaPokemon.name,
          current_hp: arenaPokemon.current_hp,
          max_hp: arenaPokemon.max_hp,
          isKO: arenaPokemon.current_hp <= 0
        },
        userWon,
        loserPokemon: userWon ? 'arena' : 'user'
      });
      
      // Attendre pour l'animation
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };
  
  while (userIndex < userTeamWithMaxHP.length && arenaIndex < arenaTeamWithMaxHP.length) {
    const userPokemon = userTeamWithMaxHP[userIndex];
    const arenaPokemon = arenaTeamWithMaxHP[arenaIndex];
    
    // Diffuser le début du round
    await broadcastBattleRound(userPokemon, arenaPokemon, roundNumber);
    
    // Simuler le combat entre ces deux Pokémon
    const battleResult = await simulateBattleBetweenPokemon(
      userPokemon.pokemon_id,
      userPokemon.level,
      arenaPokemon.pokemon_id,
      arenaPokemon.level
    );
    
    // Mettre à jour les HP
    if (battleResult.finalHP) {
      userPokemon.current_hp = Math.max(0, battleResult.finalHP.user || 0);
      arenaPokemon.current_hp = Math.max(0, battleResult.finalHP.wild || 0);
    }
    
    const userWon = battleResult.victory;

    if (userWon) {
      expGains.push({
        userPokemonId: userPokemon.id,
        defeatedLevel: arenaPokemon.level,
        defeatedGrowthType: arenaPokemon.experience_growth
      });
    }
    
    // Diffuser le résultat du round
    await broadcastRoundResult(userPokemon, arenaPokemon, userWon);
    
    battleLog.push({
      round: roundNumber,
      userPokemon: userPokemon.name,
      arenaPokemon: arenaPokemon.name,
      userWon,
      userHP: userPokemon.current_hp,
      arenaHP: arenaPokemon.current_hp
    });
    
    // Le perdant envoie son Pokémon suivant, le gagnant reste sur le terrain
    if (userWon) {
      // Le champion envoie son Pokémon suivant
      arenaIndex++;
    } else {
      // Le viewer envoie son Pokémon suivant
      userIndex++;
    }
    
    roundNumber++;
  }
  
  // Déterminer le vainqueur
  const userWon = arenaIndex >= arenaTeamWithMaxHP.length;
  const arenaWon = userIndex >= userTeamWithMaxHP.length;
  
  // Mettre à jour les HP des Pokémon du viewer dans la base de données
  for (const pokemon of userTeamWithMaxHP) {
    const isKO = pokemon.current_hp <= 0;
    await query(`
      UPDATE user_pokemons 
      SET current_hp = $1, is_ko = $2 
      WHERE id = $3
    `, [pokemon.current_hp, isKO, pokemon.id]);
  }
  
  return {
    victory: userWon,
    defeat: arenaWon,
    battleLog,
    expGains,
    userTeamFinalHP: userTeamWithMaxHP.map(p => ({ id: p.id, hp: p.current_hp, is_ko: p.current_hp <= 0 })),
    arenaTeamFinalHP: arenaTeamWithMaxHP.map(p => ({ name: p.name, hp: p.current_hp, is_ko: p.current_hp <= 0 }))
  };
}

/**
 * Traite un combat d'arène après le vote
 * @param {number} eventId - ID de l'événement d'arène
 * @param {number} userId - ID de l'utilisateur sélectionné
 */
export async function processArenaBattle(eventId, userId) {
  const user = await queryOne('SELECT username FROM users WHERE id = $1', [userId]);
  const username = user?.username || 'Viewer';
  
  try {
    // Récupérer l'arène et son équipe pour afficher le combat
    const event = await queryOne(`
      SELECT ae.*, a.name as arena_name, a.type as arena_type, a.sprite_url as arena_sprite, a.badge_id
      FROM active_events ae
      JOIN arenas a ON ae.arena_id = a.id
      WHERE ae.id = $1
    `, [eventId]);
    
    if (!event) {
      throw new Error('Arena event not found');
    }
    
    // Récupérer le premier Pokémon de l'équipe du champion
    const arenaFirstPokemon = await queryOne(`
      SELECT 
        at.level,
        at.team_order,
        p.id as pokemon_id,
        p.pokedex_id,
        p.name,
        p.base_hp,
        p.base_attack,
        p.base_defense,
        p.sprite_url
      FROM arena_teams at
      JOIN pokemons p ON at.pokemon_id = p.id
      WHERE at.arena_id = $1
      ORDER BY at.team_order ASC
      LIMIT 1
    `, [event.arena_id]);
    
    // Récupérer le premier Pokémon de l'équipe du viewer
    const userFirstPokemon = await queryOne(`
      SELECT 
        up.id,
        up.pokemon_id,
        up.level,
        up.current_hp,
        p.pokedex_id,
        p.name,
        p.base_hp,
        p.base_attack,
        p.base_defense,
        p.sprite_url
      FROM user_pokemons up
      JOIN pokemons p ON up.pokemon_id = p.id
      WHERE up.user_id = $1 AND up.is_ko = false
      ORDER BY up.level DESC, up.captured_at ASC
      LIMIT 1
    `, [userId]);
    
    if (!arenaFirstPokemon || !userFirstPokemon) {
      throw new Error('No Pokémon available for battle');
    }
    
    // Calculer les HP max
    const arenaMaxHP = Math.floor(arenaFirstPokemon.base_hp * (1 + (arenaFirstPokemon.level - 1) * 0.1));
    const userMaxHP = Math.floor(userFirstPokemon.base_hp * (1 + (userFirstPokemon.level - 1) * 0.1));
    const userCurrentHP = userFirstPokemon.current_hp || userMaxHP;
    
    // Diffuser le début du combat d'arène au frontend avec les données des Pokémon
    if (io) {
      io.emit('battle_selection', {
        eventId,
        userId,
        username,
        wildPokemon: {
          id: arenaFirstPokemon.pokemon_id,
          pokedex_id: arenaFirstPokemon.pokedex_id,
          name: arenaFirstPokemon.name,
          level: arenaFirstPokemon.level,
          sprite_url: arenaFirstPokemon.sprite_url,
          base_hp: arenaFirstPokemon.base_hp,
          max_hp: arenaMaxHP,
          current_hp: arenaMaxHP
        },
        userPokemon: {
          id: userFirstPokemon.pokemon_id,
          pokedex_id: userFirstPokemon.pokedex_id,
          name: userFirstPokemon.name,
          level: userFirstPokemon.level,
          sprite_url: userFirstPokemon.sprite_url,
          base_hp: userFirstPokemon.base_hp,
          max_hp: userMaxHP,
          current_hp: userCurrentHP
        },
        isArena: true
      });
      
      // Attendre un peu pour que le frontend affiche le début du combat
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Simuler le combat
    const battleResult = await simulateArenaBattle(eventId, userId);
    
    if (battleResult.victory) {
      // Victoire : attribuer le badge
      const event = await queryOne(`
        SELECT a.badge_id FROM active_events ae
        JOIN arenas a ON ae.arena_id = a.id
        WHERE ae.id = $1
      `, [eventId]);
      
      if (event.badge_id) {
        // Vérifier si l'utilisateur a déjà le badge
        const existingBadge = await queryOne(
          'SELECT * FROM user_badges WHERE user_id = $1 AND badge_id = $2',
          [userId, event.badge_id]
        );
        
        if (!existingBadge) {
          // Attribuer le badge
          await query(
            'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)',
            [userId, event.badge_id]
          );
          
          const badge = await queryOne('SELECT name FROM badges WHERE id = $1', [event.badge_id]);
          await sendChatMessage(`🏆 @${username} a remporté le badge ${badge.name} !`);
        }
      }
      
      // Récompenser avec des Pokédollars
      await addCoins(userId, 500);
      await sendChatMessage(`🎉 @${username} a vaincu le champion d'arène ! +500 Pokédollars`);

      // Gain d'XP pour chaque Pokémon adverse vaincu : EXP = (1 * b * N) / 7
      const { addExperience, computeExpGain } = await import('./experienceService.js');
      const levelUpMessages = [];
      const evolutionMessages = [];
      for (const gain of battleResult.expGains || []) {
        const expGained = computeExpGain(gain.defeatedLevel, gain.defeatedGrowthType);
        const xpResult = await addExperience(gain.userPokemonId, expGained);
        if (xpResult.levelsGained > 0) {
          levelUpMessages.push(`${xpResult.pokemonName} → niveau ${xpResult.newLevel}`);
          if (xpResult.readyToEvolve) {
            evolutionMessages.push(xpResult.pokemonName);
          }
        } else if (xpResult.readyToEvolve) {
          evolutionMessages.push(xpResult.pokemonName);
        }
      }
      if (levelUpMessages.length > 0) {
        await sendChatMessage(`📈 @${username}, ${levelUpMessages.join(' | ')}`);
      }
      if (evolutionMessages.length > 0) {
        await sendChatMessage(`✨ @${username}, ${evolutionMessages.join(', ')} ${evolutionMessages.length === 1 ? 'est prêt' : 'sont prêts'} à évoluer !`);
      }
      
      // Marquer l'événement comme complété
      await query('UPDATE active_events SET status = $1, processing_state = $2 WHERE id = $3',
        ['completed', 'completed', eventId]);
      
      // Diffuser le résultat
      if (io) {
        io.emit('arena_battle_result', {
          eventId,
          userId,
          username,
          victory: true,
          badgeEarned: event.badge_id ? true : false
        });
      }
    } else {
      // Défaite : tous les Pokémon du viewer sont KO
      await query(`
        UPDATE user_pokemons 
        SET is_ko = true, current_hp = 0 
        WHERE user_id = $1
      `, [userId]);
      
      await sendChatMessage(`❌ @${username}, tous vos Pokémon ont été mis KO. Utilisez !soin pour les soigner.`);
      
      // Marquer l'événement comme complété
      await query('UPDATE active_events SET status = $1, processing_state = $2 WHERE id = $3',
        ['completed', 'completed', eventId]);
      
      // Diffuser le résultat
      if (io) {
        io.emit('arena_battle_result', {
          eventId,
          userId,
          username,
          victory: false
        });
      }
    }
  } catch (error) {
    console.error('❌ Error processing arena battle:', error);
    await sendChatMessage(`❌ Erreur lors du combat d'arène.`);
    
    // Marquer l'événement comme échoué
    await query('UPDATE active_events SET status = $1 WHERE id = $2',
      ['failed', eventId]);
  }
}
