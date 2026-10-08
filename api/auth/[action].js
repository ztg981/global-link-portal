// Sign-in for the portal. Accounts are the ones people create on globallink.com
// (same users table, same scrypt hashes, same JWTs), so there is no sign-up here.
//   POST /api/auth/login      { login: email-or-username, password, otp? }  -> { token, user }
//   GET  /api/auth/me                                                    -> { user }
//   PATCH /api/auth/me        { name?, lang?, timeZone? }                -> { user }
//   POST /api/auth/password   { current, next }                          -> { token, user }
//   GET  /api/auth/providers                                             -> { google, wechat, site }
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
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

// ---- Google sign-in ----
// Same Google OAuth client as the website (one client, two redirect URIs). The
// browser goes to Google and back to /api/auth/google-callback, which matches
// the Google account to a Global Link account (by Google ID, else by verified
// email, which links it) and hands the page a one-time code (oauth_pending,
// shared with the website). The desktop app does this in the system browser
// (Google blocks sign-in inside embedded windows) and receives the code through
// a globallink:// link. New Google users finish sign-up on the website.
const googleOn = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const APP = () => (process.env.APP_URL || 'https://global-link-portal.vercel.app').replace(/\/$/, '');
const sha = t => createHash('sha256').update(t).digest('hex');
const cookie = (req, name) => (String(req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '=')) || '').slice(name.length + 1);
const back = (res, path) => { res.statusCode = 302; res.setHeader('location', APP() + path); res.end(); };

async function google(req, res) {
  if (!googleOn()) return back(res, '/#/oauth-error/not-configured');
  const state = randomBytes(24).toString('base64url') + (req.query.desktop === '1' ? '.d' : '');
  res.setHeader('set-cookie', `gl_app_oauth=${state}; Path=/api/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: APP() + '/api/auth/google-callback', response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
  res.statusCode = 302; res.setHeader('location', 'https://accounts.google.com/o/oauth2/v2/auth?' + q); res.end();
}

async function googleCallback(req, res) {
  const state = String(req.query.state || ''), saved = cookie(req, 'gl_app_oauth');
  res.setHeader('set-cookie', 'gl_app_oauth=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  if (!googleOn() || !state || !saved || state.length !== saved.length || !timingSafeEqual(Buffer.from(state), Buffer.from(saved)) || !req.query.code) return back(res, '/#/oauth-error/failed');
  const desktop = state.endsWith('.d');
  const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: String(req.query.code), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: APP() + '/api/auth/google-callback', grant_type: 'authorization_code' }) }).then(r => r.json());
  if (!tok.id_token) return back(res, '/#/oauth-error/failed');
  const info = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok.id_token)).then(r => r.json());
  if (info.aud !== process.env.GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(info.iss) || String(info.email_verified) !== 'true' || !info.sub) return back(res, '/#/oauth-error/failed');
  const email = String(info.email || '').toLowerCase();
  let [user] = await sql`SELECT * FROM users WHERE google_sub = ${info.sub}`;
  if (!user) {
    [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (user) await sql`UPDATE users SET google_sub = ${info.sub}, updated_at = now() WHERE id = ${user.id} AND google_sub IS NULL`;
  }
  if (!user) return back(res, '/#/oauth-error/no-account/' + encodeURIComponent(email));
  if (user.status === 'suspended') return back(res, '/#/oauth-error/suspended');
  const code = randomBytes(32).toString('base64url');
  await sql`INSERT INTO oauth_pending (code_hash, provider, subject, email, name, user_id, expires_at) VALUES (${sha(code)}, 'google', ${info.sub}, ${email}, ${String(info.name || '').slice(0, 120)}, ${user.id}, ${new Date(Date.now() + 5 * 60000).toISOString()})`;
  if (!desktop) return back(res, '/#/oauth/' + code);
  // Desktop: hand the code to the app via its globallink:// link.
  res.statusCode = 200; res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
  const link = 'globallink://oauth/' + code;
  return res.end(`<!doctype html><meta charset="utf-8"><title>Global Link</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0c1730;color:#e8f0ff;font:16px system-ui,sans-serif;text-align:center"><div><h1 style="font-size:24px">You’re signed in</h1><p style="color:#a9b9d6">Return to the Global Link app to continue.</p><p><a href="${link}" style="display:inline-block;margin-top:10px;padding:12px 22px;border-radius:12px;background:#2f8cf3;color:#fff;text-decoration:none;font-weight:700">Open Global Link</a></p><p style="color:#7d8fb0;font-size:13px">You can close this tab afterwards.</p></div><script>location.href=${JSON.stringify(link)}</script></body>`);
}

async function oauth(req, res) {
  const b = body(req) || {};
  const code = str(b.code, 200);
  if (!code) return fail(res, 400, 'Missing sign-in code.');
  const [p] = await sql`UPDATE oauth_pending SET used_at = now() WHERE code_hash = ${sha(code)} AND used_at IS NULL AND expires_at > now() RETURNING user_id`;
  if (!p || !p.user_id) return fail(res, 401, 'That sign-in link expired. Please try again.');
  const [user] = await sql`SELECT * FROM users WHERE id = ${p.user_id}`;
  if (!user || user.status === 'suspended') return fail(res, 403, 'This account is paused. Contact support@globallink.com.');
  if (user.role === 'parent') return fail(res, 403, 'Parent accounts use globallink.com for now. The portal is for students and mentors.');
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
  return res.status(200).json({ token: signToken(user), user: meUser(user) });
}

const ROUTES = { login: ['POST', login], me: ['GET', me], password: ['POST', password], providers: ['GET', providers],
  google: ['GET', google], 'google-callback': ['GET', googleCallback], oauth: ['POST', oauth] };

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
