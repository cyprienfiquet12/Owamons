-- Migration 011: Ajout de la colonne lvl (niveau) dans user_pokedex

ALTER TABLE user_pokedex
ADD COLUMN IF NOT EXISTS lvl INTEGER NOT NULL DEFAULT 1;
