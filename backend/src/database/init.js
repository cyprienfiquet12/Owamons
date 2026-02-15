import { initDatabase, initializeSchema, query } from './connection.js';
import { loadPokemonData } from '../utils/pokemonLoader.js';

/**
 * Initialise complètement la base de données
 * - Crée le schéma
 * - Seed les Pokémon
 * - Seed les items de boutique
 * - Seed les badges
 */
async function initializeDatabase() {
  try {
    await initDatabase();
    await initializeSchema();

    // Seed les Pokémon
    const pokemonData = loadPokemonData();
    
    for (const pokemon of pokemonData) {
      try {
        await query(`
          INSERT INTO pokemons 
          (pokedex_id, name, type_1, type_2, base_hp, base_attack, rarity, capture_rate, spawn_weight, sprite_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (pokedex_id) DO NOTHING
        `, [
          pokemon.pokedex_id,
          pokemon.name,
          pokemon.type_1,
          pokemon.type_2 || null,
          pokemon.base_hp,
          pokemon.base_attack,
          pokemon.rarity,
          pokemon.capture_rate,
          pokemon.spawn_weight,
          pokemon.sprite_url || null
        ]);
      } catch (error) {
        // Ignorer les erreurs de duplication
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          console.error(`Error inserting ${pokemon.name}:`, error.message);
        }
      }
    }

    // Seed les items de boutique
    const shopItems = [
      {
        name: 'Pokéball',
        price: 5,
        effect_type: 'CAPTURE_BONUS',
        effect_value: 0.05,
        description: 'Augmente les chances de capture de 5%'
      },
      {
        name: 'Superball',
        price: 15,
        effect_type: 'CAPTURE_BONUS',
        effect_value: 0.10,
        description: 'Augmente les chances de capture de 10%'
      },
      {
        name: 'Hyperball',
        price: 40,
        effect_type: 'CAPTURE_BONUS',
        effect_value: 0.20,
        description: 'Augmente les chances de capture de 20%'
      }
    ];
    
    for (const item of shopItems) {
      try {
        await query(`
          INSERT INTO shop_items (name, price, effect_type, effect_value, description)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (name) DO NOTHING
        `, [
          item.name,
          item.price,
          item.effect_type,
          item.effect_value,
          item.description
        ]);
      } catch (error) {
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          console.error(`Error inserting shop item ${item.name}:`, error.message);
        }
      }
    }

    // Seed les badges
    const badges = [
      {
        name: 'First Capture',
        description: 'Capturé votre premier Pokémon',
        image_url: null
      },
      {
        name: 'Arena Champion',
        description: 'Vaincu une arène',
        image_url: null
      },
      {
        name: 'Legendary Hunter',
        description: 'Capturé un Pokémon légendaire',
        image_url: null
      }
    ];
    
    for (const badge of badges) {
      try {
        await query(`
          INSERT INTO badges (name, description, image_url)
          VALUES ($1, $2, $3)
          ON CONFLICT (name) DO NOTHING
        `, [
          badge.name,
          badge.description,
          badge.image_url
        ]);
      } catch (error) {
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          console.error(`Error inserting badge ${badge.name}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith('init.js')) {
  initializeDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    });
}

export { initializeDatabase };
