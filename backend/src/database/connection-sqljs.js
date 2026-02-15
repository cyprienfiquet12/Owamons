// Alternative connection.js using sql.js (JavaScript pure, no compilation needed)
// This is a fallback if better-sqlite3 cannot be compiled on Windows

import initSqlJs from 'sql.js';
import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;
let dbType = null;
let SQL = null;

/**
 * Initialise la connexion à la base de données
 * SQLite pour le développement, PostgreSQL pour la production
 */
export async function initDatabase() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  if (nodeEnv === 'production' && process.env.DATABASE_URL) {
    // PostgreSQL pour la production
    dbType = 'postgresql';
    const { Pool } = pg;
    db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
  } else {
    // SQL.js pour le développement (JavaScript pur)
    dbType = 'sqlite';
    const dbPath = process.env.DB_PATH || join(__dirname, '../../../data/database.sqlite');
    
    // Créer le dossier data s'il n'existe pas
    try {
      mkdirSync(dirname(dbPath), { recursive: true });
    } catch (error) {
      // Dossier existe déjà
    }
    
    // Initialiser SQL.js
    SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`
    });
    
    // Charger ou créer la base de données
    if (existsSync(dbPath)) {
      const buffer = readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  }

  return db;
}

/**
 * Obtient l'instance de la base de données
 * @returns {Database|Pool}
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Sauvegarde la base SQLite (pour sql.js uniquement)
 */
function saveDatabase() {
  if (dbType === 'sqlite' && db) {
    const dbPath = process.env.DB_PATH || join(__dirname, '../../../data/database.sqlite');
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
}

/**
 * Exécute une requête SQL (compatible SQLite et PostgreSQL)
 * @param {string} sqlQuery 
 * @param {Array} params 
 * @returns {Promise|Array}
 */
export function query(sqlQuery, params = []) {
  const database = getDatabase();
  
  if (dbType === 'postgresql') {
    return database.query(sqlQuery, params);
  } else {
    // SQL.js
    try {
      const stmt = database.prepare(sqlQuery);
      if (sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
        const results = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          results.push(row);
        }
        stmt.free();
        saveDatabase();
        return results;
      } else {
        stmt.run(params);
        stmt.free();
        saveDatabase();
        return { changes: database.getRowsModified() };
      }
    } catch (error) {
      console.error('SQL.js query error:', error, 'Query:', sqlQuery);
      throw error;
    }
  }
}

/**
 * Exécute une requête et retourne une seule ligne
 * @param {string} sqlQuery 
 * @param {Array} params 
 * @returns {Promise|Object}
 */
export function queryOne(sqlQuery, params = []) {
  const database = getDatabase();
  
  if (dbType === 'postgresql') {
    return database.query(sqlQuery, params).then(result => result.rows[0] || null);
  } else {
    // SQL.js
    const results = query(sqlQuery, params);
    return results.length > 0 ? results[0] : null;
  }
}

/**
 * Exécute une migration SQL
 * @param {string} sql 
 */
export function runMigration(sql) {
  const database = getDatabase();
  
  if (dbType === 'postgresql') {
    return database.query(sql);
  } else {
    // SQL.js - exécuter chaque statement séparément
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    for (const statement of statements) {
      try {
        database.run(statement);
      } catch (error) {
        // Ignorer les erreurs de "table already exists" etc.
        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
          console.warn('Migration warning:', error.message);
        }
      }
    }
    saveDatabase();
  }
}

/**
 * Charge et exécute le schéma initial
 */
export function initializeSchema() {
  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    runMigration(schema);
  } catch (error) {
    console.error('❌ Error initializing schema:', error);
    throw error;
  }
}


