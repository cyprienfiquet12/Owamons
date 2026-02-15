/**
 * Service de gain d'expérience pour les Pokémon ayant combattu.
 * Formule: EXP = (1 * b * N) / 7
 * b = expérience de base pour atteindre le niveau N (du Pokémon vaincu), selon sa courbe experience_growth
 * N = niveau du Pokémon vaincu
 *
 * Courbes (image experience.png): Rapide=Fast, Moyenne=Medium Fast, Parabolique=Medium Slow, Lente=Slow, Fluctuante=Fluctuating
 */

import { query, queryOne, queryResult } from '../database/connection.js';

// Total EXP requis pour atteindre chaque niveau (0..100) par courbe (formules Bulbapedia / Gen III+)
const CURVES = ['Fast', 'Medium Fast', 'Medium Slow', 'Slow', 'Fluctuating', 'Erratic'];

function totalExpFast(n) {
  if (n <= 0) return 0;
  return Math.floor((4 * n * n * n) / 5);
}

function totalExpMediumFast(n) {
  if (n <= 0) return 0;
  return n * n * n;
}

function totalExpMediumSlow(n) {
  if (n <= 0) return 0;
  if (n === 1) return 0;
  return Math.floor((6 * n * n * n) / 5 - 15 * n * n + 100 * n - 140);
}

function totalExpSlow(n) {
  if (n <= 0) return 0;
  return Math.floor((5 * n * n * n) / 4);
}

function totalExpFluctuating(n) {
  if (n <= 0) return 0;
  if (n < 15) return Math.floor((n * n * n * (Math.floor((n + 1) / 3) + 24)) / 50);
  if (n < 36) return Math.floor((n * n * n * (n + 14)) / 50);
  return Math.floor((n * n * n * (Math.floor(n / 2) + 32)) / 50);
}

function totalExpErratic(n) {
  if (n <= 0) return 0;
  if (n < 50) return Math.floor((n * n * n * (100 - n)) / 50);
  if (n < 68) return Math.floor((n * n * n * (150 - n)) / 100);
  if (n < 98) return Math.floor((n * n * n * Math.floor((1911 - 10 * n) / 3)) / 500);
  return Math.floor((n * n * n * (160 - n)) / 100);
}

function buildTotalTable(fn) {
  const t = [0];
  for (let level = 1; level <= 100; level++) t.push(fn(level));
  return t;
}

const TOTAL_EXP = {
  'Fast': buildTotalTable(totalExpFast),
  'Medium Fast': buildTotalTable(totalExpMediumFast),
  'Medium Slow': buildTotalTable(totalExpMediumSlow),
  'Slow': buildTotalTable(totalExpSlow),
  'Fluctuating': buildTotalTable(totalExpFluctuating),
  'Erratic': buildTotalTable(totalExpErratic)
};

/**
 * Normalise le type de courbe (DB peut avoir des variantes).
 */
function normalizeGrowthType(growthType) {
  if (!growthType || typeof growthType !== 'string') return 'Medium Fast';
  const s = growthType.trim();
  const map = {
    'Fast': 'Fast',
    'Medium Fast': 'Medium Fast',
    'Medium Slow': 'Medium Slow',
    'Parabolique': 'Medium Slow',
    'Slow': 'Slow',
    'Lente': 'Slow',
    'Fluctuating': 'Fluctuating',
    'Fluctuante': 'Fluctuating',
    'Erratic': 'Erratic',
    'Rapide': 'Fast',
    'Moyenne': 'Medium Fast'
  };
  return map[s] || 'Medium Fast';
}

/**
 * Expérience de base "b" pour un Pokémon vaincu de niveau N (exp nécessaire pour passer de N-1 à N).
 */
export function getBaseExpYield(level, growthType) {
  const curve = normalizeGrowthType(growthType);
  const table = TOTAL_EXP[curve];
  if (!table || level < 1 || level > 100) return 100;
  const totalAtLevel = table[level];
  const totalPrev = table[level - 1];
  return Math.max(1, totalAtLevel - totalPrev);
}

/**
 * EXP gagnée en battant un Pokémon de niveau N avec courbe donnée.
 * Formule: EXP = (1 * b * N) / 7
 */
export function computeExpGain(defeatedLevel, defeatedGrowthType) {
  const b = getBaseExpYield(defeatedLevel, defeatedGrowthType);
  return Math.max(1, Math.floor((1 * b * defeatedLevel) / 7));
}

/**
 * Retourne le niveau correspondant à un total d'EXP donné pour une courbe.
 */
export function getLevelFromTotalExp(totalExp, growthType) {
  const curve = normalizeGrowthType(growthType);
  const table = TOTAL_EXP[curve];
  if (!table) return 1;
  let level = 1;
  for (let L = 1; L <= 100; L++) {
    if (totalExp >= table[L]) level = L;
    else break;
  }
  return level;
}

/**
 * Total EXP requis pour atteindre un niveau (pour une courbe).
 */
export function getTotalExpForLevel(level, growthType) {
  const curve = normalizeGrowthType(growthType);
  const table = TOTAL_EXP[curve];
  if (!table || level < 1 || level > 100) return 0;
  return table[level];
}

/**
 * Parse evolution_details pour extraire le niveau requis ("Level 16" -> 16).
 * Retourne null si pas d'évolution par niveau ou si non parseable.
 */
export function getEvolutionLevelFromDetails(evolutionDetails) {
  if (!evolutionDetails || typeof evolutionDetails !== 'string') return null;
  const m = evolutionDetails.trim().match(/Level\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Vérifie si l'espèce peut évoluer (a des evolution_details de type "Level X") et si le niveau du Pokémon l'atteint.
 */
export function isReadyToEvolve(pokemonSpeciesEvolutionDetails, currentLevel) {
  const requiredLevel = getEvolutionLevelFromDetails(pokemonSpeciesEvolutionDetails);
  if (requiredLevel == null) return false;
  return currentLevel >= requiredLevel;
}

/**
 * Ajoute de l'EXP à un Pokémon du viewer, met à jour le niveau si besoin, et indique si level up / prêt à évoluer.
 * @param {number} userPokemonId - ID dans user_pokemons (pas pokemons)
 * @param {number} expGained - EXP à ajouter
 * @returns {Promise<{ levelsGained: number, newLevel: number, newXp: number, readyToEvolve: boolean, pokemonName: string }>}
 */
export async function addExperience(userPokemonId, expGained) {
  const up = await queryOne(`
    SELECT up.id, up.xp, up.level, up.pokemon_id, p.name as pokemon_name, p.experience_growth, p.evolution_details
    FROM user_pokemons up
    JOIN pokemons p ON up.pokemon_id = p.id
    WHERE up.id = ?
  `, [userPokemonId]);

  if (!up) {
    throw new Error(`user_pokemon ${userPokemonId} not found`);
  }

  const growthType = normalizeGrowthType(up.experience_growth);
  const totalTable = TOTAL_EXP[growthType];
  if (!totalTable) {
    throw new Error(`Unknown experience_growth: ${up.experience_growth}`);
  }

  // XP actuel = total cumulé. Si xp n'a jamais été mis à jour (ex. capture), on suppose le total pour le niveau actuel
  let currentTotalXp = up.xp || 0;
  if (currentTotalXp === 0 && up.level >= 1) {
    currentTotalXp = totalTable[Math.min(up.level, 100)] || 0;
  }
  const newTotalXp = Math.min(currentTotalXp + expGained, totalTable[100]);
  const newLevel = getLevelFromTotalExp(newTotalXp, growthType);

  await queryResult(`
    UPDATE user_pokemons SET xp = $1, level = $2 WHERE id = $3
  `, [newTotalXp, newLevel, userPokemonId]);

  const levelsGained = Math.max(0, newLevel - up.level);
  const readyToEvolve = isReadyToEvolve(up.evolution_details, newLevel);

  return {
    levelsGained,
    previousLevel: up.level,
    newLevel,
    newXp: newTotalXp,
    expGained,
    readyToEvolve,
    pokemonName: up.pokemon_name
  };
}
