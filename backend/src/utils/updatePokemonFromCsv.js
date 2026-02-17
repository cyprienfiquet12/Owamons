/**
 * Met à jour la table pokemons à partir de PokemonDatabase.csv :
 * - rarity (à partir de Legendary Type, traduit en notre enum)
 * - experience_growth, experience_growth_total (gain d'XP en combat)
 * - pre_evolution_pokedex_id, evolution_details (évolution future)
 *
 * Ignore les lignes où "Alternate Form Name" n'est pas NULL (formes alternatives, Mega, etc.).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, query, queryResult } from '../database/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CSV_PATH = join(__dirname, '../../PokemonDatabase.csv');

// Mapping Legendary Type (CSV) -> rarity (notre enum) — traduction pour cohérence affichage
const LEGENDARY_TYPE_TO_RARITY = {
  'Legendary': 'LEGENDARY',      // Légendaire
  'Sub-Legendary': 'EPIC',       // Sous-légendaire
  'Mythical': 'LEGENDARY',       // Mythique
};

/**
 * Parse une ligne CSV en respectant les champs entre guillemets (et "" = guillemet échappé).
 */
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let content = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          content += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          content += line[i];
          i++;
        }
      }
      fields.push(content);
      if (line[i] === ',') i++;
    } else {
      let content = '';
      while (i < line.length && line[i] !== ',') {
        content += line[i];
        i++;
      }
      fields.push(content.trim());
      if (line[i] === ',') i++;
    }
  }
  return fields;
}

/**
 * Retourne un objet { header -> index } à partir de la première ligne.
 */
function parseHeader(headerLine) {
  const keys = parseCsvLine(headerLine);
  const index = {};
  keys.forEach((k, i) => { index[k] = i; });
  return index;
}

/**
 * Normalise une valeur "NULL" du CSV en null.
 */
function nullIfCsvNull(value) {
  if (value == null || String(value).trim() === '' || String(value).trim().toUpperCase() === 'NULL') {
    return null;
  }
  return value;
}

/**
 * Parse un entier ou null.
 */
function parseIntOrNull(value) {
  const v = nullIfCsvNull(value);
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export async function updatePokemonFromCsv() {
  await initDatabase();

  const raw = readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV vide ou sans données');
  }

  const idx = parseHeader(lines[0]);
  const pokemonIdIdx = idx['Pokemon Id'];
  const pokedexNumIdx = idx['Pokedex Number'];
  const altFormIdx = idx['Alternate Form Name'];
  const legendaryTypeIdx = idx['Legendary Type'];
  const expGrowthIdx = idx['Experience Growth'];
  const expGrowthTotalIdx = idx['Experience Growth Total'];
  const preEvoIdx = idx['Pre-Evolution Pokemon Id'];
  const evolutionDetailsIdx = idx['Evolution Details'];

  if ([pokemonIdIdx, pokedexNumIdx, altFormIdx, legendaryTypeIdx, expGrowthIdx, expGrowthTotalIdx, preEvoIdx, evolutionDetailsIdx].some((i) => i == null)) {
    throw new Error('Colonnes attendues manquantes dans le CSV');
  }

  // Mapping Pokemon Id (CSV) -> Pokedex Number : "Pre-Evolution Pokemon Id" est un Pokemon Id, la BDD attend un pokedex_id
  const pokemonIdToPokedexNumber = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const pokemonId = parseIntOrNull(row[pokemonIdIdx]);
    const pokedexNumber = parseIntOrNull(row[pokedexNumIdx]);
    if (pokemonId != null && pokedexNumber != null) {
      pokemonIdToPokedexNumber.set(pokemonId, pokedexNumber);
    }
  }

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const altForm = row[altFormIdx];
    // Ignorer les formes alternatives (Mega, Alola, etc.)
    if (altForm != null && String(altForm).trim().toUpperCase() !== 'NULL') {
      skipped++;
      continue;
    }

    const pokedexNumber = parseIntOrNull(row[pokedexNumIdx]);
    if (pokedexNumber == null) {
      skipped++;
      continue;
    }

    const legendaryType = nullIfCsvNull(row[legendaryTypeIdx]);
    let rarity = null;
    if (legendaryType) {
      const r = LEGENDARY_TYPE_TO_RARITY[legendaryType.trim()];
      if (r) rarity = r;
    }

    const experienceGrowth = nullIfCsvNull(row[expGrowthIdx]);
    const experienceGrowthTotal = parseIntOrNull(row[expGrowthTotalIdx]);
    // Pre-Evolution Pokemon Id (CSV) = Pokemon Id ; on stocke en BDD le Pokedex Number de cette pré-évolution
    const preEvoPokemonId = parseIntOrNull(row[preEvoIdx]);
    const preEvolutionPokedexId = preEvoPokemonId != null ? (pokemonIdToPokedexNumber.get(preEvoPokemonId) ?? null) : null;
    const evolutionDetails = nullIfCsvNull(row[evolutionDetailsIdx]);

    const existing = await query(
      'SELECT id FROM pokemons WHERE pokedex_id = $1',
      [pokedexNumber]
    );
    if (existing.length === 0) {
      notFound++;
      continue;
    }

    const updates = [];
    const params = [];
    let p = 1;
    if (rarity != null) {
      updates.push(`rarity = $${p++}`);
      params.push(rarity);
    }
    if (experienceGrowth != null) {
      updates.push(`experience_growth = $${p++}`);
      params.push(experienceGrowth);
    }
    if (experienceGrowthTotal != null) {
      updates.push(`experience_growth_total = $${p++}`);
      params.push(experienceGrowthTotal);
    }
    updates.push(`pre_evolution_pokedex_id = $${p++}`);
    params.push(preEvolutionPokedexId);
    updates.push(`evolution_details = $${p++}`);
    params.push(evolutionDetails);
    params.push(pokedexNumber);

    await queryResult(
      `UPDATE pokemons SET ${updates.join(', ')} WHERE pokedex_id = $${p}`,
      params
    );
    updated++;
  }

  return { updated, skipped, notFound };
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('updatePokemonFromCsv');
if (isMain) {
  updatePokemonFromCsv()
    .then(({ updated, skipped, notFound }) => {
      console.log(`Terminé: ${updated} Pokémon mis à jour, ${skipped} lignes ignorées (forme alternative), ${notFound} non trouvés en base.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Erreur:', err);
      process.exit(1);
    });
}
