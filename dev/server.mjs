// Local dev server: serves the portal and runs the api/ functions like Vercel.
//   npm run dev            -> http://localhost:3124
// Reads .env.local if present. Without DATABASE_URL the API uses an in-process
// Postgres (PGlite); set PGLITE_DIR=.pglite to keep data between restarts.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const envFile = join(ROOT, '.env.local');
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const PORT = Number(process.env.PORT || 3124);
process.env.AUTH_SECRET ||= randomBytes(32).toString('hex');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const HEADERS = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8')).headers || [];
function applyHeaders(res, path) {
  for (const h of HEADERS) {
    const re = new RegExp('^' + h.source.split('(.*)').join('.*') + '$');
    if (!re.test(path)) continue;
    for (const { key, value } of h.headers) if (key !== 'Strict-Transport-Security') res.setHeader(key, value);
  }
}
// Static files Vercel would not serve (mirrors .vercelignore).
const PRIVATE = /^\/(api\/_lib|dev|db|test|scripts|desktop|design|node_modules|_zip)(\/|$)|\/\./;

async function findApi(path) {
  const rel = path.replace(/^\/api\//, '').replace(/\/$/, '');
  const direct = join(ROOT, 'api', rel + '.js');
  if (await stat(direct).catch(() => null)) return { file: direct, query: {} };
  const parts = rel.split('/'), last = parts.pop(), dir = join(ROOT, 'api', ...parts);
  const f = join(dir, '[action].js');
  if (await stat(f).catch(() => null)) return { file: f, query: { action: last } };
  return null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  applyHeaders(res, url.pathname);
  try {
    if (url.pathname.startsWith('/api/_') || PRIVATE.test(url.pathname)) { res.writeHead(404).end(); return; }
    if (url.pathname.startsWith('/api/')) {
      const hit = await findApi(url.pathname);
      if (!hit) { res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"Not found"}'); return; }
      const chunks = []; for await (const c of req) chunks.push(Buffer.from(c));
      const buf = Buffer.concat(chunks), json = /json/.test(req.headers['content-type'] || '') || /^[[{]/.test(buf.slice(0, 1).toString());
      // Like Vercel: JSON is parsed, anything else (file uploads) stays a Buffer.
      req.body = !buf.length ? undefined : json ? (() => { try { return JSON.parse(buf.toString()); } catch { return buf.toString(); } })() : buf;
      req.query = { ...Object.fromEntries(url.searchParams), ...hit.query };
      res.status = c => { res.statusCode = c; return res; };
      res.json = j => { if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(j)); return res; };
      const mod = await import(pathToFileURL(hit.file).href);
      await mod.default(req, res);
      return;
    }
    const p = normalize(join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!p.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
    const data = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(data);
  } catch (e) {
    if (!res.headersSent) res.writeHead(e.code === 'ENOENT' ? 404 : 500).end(e.code === 'ENOENT' ? 'Not found' : String(e));
  }
}).listen(PORT, () => console.log(`Global Link portal dev server on http://localhost:${PORT}`));
