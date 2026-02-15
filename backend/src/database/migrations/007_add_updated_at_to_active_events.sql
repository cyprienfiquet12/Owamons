-- Migration 007: Ajouter updated_at à active_events pour tracker les timeouts de sélection

ALTER TABLE active_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


