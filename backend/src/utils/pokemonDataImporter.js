import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, query, queryResult } from '../database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Charge les données Pokémon depuis le fichier JSON
 */
export function loadPokemonDataFromJSON() {
  const jsonPath = join(__dirname, '../../Pokemondata.json');
  const fileContent = readFileSync(jsonPath, 'utf-8');
  return JSON.parse(fileContent);
}

/**
 * Charge les données du pokedex.json et crée un Map de pokedex_id -> avg_spawns
 */
export function loadPokedexSpawnWeights() {
  try {
    const pokedexPath = join(__dirname, '../../pokedex.json');
    const fileContent = readFileSync(pokedexPath, 'utf-8');
    const pokedexData = JSON.parse(fileContent);
    
    const spawnWeightMap = new Map();
    
    if (pokedexData.pokemon && Array.isArray(pokedexData.pokemon)) {
      for (const pokemon of pokedexData.pokemon) {
        if (pokemon.num && pokemon.avg_spawns !== undefined) {
          // Convertir "001" en 1, "002" en 2, etc.
          const pokedexId = parseInt(pokemon.num, 10);
          if (!isNaN(pokedexId) && pokemon.avg_spawns !== null) {
            // Utiliser avg_spawns comme spawn_weight (garder la valeur décimale)
            spawnWeightMap.set(pokedexId, parseFloat(pokemon.avg_spawns));
          }
        }
      }
    }
    
    return spawnWeightMap;
  } catch (error) {
    console.warn('⚠️ Could not load pokedex.json:', error.message);
    return new Map();
  }
}

/**
 * Normalise le nom du type pour correspondre à la base de données
 */
function normalizeTypeName(typeName) {
  const typeMap = {
    'Poison': 'Poison',
    'Plante': 'Grass',
    'Feu': 'Fire',
    'Eau': 'Water',
    'Normal': 'Normal',
    'Vol': 'Flying',
    'Insecte': 'Bug',
    'Électrik': 'Electric',
    'Électrique': 'Electric',
    'Sol': 'Ground',
    'Roche': 'Rock',
    'Combat': 'Fighting',
    'Psy': 'Psychic',
    'Glace': 'Ice',
    'Spectre': 'Ghost',
    'Dragon': 'Dragon',
    'Ténèbres': 'Dark',
    'Acier': 'Steel',
    'Fée': 'Fairy'
  };
  
  return typeMap[typeName] || typeName;
}

/**
 * Extrait tous les types uniques depuis les données Pokémon
 */
function extractUniqueTypes(pokemonData) {
  const typesMap = new Map();
  
  for (const pokemon of pokemonData) {
    if (pokemon.apiTypes && Array.isArray(pokemon.apiTypes)) {
      for (const type of pokemon.apiTypes) {
        if (type && type.name) {
          const normalizedName = normalizeTypeName(type.name);
          if (!typesMap.has(normalizedName)) {
            typesMap.set(normalizedName, {
              name: normalizedName,
              sprite_url: type.image || null
            });
          }
        }
      }
    }
  }
  
  return Array.from(typesMap.values());
}

/**
 * Détermine la rareté basée sur le pokedex_id et la génération
 */
function determineRarity(pokedexId, generation) {
  // Légendaires et mythiques (généralement dans les dernières positions de chaque génération)
  const legendaryRanges = [
    [144, 151], // Gen 1
    [243, 251], // Gen 2
    [377, 386], // Gen 3
    [480, 493], // Gen 4
    [638, 649], // Gen 5
    [716, 721], // Gen 6
    [772, 807], // Gen 7
    [888, 905]  // Gen 8
  ];
  
  for (const [start, end] of legendaryRanges) {
    if (pokedexId >= start && pokedexId <= end) {
      return 'LEGENDARY';
    }
  }
  
  // Épiques : starters et quelques autres
  const epicRanges = [
    [1, 3], [4, 6], [7, 9], // Starters Gen 1
    [152, 157], [158, 160], [161, 163], // Starters Gen 2
    [252, 257], [258, 260], [261, 264], // Starters Gen 3
    // Ajouter d'autres ranges si nécessaire
  ];
  
  for (const [start, end] of epicRanges) {
    if (pokedexId >= start && pokedexId <= end) {
      return 'EPIC';
    }
  }
  
  // Rares : certains Pokémon spéciaux
  if (pokedexId % 10 === 0 || pokedexId % 7 === 0) {
    return 'RARE';
  }
  
  return 'COMMON';
}

/**
 * Calcule le taux de capture basé sur les stats
 */
function calculateCaptureRate(stats) {
  // Formule simplifiée basée sur les stats totales
  const totalStats = stats.HP + stats.attack + stats.defense + 
                     stats.special_attack + stats.special_defense + stats.speed;
  
  // Plus les stats sont élevées, plus c'est difficile à capturer
  // Normalisé entre 0.1 et 0.9
  const baseRate = Math.max(0.1, Math.min(0.9, 1 - (totalStats / 1000)));
  return Math.round(baseRate * 100) / 100;
}

/**
 * Importe les données Pokémon depuis le JSON
 */
export async function importPokemonData() {
  await initDatabase();
  
  // Vérifier que la table a les nouvelles colonnes
  try {
    const checkResult = await queryResult(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pokemons' AND column_name = 'base_defense'
    `);
    
    if (checkResult.rows.length === 0) {
      console.error('❌ ERROR: The pokemons table does not have the new columns.');
      console.error('   Please run the migration first: npm run migrate');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ ERROR: Could not check table structure:', error.message);
    console.error('   Please ensure the migration has been run: npm run migrate');
    process.exit(1);
  }
  
  // Vider les tables avant l'import (dans l'ordre pour respecter les foreign keys)
  try {
    await queryResult('DELETE FROM pokemon_resistances');
    await queryResult('DELETE FROM pokemon_evolutions');
    await queryResult('DELETE FROM pokemons');

    try {
      await queryResult('ALTER SEQUENCE pokemons_id_seq RESTART WITH 1');
    } catch (seqError) {
      // Ne pas échouer si la séquence n'existe pas encore
      if (seqError.message.includes('does not exist')) {
        console.warn('   ⚠️ Sequence pokemons_id_seq does not exist yet, skipping reset');
      } else {
        throw seqError;
      }
    }
    
    // Réinitialiser les séquences des tables dépendantes
    try {
      await queryResult('ALTER SEQUENCE pokemon_resistances_id_seq RESTART WITH 1');
    } catch (seqError) {
      if (!seqError.message.includes('does not exist')) {
        console.warn('   ⚠️ Could not reset pokemon_resistances_id_seq:', seqError.message);
      }
    }
    
    try {
      await queryResult('ALTER SEQUENCE pokemon_evolutions_id_seq RESTART WITH 1');
    } catch (seqError) {
      if (!seqError.message.includes('does not exist')) {
        console.warn('   ⚠️ Could not reset pokemon_evolutions_id_seq:', seqError.message);
      }
    }
    
    // Vérifier si pokemon_types existe
    try {
      await queryResult('DELETE FROM pokemon_types');
      await queryResult('ALTER SEQUENCE pokemon_types_id_seq RESTART WITH 1');
    } catch (error) {
      if (!error.message.includes('does not exist')) {
        console.warn('   ⚠️ Could not clear/reset pokemon_types:', error.message);
      }
    }
    
    // Vérifier si types existe
    try {
      await queryResult('DELETE FROM types');
      await queryResult('ALTER SEQUENCE types_id_seq RESTART WITH 1');
    } catch (error) {
      if (!error.message.includes('does not exist')) {
        console.warn('   ⚠️ Could not clear/reset types:', error.message);
      }
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to clear tables:', error.message);
    console.error('   This might be due to foreign key constraints or missing tables.');
    throw error;
  }
  
  const pokemonData = loadPokemonDataFromJSON();
  const spawnWeightMap = loadPokedexSpawnWeights();
  const uniqueTypes = extractUniqueTypes(pokemonData);
  const typeIdMap = new Map();

  for (const type of uniqueTypes) {
    try {
      const result = await queryResult(`
        INSERT INTO types (name, sprite_url)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET
          sprite_url = EXCLUDED.sprite_url
        RETURNING id
      `, [type.name, type.sprite_url]);
      
      if (result.rows && result.rows[0]) {
        typeIdMap.set(type.name, result.rows[0].id);
      }
    } catch (error) {
      console.warn(`⚠️ Error importing type ${type.name}:`, error.message);
    }
  }

  let imported = 0;
  let errors = 0;
  
  for (const pokemon of pokemonData) {
    try {
      // Vérifier que le Pokémon a les données essentielles
      if (!pokemon.pokedexId || !pokemon.name) {
        console.warn(`⚠️ Skipping Pokémon with missing pokedexId or name:`, pokemon);
        errors++;
        continue;
      }
      
      // Extraire les types
      const types = pokemon.apiTypes || [];
      const type1 = (types[0] && types[0].name) ? normalizeTypeName(types[0].name) : 'Normal';
      const type2 = (types[1] && types[1].name) ? normalizeTypeName(types[1].name) : null;
      
      // Extraire les stats
      const stats = pokemon.stats || {};
      const baseHP = stats.HP || 50;
      const baseAttack = stats.attack || 50;
      const baseDefense = stats.defense || 50;
      const baseSpecialAttack = stats.special_attack || 50;
      const baseSpecialDefense = stats.special_defense || 50;
      const baseSpeed = stats.speed || 50;
      
      // Déterminer la rareté et le taux de capture
      const rarity = determineRarity(pokemon.pokedexId, pokemon.apiGeneration || 1);
      const captureRate = calculateCaptureRate(stats);
      
      // Extraire les URLs
      const spriteUrl = pokemon.sprite || null;
      const imageUrl = pokemon.image || null;
      
      // Extraire la pré-évolution
      let preEvolutionPokedexId = null;
      if (pokemon.apiPreEvolution && pokemon.apiPreEvolution !== 'none') {
        preEvolutionPokedexId = pokemon.apiPreEvolution.pokedexIdd || pokemon.apiPreEvolution.pokedexId || null;
      }
      
      // Insérer ou mettre à jour le Pokémon
      const result = await queryResult(`
        INSERT INTO pokemons 
        (pokedex_id, name, type_1, type_2, base_hp, base_attack, base_defense, 
         base_special_attack, base_special_defense, base_speed, rarity, capture_rate, 
         spawn_weight, sprite_url, image_url, generation, slug, pre_evolution_pokedex_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (pokedex_id) DO UPDATE SET
          name = EXCLUDED.name,
          type_1 = EXCLUDED.type_1,
          type_2 = EXCLUDED.type_2,
          base_hp = EXCLUDED.base_hp,
          base_attack = EXCLUDED.base_attack,
          base_defense = EXCLUDED.base_defense,
          base_special_attack = EXCLUDED.base_special_attack,
          base_special_defense = EXCLUDED.base_special_defense,
          base_speed = EXCLUDED.base_speed,
          rarity = EXCLUDED.rarity,
          capture_rate = EXCLUDED.capture_rate,
          spawn_weight = EXCLUDED.spawn_weight,
          sprite_url = EXCLUDED.sprite_url,
          image_url = EXCLUDED.image_url,
          generation = EXCLUDED.generation,
          slug = EXCLUDED.slug,
          pre_evolution_pokedex_id = EXCLUDED.pre_evolution_pokedex_id
        RETURNING id
      `, [
        pokemon.pokedexId,
        pokemon.name,
        type1,
        type2,
        baseHP,
        baseAttack,
        baseDefense,
        baseSpecialAttack,
        baseSpecialDefense,
        baseSpeed,
        rarity,
        captureRate,
        spawnWeightMap.get(pokemon.pokedexId) || 100.0, // spawn_weight depuis pokedex.json ou 100.0 par défaut
        spriteUrl,
        imageUrl,
        pokemon.apiGeneration || 1,
        pokemon.slug || pokemon.name,
        preEvolutionPokedexId
      ]);
      
      // Vérifier que l'insertion a réussi
      if (!result.rows || !result.rows[0] || !result.rows[0].id) {
        console.error(`❌ Failed to insert/update ${pokemon.name} (pokedex_id: ${pokemon.pokedexId}): No ID returned`);
        errors++;
        continue;
      }
      
      const pokemonDbId = result.rows[0].id;
      
      // Insérer les types du Pokémon (relation many-to-many)
      if (pokemon.apiTypes && Array.isArray(pokemon.apiTypes)) {
        for (let i = 0; i < pokemon.apiTypes.length; i++) {
          const type = pokemon.apiTypes[i];
          if (type && type.name) {
            const normalizedTypeName = normalizeTypeName(type.name);
            const typeId = typeIdMap.get(normalizedTypeName);
            
            if (typeId) {
              try {
                await queryResult(`
                  INSERT INTO pokemon_types (pokemon_id, type_id, slot)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (pokemon_id, type_id, slot) DO NOTHING
                `, [pokemonDbId, typeId, i + 1]); // slot 1 ou 2
              } catch (typeError) {
                console.warn(`⚠️ Error inserting type for ${pokemon.name}:`, typeError.message);
              }
            } else {
              console.warn(`⚠️ Type not found in typeIdMap: ${normalizedTypeName} for ${pokemon.name}`);
            }
          }
        }
      }
      
      // Insérer les résistances/faiblesses
      if (pokemon.apiResistances && Array.isArray(pokemon.apiResistances)) {
        for (const resistance of pokemon.apiResistances) {
          if (!resistance || !resistance.name) {
            console.warn(`⚠️ Skipping invalid resistance for ${pokemon.name}:`, resistance);
            continue;
          }
          
          try {
            await query(`
              INSERT INTO pokemon_resistances 
              (pokemon_id, type_name, damage_multiplier, damage_relation)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (pokemon_id, type_name) DO UPDATE SET
                damage_multiplier = EXCLUDED.damage_multiplier,
                damage_relation = EXCLUDED.damage_relation
            `, [
              pokemonDbId,
              normalizeTypeName(resistance.name),
              resistance.damage_multiplier || 1,
              resistance.damage_relation || 'neutral'
            ]);
          } catch (resistanceError) {
            console.warn(`⚠️ Error inserting resistance for ${pokemon.name}:`, resistanceError.message);
          }
        }
      }
      
      // Insérer les évolutions
      if (pokemon.apiEvolutions && Array.isArray(pokemon.apiEvolutions)) {
        for (const evolution of pokemon.apiEvolutions) {
          if (!evolution || !evolution.pokedexId || !evolution.name) {
            console.warn(`⚠️ Skipping invalid evolution for ${pokemon.name}:`, evolution);
            continue;
          }
          
          try {
            await query(`
              INSERT INTO pokemon_evolutions 
              (pokemon_id, evolution_pokedex_id, evolution_name)
              VALUES ($1, $2, $3)
              ON CONFLICT (pokemon_id, evolution_pokedex_id) DO NOTHING
            `, [
              pokemonDbId,
              evolution.pokedexId,
              evolution.name
            ]);
          } catch (evolutionError) {
            console.warn(`⚠️ Error inserting evolution for ${pokemon.name}:`, evolutionError.message);
          }
        }
      }
      
      imported++;
    } catch (error) {
      errors++;
      console.error(`❌ Error importing ${pokemon.name} (pokedex_id: ${pokemon.pokedexId}):`, error.message);
    }
  }
}

// Exécuter l'import si le script est lancé directement
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('pokemonDataImporter')) {
  importPokemonData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Import failed:', error);
      process.exit(1);
    });
}

// Si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  importPokemonData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Import failed:', error);
      process.exit(1);
    });
}

