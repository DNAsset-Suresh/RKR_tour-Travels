import './env.js';
import pg from 'pg';
export const pool = new pg.Pool({
  host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'rkr_tour', user: process.env.PGUSER,
  password: process.env.PGPASSWORD, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 10, connectionTimeoutMillis: 4000, idleTimeoutMillis: 30000, statement_timeout: 10000
});
pool.on('error', () => console.error('Database pool connection interrupted.'));
