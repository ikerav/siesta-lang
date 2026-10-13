#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { run } from './dist/language.js';
const file = process.argv[2];
if (!file) { console.error('Uso: node cli.js programa.zzz'); process.exitCode = 1; }
else {
  try {
    const r = run(await readFile(file, 'utf8'));
    for (const line of r.output) console.log(line);
    if (r.error) { console.error(`${r.error.phase} · ${file}:${r.error.line}:${r.error.column}: ${r.error.message}`); process.exitCode = 1; }
  } catch (e) { console.error(`No pude leer el archivo: ${e.message}`); process.exitCode = 1; }
}
