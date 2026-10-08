// Shared helpers for the serverless API routes.
import { createHash } from 'node:crypto';

const allowed = () => (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Same-origin requests need no CORS. Extra origins (e.g. the future Electron
// app or a second website) are whitelisted via ALLOWED_ORIGINS.
export function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowed().includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'origin');
    res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type,authorization');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

// Vercel sets x-vercel-forwarded-for / x-real-ip itself (clients can't spoof them); x-forwarded-for is a fallback for local dev.
export const clientIp = req => String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
export const ipHash = req => createHash('sha256').update(clientIp(req) + (process.env.IP_SALT || 'gl')).digest('hex').slice(0, 16);

// Best-effort per-instance rate limit (serverless instances are short-lived).
const hits = new Map();
export function rateLimited(req, limit, windowMs = 60_000, bucket = '') {
  const k = bucket + clientIp(req), now = Date.now();
  const arr = (hits.get(k) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > limit;
}

export function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b && typeof b === 'object' ? b : null;
}

export const str = (v, max = 500) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim().slice(0, max);
export const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export const fail = (res, code, error, extra) => res.status(code).json({ error, ...extra });
// Parses a JSON body field as a bounded integer.
export const int = (v, min, max, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };
