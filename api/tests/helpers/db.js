import pg from 'pg';

export function makePool() {
  const pool = new pg.Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'beauty_salon',
    password: process.env.DB_PASS || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
  });
  return pool;
}
