import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, getDatabase, runMigration } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Chemin du dump (racine du projet) */
const DUMP_PATH = join(__dirname, '../../../pokemon_twitch_backup.dump');

/** Tables ajoutées après la création du dump : à supprimer avant pg_restore --clean pour éviter les conflits de FK */
const TABLES_TO_DROP_BEFORE_RESTORE = ['user_pokedex'];

/**
 * Peuple la BDD en restaurant le dump PostgreSQL.
 * Nécessite pg_restore (postgresql-client) et DATABASE_URL.
 * Les tables créées après le dump (ex. user_pokedex) sont supprimées avant restauration puis recréées après.
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

    // Connexion à la BDD (charge .env via connection.js) — même connexion pour le DROP et pour runMigration
    await initDatabase();
    const pool = getDatabase();

    // DROP via la connexion Node pour être sûr d’agir sur la même base que pg_restore (évite URL tronquée par le shell sous Windows)
    for (const table of TABLES_TO_DROP_BEFORE_RESTORE) {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`   Table ${table} supprimée (sera recréée après la restauration).`);
    }

    // pg_restore sans shell : URL passée en un seul argument pour éviter & et autres caractères spéciaux sous Windows
    console.log('📦 Restauration du dump PostgreSQL (pokemon_twitch_backup.dump)...');
    const restore = spawnSync(
      'pg_restore',
      ['--no-owner', '--no-acl', '--clean', '--if-exists', '-d', process.env.DATABASE_URL, DUMP_PATH],
      { stdio: 'inherit', env: process.env, shell: false }
    );
    if (restore.status !== 0) {
      throw new Error(`pg_restore a quitté avec le code ${restore.status}`);
    }

    // Recréer les tables ajoutées après le dump (migration 010 : user_pokedex)
    const migration010 = readFileSync(join(__dirname, 'migrations', '010_user_pokedex.sql'), 'utf-8');
    await runMigration(migration010);
    console.log('   Table user_pokedex recréée.');

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
