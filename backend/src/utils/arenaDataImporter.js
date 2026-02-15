import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, queryOne, queryResult } from '../database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Importe les données des arènes depuis arena.json
 */
export async function importArenaData() {
  try {
    // Lire le fichier arena.json
    const arenaDataPath = join(__dirname, '../../arena.json');
    const arenaData = JSON.parse(readFileSync(arenaDataPath, 'utf-8'));

    // Vider les tables existantes
    await query('DELETE FROM arena_teams');
    await query('DELETE FROM arenas');
    await query('DELETE FROM badges WHERE id IN (SELECT badge_id FROM arenas WHERE badge_id IS NOT NULL)');
    
    // Réinitialiser les séquences
    await query('ALTER SEQUENCE arenas_id_seq RESTART WITH 1');
    await query('ALTER SEQUENCE arena_teams_id_seq RESTART WITH 1');

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const arena of arenaData) {
      try {
        // Vérifier si le type existe dans la table types
        const typeRecord = await queryOne('SELECT id FROM types WHERE LOWER(name) = LOWER($1)', [arena.type]);
        
        if (!typeRecord) {
          console.warn(`⚠️  Type "${arena.type}" not found in types table for arena "${arena.name}". Skipping type association.`);
        }

        // Créer ou récupérer le badge
        let badgeId = null;
        if (arena.badge) {
          const existingBadge = await queryOne('SELECT id FROM badges WHERE LOWER(name) = LOWER($1)', [arena.badge.name]);
          
          if (existingBadge) {
            badgeId = existingBadge.id;
            // Mettre à jour le sprite_url du badge
            await query('UPDATE badges SET sprite_url = $1 WHERE id = $2', [arena.badge.sprite, badgeId]);
            updated++;
          } else {
            // Créer le badge
            const badgeResult = await queryResult(
              'INSERT INTO badges (name, sprite_url, description) VALUES ($1, $2, $3) RETURNING id',
              [arena.badge.name, arena.badge.sprite, `Badge de l'arène ${arena.name}`]
            );
            badgeId = badgeResult.rows[0].id;
            imported++;
          }
        }

        // Créer l'arène
        const arenaResult = await queryResult(
          'INSERT INTO arenas (name, type, sprite_url, badge_id) VALUES ($1, $2, $3, $4) RETURNING id',
          [arena.name, arena.type, arena.sprite, badgeId]
        );
        const arenaId = arenaResult.rows[0].id;

        // Ajouter les Pokémon de l'équipe
        for (let i = 0; i < arena.team.length; i++) {
          const teamMember = arena.team[i];
          
          // Trouver le Pokémon par pokedex_number
          const pokemon = await queryOne('SELECT id FROM pokemons WHERE pokedex_id = $1', [teamMember.pokedex_number]);
          
          if (!pokemon) {
            console.warn(`⚠️  Pokémon with pokedex_id ${teamMember.pokedex_number} (${teamMember.name}) not found. Skipping.`);
            continue;
          }

          // Ajouter au team
          await query(
            'INSERT INTO arena_teams (arena_id, pokemon_id, level, team_order) VALUES ($1, $2, $3, $4)',
            [arenaId, pokemon.id, teamMember.level, i + 1]
          );
        }

        imported++;
      } catch (error) {
        console.error(`❌ Error importing arena ${arena.name}:`, error);
        errors++;
      }
    }

    return { imported, updated, errors };
  } catch (error) {
    console.error('❌ Error importing arena data:', error);
    throw error;
  }
}

// Si exécuté directement
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.includes('arenaDataImporter') ||
                     import.meta.url.endsWith('arenaDataImporter.js');

if (isMainModule) {
  import('../database/connection.js').then(({ initDatabase }) => {
    return initDatabase();
  }).then(() => {
    return importArenaData();
  }).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
}

