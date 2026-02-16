import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// SSL requis pour Supabase et BDD cloud (même logique que connection.js)
const useSsl = String(process.env.DATABASE_SSL || '').trim().toLowerCase() === 'true' ||
  url.includes('supabase.com');
const sslOption = useSsl ? { rejectUnauthorized: false } : false;

const pool = new pg.Pool({
  connectionString: url,
  ssl: sslOption,
  connectionTimeoutMillis: 10000,
});
try {
  const client = await pool.connect();
  client.release();
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error('Wait DB failed:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
}
