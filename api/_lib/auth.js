// Accounts: password hashing (scrypt) and signed session tokens (JWT, HS256).
// Tokens are standard JWTs signed with AUTH_SECRET, so the future portal /
// Electron app can verify them with the same secret and any JWT library.
import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const TOKEN_DAYS = 30;
export const ROLES = ['student', 'parent', 'tutor'];

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(pw, stored) {
  const [alg, n, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scryptAsync(pw, Buffer.from(salt, 'base64'), want.length, { N: Number(n), r: 8, p: 1 });
  return timingSafeEqual(got, want);
}

const b64url = b => Buffer.from(b).toString('base64url');
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET is not configured');
  return s;
};

export function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ sub: user.id, email: user.email, username: user.username, name: user.name, role: user.role, tv: user.token_version || 0, iss: 'global-link', iat: now, exp: now + TOKEN_DAYS * 86400 }));
  const sig = createHmac('sha256', secret()).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token) {
  const [head, body, sig] = String(token || '').split('.');
  if (!head || !body || !sig) return null;
  const want = createHmac('sha256', secret()).update(`${head}.${body}`).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

// Returns the token payload for "Authorization: Bearer <token>", or null.
export function authUser(req) {
  const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
  return m ? verifyToken(m[1]) : null;
}

// Verifies the token AND that it hasn't been revoked (password change bumps
// token_version). Returns the user row, or null.
export async function requireUser(req, findUserById) {
  const t = authUser(req);
  if (!t) return null;
  const u = await findUserById(t.sub);
  if (!u || (u.token_version || 0) !== (t.tv || 0)) return null;
  return u;
}

// Usernames: 3–20 chars, lowercase letters, numbers, "_" or ".", starting with a letter or number.
const RESERVED = new Set(['admin', 'administrator', 'root', 'support', 'help', 'globallink', 'global_link', 'global.link', 'lumi', 'staff', 'team', 'system', 'mentor', 'tutor', 'student', 'parent', 'null', 'undefined']);
export const normUsername = v => String(v || '').trim().toLowerCase().replace(/^@/, '');
export function usernameError(u) {
  if (!/^[a-z0-9][a-z0-9_.]{2,19}$/.test(u)) return 'Username must be 3–20 characters: letters, numbers, "_" or ".".';
  if (RESERVED.has(u)) return 'That username is reserved. Please pick another.';
  return '';
}
// Names compared case-insensitively with collapsed spaces.
export const normName = v => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();

// The public shape of a user row (never includes the password hash).
export const publicUser = u => u && ({
  id: u.id, email: u.email, username: u.username || '', name: u.name, role: u.role,
  lang: u.lang || 'en', timeZone: u.time_zone || '', createdAt: u.created_at,
});
