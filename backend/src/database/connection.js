import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;
const dbType = 'postgresql';

/**
 * Initialise la connexion à la base de données PostgreSQL
 */
export async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
  }
  
  // Si déjà initialisé, retourner l'instance existante
  if (db) {
    return db;
  }
  
  const { Pool } = pg;
  
  // Parser DATABASE_URL pour vérifier qu'il est valide
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      throw new Error('DATABASE_URL must use postgresql:// or postgres:// protocol');
    }
  } catch (error) {
    if (error.code !== 'ERR_INVALID_URL') {
      throw error;
    }
    // Si ce n'est pas une erreur d'URL, c'est peut-être un format différent, continuer
  }
  
  // SSL requis pour Supabase et autres BDD cloud (tolérant : .env avec espace ou valeur "true")
  const useSsl = String(process.env.DATABASE_SSL || '').trim().toLowerCase() === 'true' ||
    (process.env.DATABASE_URL || '').includes('supabase.com');
  const sslOption = useSsl ? { rejectUnauthorized: false } : false;

  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslOption,
    // Configuration du pool (timeout plus long pour BDD distante type Supabase)
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // 10s pour connexions cloud
  });
  
  // Tester la connexion
  try {
    const client = await db.connect();
    client.release();
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Afficher des informations de débogage (sans le mot de passe)
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const url = new URL(dbUrl);
        console.error('Database host:', url.hostname);
        console.error('Database port:', url.port || '5432');
        console.error('Database name:', url.pathname.substring(1));
        console.error('Database user:', url.username);
        // Ne pas afficher le mot de passe pour la sécurité
      } catch (e) {
        console.error('Could not parse DATABASE_URL');
      }
    }
    
    throw error;
  }
  
  // Gérer les erreurs de connexion
  db.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err);
  });
  
  return db;
}

/**
 * Obtient l'instance de la base de données
 * @returns {Pool}
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Convertit les placeholders SQLite (?) en placeholders PostgreSQL ($1, $2, ...)
 * @param {string} sqlQuery 
 * @returns {string}
 */
function convertPlaceholders(sqlQuery) {
  let paramIndex = 1;
  return sqlQuery.replace(/\?/g, () => `$${paramIndex++}`);
}

/**
 * Exécute une requête SQL PostgreSQL
 * @param {string} sqlQuery - Peut utiliser ? ou $1, $2, ... (les ? seront convertis automatiquement)
 * @param {Array} params 
 * @returns {Promise<Array>}
 */
export async function query(sqlQuery, params = []) {
  const database = getDatabase();
  // Convertir les placeholders ? en $1, $2, ... si nécessaire
  const convertedQuery = sqlQuery.includes('?') ? convertPlaceholders(sqlQuery) : sqlQuery;
  const result = await database.query(convertedQuery, params);
  return result.rows;
}

/**
 * Exécute une requête et retourne une seule ligne
 * @param {string} sqlQuery - Peut utiliser ? ou $1, $2, ... (les ? seront convertis automatiquement)
 * @param {Array} params 
 * @returns {Promise<Object|null>}
 */
export async function queryOne(sqlQuery, params = []) {
  const database = getDatabase();
  // Convertir les placeholders ? en $1, $2, ... si nécessaire
  const convertedQuery = sqlQuery.includes('?') ? convertPlaceholders(sqlQuery) : sqlQuery;
  const result = await database.query(convertedQuery, params);
  return result.rows[0] || null;
}

/**
 * Exécute une requête et retourne le résultat complet (pour les INSERT/UPDATE/DELETE avec RETURNING)
 * @param {string} sqlQuery - Peut utiliser ? ou $1, $2, ... (les ? seront convertis automatiquement)
 * @param {Array} params 
 * @returns {Promise<Object>}
 */
export async function queryResult(sqlQuery, params = []) {
  const database = getDatabase();
  // Convertir les placeholders ? en $1, $2, ... si nécessaire
  const convertedQuery = sqlQuery.includes('?') ? convertPlaceholders(sqlQuery) : sqlQuery;
  return await database.query(convertedQuery, params);
}

/**
 * Exécute une migration SQL
 * @param {string} sql 
 */
export async function runMigration(sql) {
  const database = getDatabase();
  // PostgreSQL gère les transactions automatiquement
  // Exécuter chaque statement séparément
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  
  for (const statement of statements) {
    try {
      await database.query(statement);
    } catch (error) {
      // Ignorer les erreurs de "table already exists" etc.
      if (!error.message.includes('already exists') && 
          !error.message.includes('duplicate') &&
          !error.message.includes('does not exist')) {
        console.warn('Migration warning:', error.message);
        console.warn('Statement:', statement.substring(0, 100));
      }
    }
  }
}

/**
 * Charge et exécute le schéma initial
 */
export async function initializeSchema() {
  try {
    // Utiliser le schéma PostgreSQL
    const schemaPath = join(__dirname, 'schema-postgresql.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    await runMigration(schema);
  } catch (error) {
    console.error('❌ Error initializing schema:', error);
    throw error;
  }
}
