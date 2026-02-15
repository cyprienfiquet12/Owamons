-- Migration 009: Colonnes pour XP en combat et évolution (préparation fonctionnalités futures)

-- Courbe d'expérience (ex: "Medium Slow", "Fast") pour le gain d'XP en combat
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS experience_growth VARCHAR(50);

-- XP total pour atteindre le niveau 100 (utilisé pour calcul du gain d'XP)
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS experience_growth_total INTEGER;

-- Détails d'évolution (ex: "Level 16", "Thunder Stone") pour la future fonctionnalité d'évolution
ALTER TABLE pokemons ADD COLUMN IF NOT EXISTS evolution_details TEXT;

-- pre_evolution_pokedex_id existe déjà (migration 004)

CREATE INDEX IF NOT EXISTS idx_pokemons_experience_growth ON pokemons(experience_growth);
