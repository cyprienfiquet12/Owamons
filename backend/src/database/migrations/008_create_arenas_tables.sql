-- Migration 008: Créer les tables pour les arènes

-- Ajouter sprite_url à la table badges si elle n'existe pas déjà
ALTER TABLE badges ADD COLUMN IF NOT EXISTS sprite_url TEXT;

-- Table Arenas (Champions d'arène)
CREATE TABLE IF NOT EXISTS arenas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    sprite_url TEXT,
    badge_id INTEGER REFERENCES badges(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table Arena Teams (Équipes des champions)
CREATE TABLE IF NOT EXISTS arena_teams (
    id SERIAL PRIMARY KEY,
    arena_id INTEGER NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    pokemon_id INTEGER NOT NULL REFERENCES pokemons(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 1,
    team_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(arena_id, team_order)
);

-- Ajouter arena_id à active_events pour lier les événements aux arènes
ALTER TABLE active_events ADD COLUMN IF NOT EXISTS arena_id INTEGER REFERENCES arenas(id) ON DELETE SET NULL;

-- Indexes pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_arenas_type ON arenas(type);
CREATE INDEX IF NOT EXISTS idx_arenas_badge_id ON arenas(badge_id);
CREATE INDEX IF NOT EXISTS idx_arena_teams_arena_id ON arena_teams(arena_id);
CREATE INDEX IF NOT EXISTS idx_arena_teams_pokemon_id ON arena_teams(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_active_events_arena_id ON active_events(arena_id);

