-- PostgreSQL Schema for Pokémon Twitch Chat System

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    twitch_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    poke_coins INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pokemons Table (Référentiel)
CREATE TABLE IF NOT EXISTS pokemons (
    id SERIAL PRIMARY KEY,
    pokedex_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type_1 VARCHAR(50) NOT NULL,
    type_2 VARCHAR(50),
    base_hp INTEGER NOT NULL,
    base_attack INTEGER NOT NULL,
    base_defense INTEGER,
    base_special_attack INTEGER,
    base_special_defense INTEGER,
    base_speed INTEGER,
    rarity VARCHAR(20) NOT NULL CHECK(rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
    capture_rate REAL NOT NULL,
    spawn_weight REAL NOT NULL DEFAULT 100.0,
    sprite_url TEXT,
    image_url TEXT,
    generation INTEGER,
    slug VARCHAR(255),
    pre_evolution_pokedex_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UserPokemons Table
CREATE TABLE IF NOT EXISTS user_pokemons (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    current_hp INTEGER NOT NULL,
    is_shiny BOOLEAN DEFAULT FALSE,
    is_ko BOOLEAN DEFAULT FALSE,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Pokedex Table (espèces déjà possédées par un viewer, pour suivi progression Pokédex)
CREATE TABLE IF NOT EXISTS user_pokedex (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    first_captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lvl INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, pokemon_id)
);
CREATE INDEX IF NOT EXISTS idx_user_pokedex_user_id ON user_pokedex(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pokedex_pokemon_id ON user_pokedex(pokemon_id);

-- ShopItems Table
CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    price INTEGER NOT NULL,
    effect_type VARCHAR(50) NOT NULL CHECK(effect_type IN ('CAPTURE_BONUS', 'XP_BONUS', 'HEAL')),
    effect_value REAL NOT NULL,
    description TEXT,
    sprite_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UserInventory Table
CREATE TABLE IF NOT EXISTS user_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    UNIQUE(user_id, item_id)
);

-- Badges Table
CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UserBadges Table
CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_id)
);

-- ActiveEvent Table
CREATE TABLE IF NOT EXISTS active_events (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK(type IN ('spawn', 'arena', 'boss')),
    pokemon_id INTEGER REFERENCES pokemons(id) ON DELETE SET NULL,
    level INTEGER DEFAULT 1,
    current_hp INTEGER,
    status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active', 'completed', 'expired', 'failed')),
    winning_vote VARCHAR(20),
    selected_user_id INTEGER REFERENCES users(id),
    processing_state VARCHAR(50) DEFAULT 'voting',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- EventVotes Table
CREATE TABLE IF NOT EXISTS event_votes (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES active_events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(20) NOT NULL CHECK(vote_type IN ('capture', 'battle', 'flee')),
    ball_type VARCHAR(50),
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Indexes pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_twitch_id ON users(twitch_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_pokemons_rarity ON pokemons(rarity);
CREATE INDEX IF NOT EXISTS idx_pokemons_spawn_weight ON pokemons(spawn_weight);
CREATE INDEX IF NOT EXISTS idx_user_pokemons_user_id ON user_pokemons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pokemons_pokemon_id ON user_pokemons(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_active_events_status ON active_events(status);
CREATE INDEX IF NOT EXISTS idx_active_events_expires_at ON active_events(expires_at);
CREATE INDEX IF NOT EXISTS idx_event_votes_event_id ON event_votes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_votes_user_id ON event_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pokemons_is_ko ON user_pokemons(user_id, is_ko);
CREATE INDEX IF NOT EXISTS idx_event_votes_ball_type ON event_votes(event_id, ball_type);

-- StarterSelections Table (pour gérer les sélections de starter en cours)
CREATE TABLE IF NOT EXISTS starter_selections (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_starter_selections_user_id ON starter_selections(user_id);

-- Pokemon Resistances Table (pour les faiblesses/résistances)
CREATE TABLE IF NOT EXISTS pokemon_resistances (
    id SERIAL PRIMARY KEY,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    type_name VARCHAR(50) NOT NULL,
    damage_multiplier REAL NOT NULL,
    damage_relation VARCHAR(50) NOT NULL CHECK(damage_relation IN ('neutral', 'resistant', 'twice_resistant', 'vulnerable', 'twice_vulnerable', 'immune')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pokemon_id, type_name)
);

-- Pokemon Evolutions Table (pour les évolutions)
CREATE TABLE IF NOT EXISTS pokemon_evolutions (
    id SERIAL PRIMARY KEY,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    evolution_pokedex_id INTEGER NOT NULL,
    evolution_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pokemon_id, evolution_pokedex_id)
);

-- Indexes supplémentaires
CREATE INDEX IF NOT EXISTS idx_pokemon_resistances_pokemon_id ON pokemon_resistances(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_resistances_type_name ON pokemon_resistances(type_name);
CREATE INDEX IF NOT EXISTS idx_pokemon_evolutions_pokemon_id ON pokemon_evolutions(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_evolutions_pokedex_id ON pokemon_evolutions(evolution_pokedex_id);
CREATE INDEX IF NOT EXISTS idx_pokemons_generation ON pokemons(generation);
CREATE INDEX IF NOT EXISTS idx_pokemons_pre_evolution ON pokemons(pre_evolution_pokedex_id);

-- Types Table (tous les types Pokémon disponibles)
CREATE TABLE IF NOT EXISTS types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    sprite_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pokemon Types Table (relation many-to-many)
CREATE TABLE IF NOT EXISTS pokemon_types (
    id SERIAL PRIMARY KEY,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL REFERENCES types(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK(slot IN (1, 2)), -- 1 pour type principal, 2 pour type secondaire
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pokemon_id, type_id, slot)
);

-- Index pour les types
CREATE INDEX IF NOT EXISTS idx_pokemon_types_pokemon_id ON pokemon_types(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_types_type_id ON pokemon_types(type_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_types_slot ON pokemon_types(pokemon_id, slot);
CREATE INDEX IF NOT EXISTS idx_types_name ON types(name);

