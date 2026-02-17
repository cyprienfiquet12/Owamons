/**
 * Corrige la colonne pre_evolution_pokedex_id dans la table pokemons.
 *
 * Dans PokemonDatabase.csv, "Pre-Evolution Pokemon Id" est l'ID interne du CSV (Pokemon Id),
 * alors que la BDD attend le Pokedex Number. Ce script :
 * 1. Construit un mapping Pokemon Id (CSV) -> Pokedex Number depuis le CSV
 * 2. Pour chaque ligne avec un Pre-Evolution Pokemon Id, calcule le Pokedex Number de la pré-évolution
 * 3. Met à jour pokemons.pre_evolution_pokedex_id avec ce Pokedex Number (au lieu du Pokemon Id)
 *
 * Ignore les lignes où "Alternate Form Name" n'est pas NULL (formes alternatives, Mega, etc.).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, queryResult } from '../src/database/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, '..', 'PokemonDatabase.csv');

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

function parseHeader(headerLine) {
  const keys = parseCsvLine(headerLine);
  const index = {};
  keys.forEach((k, i) => { index[k] = i; });
  return index;
}

function nullIfCsvNull(value) {
  if (value == null || String(value).trim() === '' || String(value).trim().toUpperCase() === 'NULL') {
    return null;
  }
  return value;
}

function parseIntOrNull(value) {
  const v = nullIfCsvNull(value);
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export async function fixPreEvolutionPokedexId() {
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
  const preEvoIdx = idx['Pre-Evolution Pokemon Id'];

  if ([pokemonIdIdx, pokedexNumIdx, altFormIdx, preEvoIdx].some((i) => i == null)) {
    throw new Error('Colonnes attendues manquantes dans le CSV (Pokemon Id, Pokedex Number, Alternate Form Name, Pre-Evolution Pokemon Id)');
  }

  // 1) Mapping Pokemon Id (CSV) -> Pokedex Number (pour toute ligne du CSV)
  const pokemonIdToPokedexNumber = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const pokemonId = parseIntOrNull(row[pokemonIdIdx]);
    const pokedexNumber = parseIntOrNull(row[pokedexNumIdx]);
    if (pokemonId != null && pokedexNumber != null) {
      pokemonIdToPokedexNumber.set(pokemonId, pokedexNumber);
    }
  }

  // 2) Pour chaque ligne "principale" (sans forme alternative) ayant une pré-évolution,
  //    calculer le bon pre_evolution_pokedex_id (Pokedex Number) et mettre à jour la BDD
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let noMapping = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const altForm = row[altFormIdx];
    if (altForm != null && String(altForm).trim().toUpperCase() !== 'NULL') {
      skipped++;
      continue;
    }

    const pokedexNumber = parseIntOrNull(row[pokedexNumIdx]);
    if (pokedexNumber == null) {
      skipped++;
      continue;
    }

    const preEvolutionPokemonId = parseIntOrNull(row[preEvoIdx]);
    if (preEvolutionPokemonId == null) {
      // Pas de pré-évolution : on met NULL en base pour ce pokedex_id
      const res = await queryResult(
        'UPDATE pokemons SET pre_evolution_pokedex_id = NULL WHERE pokedex_id = $1',
        [pokedexNumber]
      );
      if (res?.rowCount > 0) updated++;
      else if (res?.rowCount === 0) notFound++;
      continue;
    }

    const preEvolutionPokedexNumber = pokemonIdToPokedexNumber.get(preEvolutionPokemonId);
    if (preEvolutionPokedexNumber == null) {
      noMapping++;
      console.warn(`Avertissement: Pre-Evolution Pokemon Id ${preEvolutionPokemonId} sans Pokedex Number trouvé (ligne ${i + 1}, pokedex_id=${pokedexNumber}).`);
      continue;
    }

    const result = await queryResult(
      'UPDATE pokemons SET pre_evolution_pokedex_id = $1 WHERE pokedex_id = $2',
      [preEvolutionPokedexNumber, pokedexNumber]
    );
    const rowCount = result?.rowCount ?? 0;
    if (rowCount > 0) {
      updated++;
    } else {
      notFound++;
    }
  }

  return { updated, skipped, notFound, noMapping };
}

const isMain = process.argv[1]?.includes('fix-pre-evolution-pokedex-id');
if (isMain) {
  fixPreEvolutionPokedexId()
    .then(({ updated, skipped, notFound, noMapping }) => {
      console.log(`Terminé: ${updated} Pokémon mis à jour, ${skipped} lignes ignorées (forme alternative), ${notFound} non trouvés en base, ${noMapping} pré-évolutions sans mapping.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Erreur:', err);
      process.exit(1);
    });
}
