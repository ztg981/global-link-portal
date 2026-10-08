// Renders every screen of the built app (index.html) in Node, for:
//   demo student / mentor / admin (the design's sample accounts),
//   brand-new real student / mentor / admin (empty data),
//   real accounts with data (made through the real API handlers).
// Catches crashes in renderVals() for any page, tab, modal or lesson-room phase.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomBytes } from 'node:crypto';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('>', html.indexOf('data-dc-script')) + 1;
const SRC = html.slice(start, html.lastIndexOf('</script>'));
const LIVE_JS = readFileSync(new URL('../live.js', import.meta.url), 'utf8');

function makeApp() {
  const noop = () => {};
  const store = new Map();
  const ctx = {
    console, Intl, Date, Math, JSON, Promise, Array, Object, String, Number, Boolean, Set, Map, RegExp, Error, encodeURIComponent, parseInt, parseFloat, isNaN,
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { platform: 'Win32', userAgent: 'node' }, location: { href: 'http://localhost/', reload: noop },
    document: { querySelector: () => null, querySelectorAll: () => [], visibilityState: 'visible', createElement: () => ({ click: noop, remove: noop }), body: { appendChild: noop } },
    fetch: () => Promise.reject(new Error('offline in tests')), speechSynthesis: { cancel: noop, speak: noop },
    React: {}, addEventListener: noop, removeEventListener: noop,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(LIVE_JS, ctx);
  class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(u) { const p = typeof u === 'function' ? u(this.state) : u; if (p) this.state = { ...this.state, ...p }; } forceUpdate() {} }
  ctx.DCLogic = DCLogic;
  const Component = vm.runInContext('(function(DCLogic,StreamableLogic,React){' + SRC + '\n;return Component;})', ctx)(DCLogic, DCLogic, {});
  const app = new Component({ startAs: 'signin', theme: 'light', platform: 'web' });
  app._init0 = { ...app.state };
  app.toast = noop;
  return { app, ctx };
}

const PAGES = {
  student: ['home', 'mentors', 'schedule', 'classes', 'tasks', 'materials', 'messages', 'ask', 'community', 'progress', 'practice', 'settings'],
  tutor: ['today', 'schedule', 'students', 'questions', 'library', 'messages', 'community', 'availability', 'settings'],
  admin: ['a_overview', 'a_people', 'a_matching', 'a_lessons', 'a_materials', 'a_payments', 'a_moderation', 'a_announce', 'a_system', 'a_audit', 'a_dev'],
};
const VARIANTS = [
  {}, { bookOpen: true }, { askOpen: true }, { reqOpen: true }, { postOpen: true }, { ntOpen: true }, { palette: true }, { notifOpen: true }, { meTop: true }, { clOpen: true },
  { prTab: 'sat' }, { prTab: 'act' }, { mTab: 'past' }, { comTab: 'events' }, { comTab: 'groups' }, { libTab: 'asg' }, { matTab: 'asg' }, { matTab: 'prog' }, { recapFull: true }, { tFilter: 'all' },
  { recapTab: 'transcript' }, { recapTab: 'words' }, { recapTab: 'tasks' }, { weekOff: 1 }, { weekOff: -1 }, { lumiOpen: true }, { asgOpen: true, libSel: {} }, { satStep: 0 }, { satStep: 2 }, { logOpen: true }, { skill: 0 },
  { buyOpen: true }, { evFormOpen: true }, { taskRec: 'rec' }, { taskRec: 'done' }, { recOn: true }, { recDone: true },
  ...['account', 'appearance', 'language', 'notifications', 'lessons', 'privacy', 'desktop', 'help'].map(settingsTab => ({ settingsTab })),
];

function renderAll(app, role, label) {
  const errors = [];
  const run = (what, patch) => {
    app.setState(patch);
    try { const V = app.renderVals(); assert.ok(V && typeof V === 'object'); } catch (e) { errors.push(`${label} ${what}: ${e.message}\n    ${String(e.stack).split('\n').slice(1, 3).join('\n    ')}`); }
  };
  for (const page of PAGES[role]) for (const v of VARIANTS) run(page + ' ' + JSON.stringify(v), { page, ...app._init0Variant, ...Object.fromEntries(Object.keys(VARIANTS.reduce((a, x) => ({ ...a, ...x }), {})).map(k => [k, app._base[k]])), ...v });
  // Welcome setup, tour and the lesson room.
  for (let w = 0; w < 7; w++) run('welcome ' + w, { stage: 'welcome', wStep: w });
  app.setState({ stage: 'app' });
  if (role !== 'admin') {
    for (let t = 0; t < 8; t++) run('tour ' + t, { tourStep: t, page: PAGES[role][0] });
    app.setState({ tourStep: null });
    const call = { phase: 'pre', mic: true, cam: true, panel: null, cc: true, hand: false, tray: false, secs: 0, pop: null, quizAns: null, wordSaved: false, chat: [], chatDraft: '', notes: '', share: false, reacts: [], studentHand: false, sentWord: false, quizT: null, unreadChat: false };
    for (const c of [{}, { phase: 'live', secs: 30 }, { phase: 'live', pop: 'word' }, { phase: 'live', pop: 'quiz' }, { phase: 'live', panel: 'chat' }, { phase: 'live', panel: 'words' }, { phase: 'live', panel: 'notes' }, { phase: 'end', secs: 2400 }])
      run('call ' + JSON.stringify(c), { call: { ...call, ...c } });
    app.setState({ call: null });
  }
  // One line per distinct failure (the same bug shows up on many screens).
  return [...new Map(errors.map(e => [e.split(': ').slice(1).join(': '), e])).values()];
}
function prep(app) { app._base = { ...app.state }; app._init0Variant = {}; }

test('demo accounts render every screen', () => {
  for (const role of ['student', 'tutor', 'admin']) {
    const { app } = makeApp();
    app.enterApp(role); app.setState({ stage: 'app', onboarded: true });
    prep(app);
    const errs = renderAll(app, role, 'demo ' + role);
    assert.deepEqual(errs, [], errs.join('\n'));
  }
});

// ---- real accounts through the real API ----
process.env.AUTH_SECRET = randomBytes(32).toString('hex');
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL; delete process.env.PGLITE_DIR;
const { hashPassword } = await import('../api/_lib/auth.js');
process.env.ADMIN_PASSWORD_HASH = await hashPassword('admin-pass-123');
const { sql } = await import('../api/_lib/db.js');
const portal = (await import('../api/portal/[action].js')).default;
const admin = (await import('../api/admin/[action].js')).default;
const auth = (await import('../api/auth/[action].js')).default;
let ipn = 0;
function call(handler, action, { method = 'GET', token, body: b } = {}) {
  return new Promise((resolve, reject) => {
    const req = { method, headers: { authorization: token ? 'Bearer ' + token : '', 'x-real-ip': '10.1.0.' + (++ipn % 200) }, body: b, query: { action }, socket: {} };
    const res = { statusCode: 200, setHeader() {}, getHeader() {}, status(c) { this.statusCode = c; return this; }, json(j) { resolve({ status: this.statusCode, body: j }); return this; }, end() { resolve({ status: this.statusCode }); } };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}
async function user(username, name, role) {
  await sql`INSERT INTO users (email, username, name, role, password_hash) VALUES (${username + '@example.org'}, ${username}, ${name}, ${role}, ${await hashPassword('password123')})`;
  return (await call(auth, 'login', { method: 'POST', body: { login: username, password: 'password123' } })).body;
}
function liveApp(B, role) {
  const { app } = makeApp();
  app.loadLive(B, true); app.enterApp(role); app.setState({ stage: 'app', onboarded: true });
  prep(app);
  return app;
}
function adminApp(A) {
  const { app } = makeApp();
  app.applyAdmin(A, true, { name: 'Jordan Reyes', role: 'admin' }); app.enterApp('admin');
  prep(app);
  return app;
}

test('brand-new real accounts render every screen, empty', async () => {
  const s = await user('new_student', 'Nora Li', 'student');
  const t = await user('new_mentor', 'Max Park', 'tutor');
  const A = (await call(auth, 'login', { method: 'POST', body: { login: 'admin718', password: 'admin-pass-123' } })).body.token;
  const SB = (await call(portal, 'bootstrap', { token: s.token })).body;
  const TB = (await call(portal, 'bootstrap', { token: t.token })).body;
  const AD = (await call(admin, 'data', { token: A })).body;
  const errs = [...renderAll(liveApp(SB, 'student'), 'student', 'new student'), ...renderAll(liveApp(TB, 'tutor'), 'tutor', 'new mentor'), ...renderAll(adminApp(AD), 'admin', 'admin (empty)')];
  assert.deepEqual(errs, [], errs.join('\n'));
  // Nothing from the sample accounts leaks into a new account.
  const app = liveApp(SB, 'student');
  for (const page of PAGES.student) {
    app.setState({ page });
    const V = app.renderVals(), str = v => JSON.stringify(v, (k, x) => (typeof x === 'function' ? undefined : x)) || '';
    for (const sample of ['Emma', 'Mia', 'Sarah', 'David', 'Huangshan', 'Golden Week', 'Chloe', 'Olivia']) {
      const keys = Object.keys(V).filter(k => str(V[k]).includes(sample));
      assert.deepEqual(keys, [], `${page} shows sample data (${sample}) in: ${keys.join(', ')}`);
    }
  }
});

test('real accounts with data render every screen', async () => {
  const s = await user('data_student', 'Ava Chen', 'student');
  const t = await user('data_mentor', 'Sam Lee', 'tutor');
  const A = (await call(auth, 'login', { method: 'POST', body: { login: 'admin718', password: 'admin-pass-123' } })).body.token;
  await call(portal, 'state', { method: 'POST', token: t.token, body: { state: { teaches: 'English conversation', avail: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].flatMap(d => [9, 17, 18].map(h => [d + '-' + h, 1]))) } } });
  await call(portal, 'request', { method: 'POST', token: s.token, body: { subject: 'English conversation', note: 'Interview prep' } });
  const q = (await call(admin, 'data', { token: A })).body.queue[0];
  await call(admin, 'match', { method: 'POST', token: A, body: { requestId: q.id, tutorId: t.user.id } });
  let TB = (await call(portal, 'bootstrap', { token: t.token })).body;
  await call(portal, 'respond', { method: 'POST', token: t.token, body: { id: TB.matches[0].id, accept: true } });
  await call(portal, 'request', { method: 'POST', token: s.token, body: { subject: 'SAT math' } });
  let SB = (await call(portal, 'bootstrap', { token: s.token })).body;
  const GLLive = makeApp().ctx.GLLive;
  const slots = GLLive.mapMember(SB, { TI: {}, PACKS: { free: ['Free'] }, GROUPS: [] }).BOOK_SLOTS;
  assert.ok(slots.length > 0, 'mentor hours become bookable slots');
  assert.equal((await call(portal, 'book', { method: 'POST', token: s.token, body: { tutorId: t.user.id, start: slots[0].start } })).status, 201);
  await call(portal, 'message', { method: 'POST', token: s.token, body: { to: t.user.id, text: 'Hi Sam!' } });
  await call(portal, 'message', { method: 'POST', token: t.token, body: { to: s.user.id, text: '你好 Ava!' } });
  await call(portal, 'task', { method: 'POST', token: s.token, body: { op: 'create', title: 'Practice small talk', shareWith: [t.user.id] } });
  const qq = await call(portal, 'ask', { method: 'POST', token: s.token, body: { to: t.user.id, q: 'Is gonna okay?', share: true } });
  await call(portal, 'ask', { method: 'POST', token: s.token, body: { to: t.user.id, q: 'What about wanna?', kind: 'video' } });
  await call(portal, 'answer', { method: 'POST', token: t.token, body: { id: qq.body.id, text: 'Yes, in speaking.' } });
  const mat = await call(portal, 'material', { method: 'POST', token: t.token, body: { title: 'Small talk', type: 'Lesson plan', blocks: [{ k: 'h', text: 'Warm-up' }, { k: 'q', text: 'Pick one', opts: ['a', 'b', 'c'], ok: 1 }] } });
  await call(portal, 'material', { method: 'POST', token: t.token, body: { title: 'Review me', type: 'Word list', status: 'In review', blocks: [{ k: 'v', text: 'refill', zh: '续杯' }] } });
  await call(portal, 'assign', { method: 'POST', token: t.token, body: { mats: [mat.body.id], to: [s.user.id], due: 'Tomorrow', note: 'Before Monday', task: true } });
  await call(admin, 'material', { method: 'POST', token: A, body: { title: 'GL library item', type: 'Reading', status: 'Published', blocks: [{ k: 't', text: 'Read this' }] } });
  const p = await call(portal, 'post', { method: 'POST', token: s.token, body: { title: 'My first win!', body: 'Ordered coffee', type: 'Wins', group: 'g2' } });
  await call(portal, 'comment', { method: 'POST', token: t.token, body: { postId: p.body.id, text: 'Great job' } });
  await call(portal, 'report', { method: 'POST', token: t.token, body: { postId: p.body.id, reason: 'Test' } });
  await call(portal, 'state', { method: 'POST', token: s.token, body: { state: { joined: { g2: true }, savedWords: ['refill'], goal: 'Speak confidently', sat: { setup: true, date: 'Mar 13, 2027', has: true, goal: 1400, tests: [{ n: 'Practice 1', d: 'Oct 1', math: 600, rw: 560 }] } } } });
  // Payments, events, a voice-note task.
  assert.equal((await call(portal, 'buy', { method: 'POST', token: s.token, body: { packId: 'p2', method: 'wechat' } })).status, 201);
  const ev = await call(portal, 'event', { method: 'POST', token: t.token, body: { title: 'Halloween Q&A', start: Date.now() + 3 * 864e5, dur: 45, link: 'https://example.org/meet' } });
  assert.equal(ev.status, 201);
  await call(portal, 'rsvp', { method: 'POST', token: s.token, body: { id: ev.body.id, on: true } });
  assert.equal((await call(portal, 'task', { method: 'POST', token: t.token, body: { op: 'create', title: 'Describe your weekend', kind: 'Voice note', studentId: s.user.id } })).status, 201);
  SB = (await call(portal, 'bootstrap', { token: s.token })).body;
  TB = (await call(portal, 'bootstrap', { token: t.token })).body;
  const AD = (await call(admin, 'data', { token: A })).body;
  assert.equal(SB.lessons.length, 1); assert.equal(SB.assignments.length, 1); assert.ok(SB.posts.length >= 1);
  const errs = [...renderAll(liveApp(SB, 'student'), 'student', 'student with data'), ...renderAll(liveApp(TB, 'tutor'), 'tutor', 'mentor with data'), ...renderAll(adminApp(AD), 'admin', 'admin with data')];
  assert.deepEqual(errs, [], errs.join('\n'));
  // New screens show the real data.
  const st = liveApp(SB, 'student');
  st.setState({ page: 'materials', matOpen: SB.assignments[0].materialId });
  let V = st.renderVals();
  assert.ok(V.mv.has && V.mv.blocks.length > 0, 'material viewer shows the blocks');
  st.setState({ page: 'tasks', tFilter: 'all' }); V = st.renderVals();
  assert.ok(V.tasksShown.some(k => k.recIdle && typeof k.startRec === 'function'), 'voice-note task can be recorded');
  st.setState({ page: 'community', comTab: 'events', buyOpen: true }); V = st.renderVals();
  assert.equal(V.events.length, 1); assert.ok(V.events[0].hasLink);
  assert.ok(V.buy.packs.length >= 3 && V.buy.hasHistory, 'buy modal lists plans and the pending request');
  assert.match(V.buy.wechatText, /WeChat/);
  assert.equal(V.pr.nodes.length, 5);
  const ad = adminApp(AD); ad.setState({ page: 'a_payments' }); V = ad.renderVals();
  assert.equal(V.ap.pending.length, 1); assert.equal(V.aEvents.length, 1);
});
