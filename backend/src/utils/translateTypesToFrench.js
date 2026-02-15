import { query, initDatabase } from '../database/connection.js';

/**
 * Mapping des types anglais vers français
 */
const typeTranslationMap = {
  'Normal': 'Normal',
  'Fire': 'Feu',
  'Water': 'Eau',
  'Electric': 'Électrik',
  'Grass': 'Plante',
  'Ice': 'Glace',
  'Fighting': 'Combat',
  'Poison': 'Poison',
  'Ground': 'Sol',
  'Flying': 'Vol',
  'Psychic': 'Psy',
  'Bug': 'Insecte',
  'Rock': 'Roche',
  'Ghost': 'Spectre',
  'Dragon': 'Dragon',
  'Dark': 'Ténèbres',
  'Steel': 'Acier',
  'Fairy': 'Fée'
};

/**
 * Traduit tous les types de la table types en français
 */
export async function translateTypesToFrench() {
  try {
    await initDatabase();

    // Récupérer tous les types actuels
    const types = await query('SELECT id, name FROM types');

    let translated = 0;
    let skipped = 0;
    let errors = 0;

    for (const type of types) {
      const englishName = type.name;
      const frenchName = typeTranslationMap[englishName];

      if (!frenchName) {
        console.warn(`⚠️  No French translation found for type: ${englishName}`);
        skipped++;
        continue;
      }

      if (englishName === frenchName) {
        skipped++;
        continue;
      }

      try {
        // Vérifier si le nom français existe déjà
        const existingFrench = await query('SELECT id FROM types WHERE name = $1', [frenchName]);

        if (existingFrench.length > 0) {
          console.warn(`⚠️  French name "${frenchName}" already exists. Skipping translation of "${englishName}"`);
          skipped++;
          continue;
        }

        // Mettre à jour le nom
        await query('UPDATE types SET name = $1 WHERE id = $2', [frenchName, type.id]);
        translated++;
      } catch (error) {
        console.error(`❌ Error translating type ${englishName}:`, error.message);
        errors++;
      }
    }

    return { translated, skipped, errors };
  } catch (error) {
    console.error('❌ Error translating types:', error);
    throw error;
  }
}

// Si exécuté directement
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('translateTypesToFrench')) {
  translateTypesToFrench()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Translation failed:', error);
      process.exit(1);
    });
}

