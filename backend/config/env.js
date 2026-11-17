import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const candidatePaths = [
  fileURLToPath(new URL('../.env', import.meta.url)),
  fileURLToPath(new URL('../.env.local', import.meta.url)),
  fileURLToPath(new URL('../../.env', import.meta.url)),
  fileURLToPath(new URL('../../.env.local', import.meta.url)),
];

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true, quiet: true });
  }
}
