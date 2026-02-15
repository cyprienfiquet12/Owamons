import { spawnPokemon } from './src/services/spawnService.js';
import { initDatabase } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script de test pour spawner un Pokémon
 * 
 * ⚠️  IMPORTANT: Ce script ne démarre PAS le serveur.
 * Il crée seulement l'événement dans la base de données.
 * 
 * Pour voir l'overlay avec le sprite:
 * 1. Démarrez le serveur dans un terminal séparé: npm run dev
 * 2. Ouvrez http://localhost:3000 dans votre navigateur
 * 3. Utilisez l'endpoint API: curl -X POST http://localhost:3000/api/spawn
 * 
 * Ou utilisez directement l'endpoint API au lieu de ce script.
 */
async function test() {
  try {
    await initDatabase();
    await spawnPokemon();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.message.includes('already in progress')) {
      console.error('');
      console.error('💡 Il y a déjà un événement actif.');
      console.error('   Attendez qu\'il expire ou utilisez l\'API pour le gérer.');
    }
    process.exit(1);
  }
}

test();