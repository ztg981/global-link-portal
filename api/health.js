// GET /api/health - which services are configured (never shows secrets).
import { buildChain } from './_lib/llm.js';
import { sql } from './_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  let database = false;
  try { await sql`SELECT 1`; database = true; } catch { database = false; }
  const chain = buildChain('lite').map(l => l.provider + ':' + l.model);
  return res.status(200).json({
    ok: database && !!process.env.AUTH_SECRET,
    database,
    auth: !!(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32),
    admin: !!process.env.ADMIN_PASSWORD_HASH,
    admin2fa: !!process.env.ADMIN_TOTP_SECRET,
    lumi: { links: chain.length, chain: [...new Set(chain)] },
    version: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'dev',
  });
}
