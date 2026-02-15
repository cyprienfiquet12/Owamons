import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Charge les données Pokémon depuis le fichier JSON
 * @returns {Array} Liste des Pokémon
 */
export function loadPokemonData() {
  try {
    const dataPath = join(__dirname, '../../data/pokemon.json');
    const data = readFileSync(dataPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading Pokemon data:', error);
    return [];
  }
}

/**
 * Obtient un Pokémon par son ID Pokedex
 * @param {number} pokedexId 
 * @returns {Object|null}
 */
export function getPokemonByPokedexId(pokemonData, pokedexId) {
  return pokemonData.find(p => p.pokedex_id === pokedexId) || null;
}

/**
 * Obtient tous les Pokémon d'une rareté donnée
 * @param {string} rarity 
 * @returns {Array}
 */
export function getPokemonByRarity(pokemonData, rarity) {
  return pokemonData.filter(p => p.rarity === rarity);
}


