-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    twitch_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    poke_coins INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pokemons Table (Référentiel)
CREATE TABLE IF NOT EXISTS pokemons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pokedex_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type_1 TEXT NOT NULL,
    type_2 TEXT,
    base_hp INTEGER NOT NULL,
    base_attack INTEGER NOT NULL,
    rarity TEXT NOT NULL CHECK(rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
    capture_rate REAL NOT NULL,
    spawn_weight INTEGER NOT NULL DEFAULT 100,
    sprite_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- UserPokemons Table
CREATE TABLE IF NOT EXISTS user_pokemons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    pokemon_id INTEGER NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    current_hp INTEGER NOT NULL,
    is_shiny BOOLEAN DEFAULT 0,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pokemon_id) REFERENCES pokemons(id) ON DELETE CASCADE
);

-- ShopItems Table
CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    price INTEGER NOT NULL,
    effect_type TEXT NOT NULL CHECK(effect_type IN ('CAPTURE_BONUS', 'XP_BONUS', 'HEAL')),
    effect_value REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- UserInventory Table
CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_id)
);

-- Badges Table
CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- UserBadges Table
CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_id INTEGER NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_id)
);

-- ActiveEvent Table
CREATE TABLE IF NOT EXISTS active_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('spawn', 'arena', 'boss')),
    pokemon_id INTEGER,
    level INTEGER DEFAULT 1,
    current_hp INTEGER,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'expired', 'failed')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (pokemon_id) REFERENCES pokemons(id) ON DELETE SET NULL
);

-- EventVotes Table (pour tracker les votes)
CREATE TABLE IF NOT EXISTS event_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_type TEXT NOT NULL CHECK(vote_type IN ('capture', 'battle', 'flee')),
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES active_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
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


