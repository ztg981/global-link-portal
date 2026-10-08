// Credits, payments, events, Google sign-in codes, push subscriptions, the
// scheduler and uploads, against the real handlers and an in-process Postgres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';

process.env.AUTH_SECRET = randomBytes(32).toString('hex');
process.env.CRON_SECRET = randomBytes(16).toString('hex');
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL; delete process.env.PGLITE_DIR;
delete process.env.STRIPE_SECRET_KEY; delete process.env.BLOB_READ_WRITE_TOKEN;
const { hashPassword } = await import('../api/_lib/auth.js');
process.env.ADMIN_PASSWORD_HASH = await hashPassword('admin-pass-123');
const { sql } = await import('../api/_lib/db.js');
const auth = (await import('../api/auth/[action].js')).default;
const portal = (await import('../api/portal/[action].js')).default;
const admin = (await import('../api/admin/[action].js')).default;
const cron = (await import('../api/cron.js')).default;
const { zoned, parts, CA } = await import('../api/_lib/time.js');

let ipn = 0;
function call(handler, action, { method = 'GET', token, body: b, query = {}, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = { method, headers: { authorization: token ? 'Bearer ' + token : '', 'x-real-ip': '10.2.0.' + (++ipn % 200), ...headers }, body: b, query: { action, ...query }, socket: {} };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k]; },
      status(c) { this.statusCode = c; return this; }, json(j) { resolve({ status: this.statusCode, body: j }); return this; }, end(x) { resolve({ status: this.statusCode, body: x, headers: this.headers }); } };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}
async function account(username, name, role) {
  const [u] = await sql`INSERT INTO users (email, username, name, role, password_hash) VALUES (${username + '@example.org'}, ${username}, ${name}, ${role}, ${await hashPassword('password123')}) RETURNING *`;
  return { u, token: (await call(auth, 'login', { method: 'POST', body: { login: username, password: 'password123' } })).body.token };
}
const slot = (daysAhead, hour) => { const n = parts(Date.now() + daysAhead * 86400000, CA); return zoned(n.y, n.mo, n.d, hour, 0, CA); };

test('credits, payments, events, sign-in codes, push and scheduled jobs', async () => {
  const { u: stu, token: S } = await account('cred_student', 'Mei Wu', 'student');
  const { u: tut, token: T } = await account('cred_mentor', 'Ray Kim', 'tutor');
  const A = (await call(auth, 'login', { method: 'POST', body: { login: 'admin718', password: 'admin-pass-123' } })).body.token;
  const allHours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].flatMap(d => Array.from({ length: 24 }, (_, h) => [d + '-' + h, 1])));
  await call(portal, 'state', { method: 'POST', token: T, body: { state: { avail: allHours } } });
  await sql`INSERT INTO portal_matches (student_id, tutor_id, subject, status) VALUES (${stu.id}, ${tut.id}, 'English conversation', 'active')`;

  // A new student gets one free intro credit, once.
  let b = (await call(portal, 'bootstrap', { token: S })).body;
  assert.equal(b.me.credits, 1);
  assert.ok(b.pkgs.length >= 4 && b.pkgs.every(p => p.on && p.credits > 0));
  b = (await call(portal, 'bootstrap', { token: S })).body;
  assert.equal(b.me.credits, 1, 'intro credit is granted only once');

  // Booking spends a credit; with none left the API says to buy more.
  assert.equal((await call(portal, 'book', { method: 'POST', token: S, body: { tutorId: tut.id, start: slot(3, 10) } })).status, 201);
  const none = await call(portal, 'book', { method: 'POST', token: S, body: { tutorId: tut.id, start: slot(4, 10) } });
  assert.equal(none.status, 402); assert.equal(none.body.needCredits, true);
  // Cancelling more than 24 hours ahead returns it.
  const les = (await call(portal, 'bootstrap', { token: S })).body.lessons[0];
  await call(portal, 'lesson', { method: 'POST', token: S, body: { id: les.id, op: 'cancel' } });
  assert.equal((await call(portal, 'bootstrap', { token: S })).body.me.credits, 1);

  // WeChat payment request -> admin confirms -> credits and packs.
  const pk = b.pkgs.find(p => p.id === 'p2');
  const req1 = await call(portal, 'buy', { method: 'POST', token: S, body: { packId: 'p2' } });
  assert.equal(req1.status, 201);
  assert.equal((await call(portal, 'buy', { method: 'POST', token: S, body: { packId: 'p2', method: 'stripe' } })).status, 503, 'no Stripe key -> told to pay on WeChat');
  let ad = (await call(admin, 'data', { token: A })).body;
  assert.equal(ad.payments[0].status, 'pending');
  assert.equal((await call(admin, 'payment', { method: 'POST', token: A, body: { op: 'confirm', id: req1.body.id } })).status, 200);
  assert.equal((await call(admin, 'payment', { method: 'POST', token: A, body: { op: 'confirm', id: req1.body.id } })).status, 200);
  b = (await call(portal, 'bootstrap', { token: S })).body;
  assert.equal(b.me.credits, 1 + pk.credits, 'confirming twice adds credits once');
  assert.ok(b.me.packs.includes('conv'));
  // Admin records a payment made outside the app, then refunds it.
  const rec = await call(admin, 'payment', { method: 'POST', token: A, body: { op: 'record', userId: stu.id, packId: 'p5', amount: 480, method: 'wechat' } });
  assert.equal(rec.status, 201);
  assert.equal((await call(portal, 'bootstrap', { token: S })).body.me.credits, 1 + pk.credits + 5);
  await call(admin, 'payment', { method: 'POST', token: A, body: { op: 'refund', id: rec.body.id } });
  assert.equal((await call(portal, 'bootstrap', { token: S })).body.me.credits, 1 + pk.credits);
  const ledger = await sql`SELECT sum(delta)::int AS s FROM portal_credit_events WHERE user_id = ${stu.id}`;
  assert.equal(ledger[0].s, 1 + pk.credits, 'ledger matches the balance');

  // Events: mentor hosts, student RSVPs, admin posts one too.
  const ev = await call(portal, 'event', { method: 'POST', token: T, body: { title: 'Halloween Q&A', kind: 'Live Q&A', start: Date.now() + 3 * 86400000, link: 'https://meet.example.org/x' } });
  assert.equal(ev.status, 201);
  assert.equal((await call(portal, 'event', { method: 'POST', token: S, body: { title: 'Nope nope', start: Date.now() + 86400000 } })).status, 403);
  assert.equal((await call(portal, 'event', { method: 'POST', token: T, body: { title: 'Bad link', start: Date.now() + 86400000, link: 'javascript:alert(1)' } })).status, 400);
  await call(admin, 'event', { method: 'POST', token: A, body: { title: 'College essay workshop', kind: 'Workshop', start: Date.now() + 5 * 86400000 } });
  await call(portal, 'rsvp', { method: 'POST', token: S, body: { id: ev.body.id, on: true } });
  b = (await call(portal, 'bootstrap', { token: S })).body;
  assert.equal(b.events.length, 2);
  assert.deepEqual([b.events[0].going, b.events[0].mine, b.events[1].host], [1, true, 'Global Link Team']);

  // Google sign-in: a one-time code signs in once.
  const code = randomBytes(24).toString('base64url');
  await sql`INSERT INTO oauth_pending (code_hash, provider, subject, email, user_id, expires_at) VALUES (${createHash('sha256').update(code).digest('hex')}, 'google', 'g123', ${stu.email}, ${stu.id}, ${new Date(Date.now() + 60000).toISOString()})`;
  const g = await call(auth, 'oauth', { method: 'POST', body: { code } });
  assert.equal(g.status, 200); assert.equal(g.body.user.id, stu.id);
  assert.equal((await call(auth, 'oauth', { method: 'POST', body: { code } })).status, 401, 'codes are single-use');
  const gs = await call(auth, 'google', {});
  assert.match(gs.headers.location, /oauth-error\/not-configured/);

  // Push subscriptions; uploads need Blob configured; attachments must be ours.
  assert.equal((await call(portal, 'push-subscribe', { method: 'POST', token: S, body: { endpoint: 'https://push.example.org/abc', keys: { p256dh: 'k', auth: 'a' } } })).status, 200);
  assert.equal((await sql`SELECT count(*)::int AS n FROM portal_push`)[0].n, 1);
  assert.equal((await call(portal, 'upload', { method: 'POST', token: S, body: Buffer.from('x'), query: { type: 'audio/webm' } })).status, 503);
  await call(portal, 'message', { method: 'POST', token: S, body: { to: tut.id, text: 'see file', file: { url: 'https://evil.example.org/x.exe', name: 'x' } } });
  const msg = (await call(portal, 'bootstrap', { token: T })).body.threads.find(t => t.id === stu.id).msgs.at(-1);
  assert.equal(msg.file, null, 'files from other sites are dropped');

  // Scheduler: needs the secret; marks finished lessons done and expires old questions.
  assert.equal((await call(cron, undefined, {})).status, 401);
  await sql`INSERT INTO portal_lessons (student_id, tutor_id, start_at, credit_used) VALUES (${stu.id}, ${tut.id}, ${new Date(Date.now() - 3 * 3600000).toISOString()}, true)`;
  await sql`INSERT INTO portal_questions (student_id, tutor_id, body, created_at) VALUES (${stu.id}, ${tut.id}, 'old question', now() - interval '4 days')`;
  const c = await call(cron, undefined, { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } });
  assert.equal(c.status, 200); assert.equal(c.body.done, 1); assert.equal(c.body.expired, 1);
  ad = (await call(admin, 'data', { token: A })).body;
  assert.equal(ad.payouts[0].lessons, 1);
  assert.equal((await call(admin, 'payout', { method: 'POST', token: A, body: { tutorId: tut.id, month: ad.payouts[0].month } })).status, 200);
  assert.equal((await call(admin, 'data', { token: A })).body.payouts[0].paid, true);
});
