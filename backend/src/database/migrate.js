import { initDatabase, runMigration } from './connection.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  try {
    await initDatabase();

    const migration002 = readFileSync(
      join(__dirname, 'migrations', '002_add_vote_processing_fields.sql'),
      'utf-8'
    );
    await runMigration(migration002);

    const migration003 = readFileSync(
      join(__dirname, 'migrations', '003_add_starter_selections.sql'),
      'utf-8'
    );
    await runMigration(migration003);

    const migration004 = readFileSync(
      join(__dirname, 'migrations', '004_update_pokemons_table.sql'),
      'utf-8'
    );
    await runMigration(migration004);

    const migration005 = readFileSync(
      join(__dirname, 'migrations', '005_create_types_table.sql'),
      'utf-8'
    );
    await runMigration(migration005);

    const migration006 = readFileSync(
      join(__dirname, 'migrations', '006_change_spawn_weight_to_real.sql'),
      'utf-8'
    );
    await runMigration(migration006);

    const migration007 = readFileSync(
      join(__dirname, 'migrations', '007_add_updated_at_to_active_events.sql'),
      'utf-8'
    );
    await runMigration(migration007);

    const migration008 = readFileSync(
      join(__dirname, 'migrations', '008_create_arenas_tables.sql'),
      'utf-8'
    );
    await runMigration(migration008);

    const migration009 = readFileSync(
      join(__dirname, 'migrations', '009_add_pokemon_experience_evolution.sql'),
      'utf-8'
    );
    await runMigration(migration009);

    const migration010 = readFileSync(
      join(__dirname, 'migrations', '010_user_pokedex.sql'),
      'utf-8'
    );
    await runMigration(migration010);

    const migration011 = readFileSync(
      join(__dirname, 'migrations', '011_add_lvl_user_pokedex.sql'),
      'utf-8'
    );
    await runMigration(migration011);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

runMigrations();
