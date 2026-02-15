import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const client = await pool.connect();
  client.release();
  await pool.end();
  process.exit(0);
} catch (err) {
  await pool.end().catch(() => {});
  process.exit(1);
}
