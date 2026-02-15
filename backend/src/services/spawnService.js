import { query, queryOne, queryResult } from '../database/connection.js';
import { VOTE_TIMERS, RARITY } from '../utils/rarity.js';
import { applyLegendarySpawnRules, isLegendary } from './legendaryService.js';

/**
 * Sélectionne un Pokémon aléatoire basé sur le poids de spawn
 * Algorithme pondéré par spawn_weight
 * @returns {Promise<Object|null>} Pokémon sélectionné
 */
export async function selectRandomPokemon() {
  // Récupérer tous les Pokémon avec leur spawn_weight
  const pokemons = await query('SELECT * FROM pokemons ORDER BY spawn_weight DESC');
  
  if (pokemons.length === 0) {
    return null;
  }
  
  // Calculer le poids total
  const totalWeight = pokemons.reduce((sum, p) => sum + p.spawn_weight, 0);
  
  if (totalWeight === 0) {
    return null;
  }
  
  // Sélection aléatoire pondérée
  const random = Math.random() * totalWeight;
  
  let cumulative = 0;
  for (const pokemon of pokemons) {
    cumulative += pokemon.spawn_weight;
    if (random <= cumulative) {
      return pokemon;
    }
  }
  
  // Fallback (ne devrait jamais arriver)
  return pokemons[pokemons.length - 1];
}

/**
 * Vérifie si un Pokémon est une évolution (a une pré-évolution)
 * @param {Object} pokemon - Pokémon à vérifier
 * @returns {boolean} True si c'est une évolution
 */
function isEvolution(pokemon) {
  return pokemon.pre_evolution_pokedex_id !== null && pokemon.pre_evolution_pokedex_id !== undefined;
}

// Paliers de niveau par rareté d'apparition (table de concordance)
// 5-20 commun, 20-45 rare, 45-100 ultra rare (niveaux 1-4 inclus dans commun)
const LEVEL_TIERS = {
  common: { min: 1, max: 20, weight: 60 },   // 1-20 : commun (5-20 plus fréquents)
  rare: { min: 21, max: 45, weight: 30 },   // 21-45 : rare
  ultraRare: { min: 46, max: 100, weight: 10 } // 46-100 : ultra rare
};

/**
 * Génère un niveau pour un Pokémon selon les règles :
 * - Paliers : 5-20 commun, 21-45 rare, 46-100 ultra rare
 * - Évolutions : niveau minimum 15
 * - Légendaires : niveau minimum 50
 * @param {Object} pokemon - Pokémon pour lequel générer le niveau
 * @returns {number} Niveau généré (1-100)
 */
function generatePokemonLevel(pokemon) {
  const isEvo = isEvolution(pokemon);
  const isLeg = isLegendary(pokemon);

  let minLevel = 1;
  if (isLeg) {
    minLevel = 50;
  } else if (isEvo) {
    minLevel = 15;
  }

  const maxLevel = 100;

  // Construire la liste des paliers possibles (dont la plage coupe [minLevel, maxLevel])
  const possibleTiers = [];
  for (const [name, tier] of Object.entries(LEVEL_TIERS)) {
    const effectiveMin = Math.max(tier.min, minLevel);
    const effectiveMax = Math.min(tier.max, maxLevel);
    if (effectiveMin <= effectiveMax) {
      possibleTiers.push({
        name,
        effectiveMin,
        effectiveMax,
        weight: tier.weight
      });
    }
  }

  if (possibleTiers.length === 0) {
    return minLevel;
  }

  // Tirer un palier selon les poids
  const totalWeight = possibleTiers.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalWeight;
  let chosen = possibleTiers[0];
  for (const t of possibleTiers) {
    r -= t.weight;
    if (r <= 0) {
      chosen = t;
      break;
    }
  }

  // Niveau uniforme dans le palier
  const span = chosen.effectiveMax - chosen.effectiveMin + 1;
  const level = chosen.effectiveMin + Math.floor(Math.random() * span);

  return Math.max(minLevel, Math.min(maxLevel, level));
}

/**
 * Crée un événement de spawn
 * @param {Object} pokemon - Pokémon à faire spawner
 * @param {number} level - Niveau du Pokémon (défaut: 1)
 * @returns {Promise<Object>} Événement créé
 */
export async function createSpawnEvent(pokemon, level = 1) {
  const isLegendary = pokemon.rarity === RARITY.LEGENDARY;
  const voteDuration = isLegendary ? VOTE_TIMERS.legendary : VOTE_TIMERS.normal;
  
  // Calculer les HP basés sur le niveau
  const currentHP = Math.floor(pokemon.base_hp * (1 + (level - 1) * 0.1));
  
  // Utiliser NOW() + INTERVAL directement dans PostgreSQL pour éviter les problèmes de timezone
  const result = await queryResult(`
    INSERT INTO active_events (type, pokemon_id, level, current_hp, status, expires_at)
    VALUES (?, ?, ?, ?, 'active', NOW() + INTERVAL '${voteDuration} seconds')
    RETURNING id, expires_at
  `, ['spawn', pokemon.id, level, currentHP]);
  
  const eventId = result.rows[0]?.id;
  
  const event = await queryOne('SELECT * FROM active_events WHERE id = $1', [eventId]);
  
  // Récupérer les types avec leurs sprites depuis la table types
  const types = await query(`
    SELECT t.id, t.name, t.sprite_url, pt.slot
    FROM pokemon_types pt
    JOIN types t ON pt.type_id = t.id
    WHERE pt.pokemon_id = $1
    ORDER BY pt.slot ASC
  `, [pokemon.id]);
  
  // Ajouter les types au pokémon
  const pokemonWithTypes = {
    ...pokemon,
    types: types.map(t => ({
      id: t.id,
      name: t.name,
      sprite_url: t.sprite_url,
      slot: t.slot
    }))
  };
  
  // S'assurer que expires_at est au format ISO pour le frontend
  const expiresAtISO = event.expires_at instanceof Date 
    ? event.expires_at.toISOString() 
    : new Date(event.expires_at).toISOString();
  
  return {
    ...event,
    expires_at: expiresAtISO, // S'assurer que c'est au format ISO
    pokemon: pokemonWithTypes,
    voteDuration,
    isLegendary
  };
}

/**
 * Vérifie s'il y a un événement actif (spawn ou arène)
 * @returns {Promise<Object|null>} L'événement actif ou null
 */
export async function hasActiveEvent() {
  const activeEvent = await queryOne(`
    SELECT id, type, status, expires_at 
    FROM active_events 
    WHERE status = 'active' AND expires_at > NOW()
    ORDER BY started_at DESC
    LIMIT 1
  `);
  
  return activeEvent;
}

/**
 * Spawn un nouveau Pokémon aléatoire
 * @param {number} level - Niveau du Pokémon (optionnel, aléatoire si non fourni)
 * @returns {Promise<Object>} Événement de spawn créé
 */
export async function spawnPokemon(level = null) {
  // Vérifier s'il y a déjà un événement actif (spawn ou arène)
  const activeEvent = await hasActiveEvent();
  
  if (activeEvent) {
    const eventType = activeEvent.type === 'arena' ? 'arène' : 'spawn';
    throw new Error(`Un événement est déjà actif (${eventType}). Attendez qu'il se termine.`);
  }
  
  // Sélectionner un Pokémon aléatoire
  const pokemon = await selectRandomPokemon();
  
  if (!pokemon) {
    throw new Error('No Pokemon available in database');
  }
  
  // Appliquer les règles spéciales pour les légendaires
  if (isLegendary(pokemon)) {
    const legendaryRules = applyLegendarySpawnRules(pokemon);
    if (!legendaryRules) {
      // Si le cooldown n'est pas respecté, relancer le spawn (sélectionner un autre Pokémon)
      // Pour éviter une boucle infinie, on limite à 10 tentatives
      let attempts = 0;
      let selectedPokemon = pokemon;
      
      while (isLegendary(selectedPokemon) && attempts < 10) {
        selectedPokemon = await selectRandomPokemon();
        attempts++;
      }
      
      if (isLegendary(selectedPokemon)) {
        throw new Error('Cannot spawn legendary due to cooldown. Please try again later.');
      }
      
      // Utiliser le Pokémon non-légendaire sélectionné
      const pokemonLevel = level || generatePokemonLevel(selectedPokemon);
      return await createSpawnEvent(selectedPokemon, pokemonLevel);
    }
  }
  
  // Générer le niveau selon les règles (1-100, avec contraintes pour évolutions/légendaires)
  const pokemonLevel = level || generatePokemonLevel(pokemon);
  
  // Créer l'événement
  const event = await createSpawnEvent(pokemon, pokemonLevel);
  
  return event;
}

/**
 * Obtient l'événement actif
 * @returns {Promise<Object|null>}
 */
export async function getActiveEvent() {
  // Ne pas nettoyer automatiquement les événements expirés ici
  // Le frontend gère l'expiration et envoie 'event_expired' qui déclenchera le nettoyage
  
  // Chercher un événement actif basé uniquement sur le status
  // Le frontend gère son propre timer, donc on accepte les votes tant que status = 'active'
  const event = await queryOne(`
    SELECT ae.*, p.*, 
           p.id as pokemon_db_id,
           ae.id as event_id
    FROM active_events ae
    LEFT JOIN pokemons p ON ae.pokemon_id = p.id
    WHERE ae.status = 'active' 
      AND ae.type = 'spawn'
    ORDER BY ae.started_at DESC
    LIMIT 1
  `);
  
  if (!event) {
    // Log pour déboguer
    const allEvents = await query(`
      SELECT ae.*, p.name as pokemon_name
      FROM active_events ae
      LEFT JOIN pokemons p ON ae.pokemon_id = p.id
      WHERE ae.type = 'spawn'
      ORDER BY ae.started_at DESC
      LIMIT 5
    `);
    
    return null;
  }

  // Récupérer les types avec leurs sprites depuis la table types
  const types = await query(`
    SELECT t.id, t.name, t.sprite_url, pt.slot
    FROM pokemon_types pt
    JOIN types t ON pt.type_id = t.id
    WHERE pt.pokemon_id = $1
    ORDER BY pt.slot ASC
  `, [event.pokemon_db_id]);

  // Restructurer pour avoir pokemon séparé avec types
  const pokemon = {
    id: event.pokemon_db_id,
    pokedex_id: event.pokedex_id,
    name: event.name,
    type_1: event.type_1,
    type_2: event.type_2,
    types: types.map(t => ({
      id: t.id,
      name: t.name,
      sprite_url: t.sprite_url,
      slot: t.slot
    })),
    base_hp: event.base_hp,
    base_attack: event.base_attack,
    rarity: event.rarity,
    capture_rate: event.capture_rate,
    spawn_weight: event.spawn_weight,
    sprite_url: event.sprite_url
  };
  
  // S'assurer que expires_at est au format ISO pour le frontend
  const expiresAtISO = event.expires_at instanceof Date 
    ? event.expires_at.toISOString() 
    : new Date(event.expires_at).toISOString();
  
  return {
    id: event.event_id,
    type: event.type,
    level: event.level,
    current_hp: event.current_hp,
    status: event.status,
    started_at: event.started_at,
    expires_at: expiresAtISO, // Format ISO pour le frontend
    pokemon: pokemon
  };
}

/**
 * Marque un événement comme expiré
 * @param {number} eventId 
 */
export async function expireEvent(eventId) {
  await query('UPDATE active_events SET status = ? WHERE id = ?', ['expired', eventId]);
}

/**
 * Nettoie les événements expirés (marque comme expirés dans la DB)
 * Note: Cette fonction nettoie uniquement les événements orphelins (expirés depuis plus de 10 secondes)
 * Le frontend gère l'expiration normale et envoie 'event_expired' qui déclenche le traitement des votes
 * @returns {Promise<Array>} Liste des événements expirés avec leurs infos Pokémon
 */
export async function cleanupExpiredEvents() {
  // Récupérer uniquement les événements vraiment orphelins (expirés depuis plus de 1 minute)
  // Cela évite de nettoyer des événements que le frontend gère encore ou qui sont en cours de traitement
  const expiredEvents = await query(`
    SELECT ae.*, p.name as pokemon_name, p.rarity, p.id as pokemon_id
    FROM active_events ae
    LEFT JOIN pokemons p ON ae.pokemon_id = p.id
    WHERE ae.status = 'active' 
      AND ae.expires_at <= (NOW() - INTERVAL '1 minute')
      AND (ae.processing_state IS NULL OR ae.processing_state = 'voting')
  `);

  // Marquer comme expirés (sans envoyer de message chat - c'est le frontend qui déclenche le message)
  if (expiredEvents.length > 0) {
    await query(`
      UPDATE active_events 
      SET status = 'expired' 
      WHERE status = 'active' 
        AND expires_at <= (NOW() - INTERVAL '1 minute')
        AND (processing_state IS NULL OR processing_state = 'voting')
    `);
  }

  return expiredEvents;
}
