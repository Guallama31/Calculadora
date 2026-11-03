/* Verifica sintaxis de JS/JSX sin depender de un build completo. */
import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['src', 'tools', 'data', 'tests'];
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (['.js', '.mjs', '.jsx'].includes(extname(entry.name))) files.push(path);
  }
}

let failures = 0;
for (const dir of DIRS) {
  try {
    await walk(join(ROOT, dir));
  } catch {
    /* carpeta opcional */
  }
}
for (const file of files) {
  try {
    if (extname(file) === '.jsx') {
      const source = await readFile(file, 'utf8');
      await transform(source, { loader: 'jsx', jsx: 'automatic', sourcefile: file });
    } else {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    }
  } catch (error) {
    failures++;
    console.error(`✖ ${file.replace(ROOT, '')}\n  ${error.message.split('\n')[0]}`);
  }
}
console.log(`${files.length - failures}/${files.length} archivos con sintaxis correcta`);
if (failures) process.exit(1);
