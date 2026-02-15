import { query, queryOne, queryResult } from '../database/connection.js';
import { BASE_CAPTURE_RATES, LEGENDARY_CAPTURE_CAP, RARITY } from '../utils/rarity.js';
import { rewardCapture, rewardParticipation } from './economyService.js';
import { applyLegendaryCaptureCap, isLegendary } from './legendaryService.js';

/**
 * Enregistre un vote de capture pour un utilisateur
 * @param {number} eventId 
 * @param {number} userId 
 * @param {string} voteType - 'capture', 'battle', ou 'flee'
 * @returns {Promise<{success: boolean, reason?: string}>} Résultat avec success et reason optionnel
 */
export async function registerVote(eventId, userId, voteType = 'capture') {
  // Vérifier si l'utilisateur a déjà voté
  const existingVote = await queryOne(
    'SELECT * FROM event_votes WHERE event_id = ? AND user_id = ?',
    [eventId, userId]
  );
  
  if (existingVote) {
    return { success: false, reason: 'already_voted' }; // Déjà voté
  }
  
  // Pour les votes d'arène (battle ou flee), vérifier si l'utilisateur possède déjà le badge
  if (voteType === 'battle' || voteType === 'flee') {
    // Vérifier si c'est un événement d'arène
    const event = await queryOne(`
      SELECT ae.type, ae.arena_id, a.badge_id
      FROM active_events ae
      LEFT JOIN arenas a ON ae.arena_id = a.id
      WHERE ae.id = ?
    `, [eventId]);
    
    if (event && event.type === 'arena' && event.badge_id) {
      // Vérifier si l'utilisateur possède déjà ce badge
      const hasBadge = await queryOne(
        'SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?',
        [userId, event.badge_id]
      );
      
      if (hasBadge) {
        return { success: false, reason: 'already_has_badge' }; // Possède déjà le badge
      }
    }
  }
  
  // Enregistrer le vote
  await query(
    'INSERT INTO event_votes (event_id, user_id, vote_type) VALUES (?, ?, ?)',
    [eventId, userId, voteType]
  );
  
  // Récompenser la participation
  try {
    await rewardParticipation(userId);
  } catch (error) {
    console.error('Error rewarding participation:', error);
  }
  
  return { success: true };
}

/**
 * Obtient les statistiques de vote pour un événement
 * @param {number} eventId 
 * @returns {Promise<Object>} Statistiques de vote
 */
export async function getVoteStats(eventId) {
  const votes = await query(
    'SELECT vote_type, COUNT(*)::int as count FROM event_votes WHERE event_id = ? GROUP BY vote_type',
    [eventId]
  );
  
  const stats = {
    capture: 0,
    battle: 0,
    flee: 0,
    total: 0
  };
  
  for (const vote of votes) {
    const count = typeof vote.count === 'bigint' ? Number(vote.count) : parseInt(vote.count) || 0;
    stats[vote.vote_type] = count;
    stats.total += count;
  }
  
  return stats;
}

/**
 * Calcule le taux de capture final
 * @param {Object} pokemon - Pokémon à capturer
 * @param {number} participantCount - Nombre de participants
 * @param {number} ballBonus - Bonus de la ball utilisée (0.05, 0.10, 0.20)
 * @returns {number} Taux de capture final (0-1)
 */
export function calculateCaptureRate(pokemon, participantCount, ballBonus = 0) {
  const baseRate = BASE_CAPTURE_RATES[pokemon.rarity] || 0.5;
  
  // Bonus de participation : min(participants * 1%, 10%)
  const participationBonus = Math.min(participantCount * 0.01, 0.10);
  
  // Bonus aléatoire (0-5%)
  const randomBonus = Math.random() * 0.05;
  
  // Taux final
  let finalRate = baseRate + participationBonus + ballBonus + randomBonus;
  
  // Plafond spécial pour les légendaires (25% max)
  if (isLegendary(pokemon)) {
    finalRate = applyLegendaryCaptureCap(finalRate);
  } else {
    // Plafond à 100% pour les autres
    finalRate = Math.min(finalRate, 1.0);
  }
  
  return finalRate;
}

/**
 * Tente de capturer un Pokémon
 * @param {number} eventId 
 * @param {number} userId 
 * @param {number} ballBonus - Bonus de la ball (optionnel)
 * @returns {Promise<Object>} Résultat de la capture
 */
export async function attemptCapture(eventId, userId, ballBonus = 0) {
  // Récupérer l'événement
  const event = await queryOne(`
    SELECT ae.*, p.*, 
           p.id as pokemon_db_id,
           ae.id as event_id
    FROM active_events ae
    LEFT JOIN pokemons p ON ae.pokemon_id = p.id
    WHERE ae.id = ? AND ae.status = 'active'
  `, [eventId]);
  
  if (!event) {
    throw new Error('Event not found or not active');
  }
  
  // Vérifier si l'utilisateur a déjà voté
  const hasVoted = await queryOne(
    'SELECT * FROM event_votes WHERE event_id = ? AND user_id = ?',
    [eventId, userId]
  );
  
  if (!hasVoted) {
    // Enregistrer le vote automatiquement
    await registerVote(eventId, userId, 'capture');
  }
  
  // Obtenir le nombre de participants
  const voteStats = await getVoteStats(eventId);
  const participantCount = voteStats.total;
  
  // Restructurer le Pokémon
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
    spawn_weight: event.spawn_weight,
    sprite_url: event.sprite_url
  };
  
  // Calculer le taux de capture
  const captureRate = calculateCaptureRate(pokemon, participantCount, ballBonus);
  
  // Tenter la capture
  const success = Math.random() < captureRate;
  
  if (success) {
    // Capturer le Pokémon
    const currentHP = Math.floor(pokemon.base_hp * (1 + (event.level - 1) * 0.1));
    const isShiny = Math.random() < 0.01; // 1% de chance shiny
    
    await query(`
      INSERT INTO user_pokemons (user_id, pokemon_id, level, xp, current_hp, is_shiny)
      VALUES (?, ?, ?, 0, ?, ?)
    `, [userId, pokemon.id, event.level, currentHP, isShiny ? 1 : 0]);
    
    // Récompenser l'utilisateur
    const rewards = await rewardCapture(userId, pokemon.rarity);
    
    // Marquer l'événement comme complété
    await query('UPDATE active_events SET status = ? WHERE id = ?', ['completed', eventId]);
    
    return {
      success: true,
      pokemon: {
        ...pokemon,
        level: event.level,
        is_shiny: isShiny
      },
      captureRate,
      rewards
    };
  } else {
    return {
      success: false,
      captureRate,
      pokemon: pokemon
    };
  }
}

/**
 * Obtient les votes d'un événement avec les noms d'utilisateurs
 * @param {number} eventId 
 * @returns {Promise<Array>} Liste des votes
 */
export async function getEventVotes(eventId) {
  const votes = await query(`
    SELECT ev.*, u.username
    FROM event_votes ev
    JOIN users u ON ev.user_id = u.id
    WHERE ev.event_id = ?
    ORDER BY ev.voted_at DESC
  `, [eventId]);
  
  return votes;
}

/**
 * Détermine l'action majoritaire (capture, battle, flee)
 * @param {number} eventId 
 * @returns {Promise<string>} Action majoritaire
 */
export async function getMajorityAction(eventId) {
  const stats = await getVoteStats(eventId);
  
  if (stats.capture > stats.battle && stats.capture > stats.flee) {
    return 'capture';
  } else if (stats.battle > stats.flee) {
    return 'battle';
  } else {
    return 'flee';
  }
}
