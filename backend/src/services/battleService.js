import { query, queryOne, queryResult } from '../database/connection.js';
import { rewardBattleVictory } from './economyService.js';

/**
 * Récupère les types d'un Pokémon depuis la base de données
 * @param {number} pokemonId - ID du Pokémon
 * @returns {Promise<Array>} Liste des types avec leurs noms
 */
async function getPokemonTypes(pokemonId) {
  const types = await query(`
    SELECT t.name, t.id, pt.slot
    FROM pokemon_types pt
    JOIN types t ON pt.type_id = t.id
    WHERE pt.pokemon_id = ?
    ORDER BY pt.slot ASC
  `, [pokemonId]);
  
  return types.map(t => t.name);
}

/**
 * Récupère les résistances d'un Pokémon depuis la base de données
 * @param {number} pokemonId - ID du Pokémon
 * @returns {Promise<Map>} Map de type_name -> damage_multiplier
 */
async function getPokemonResistances(pokemonId) {
  const resistances = await query(`
    SELECT type_name, damage_multiplier, damage_relation
    FROM pokemon_resistances
    WHERE pokemon_id = ?
  `, [pokemonId]);
  
  const resistanceMap = new Map();
  for (const res of resistances) {
    resistanceMap.set(res.type_name.toLowerCase(), res.damage_multiplier);
  }
  
  return resistanceMap;
}

/**
 * Calcule le multiplicateur de dégâts basé sur les types de l'attaque et les résistances du défenseur
 * @param {Array<string>} attackerTypes - Types du Pokémon attaquant
 * @param {Map<string, number>} defenderResistances - Map des résistances du défenseur
 * @returns {number} Multiplicateur de dégâts (peut être 0, 0.25, 0.5, 1.0, 2.0, 4.0)
 */
function calculateTypeMultiplier(attackerTypes, defenderResistances) {
  if (!attackerTypes || attackerTypes.length === 0) {
    return 1.0; // Pas de type = neutre
  }
  
  // Pour chaque type de l'attaquant, on prend le meilleur multiplicateur
  // Si le Pokémon a deux types, on utilise le type le plus efficace
  let bestMultiplier = 1.0;
  
  for (const attackType of attackerTypes) {
    const typeLower = attackType.toLowerCase();
    const multiplier = defenderResistances.get(typeLower) || 1.0;
    
    // Prendre le multiplicateur le plus élevé (le plus efficace)
    if (multiplier > bestMultiplier) {
      bestMultiplier = multiplier;
    }
  }
  
  return bestMultiplier;
}

/**
 * Calcule les dégâts d'une attaque
 * Formule améliorée: ((attacker_level * attack_stat) / (defender_level * defense_stat)) * type_multiplier * random_factor
 * @param {Object} attacker - Pokémon attaquant avec level, base_attack, types
 * @param {Object} defender - Pokémon défenseur avec level, base_defense, resistances
 * @returns {number} Dégâts infligés
 */
async function calculateDamage(attacker, defender) {
  // Récupérer les types de l'attaquant
  const attackerTypes = await getPokemonTypes(attacker.id);
  
  // Récupérer les résistances du défenseur
  const defenderResistances = await getPokemonResistances(defender.id);
  
  // Calculer le multiplicateur de type
  const typeMultiplier = calculateTypeMultiplier(attackerTypes, defenderResistances);
  
  // Calculer les stats effectives (basées sur le niveau)
  // Les stats augmentent de 10% par niveau au-dessus du niveau 1
  const attackerAttack = attacker.base_attack * (1 + (attacker.level - 1) * 0.1);
  const defenderDefense = (defender.base_defense || 50) * (1 + (defender.level - 1) * 0.1);
  
  // Formule de base : (niveau * attaque) / (niveau * défense)
  const baseDamage = (attacker.level * attackerAttack) / (defender.level * defenderDefense);
  
  // Appliquer le multiplicateur de type
  const typeAdjustedDamage = baseDamage * typeMultiplier;
  
  // Ajouter un facteur aléatoire (0.85 à 1.15) pour la variabilité
  const randomFactor = 0.85 + (Math.random() * 0.3);
  
  // Dégâts finaux (minimum 1)
  const finalDamage = Math.max(1, Math.floor(typeAdjustedDamage * randomFactor));
  
  return {
    damage: finalDamage,
    typeMultiplier: typeMultiplier,
    attackerTypes: attackerTypes,
    baseDamage: baseDamage
  };
}

/**
 * Simule un combat entre un Pokémon sauvage et l'équipe du chat
 * @param {number} eventId - ID de l'événement de combat
 * @param {number} wildPokemonId - ID du Pokémon sauvage
 * @param {number} wildLevel - Niveau du Pokémon sauvage
 * @returns {Promise<Object>} Résultat du combat
 */
export async function simulateBattle(eventId, wildPokemonId, wildLevel) {
  // Récupérer le Pokémon sauvage
  const wildPokemon = await queryOne('SELECT * FROM pokemons WHERE id = ?', [wildPokemonId]);
  
  if (!wildPokemon) {
    throw new Error('Wild Pokemon not found');
  }
  
  // Calculer les HP initiaux
  const wildMaxHP = Math.floor(wildPokemon.base_hp * (1 + (wildLevel - 1) * 0.1));
  let wildCurrentHP = wildMaxHP;
  
  // Pokémon de l'équipe (utiliser le premier Pokémon du premier utilisateur pour simplifier)
  // En production, on pourrait utiliser le Pokémon le plus fort de l'équipe collective
  const teamPokemon = await queryOne(`
    SELECT up.*, p.*
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    ORDER BY up.level DESC, up.xp DESC
    LIMIT 1
  `);
  
  if (!teamPokemon) {
    throw new Error('No team Pokemon available');
  }
  
  const teamMaxHP = teamPokemon.current_hp;
  let teamCurrentHP = teamMaxHP;
  
  const battleLog = [];
  let turn = 0;
  const maxTurns = 3;
  
  // Simuler jusqu'à 3 tours
  while (turn < maxTurns && wildCurrentHP > 0 && teamCurrentHP > 0) {
    turn++;
    
    // Tour de l'équipe
    const teamDamageResult = await calculateDamage(
      {
        id: teamPokemon.pokemon_id,
        level: teamPokemon.level,
        base_attack: teamPokemon.base_attack
      },
      {
        id: wildPokemon.id,
        level: wildLevel,
        base_defense: wildPokemon.base_defense
      }
    );
    
    wildCurrentHP = Math.max(0, wildCurrentHP - teamDamageResult.damage);
    
    battleLog.push({
      turn,
      action: 'team_attack',
      damage: teamDamageResult.damage,
      typeMultiplier: teamDamageResult.typeMultiplier,
      wildHP: wildCurrentHP,
      teamHP: teamCurrentHP
    });
    
    if (wildCurrentHP <= 0) {
      break; // Victoire
    }
    
    // Tour du Pokémon sauvage
    const wildDamageResult = await calculateDamage(
      {
        id: wildPokemon.id,
        level: wildLevel,
        base_attack: wildPokemon.base_attack
      },
      {
        id: teamPokemon.pokemon_id,
        level: teamPokemon.level,
        base_defense: teamPokemon.base_defense
      }
    );
    
    teamCurrentHP = Math.max(0, teamCurrentHP - wildDamageResult.damage);
    
    battleLog.push({
      turn,
      action: 'wild_attack',
      damage: wildDamageResult.damage,
      typeMultiplier: wildDamageResult.typeMultiplier,
      wildHP: wildCurrentHP,
      teamHP: teamCurrentHP
    });
  }
  
  const victory = wildCurrentHP <= 0;
  const defeat = teamCurrentHP <= 0;
  
  // Mettre à jour l'événement
  if (victory) {
    await query('UPDATE active_events SET status = ?, current_hp = ? WHERE id = ?', 
      ['completed', 0, eventId]);
  } else if (defeat) {
    await query('UPDATE active_events SET status = ? WHERE id = ?', 
      ['failed', eventId]);
  } else {
    // Match nul (3 tours sans vainqueur)
    await query('UPDATE active_events SET status = ? WHERE id = ?', 
      ['failed', eventId]);
  }
  
  // Récompenser tous les participants en cas de victoire
  if (victory) {
    const participants = await query(`
      SELECT DISTINCT user_id FROM event_votes WHERE event_id = ?
    `, [eventId]);
    
    const rewards = [];
    for (const participant of participants) {
      try {
        const reward = await rewardBattleVictory(participant.user_id, 'wild');
        rewards.push({
          userId: participant.user_id,
          ...reward
        });
      } catch (error) {
        console.error(`Error rewarding user ${participant.user_id}:`, error);
      }
    }
    
    return {
      victory: true,
      defeat: false,
      turns: turn,
      battleLog,
      rewards
    };
  }
  
  return {
    victory: false,
    defeat: defeat,
    turns: turn,
    battleLog
  };
}

/**
 * Simule un combat entre deux pokémon
 * @param {number} userPokemonId - ID du pokémon du viewer (dans pokemons)
 * @param {number} userPokemonLevel - Niveau du pokémon du viewer
 * @param {number} wildPokemonId - ID du pokémon sauvage (dans pokemons)
 * @param {number} wildPokemonLevel - Niveau du pokémon sauvage
 * @returns {Promise<Object>} Résultat du combat { victory: boolean, rounds: Array, finalHP: Object }
 */
export async function simulateBattleBetweenPokemon(userPokemonId, userPokemonLevel, wildPokemonId, wildPokemonLevel) {
  // Récupérer les pokémon avec toutes leurs stats
  const userPokemon = await queryOne('SELECT * FROM pokemons WHERE id = ?', [userPokemonId]);
  const wildPokemon = await queryOne('SELECT * FROM pokemons WHERE id = ?', [wildPokemonId]);
  
  if (!userPokemon || !wildPokemon) {
    throw new Error('Pokemon not found');
  }
  
  // Calculer les HP initiaux
  const userMaxHP = Math.floor(userPokemon.base_hp * (1 + (userPokemonLevel - 1) * 0.1));
  const wildMaxHP = Math.floor(wildPokemon.base_hp * (1 + (wildPokemonLevel - 1) * 0.1));
  
  let userCurrentHP = userMaxHP;
  let wildCurrentHP = wildMaxHP;
  
  const rounds = [];
  const maxRounds = 3;
  
  // 3 rounds de combat
  for (let round = 1; round <= maxRounds; round++) {
    // Le pokémon du viewer attaque
    const userDamageResult = await calculateDamage(
      {
        id: userPokemon.id,
        level: userPokemonLevel,
        base_attack: userPokemon.base_attack
      },
      {
        id: wildPokemon.id,
        level: wildPokemonLevel,
        base_defense: wildPokemon.base_defense || 50
      }
    );
    
    wildCurrentHP = Math.max(0, wildCurrentHP - userDamageResult.damage);
    
    rounds.push({
      round,
      attacker: 'user',
      damage: userDamageResult.damage,
      typeMultiplier: userDamageResult.typeMultiplier,
      attackerTypes: userDamageResult.attackerTypes,
      wildHP: wildCurrentHP,
      wildMaxHP: wildMaxHP
    });
    
    if (wildCurrentHP <= 0) {
      return { 
        victory: true, 
        rounds,
        finalHP: {
          user: userCurrentHP,
          wild: 0
        }
      };
    }
    
    // Le pokémon sauvage attaque
    const wildDamageResult = await calculateDamage(
      {
        id: wildPokemon.id,
        level: wildPokemonLevel,
        base_attack: wildPokemon.base_attack
      },
      {
        id: userPokemon.id,
        level: userPokemonLevel,
        base_defense: userPokemon.base_defense || 50
      }
    );
    
    userCurrentHP = Math.max(0, userCurrentHP - wildDamageResult.damage);
    
    rounds.push({
      round,
      attacker: 'wild',
      damage: wildDamageResult.damage,
      typeMultiplier: wildDamageResult.typeMultiplier,
      attackerTypes: wildDamageResult.attackerTypes,
      userHP: userCurrentHP,
      userMaxHP: userMaxHP
    });
    
    if (userCurrentHP <= 0) {
      return { 
        victory: false, 
        rounds,
        finalHP: {
          user: 0,
          wild: wildCurrentHP
        }
      };
    }
  }
  
  // Si aucun pokémon n'est KO après 3 rounds, le pokémon avec le plus de HP gagne
  // Sinon, le pokémon sauvage gagne par défaut (plus fort)
  const userWins = userCurrentHP > wildCurrentHP;
  
  return { 
    victory: userWins, 
    rounds,
    finalHP: {
      user: userCurrentHP,
      wild: wildCurrentHP
    }
  };
}

/**
 * Crée un événement de combat
 * @param {Object} pokemon - Pokémon sauvage
 * @param {number} level - Niveau du Pokémon
 * @returns {Promise<Object>} Événement créé
 */
export async function createBattleEvent(pokemon, level = 1) {
  // Vérifier s'il y a déjà un événement actif (spawn ou arène)
  const { hasActiveEvent } = await import('./spawnService.js');
  const activeEvent = await hasActiveEvent();
  
  if (activeEvent) {
    const eventType = activeEvent.type === 'arena' ? 'arène' : 'spawn';
    throw new Error(`Un événement est déjà actif (${eventType}). Attendez qu'il se termine.`);
  }
  
  const currentHP = Math.floor(pokemon.base_hp * (1 + (level - 1) * 0.1));
  
  // Utiliser NOW() + INTERVAL directement dans PostgreSQL pour éviter les problèmes de timezone
  const result = await queryResult(`
    INSERT INTO active_events (type, pokemon_id, level, current_hp, status, expires_at)
    VALUES (?, ?, ?, ?, 'active', NOW() + INTERVAL '30 seconds')
    RETURNING id, expires_at
  `, ['battle', pokemon.id, level, currentHP]);
  
  const eventId = result.rows[0]?.id;
  
  const event = await queryOne('SELECT * FROM active_events WHERE id = ?', [eventId]);
  
  return {
    ...event,
    pokemon: pokemon
  };
}
