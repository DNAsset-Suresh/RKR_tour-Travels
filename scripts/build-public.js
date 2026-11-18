import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'frontend');
const destDir = path.join(root, 'public');

if (!fs.existsSync(srcDir)) {
  console.log('No frontend directory found, skipping public copy.');
  process.exit(0);
}

fs.rmSync(destDir, { recursive: true, force: true });
fs.cpSync(srcDir, destDir, {
  recursive: true,
  filter: (src) => !src.endsWith('dev-server.js')
});

console.log('Prepared public/ directory from frontend/ for Vercel CDN.');
