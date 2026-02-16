-- Migration 010: Table Pokédex utilisateur (espèces déjà possédées par un viewer)
-- Permet de suivre la progression "Pokédex" : un enregistrement par (user_id, pokemon_id)
-- lorsqu'un viewer capture pour la première fois cette espèce.

CREATE TABLE IF NOT EXISTS user_pokedex (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    first_captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, pokemon_id)
);

CREATE INDEX IF NOT EXISTS idx_user_pokedex_user_id ON user_pokedex(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pokedex_pokemon_id ON user_pokedex(pokemon_id);
