-- Migration 006: Changer spawn_weight de INTEGER à REAL pour permettre les valeurs décimales

ALTER TABLE pokemons 
ALTER COLUMN spawn_weight TYPE REAL;


