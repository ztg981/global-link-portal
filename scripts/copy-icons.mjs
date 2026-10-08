// Copies every Lucide icon the app can reference into vendor/lucide/ (self-hosted).
//   npm run icons   (after npm install)
import { readFileSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs';
const SRC = 'node_modules/lucide-static/icons/', OUT = 'vendor/lucide/';
const have = new Set(readdirSync(SRC).map(f => f.replace(/\.svg$/, '')));
const text = ['index.html', 'live.js', 'shell.js'].map(f => readFileSync(f, 'utf8')).join('\n');
mkdirSync(OUT, { recursive: true });
let n = 0;
for (const t of new Set(text.match(/[a-z][a-z0-9-]*[a-z0-9]/g))) if (have.has(t)) { copyFileSync(SRC + t + '.svg', OUT + t + '.svg'); n++; }
console.log(n + ' icons in ' + OUT);
