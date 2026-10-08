// End-to-end API test against an in-process Postgres (PGlite).
// Runs the real handlers: website-style account -> portal sign-in -> mentor
// request -> admin match -> mentor accepts -> messages -> booking -> tasks ->
// questions -> materials -> community -> security checks.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.AUTH_SECRET = randomBytes(32).toString('hex');
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;

const { hashPassword } = await import('../api/_lib/auth.js');
process.env.ADMIN_USERNAME = 'admin718';
process.env.ADMIN_PASSWORD_HASH = await hashPassword('correct horse battery');
const { sql } = await import('../api/_lib/db.js');
const auth = (await import('../api/auth/[action].js')).default;
const portal = (await import('../api/portal/[action].js')).default;
const admin = (await import('../api/admin/[action].js')).default;

let ipn = 0;
function call(handler, action, { method = 'GET', token, body: b, query = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = { method, headers: { authorization: token ? 'Bearer ' + token : '', 'x-real-ip': '10.0.0.' + (++ipn % 200) }, body: b, query: { action, ...query }, socket: {} };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, getHeader(k) { return this.headers[k]; },
      status(c) { this.statusCode = c; return this; }, json(j) { resolve({ status: this.statusCode, body: j }); return this; }, end() { resolve({ status: this.statusCode, body: null }); } };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

// Accounts are created on the website; insert them the way it does.
async function websiteUser(username, name, role) {
  const [u] = await sql`INSERT INTO users (email, username, name, role, password_hash) VALUES (${username + '@example.org'}, ${username}, ${name}, ${role}, ${await hashPassword('password123')}) RETURNING *`;
  return u;
}

test('full portal flow', async () => {
  const stu = await websiteUser('ava_chen', 'Ava Chen', 'student');
  const tut = await websiteUser('sam_lee', 'Sam Lee', 'tutor');
  await websiteUser('mom_chen', 'Lin Chen', 'parent');

  // Sign in with username or email; wrong password is rejected.
  assert.equal((await call(auth, 'login', { method: 'POST', body: { login: 'ava_chen', password: 'nope-nope' } })).status, 401);
  const s1 = await call(auth, 'login', { method: 'POST', body: { login: 'ava_chen', password: 'password123' } });
  assert.equal(s1.status, 200); const S = s1.body.token;
  const T = (await call(auth, 'login', { method: 'POST', body: { login: 'sam_lee@example.org', password: 'password123' } })).body.token;
  assert.equal((await call(auth, 'login', { method: 'POST', body: { login: 'mom_chen', password: 'password123' } })).status, 403, 'parents use the website');
  const A = (await call(auth, 'login', { method: 'POST', body: { login: 'Admin718', password: 'correct horse battery' } })).body.token;
  assert.ok(A);
  assert.equal((await call(auth, 'login', { method: 'POST', body: { login: 'admin718', password: 'not-the-password' } })).status, 401, 'wrong admin password is rejected');

  // A brand-new student starts empty.
  let boot = (await call(portal, 'bootstrap', { token: S })).body;
  assert.equal(boot.me.name, 'Ava Chen');
  assert.deepEqual([boot.matches.length, boot.lessons.length, boot.tasks.length, boot.posts.length], [0, 0, 0, 0]);
  assert.deepEqual(boot.threads.map(t => t.id), ['team']);

  // Students can't use admin routes; tutors can't request mentors.
  assert.equal((await call(admin, 'data', { token: S })).status, 401);
  assert.equal((await call(portal, 'request', { method: 'POST', token: T, body: { subject: 'x' } })).status, 403);

  // Request -> admin match -> mentor accepts.
  await call(portal, 'state', { method: 'POST', token: T, body: { state: { teaches: 'English conversation, IELTS', avail: { '1-17': 1, '2-17': 1, '3-17': 1, '4-17': 1, '5-17': 1, '6-9': 1, '0-9': 1 }, evil: 'dropped' } } });
  const rq = await call(portal, 'request', { method: 'POST', token: S, body: { subject: 'English conversation', note: 'Host family prep' } });
  assert.equal(rq.status, 201);
  const ad = (await call(admin, 'data', { token: A })).body;
  assert.equal(ad.queue.length, 1);
  assert.equal(ad.queue[0].sugg[0].id, tut.id);
  assert.ok(ad.queue[0].sugg[0].score > 50);
  assert.equal((await call(admin, 'match', { method: 'POST', token: A, body: { requestId: ad.queue[0].id, tutorId: tut.id } })).status, 200);
  let tb = (await call(portal, 'bootstrap', { token: T })).body;
  assert.equal(tb.matches[0].status, 'proposed');
  assert.equal((await call(portal, 'message', { method: 'POST', token: S, body: { to: tut.id, text: 'hi' } })).status, 403, 'not matched yet');
  assert.equal((await call(portal, 'respond', { method: 'POST', token: T, body: { id: tb.matches[0].id, accept: true } })).status, 200);

  // Messages both ways, plus the team.
  assert.equal((await call(portal, 'message', { method: 'POST', token: S, body: { to: tut.id, text: 'Hi Sam!' } })).status, 201);
  assert.equal((await call(portal, 'message', { method: 'POST', token: S, body: { to: 'team', text: 'Question about plans' } })).status, 201);
  tb = (await call(portal, 'bootstrap', { token: T })).body;
  const th = tb.threads.find(t => t.id === stu.id);
  assert.equal(th.msgs.at(-1).t, 'Hi Sam!');
  assert.ok(th.msgs.at(-1).unread);
  assert.equal((await call(admin, 'data', { token: A })).body.support.length, 1);

  // Booking: only inside the mentor's hours, no double booking.
  boot = (await call(portal, 'bootstrap', { token: S })).body;
  assert.equal(boot.grids.length, 1);
  const { zoned, parts, CA } = await import('../api/_lib/time.js');
  const n = parts(Date.now() + 2 * 86400000, CA);
  const good = zoned(n.y, n.mo, n.d, n.dow === 0 || n.dow === 6 ? 9 : 17, 0, CA);
  const bad = zoned(n.y, n.mo, n.d, 3, 0, CA);
  assert.equal((await call(portal, 'book', { method: 'POST', token: S, body: { tutorId: tut.id, start: bad } })).status, 409);
  assert.equal((await call(portal, 'book', { method: 'POST', token: S, body: { tutorId: tut.id, start: good } })).status, 201);
  assert.equal((await call(portal, 'book', { method: 'POST', token: S, body: { tutorId: tut.id, start: good } })).status, 409);
  tb = (await call(portal, 'bootstrap', { token: T })).body;
  assert.equal(tb.lessons.length, 1);

  // Tasks, questions, materials.
  const tk = await call(portal, 'task', { method: 'POST', token: S, body: { op: 'create', title: 'Practice small talk', shareWith: [tut.id, '00000000-0000-0000-0000-000000000000'] } });
  assert.equal(tk.status, 201);
  assert.equal((await call(portal, 'task', { method: 'POST', token: S, body: { op: 'done', id: tk.body.id, done: true } })).status, 200);
  const q = await call(portal, 'ask', { method: 'POST', token: S, body: { to: tut.id, q: 'Is gonna okay in IELTS?', share: true } });
  assert.equal(q.status, 201);
  assert.equal((await call(portal, 'answer', { method: 'POST', token: T, body: { id: q.body.id, text: 'In speaking, yes - sparingly.' } })).status, 200);
  const mat = await call(portal, 'material', { method: 'POST', token: T, body: { title: 'Small talk starters', type: 'Lesson plan', blocks: [{ id: 'b1', k: 'h', text: 'Warm-up' }, { k: 'zzz' }] } });
  assert.equal(mat.status, 201);
  assert.equal((await call(portal, 'assign', { method: 'POST', token: T, body: { mats: [mat.body.id], to: [stu.id], due: 'Tomorrow', task: true } })).status, 201);
  boot = (await call(portal, 'bootstrap', { token: S })).body;
  assert.equal(boot.assignments[0].material.title, 'Small talk starters');
  assert.equal(boot.assignments[0].material.blocks.length, 1, 'unknown block kinds are dropped');
  assert.equal(boot.tasks.length, 2);
  assert.equal(boot.questions[0].answer, 'In speaking, yes - sparingly.');

  // Community + moderation rules.
  assert.equal((await call(portal, 'post', { method: 'POST', token: S, body: { title: 'Add me on wechat', body: 'vx: abc123' } })).status, 400);
  const p = await call(portal, 'post', { method: 'POST', token: S, body: { title: 'I ordered coffee in English!', body: 'Small win', type: 'Wins', group: 'g2' } });
  assert.equal(p.status, 201);
  await call(portal, 'like', { method: 'POST', token: T, body: { postId: p.body.id, on: true } });
  await call(portal, 'comment', { method: 'POST', token: T, body: { postId: p.body.id, text: 'Proud of you!' } });
  boot = (await call(portal, 'bootstrap', { token: S })).body;
  assert.equal(boot.posts[0].likes, 1);
  assert.equal(boot.posts[0].comments[0].mentor, true);

  // Admin view-as is read-only; suspend signs the person out everywhere.
  const va = (await call(admin, 'view-as', { method: 'POST', token: A, body: { id: stu.id } })).body.token;
  assert.equal((await call(portal, 'bootstrap', { token: va })).status, 200);
  assert.equal((await call(portal, 'message', { method: 'POST', token: va, body: { to: 'team', text: 'x' } })).status, 403);
  await call(admin, 'user', { method: 'POST', token: A, body: { id: stu.id, op: 'status', value: 'Suspended' } });
  assert.equal((await call(portal, 'bootstrap', { token: S })).status, 401);
  assert.equal((await call(auth, 'login', { method: 'POST', body: { login: 'ava_chen', password: 'password123' } })).status, 403);
  const audit = (await call(admin, 'data', { token: A })).body.audit.map(a => a.t);
  assert.ok(audit.some(t => t.startsWith('Suspended Ava Chen')));
  assert.ok(audit.some(t => t.startsWith('Matched Ava Chen with Sam Lee')));

  // Tampered tokens are rejected.
  const bad2 = S.slice(0, -2) + (S.endsWith('A') ? 'BB' : 'AA');
  assert.equal((await call(portal, 'bootstrap', { token: bad2 })).status, 401);
});
