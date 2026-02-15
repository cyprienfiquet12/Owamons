import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Chemin du dump (racine du projet) */
const DUMP_PATH = join(__dirname, '../../../pokemon_twitch_backup.dump');

/**
 * Peuple la BDD en restaurant le dump PostgreSQL.
 * Nécessite pg_restore (postgresql-client) et DATABASE_URL.
 */
async function seed() {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL est requis pour le seed.');
      process.exit(1);
    }

    if (!existsSync(DUMP_PATH)) {
      console.error(`❌ Fichier dump introuvable: ${DUMP_PATH}`);
      console.error('   Placez pokemon_twitch_backup.dump à la racine du projet.');
      process.exit(1);
    }

    // Vérifier que la DB est joignable
    await initDatabase();

    console.log('📦 Restauration du dump PostgreSQL (pokemon_twitch_backup.dump)...');
    execSync(
      `pg_restore --no-owner --no-acl --clean --if-exists -d "${process.env.DATABASE_URL}" "${DUMP_PATH}"`,
      { stdio: 'inherit', shell: true }
    );
    console.log('✅ Seed terminé (dump restauré).');
    process.exit(0);
  } catch (error) {
    if (error.status !== undefined) {
      process.exit(error.status);
    }
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
}

seed();
