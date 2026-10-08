// Admin console API. Requires an admin token (POST /api/auth/login with the
// ADMIN_USERNAME account). Every change is written to portal_audit.
import { cors, body, str, int, fail } from '../_lib/http.js';
import { sql, getConfig, setConfig, audit } from '../_lib/db.js';
import { session, signViewAsToken, SITE } from '../_lib/session.js';
import { matOut, cleanMaterial, DEFAULT_FLAGS } from '../portal/[action].js';
import { createHash, randomBytes } from 'node:crypto';
import { CA, BJ, parts } from '../_lib/time.js';

const ms = d => (d ? new Date(d).getTime() : null);
const isUuid = v => /^[0-9a-f-]{36}$/i.test(String(v || ''));
const ROLE_OUT = { student: 'Student', tutor: 'Mentor', parent: 'Parent' };
const ROLE_IN = { Student: 'student', Mentor: 'tutor', Parent: 'parent' };
export const DEFAULT_PKGS = [
  { id: 'p1', name: 'Free intro lesson', price: '0', on: true },
  { id: 'p2', name: 'Conversation 5-pack', price: '1250', on: true },
  { id: 'p3', name: 'Conversation 10-pack', price: '2300', on: true },
  { id: 'p4', name: 'IELTS Speaking 12-pack', price: '3480', on: true },
  { id: 'p5', name: 'Pronunciation add-on', price: '480', on: true },
  { id: 'p6', name: 'SAT Math 10-pack', price: '2900', on: false },
];

// How well a mentor fits a request: subject words they teach, overlap between
// the student's Beijing-time grid and the mentor's California-time grid, and load.
function fit(req, tutor) {
  const subj = String(req.subject || '').toLowerCase();
  const teaches = String(tutor.teaches || '').toLowerCase();
  const words = subj.split(/[^a-z]+/).filter(w => w.length > 2);
  const subjScore = !teaches ? 0.4 : words.some(w => teaches.includes(w)) ? 1 : 0.15;
  const sg = req.grid || {}, tg = tutor.avail || {};
  const off = (() => { const n = Date.now(); const b = parts(n, BJ), c = parts(n, CA); return ((Date.UTC(b.y, b.mo - 1, b.d, b.h) - Date.UTC(c.y, c.mo - 1, c.d, c.h)) / 3600000); })();
  let want = 0, both = 0;
  for (const k of Object.keys(sg)) {
    if (!sg[k]) continue; want++;
    const [d, h] = k.split('-').map(Number); let h2 = h - off, d2 = d; while (h2 < 0) { h2 += 24; d2--; } d2 = (d2 + 7) % 7;
    if (tg[d2 + '-' + h2]) both++;
  }
  const timeScore = want ? both / want : Object.keys(tg).length ? 0.5 : 0.1;
  const loadScore = 1 - Math.min(1, (tutor.students || 0) / 8);
  const score = Math.round(100 * (0.5 * subjScore + 0.35 * timeScore + 0.15 * loadScore));
  const why = [subjScore === 1 ? 'Teaches ' + (words.find(w => teaches.includes(w)) || 'this') : !teaches ? 'Hasn’t listed subjects yet' : 'Different subjects',
    want ? (both ? both + ' of ' + want + ' hours overlap' : 'No overlapping hours') : (Object.keys(tg).length ? Object.keys(tg).length + ' open hours a week' : 'No hours set yet')].join(' · ');
  return { score, why };
}

async function data(req, res) {
  const users = await sql`SELECT u.id, u.name, u.email, u.username, u.role, u.status, u.time_zone, u.created_at, u.last_login_at, p.credits, p.admin_note, p.last_seen_at, p.state->>'city' AS city,
      (SELECT count(*)::int FROM portal_matches m WHERE m.tutor_id = u.id AND m.status = 'active') AS students
    FROM users u LEFT JOIN portal_profiles p ON p.user_id = u.id ORDER BY u.created_at DESC LIMIT 1000`;
  const tutors = await sql`SELECT u.id, u.name, p.state->>'teaches' AS teaches, p.state->'avail' AS avail,
      (SELECT count(*)::int FROM portal_matches m WHERE m.tutor_id = u.id AND m.status = 'active') AS students
    FROM users u LEFT JOIN portal_profiles p ON p.user_id = u.id WHERE u.role = 'tutor' AND u.status = 'active'`;
  const reqs = await sql`SELECT s.id, s.data, s.status, s.created_at, u.id AS uid, u.name, p.state->'sGrid' AS grid, p.state->>'grade' AS grade, p.state->>'city' AS city, p.state->>'goal' AS goal
    FROM submissions s JOIN users u ON u.id = s.user_id LEFT JOIN portal_profiles p ON p.user_id = u.id
    WHERE s.type = 'mentor_request' AND s.status IN ('new', 'reviewing') ORDER BY s.created_at ASC LIMIT 200`;
  const lessons = await sql`SELECT l.*, s.name AS student_name, t.name AS tutor_name FROM portal_lessons l JOIN users s ON s.id = l.student_id LEFT JOIN users t ON t.id = l.tutor_id
    WHERE l.start_at > now() - interval '1 day' AND l.start_at < now() + interval '14 days' ORDER BY l.start_at LIMIT 300`;
  const mats = await sql`SELECT m.*, o.name AS owner_name FROM portal_materials m LEFT JOIN users o ON o.id = m.owner_id WHERE m.owner_id IS NULL OR m.status IN ('In review', 'Published', 'Changes requested') ORDER BY m.updated_at DESC LIMIT 500`;
  const reports = await sql`SELECT r.post_id, min(r.reason) AS reason, count(*)::int AS n, p.title, p.body, p.group_id, a.name AS author FROM portal_reports r JOIN portal_posts p ON p.id = r.post_id LEFT JOIN users a ON a.id = p.author_id
    WHERE r.status = 'open' GROUP BY r.post_id, p.title, p.body, p.group_id, a.name ORDER BY max(r.created_at) DESC LIMIT 100`;
  const auditRows = await sql`SELECT * FROM portal_audit ORDER BY created_at DESC LIMIT 200`;
  const signups = await sql`SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Asia/Shanghai'), 'YYYY-MM-DD') AS d, count(*)::int AS n FROM users WHERE created_at > now() - interval '7 days' GROUP BY 1`;
  const support = await sql`SELECT s.id, s.data, s.created_at, s.user_id FROM submissions s WHERE s.type = 'support_message' AND s.status = 'new' ORDER BY s.created_at DESC LIMIT 50`;
  const [flags, maint, announce, annHist, modRules, pkgs] = await Promise.all([getConfig('flags', DEFAULT_FLAGS), getConfig('maint', false), getConfig('announce', null), getConfig('annHist', []), getConfig('modRules', { auto: true, first: false, links: true }), getConfig('pkgs', DEFAULT_PKGS)]);

  return res.status(200).json({
    users: users.map(u => ({ id: u.id, name: u.name, email: u.email, username: u.username, role: ROLE_OUT[u.role] || 'Student', status: u.status === 'suspended' ? 'Suspended' : 'Active', loc: u.city || u.time_zone || '', credits: u.role === 'student' ? (u.credits || 0) : null,
      plan: u.role === 'tutor' ? (u.students + ' student' + (u.students === 1 ? '' : 's')) : u.role === 'parent' ? 'Parent account' : 'No plan yet', note: u.admin_note || '', joined: ms(u.created_at), lastSeen: ms(u.last_seen_at || u.last_login_at) })),
    queue: reqs.map(r => ({ id: String(r.id), studentId: r.uid, name: r.name, sub: [r.grade, r.city].filter(Boolean).join(' · ') || 'Student', subj: r.data?.subject || r.data?.mentorName || 'A mentor', note: r.data?.note || '', goal: r.goal || r.data?.note || '', via: r.data?.via === 'portal' ? 'portal' : 'website', mentorName: r.data?.mentorName || '', status: r.status, at: ms(r.created_at),
      sugg: tutors.map(t => ({ id: t.id, name: t.name, ...fit({ subject: r.data?.subject || '', grid: r.grid }, t) })).sort((a, b) => b.score - a.score).slice(0, 3) })),
    lessons: lessons.map(l => ({ id: String(l.id), start: ms(l.start_at), dur: l.dur_min, student: l.student_name, tutor: l.tutor_name || '—', cls: l.cls, status: l.status })),
    materials: mats.map(matOut),
    reports: reports.map(r => ({ id: String(r.post_id), reason: r.reason, reports: r.n, where: 'Post in ' + r.group_id, author: r.author || 'Unknown', text: (r.title + ' — ' + r.body).slice(0, 300) })),
    audit: auditRows.map(a => ({ t: a.action, icon: a.icon, by: a.actor, at: ms(a.created_at) })),
    signups: Object.fromEntries(signups.map(s => [s.d, s.n])),
    support: support.map(s => ({ id: String(s.id), userId: s.user_id, name: s.data?.name, text: s.data?.text, at: ms(s.created_at) })),
    config: { flags: { ...DEFAULT_FLAGS, ...flags }, maint: !!maint, announce, annHist, modRules, pkgs },
    now: Date.now(),
  });
}

async function user(req, res, s) {
  const b = body(req) || {};
  if (!isUuid(b.id)) return fail(res, 400, 'Pick a user.');
  const [u] = await sql`SELECT * FROM users WHERE id = ${b.id}`;
  if (!u) return fail(res, 404, 'User not found.');
  await sql`INSERT INTO portal_profiles (user_id) VALUES (${u.id}) ON CONFLICT DO NOTHING`;
  if (b.op === 'status') {
    const sus = b.value === 'Suspended';
    // Suspending bumps token_version, which signs the person out of the website and the portal.
    await sql`UPDATE users SET status = ${sus ? 'suspended' : 'active'}, token_version = token_version + ${sus ? 1 : 0}, updated_at = now() WHERE id = ${u.id}`;
    await audit(s.name, (sus ? 'Suspended ' : 'Restored ') + u.name, sus ? 'ban' : 'rotate-ccw');
  } else if (b.op === 'role') {
    const role = ROLE_IN[b.value];
    if (!role) return fail(res, 400, 'Admins are configured on the server, not by role.');
    await sql`UPDATE users SET role = ${role}, updated_at = now() WHERE id = ${u.id}`;
    await audit(s.name, 'Changed ' + u.name + ' to ' + b.value, 'user-cog');
  } else if (b.op === 'credits') {
    const d = int(b.value, -50, 50, 0);
    await sql`UPDATE portal_profiles SET credits = GREATEST(0, credits + ${d}) WHERE user_id = ${u.id}`;
    await audit(s.name, (d > 0 ? 'Gave ' + u.name + ' ' + d : 'Removed ' + -d + ' from ' + u.name) + ' lesson credit' + (Math.abs(d) === 1 ? '' : 's'), d > 0 ? 'plus' : 'minus');
  } else if (b.op === 'note') {
    await sql`UPDATE portal_profiles SET admin_note = ${str(b.value, 2000)} WHERE user_id = ${u.id}`;
  } else return fail(res, 400, 'Unknown change.');
  return res.status(200).json({ ok: true });
}

async function viewAs(req, res, s) {
  const b = body(req) || {};
  const [u] = await sql`SELECT * FROM users WHERE id = ${isUuid(b.id) ? b.id : null}`;
  if (!u) return fail(res, 404, 'User not found.');
  if (u.role === 'parent') return fail(res, 400, 'Parents don’t have a portal view yet.');
  await audit(s.name, 'Viewed the portal as ' + u.name + ' (read-only)', 'eye');
  return res.status(200).json({ token: signViewAsToken(u) });
}

// A one-hour reset link the admin can send the person (the website's /#/reset page).
async function reset(req, res, s) {
  const b = body(req) || {};
  const [u] = await sql`SELECT * FROM users WHERE id = ${isUuid(b.id) ? b.id : null}`;
  if (!u) return fail(res, 404, 'User not found.');
  const token = randomBytes(32).toString('base64url');
  await sql`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (${createHash('sha256').update(token).digest('hex')}, ${u.id}, ${new Date(Date.now() + 3600000).toISOString()})`;
  await audit(s.name, 'Made a password reset link for ' + u.name, 'key-round');
  return res.status(200).json({ link: SITE() + '/#/reset/' + token });
}

async function match(req, res, s) {
  const b = body(req) || {};
  const [r] = await sql`SELECT s.*, u.name FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ${int(b.requestId, 0, 9e15, 0)} AND s.type = 'mentor_request'`;
  const [t] = await sql`SELECT id, name FROM users WHERE id = ${isUuid(b.tutorId) ? b.tutorId : null} AND role = 'tutor'`;
  if (!r || !t) return fail(res, 404, 'Request or mentor not found.');
  const subject = r.data?.subject || r.data?.mentorName || '';
  await sql`INSERT INTO portal_matches (student_id, tutor_id, subject, status, request_id) VALUES (${r.user_id}, ${t.id}, ${subject}, 'proposed', ${r.id})
    ON CONFLICT (student_id, tutor_id) DO UPDATE SET status = CASE WHEN portal_matches.status = 'active' THEN 'active' ELSE 'proposed' END, subject = EXCLUDED.subject, request_id = EXCLUDED.request_id, updated_at = now()`;
  await sql`UPDATE submissions SET status = 'reviewing' WHERE id = ${r.id}`;
  await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (NULL, ${t.id}, ${`${r.name} would like lessons in ${subject || 'English'}. Accept or decline in Students.`})`;
  await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (NULL, ${r.user_id}, ${`We suggested ${t.name} as your mentor. We’ll let you know as soon as they say yes.`})`;
  await audit(s.name, 'Matched ' + r.name + ' with ' + t.name, 'git-merge');
  return res.status(200).json({ ok: true });
}
async function declineRequest(req, res, s) {
  const b = body(req) || {};
  const [r] = await sql`UPDATE submissions SET status = 'declined' WHERE id = ${int(b.requestId, 0, 9e15, 0)} AND type = 'mentor_request' RETURNING user_id, data`;
  if (!r) return fail(res, 404, 'Request not found.');
  const [u] = await sql`SELECT name FROM users WHERE id = ${r.user_id}`;
  await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (NULL, ${r.user_id}, 'We couldn’t find a mentor for that request yet. We’ll keep looking and email you.')`;
  await audit(s.name, 'Told ' + (u?.name || 'a student') + ' we can’t match yet', 'x');
  return res.status(200).json({ ok: true });
}

async function lesson(req, res, s) {
  const b = body(req) || {};
  const [l] = await sql`SELECT l.*, s.name AS sn, t.name AS tn FROM portal_lessons l JOIN users s ON s.id = l.student_id LEFT JOIN users t ON t.id = l.tutor_id WHERE l.id = ${int(b.id, 0, 9e15, 0)}`;
  if (!l) return fail(res, 404, 'Lesson not found.');
  await sql`UPDATE portal_lessons SET status = 'cancelled' WHERE id = ${l.id}`;
  if (b.op === 'credit' || b.op === 'cancel') await sql`UPDATE portal_profiles SET credits = credits + 1 WHERE user_id = ${l.student_id}`;
  for (const id of [l.student_id, l.tutor_id].filter(Boolean)) await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (NULL, ${id}, ${'The Global Link team cancelled the lesson between ' + (l.tn || 'your mentor') + ' and ' + l.sn + '. The lesson credit was returned.'})`;
  await audit(s.name, (b.op === 'credit' ? 'Returned ' + l.sn + '’s credit after a no-show' : 'Cancelled ' + (l.tn || '') + ' and ' + l.sn + '’s lesson and returned the credit'), b.op === 'credit' ? 'rotate-ccw' : 'calendar-x');
  return res.status(200).json({ ok: true });
}

// Admin-made materials (owner NULL) and review of mentor submissions.
const ADMIN_STATUSES = ['Draft', 'Published', 'Archived'];
async function material(req, res, s) {
  const b = body(req) || {};
  if (b.op === 'review') {
    const status = b.approve ? 'Published' : 'Changes requested';
    const m = b.blocks ? cleanMaterial(b) : null;
    const [r] = m
      ? await sql`UPDATE portal_materials SET status = ${status}, title = ${m.title || 'Untitled'}, type = ${m.type}, pack = ${m.pack}, level = ${m.level}, blocks = ${JSON.stringify(m.blocks)}::jsonb, updated_at = now() WHERE id = ${int(b.id, 0, 9e15, 0)} AND owner_id IS NOT NULL RETURNING title, owner_id`
      : await sql`UPDATE portal_materials SET status = ${status}, updated_at = now() WHERE id = ${int(b.id, 0, 9e15, 0)} AND owner_id IS NOT NULL RETURNING title, owner_id`;
    if (!r) return fail(res, 404, 'Material not found.');
    await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (NULL, ${r.owner_id}, ${b.approve ? `“${r.title}” is approved. Every mentor can use it now.` : `The team asked for a few changes on “${r.title}”. Open it in Materials.`})`;
    await audit(s.name, (b.approve ? 'Approved “' : 'Asked for changes on “') + r.title + '”', b.approve ? 'badge-check' : 'message-square-warning');
    return res.status(200).json({ ok: true });
  }
  if (b.op === 'status') {
    const status = ['Published', 'Archived', 'Draft', 'Private'].includes(b.status) ? b.status : 'Draft';
    const [r] = await sql`UPDATE portal_materials SET status = ${status}, updated_at = now() WHERE id = ${int(b.id, 0, 9e15, 0)} RETURNING title`;
    if (!r) return fail(res, 404, 'Material not found.');
    await audit(s.name, status + ': “' + r.title + '”', 'archive');
    return res.status(200).json({ ok: true });
  }
  const m = cleanMaterial(b);
  if (!m.title) return fail(res, 400, 'Give the material a title.');
  const status = ADMIN_STATUSES.includes(b.status) ? b.status : 'Draft';
  const blocks = JSON.stringify(m.blocks);
  let id;
  if (/^\d+$/.test(String(b.id || ''))) {
    const [r] = await sql`UPDATE portal_materials SET title = ${m.title}, type = ${m.type}, pack = ${m.pack}, level = ${m.level}, blocks = ${blocks}::jsonb, status = ${status}, updated_at = now() WHERE id = ${b.id} AND owner_id IS NULL RETURNING id`;
    if (!r) return fail(res, 404, 'Material not found.');
    id = r.id;
  } else {
    const [r] = await sql`INSERT INTO portal_materials (owner_id, title, type, pack, level, blocks, status) VALUES (NULL, ${m.title}, ${m.type}, ${m.pack}, ${m.level}, ${blocks}::jsonb, ${status}) RETURNING id`;
    id = r.id;
  }
  if (status === 'Published') await audit(s.name, 'Published “' + m.title + '” to the mentor library', 'globe');
  return res.status(200).json({ id: String(id), status });
}

async function moderate(req, res, s) {
  const b = body(req) || {}, id = int(b.id, 0, 9e15, 0);
  const [p] = await sql`SELECT p.*, a.name AS author FROM portal_posts p LEFT JOIN users a ON a.id = p.author_id WHERE p.id = ${id}`;
  if (!p) return fail(res, 404, 'Post not found.');
  if (b.op === 'remove') await sql`UPDATE portal_posts SET hidden = true WHERE id = ${id}`;
  if (b.op === 'keep') await sql`UPDATE portal_posts SET hidden = false WHERE id = ${id}`;
  if (b.op === 'warn' && p.author_id) await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (NULL, ${p.author_id}, ${'A note from the Global Link team: your post “' + p.title.slice(0, 80) + '” was reported. Please keep the community kind and on-topic.'})`;
  await sql`UPDATE portal_reports SET status = 'closed' WHERE post_id = ${id}`;
  await audit(s.name, { remove: 'Removed', keep: 'Kept', warn: 'Warned the author of' }[b.op] + ' a reported post by ' + (p.author || 'a member'), { remove: 'trash-2', keep: 'check', warn: 'triangle-alert' }[b.op] || 'shield');
  return res.status(200).json({ ok: true });
}

const CONFIG_KEYS = ['flags', 'maint', 'announce', 'annHist', 'modRules', 'pkgs', 'reloadAt'];
async function config(req, res, s) {
  const b = body(req) || {};
  if (!CONFIG_KEYS.includes(b.key)) return fail(res, 400, 'Unknown setting.');
  const v = JSON.parse(JSON.stringify(b.value ?? null));
  if (JSON.stringify(v).length > 20000) return fail(res, 413, 'Too large.');
  await setConfig(b.key, v);
  if (b.audit) await audit(s.name, str(b.audit, 200), str(b.icon, 40) || 'sliders-horizontal');
  return res.status(200).json({ ok: true });
}

async function message(req, res, s) {
  const b = body(req) || {};
  const text = str(b.text, 4000);
  const [u] = await sql`SELECT id, name FROM users WHERE id = ${isUuid(b.to) ? b.to : null}`;
  if (!u || !text) return fail(res, 400, 'Pick a person and write a message.');
  await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (NULL, ${u.id}, ${text})`;
  await sql`UPDATE submissions SET status = 'answered' WHERE type = 'support_message' AND user_id = ${u.id} AND status = 'new'`;
  await audit(s.name, 'Messaged ' + u.name + ' as the Global Link team', 'message-circle');
  return res.status(200).json({ ok: true });
}
async function thread(req, res) {
  const id = String(req.query.id || '');
  if (!isUuid(id)) return fail(res, 400, 'Pick a person.');
  const rows = await sql`SELECT body, sender_id, created_at FROM portal_messages WHERE (sender_id = ${id} AND recipient_id IS NULL) OR (sender_id IS NULL AND recipient_id = ${id}) ORDER BY created_at DESC LIMIT 50`;
  return res.status(200).json({ msgs: rows.reverse().map(r => ({ me: !r.sender_id, t: r.body, at: ms(r.created_at) })) });
}

const ROUTES = {
  data: ['GET', data], thread: ['GET', thread],
  user: ['POST', user], 'view-as': ['POST', viewAs], reset: ['POST', reset], match: ['POST', match], 'decline-request': ['POST', declineRequest],
  lesson: ['POST', lesson], material: ['POST', material], moderate: ['POST', moderate], config: ['POST', config], message: ['POST', message],
};

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('cache-control', 'no-store');
  const r = ROUTES[req.query.action];
  if (!r) return fail(res, 404, 'Not found');
  if (req.method !== r[0]) return fail(res, 405, 'Method not allowed');
  try {
    const s = await session(req);
    if (!s || s.kind !== 'admin') return fail(res, 401, 'Admin sign-in required.');
    return await r[1](req, res, s);
  } catch (e) {
    console.error('[admin]', req.query.action, e.message);
    return fail(res, 500, 'Something went wrong. Please try again.');
  }
}
