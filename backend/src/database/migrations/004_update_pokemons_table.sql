-- Migration 004: Mise à jour de la table pokemons avec toutes les stats et nouvelles colonnes

-- Ajouter les nouvelles colonnes pour les stats complètes
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS base_defense INTEGER;
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS base_special_attack INTEGER;
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS base_special_defense INTEGER;
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS base_speed INTEGER;

-- Ajouter les colonnes pour les métadonnées
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS generation INTEGER;
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS pre_evolution_pokedex_id INTEGER;

-- Mettre à jour les valeurs par défaut pour les stats existantes si NULL
UPDATE pokemons 
SET base_defense = base_attack,
    base_special_attack = base_attack,
    base_special_defense = base_attack,
    base_speed = 50
WHERE base_defense IS NULL;

-- Créer la table pour les résistances/faiblesses
CREATE TABLE IF NOT EXISTS pokemon_resistances (
    id SERIAL PRIMARY KEY,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    type_name VARCHAR(50) NOT NULL,
    damage_multiplier REAL NOT NULL,
    damage_relation VARCHAR(50) NOT NULL CHECK(damage_relation IN ('neutral', 'resistant', 'twice_resistant', 'vulnerable', 'twice_vulnerable', 'immune')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pokemon_id, type_name)
);

-- Créer la table pour les évolutions
CREATE TABLE IF NOT EXISTS pokemon_evolutions (
    id SERIAL PRIMARY KEY,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    evolution_pokedex_id INTEGER NOT NULL,
    evolution_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pokemon_id, evolution_pokedex_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_pokemon_resistances_pokemon_id ON pokemon_resistances(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_resistances_type_name ON pokemon_resistances(type_name);
CREATE INDEX IF NOT EXISTS idx_pokemon_evolutions_pokemon_id ON pokemon_evolutions(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_evolutions_pokedex_id ON pokemon_evolutions(evolution_pokedex_id);
CREATE INDEX IF NOT EXISTS idx_pokemons_generation ON pokemons(generation);
CREATE INDEX IF NOT EXISTS idx_pokemons_pre_evolution ON pokemons(pre_evolution_pokedex_id);


