// Who is calling? Three kinds of bearer token, all HS256 JWTs signed with the
// AUTH_SECRET shared with globallink.com (see auth.js, a copy of the website's):
//
//   member   { sub: <users.id>, role, tv }           issued by either app
//   admin    { sub: 'admin', role: 'admin', av }     issued only by the portal
//   view-as  { sub: <users.id>, role, tv, imp, ro }  admin impersonation, read-only
//
// Admin credentials live in server env vars (ADMIN_USERNAME, ADMIN_PASSWORD_HASH,
// optional ADMIN_TOTP_SECRET for 2FA) - never in the client bundle.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authUser, verifyPassword, publicUser } from './auth.js';
import { findUserById } from './db.js';

export const SITE = () => (process.env.SITE_URL || 'https://global-link-club.vercel.app').replace(/\/$/, '');
export const meUser = u => ({ ...publicUser(u), status: u.status || 'active' });
export const ADMIN_NAME = () => process.env.ADMIN_DISPLAY_NAME || 'Jordan Reyes';
export const adminUsername = () => String(process.env.ADMIN_USERNAME || 'admin718').toLowerCase();
// Bumping ADMIN_TOKEN_VERSION signs every admin session out.
const adminVersion = () => Number(process.env.ADMIN_TOKEN_VERSION || 0);

// ADMIN_PASSWORD_HASH may hold several scrypt hashes, comma-separated (e.g. two accepted spellings).
export async function checkAdminPassword(pw) {
  const hashes = String(process.env.ADMIN_PASSWORD_HASH || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const h of hashes) if (await verifyPassword(pw, h)) return true;
  return false;
}
export const adminOtpRequired = () => !!process.env.ADMIN_TOTP_SECRET;

// RFC 6238 TOTP (30 s steps, 6 digits, SHA-1), +/- one step for clock drift.
function base32(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '', out = [];
  for (const c of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) bits += A.indexOf(c).toString(2).padStart(5, '0');
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
export function checkTotp(code) {
  const key = base32(process.env.ADMIN_TOTP_SECRET || '');
  const want = String(code || '').replace(/\s/g, '');
  if (!key.length || !/^\d{6}$/.test(want)) return false;
  const step = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) {
    const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step + d));
    const h = createHmac('sha1', key).update(msg).digest();
    const o = h[h.length - 1] & 15;
    const n = ((h.readUInt32BE(o) & 0x7fffffff) % 1e6).toString().padStart(6, '0');
    if (timingSafeEqual(Buffer.from(n), Buffer.from(want))) return true;
  }
  return false;
}

const b64url = b => Buffer.from(b).toString('base64url');
function sign(payload) {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET is not configured');
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${head}.${body}.${createHmac('sha256', s).update(`${head}.${body}`).digest('base64url')}`;
}
const now = () => Math.floor(Date.now() / 1000);

export function signAdminToken() {
  return sign({ sub: 'admin', role: 'admin', name: ADMIN_NAME(), av: adminVersion(), iss: 'global-link', aud: 'portal', iat: now(), exp: now() + 12 * 3600 });
}
export function signViewAsToken(user) {
  return sign({ sub: user.id, role: user.role, tv: user.token_version || 0, imp: 'admin', ro: true, iss: 'global-link', aud: 'portal', iat: now(), exp: now() + 30 * 60 });
}

// Returns { kind: 'admin' } | { kind: 'member', user, readOnly } | null.
export async function session(req) {
  const t = authUser(req);
  if (!t) return null;
  if (t.sub === 'admin') {
    if (t.role !== 'admin' || t.aud !== 'portal' || (t.av || 0) !== adminVersion()) return null;
    return { kind: 'admin', name: ADMIN_NAME() };
  }
  const u = await findUserById(t.sub);
  if (!u || (u.token_version || 0) !== (t.tv || 0)) return null;
  if (u.status === 'suspended') return null;
  return { kind: 'member', user: u, readOnly: !!t.ro };
}
