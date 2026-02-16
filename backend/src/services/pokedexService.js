import { query } from '../database/connection.js';

/**
 * Enregistre une espèce dans le Pokédex du viewer si ce n'est pas déjà le cas.
 * À appeler après chaque ajout d'un Pokémon à user_pokemons (capture, starter, remplacement).
 * @param {number} userId - ID de l'utilisateur
 * @param {number} pokemonId - ID du Pokémon (espèce) dans la table pokemons
 * @param {number} [level=1] - Niveau du Pokémon (pour la colonne lvl)
 */
export async function addToUserPokedex(userId, pokemonId, level = 1) {
  await query(
    `INSERT INTO user_pokedex (user_id, pokemon_id, lvl)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, pokemon_id) DO NOTHING`,
    [userId, pokemonId, level]
  );
}
