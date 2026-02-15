-- Migration 003: Ajout de la table starter_selections

-- StarterSelections Table (pour gérer les sélections de starter en cours)
CREATE TABLE IF NOT EXISTS starter_selections (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_starter_selections_user_id ON starter_selections(user_id);


