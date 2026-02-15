-- Migration 002: Ajout des champs pour le traitement des votes et gestion des pokémon

-- Ajouter sprite_url aux shop_items pour les balls
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS sprite_url TEXT;

-- Ajouter is_ko aux user_pokemons pour gérer les pokémon KO
ALTER TABLE user_pokemons ADD COLUMN IF NOT EXISTS is_ko BOOLEAN DEFAULT FALSE;

-- Ajouter ball_type aux event_votes pour stocker le type de ball utilisé
ALTER TABLE event_votes ADD COLUMN IF NOT EXISTS ball_type VARCHAR(50);

-- Ajouter une colonne pour stocker le résultat du vote (winner, selected_user_id)
ALTER TABLE active_events ADD COLUMN IF NOT EXISTS winning_vote VARCHAR(20);
ALTER TABLE active_events ADD COLUMN IF NOT EXISTS selected_user_id INTEGER REFERENCES users(id);

-- Ajouter une colonne pour stocker l'état de traitement (pending_selection, etc.)
ALTER TABLE active_events ADD COLUMN IF NOT EXISTS processing_state VARCHAR(50) DEFAULT 'voting';

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_pokemons_is_ko ON user_pokemons(user_id, is_ko);
CREATE INDEX IF NOT EXISTS idx_event_votes_ball_type ON event_votes(event_id, ball_type);


