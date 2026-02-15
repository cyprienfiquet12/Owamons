-- Migration 005: Création de la table types et de la relation many-to-many avec pokemons

-- Table Types (tous les types Pokémon disponibles)
CREATE TABLE IF NOT EXISTS types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    sprite_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison Pokemon-Types (many-to-many)
CREATE TABLE IF NOT EXISTS pokemon_types (
    id SERIAL PRIMARY KEY,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL REFERENCES types(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK(slot IN (1, 2)), -- 1 pour type principal, 2 pour type secondaire
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pokemon_id, type_id, slot)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_pokemon_types_pokemon_id ON pokemon_types(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_types_type_id ON pokemon_types(type_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_types_slot ON pokemon_types(pokemon_id, slot);
CREATE INDEX IF NOT EXISTS idx_types_name ON types(name);


