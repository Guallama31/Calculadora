/* Verifica sintaxis de todos los archivos JS del proyecto. */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const dirs = ['src', 'tools', 'data'];
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|mjs)$/.test(entry.name)) files.push(p);
  }
}
dirs.forEach(walk);
let bad = 0;
for (const file of files) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (e) { bad++; console.error('✖', file, String(e.stderr || e).slice(0, 300)); }
}
console.log(`${files.length - bad}/${files.length} archivos JS con sintaxis correcta`);
process.exit(bad ? 1 : 0);
