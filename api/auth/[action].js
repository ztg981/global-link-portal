// Sign-in for the portal. Accounts are the ones people create on globallink.com
// (same users table, same scrypt hashes, same JWTs), so there is no sign-up here.
//   POST /api/auth/login      { login: email-or-username, password, otp? }  -> { token, user }
//   GET  /api/auth/me                                                    -> { user }
//   PATCH /api/auth/me        { name?, lang?, timeZone? }                -> { user }
//   POST /api/auth/password   { current, next }                          -> { token, user }
//   GET  /api/auth/providers                                             -> { google, wechat, site }
import { cors, body, str, ipHash, fail } from '../_lib/http.js';
import { hashPassword, verifyPassword, signToken, normUsername } from '../_lib/auth.js';
import { sql, hit, count } from '../_lib/db.js';
import { session, adminUsername, checkAdminPassword, adminOtpRequired, checkTotp, signAdminToken, ADMIN_NAME, SITE, meUser } from '../_lib/session.js';

const pw = v => (typeof v === 'string' ? v : '');
const adminUser = () => ({ id: 'admin', role: 'admin', name: ADMIN_NAME(), username: adminUsername(), email: '', lang: 'en', timeZone: 'America/Los_Angeles' });

async function login(req, res) {
  const b = body(req) || {};
  const id = str(b.login ?? b.email ?? b.username, 200).toLowerCase(), password = pw(b.password), ip = ipHash(req);
  if (!id || !password) return fail(res, 400, 'Enter your email or username and your password.');
  if ((await count('loginfail', id, 900)) >= 8 || (await count('loginfail-ip', ip, 900)) >= 40)
    return fail(res, 429, 'Too many failed attempts. Please wait 15 minutes or reset your password on globallink.com.');
  const failed = async () => { await hit('loginfail', id, 900); await hit('loginfail-ip', ip, 900); return fail(res, 401, 'Email/username or password is incorrect.'); };

  // The admin account is configured on the server, not in the users table.
  if (id === adminUsername()) {
    if (!(await checkAdminPassword(password))) return failed();
    if (adminOtpRequired()) {
      if (!b.otp) return res.status(200).json({ needOtp: true });
      if (!checkTotp(b.otp)) return failed();
    }
    await sql`INSERT INTO portal_audit (actor, action, icon) VALUES (${ADMIN_NAME()}, 'Signed in to the admin console', 'log-in')`;
    return res.status(200).json({ token: signAdminToken(), user: adminUser() });
  }

  const [user] = id.includes('@') ? await sql`SELECT * FROM users WHERE email = ${id}` : await sql`SELECT * FROM users WHERE username = ${normUsername(id)}`;
  // Same error (and same hashing work) for an unknown account and a wrong password.
  const ok = user ? await verifyPassword(password, user.password_hash) : (await hashPassword(password), false);
  if (!ok) return failed();
  if (user.status === 'suspended') return fail(res, 403, 'This account is paused. Contact support@globallink.com.');
  if (user.role === 'parent') return fail(res, 403, 'Parent accounts use globallink.com for now. The portal is for students and mentors.');
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
  return res.status(200).json({ token: signToken(user), user: meUser(user) });
}

async function me(req, res) {
  const s = await session(req);
  if (!s) return fail(res, 401, 'Not signed in');
  if (s.kind === 'admin') return res.status(200).json({ user: adminUser() });
  if (req.method === 'PATCH') {
    if (s.readOnly) return fail(res, 403, 'Read-only view');
    const b = body(req) || {};
    const name = b.name != null ? str(b.name, 120).replace(/\s+/g, ' ') : null;
    if (b.name != null && !name) return fail(res, 400, 'Name cannot be empty.');
    const lang = b.lang == null ? null : b.lang === 'zh' ? 'zh' : 'en';
    const tz = b.timeZone != null ? str(b.timeZone, 60) : null;
    const [u] = await sql`UPDATE users SET name = COALESCE(${name}, name), lang = COALESCE(${lang}, lang), time_zone = COALESCE(${tz}, time_zone), updated_at = now() WHERE id = ${s.user.id} RETURNING *`;
    return res.status(200).json({ user: meUser(u) });
  }
  return res.status(200).json({ user: meUser(s.user), readOnly: s.readOnly });
}

async function password(req, res) {
  const s = await session(req);
  if (!s || s.kind !== 'member' || s.readOnly) return fail(res, 401, 'Not signed in');
  if ((await hit('pwchange', s.user.id, 3600)) > 10) return fail(res, 429, 'Too many attempts. Please try again later.');
  const b = body(req) || {};
  if (!(await verifyPassword(pw(b.current), s.user.password_hash))) return fail(res, 401, 'Current password is incorrect.');
  const next = pw(b.next);
  if (next.length < 8 || next.length > 200) return fail(res, 400, 'Password must be at least 8 characters.');
  const [u] = await sql`UPDATE users SET password_hash = ${await hashPassword(next)}, token_version = token_version + 1, updated_at = now() WHERE id = ${s.user.id} RETURNING *`;
  return res.status(200).json({ token: signToken(u), user: meUser(u) });
}

async function providers(req, res) {
  return res.status(200).json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    wechat: !!process.env.WECHAT_APP_ID,
    site: SITE(),
  });
}

const ROUTES = { login: ['POST', login], me: ['GET', me], password: ['POST', password], providers: ['GET', providers] };

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('cache-control', 'no-store');
  const r = ROUTES[req.query.action];
  if (!r) return fail(res, 404, 'Not found');
  if (req.method !== r[0] && !(req.query.action === 'me' && req.method === 'PATCH')) return fail(res, 405, 'Method not allowed');
  try { return await r[1](req, res); } catch (e) {
    console.error('[auth]', req.query.action, e.message);
    return fail(res, 500, 'Something went wrong. Please try again.');
  }
}
