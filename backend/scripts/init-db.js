import { readFile } from 'node:fs/promises';
import { pool } from '../config/database.js';
try {
  for(const name of ['schema.sql','migrations/001_vehicle_video.sql','migrations/002_vehicle_tariffs.sql','migrations/003_journey_estimates.sql','seed.sql','seed-tariffs.sql']) await pool.query(await readFile(new URL(`../../database/${name}`,import.meta.url),'utf8'));
  console.log('Schema, vehicle catalogue and supplied tariffs initialized. Vehicle availability still requires confirmation.');
} finally { await pool.end(); }
