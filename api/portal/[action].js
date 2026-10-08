// Portal data API for signed-in students and mentors (Authorization: Bearer <token>).
// Every query is scoped to the caller; mentors only see students they are matched
// with, students only see their own data. View-as (admin impersonation) tokens are
// read-only. Full reference: API.md.
import { teamMsg } from '../_lib/team.js';
import { cors, body, str, int, fail, ipHash } from '../_lib/http.js';
import { sql, hit, getConfig, addCredits } from '../_lib/db.js';
import { notify, vapidPublicKey } from '../_lib/notify.js';
import { packages, payInfo, createCheckout, settleCheckout } from '../_lib/payments.js';
import { put } from '@vercel/blob';
import { randomBytes } from 'node:crypto';
import { session, meUser } from '../_lib/session.js';
import { complete } from '../_lib/llm.js';
import { inGrid } from '../_lib/time.js';

export const DEFAULT_FLAGS = { community: true, lumi: true, translate: true, ask: true, practice: true, signups: true };
export const GROUP_IDS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
const POST_TYPES = ['Discussion', 'Q&A', 'Wins'];
const ms = d => (d ? new Date(d).getTime() : null);
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const isUuid = v => /^[0-9a-f-]{36}$/i.test(String(v || ''));
// Keys a client may store in its own portal state (preferences, onboarding, practice).
const STATE_KEYS = ['themeMode', 'lang', 'zoom', 'toggles', 'hourMode', 'capLang', 'onboarded', 'setup', 'timePrefs', 'sGrid', 'avail', 'savedWords', 'sat', 'satAns', 'joined', 'savedP', 'pinned', 'notifPrefs', 'startup', 'goal', 'interests', 'grade', 'city', 'teaches', 'why', 'clHidden', 'rsvp', 'notifReadAt', 'prepNotes'];

async function profile(userId) {
  const [p] = await sql`INSERT INTO portal_profiles (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now() RETURNING *`;
  return p;
}

// Active (or proposed) mentor <-> student pairs for a user.
async function matchesFor(u) {
  return u.role === 'tutor'
    ? sql`SELECT m.*, s.name AS other_name, s.username AS other_username, s.created_at AS other_joined, p.state AS other_state FROM portal_matches m
        JOIN users s ON s.id = m.student_id LEFT JOIN portal_profiles p ON p.user_id = s.id
        WHERE m.tutor_id = ${u.id} AND m.status IN ('proposed', 'active') ORDER BY m.created_at`
    : sql`SELECT m.*, t.name AS other_name, t.username AS other_username, t.created_at AS other_joined, p.state AS other_state FROM portal_matches m
        JOIN users t ON t.id = m.tutor_id LEFT JOIN portal_profiles p ON p.user_id = t.id
        WHERE m.student_id = ${u.id} AND m.status IN ('proposed', 'active', 'ended') ORDER BY m.created_at`;
}
async function partnerIds(u) {
  const rows = await matchesFor(u);
  return rows.filter(r => r.status === 'active').map(r => (u.role === 'tutor' ? r.student_id : r.tutor_id));
}

async function threadsFor(u, partners) {
  const rows = await sql`SELECT m.*, su.name AS sender_name FROM portal_messages m LEFT JOIN users su ON su.id = m.sender_id
    WHERE m.sender_id = ${u.id} OR m.recipient_id = ${u.id} ORDER BY m.created_at ASC LIMIT 2000`;
  const byOther = new Map();
  for (const r of rows) {
    const mine = r.sender_id === u.id;
    const other = mine ? (r.recipient_id || 'team') : (r.sender_id || 'team');
    if (!byOther.has(other)) byOther.set(other, []);
    byOther.get(other).push({ id: String(r.id), me: mine, t: r.body, at: ms(r.created_at), mats: r.mats || null, file: r.file || null, unread: !mine && !r.read_at, seen: mine && !!r.read_at });
  }
  const ids = [...new Set([...partners, ...[...byOther.keys()].filter(k => k !== 'team')])];
  const people = ids.length ? await sql`SELECT id, name, role FROM users WHERE id = ANY(${ids}::uuid[])` : [];
  const threads = people.map(p => ({ id: p.id, name: p.name, role: p.role, partner: partners.includes(p.id), msgs: byOther.get(p.id) || [] }));
  threads.push({ id: 'team', name: 'Global Link Team', role: 'team', partner: true, msgs: byOther.get('team') || [] });
  return threads;
}

async function bootstrap(req, res, s) {
  const u = s.user;
  let prof = await profile(u.id);
  // Every new student gets one free intro lesson credit, once.
  if (u.role === 'student' && !prof.intro_granted && !s.readOnly) {
    const [g] = await sql`UPDATE portal_profiles SET intro_granted = true WHERE user_id = ${u.id} AND NOT intro_granted RETURNING user_id`;
    if (g) { await addCredits(u.id, 1, 'Free intro lesson', 'intro'); prof = await profile(u.id); }
  }
  const [flags, maint, announce, reloadAt] = await Promise.all([getConfig('flags', DEFAULT_FLAGS), getConfig('maint', false), getConfig('announce', null), getConfig('reloadAt', 0)]);
  const matches = await matchesFor(u);
  const partners = matches.filter(m => m.status === 'active').map(m => (u.role === 'tutor' ? m.student_id : m.tutor_id));
  const tutor = u.role === 'tutor';

  const lessons = tutor
    ? await sql`SELECT l.*, s.name AS other_name FROM portal_lessons l JOIN users s ON s.id = l.student_id WHERE l.tutor_id = ${u.id} AND l.start_at > now() - interval '60 days' ORDER BY l.start_at`
    : await sql`SELECT l.*, t.name AS other_name FROM portal_lessons l LEFT JOIN users t ON t.id = l.tutor_id WHERE l.student_id = ${u.id} AND l.start_at > now() - interval '60 days' ORDER BY l.start_at`;

  const tasks = tutor
    ? await sql`SELECT t.*, s.name AS student_name FROM portal_tasks t JOIN users s ON s.id = t.student_id WHERE t.tutor_id = ${u.id} OR t.shared_with ? ${u.id} ORDER BY t.created_at DESC LIMIT 300`
    : await sql`SELECT t.*, m.name AS tutor_name FROM portal_tasks t LEFT JOIN users m ON m.id = t.tutor_id WHERE t.student_id = ${u.id} ORDER BY t.created_at DESC LIMIT 300`;

  const questions = tutor
    ? await sql`SELECT q.*, s.name AS other_name FROM portal_questions q JOIN users s ON s.id = q.student_id WHERE q.tutor_id = ${u.id} ORDER BY q.created_at DESC LIMIT 200`
    : await sql`SELECT q.*, t.name AS other_name FROM portal_questions q JOIN users t ON t.id = q.tutor_id WHERE q.student_id = ${u.id} ORDER BY q.created_at DESC LIMIT 200`;
  const sharedQs = await sql`SELECT q.id, q.body, q.kind, q.answer, q.video_url, s.name AS student_name, t.id AS tutor_id, t.name AS tutor_name FROM portal_questions q
    JOIN users s ON s.id = q.student_id JOIN users t ON t.id = q.tutor_id
    WHERE q.shared AND q.answer IS NOT NULL ORDER BY q.answered_at DESC LIMIT 20`;

  const assignments = tutor
    ? await sql`SELECT a.*, s.name AS student_name FROM portal_assignments a JOIN users s ON s.id = a.student_id WHERE a.tutor_id = ${u.id} ORDER BY a.created_at DESC LIMIT 300`
    : await sql`SELECT a.*, m.title, m.type, m.pack, m.level, m.blocks, t.name AS tutor_name FROM portal_assignments a JOIN portal_materials m ON m.id = a.material_id LEFT JOIN users t ON t.id = a.tutor_id WHERE a.student_id = ${u.id} ORDER BY a.created_at DESC LIMIT 300`;
  const library = tutor
    ? await sql`SELECT m.*, o.name AS owner_name FROM portal_materials m LEFT JOIN users o ON o.id = m.owner_id WHERE m.owner_id = ${u.id} OR (m.status = 'Published' AND (m.owner_id IS NULL OR m.owner_id <> ${u.id})) ORDER BY m.updated_at DESC LIMIT 500`
    : [];

  // Student mentor requests: from the website (submissions) and from the portal.
  const requests = tutor ? [] : await sql`SELECT id, data, status, created_at FROM submissions WHERE user_id = ${u.id} AND type = 'mentor_request' ORDER BY created_at DESC LIMIT 50`;
  const bookings = tutor ? [] : await sql`SELECT id, data, status, created_at FROM submissions WHERE user_id = ${u.id} AND type = 'booking' ORDER BY created_at DESC LIMIT 50`;

  // Bookable times: the availability grids of a student's active mentors.
  const grids = tutor || !partners.length ? [] : await sql`SELECT u.id, u.name, p.state->'avail' AS avail FROM users u LEFT JOIN portal_profiles p ON p.user_id = u.id WHERE u.id = ANY(${partners}::uuid[])`;
  const busy = tutor || !partners.length ? [] : await sql`SELECT tutor_id, start_at, dur_min FROM portal_lessons WHERE tutor_id = ANY(${partners}::uuid[]) AND status = 'scheduled' AND start_at > now()`;
  const events = await sql`SELECT e.*, h.name AS host_name, (SELECT count(*)::int FROM portal_rsvps r WHERE r.event_id = e.id) AS going,
      EXISTS (SELECT 1 FROM portal_rsvps r WHERE r.event_id = e.id AND r.user_id = ${u.id}) AS mine
    FROM portal_events e LEFT JOIN users h ON h.id = e.host_id WHERE e.start_at > now() - interval '3 hours' ORDER BY e.start_at LIMIT 30`;
  const payments = tutor ? [] : await sql`SELECT id, name, amount, credits, method, status, created_at FROM portal_payments WHERE user_id = ${u.id} ORDER BY created_at DESC LIMIT 20`;
  const directory = tutor ? [] : await sql`SELECT u.id, u.name, p.state->>'teaches' AS teaches FROM users u LEFT JOIN portal_profiles p ON p.user_id = u.id WHERE u.role = 'tutor' AND u.status = 'active' ORDER BY u.name LIMIT 100`;

  return res.status(200).json({
    me: { ...meUser(u), credits: prof.credits, packs: prof.packs || [] },
    pkgs: (await packages()).filter(p => p.on),
    payInfo: payInfo(),
    vapid: vapidPublicKey(),
    events: events.map(e => ({ id: String(e.id), title: e.title, kind: e.kind, body: e.body, start: ms(e.start_at), dur: e.dur_min, link: e.link || '', host: e.host_name || 'Global Link Team', hostId: e.host_id, going: e.going, mine: e.mine })),
    payments: payments.map(p => ({ id: String(p.id), name: p.name, amount: p.amount, credits: p.credits, method: p.method, status: p.status, at: ms(p.created_at) })),
    readOnly: s.readOnly,
    state: prof.state || {},
    config: { flags: { ...DEFAULT_FLAGS, ...flags }, maint: !!maint, announce, reloadAt },
    matches: matches.map(m => ({ id: String(m.id), otherId: tutor ? m.student_id : m.tutor_id, name: m.other_name, subject: m.subject, status: m.status, since: ms(m.created_at), joined: ms(m.other_joined),
      profile: pick(m.other_state || {}, tutor ? ['goal', 'interests', 'grade', 'city'] : ['teaches', 'why', 'city']) })),
    lessons: lessons.map(l => ({ id: String(l.id), otherId: tutor ? l.student_id : l.tutor_id, name: l.other_name || 'Your mentor', start: ms(l.start_at), dur: l.dur_min, cls: l.cls, topic: l.topic, status: l.status, feedback: l.feedback })),
    tasks: tasks.map(t => ({ id: String(t.id), title: t.title, kind: t.kind, cls: t.cls, due: t.due, done: t.done, submission: t.submission || null, mats: t.mats || [], sharedWith: t.shared_with || [], tutorId: t.tutor_id, tutorName: t.tutor_name || null, studentId: t.student_id, studentName: t.student_name || null, at: ms(t.created_at) })),
    questions: questions.map(q => ({ id: String(q.id), otherId: tutor ? q.student_id : q.tutor_id, name: q.other_name, q: q.body, kind: q.kind, shared: q.shared, answer: q.answer, video: q.video_url || null, expired: q.expired, at: ms(q.created_at), answeredAt: ms(q.answered_at) })),
    sharedQs: sharedQs.map(q => ({ id: 'sq' + q.id, from: first(q.student_name), tutorId: q.tutor_id, tutorName: q.tutor_name, q: q.body, kind: q.kind, ans: q.answer, video: q.video_url || null })),
    assignments: assignments.map(a => ({ id: String(a.id), materialId: String(a.material_id), studentId: a.student_id, studentName: a.student_name, tutorName: a.tutor_name, due: a.due, note: a.note, progress: a.progress, opened: !!a.opened_at, at: ms(a.created_at),
      material: a.title ? { title: a.title, type: a.type, pack: a.pack, level: a.level, blocks: a.blocks } : null })),
    library: library.map(matOut),
    requests: requests.map(r => ({ id: String(r.id), subj: r.data?.subject || r.data?.mentorName || 'A mentor', note: r.data?.note || '', mentorName: r.data?.mentorName || '', via: r.data?.via === 'portal' ? 'in the portal' : 'on globallink.com', status: r.status, at: ms(r.created_at) })),
    bookings: bookings.map(r => ({ id: String(r.id), start: Number(r.data?.start) || null, cls: r.data?.className || 'Introductory lesson', mentorName: r.data?.mentorName || '', status: r.status, at: ms(r.created_at) })),
    grids: grids.map(g => ({ id: g.id, name: g.name, avail: g.avail || {} })),
    busy: busy.map(b => ({ tutorId: b.tutor_id, start: ms(b.start_at), dur: b.dur_min })),
    directory: directory.map(d => ({ id: d.id, name: d.name, teaches: d.teaches || '' })),
    threads: await threadsFor(u, partners),
    ...(await communityData(u)),
    now: Date.now(),
  });
}

// Uploaded files must be in our Vercel Blob store.
const BLOB_URL = new RegExp('^https://[a-z0-9]+\\.public\\.blob\\.vercel-storage\\.com/', 'i');
export function cleanFile(f) {
  if (!f || typeof f !== 'object') return null;
  const url = str(f.url, 600);
  if (!BLOB_URL.test(url)) return null;
  return { url, name: str(f.name, 120) || 'file', type: str(f.type, 80) || 'application/octet-stream', size: int(f.size, 0, 50e6, 0), secs: int(f.secs, 0, 3600, 0) };
}
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] != null).map(k => [k, o[k]]));
export const matOut = m => ({ id: String(m.id), title: m.title, type: m.type, pack: m.pack, level: m.level, blocks: m.blocks || [], status: m.status, uses: m.uses, ownerId: m.owner_id, by: m.owner_name || 'Global Link', at: ms(m.updated_at) });

async function communityData(u) {
  const posts = await sql`SELECT p.*, a.name AS author_name, a.role AS author_role,
      (SELECT count(*)::int FROM portal_likes l WHERE l.post_id = p.id) AS likes,
      EXISTS (SELECT 1 FROM portal_likes l WHERE l.post_id = p.id AND l.user_id = ${u ? u.id : null}) AS liked
    FROM portal_posts p LEFT JOIN users a ON a.id = p.author_id WHERE NOT p.hidden ORDER BY p.created_at DESC LIMIT 60`;
  const ids = posts.map(p => p.id);
  const comments = ids.length ? await sql`SELECT c.*, a.name AS author_name, a.role AS author_role FROM portal_comments c LEFT JOIN users a ON a.id = c.author_id WHERE c.post_id = ANY(${ids}::bigint[]) ORDER BY c.created_at` : [];
  const counts = await sql`SELECT j.key AS g, count(*)::int AS n FROM portal_profiles p, jsonb_each(COALESCE(p.state->'joined', '{}'::jsonb)) j WHERE j.value = 'true'::jsonb GROUP BY j.key`;
  const [{ members }] = await sql`SELECT count(*)::int AS members FROM users WHERE role IN ('student', 'tutor') AND status = 'active'`;
  return {
    posts: posts.map(p => ({ id: String(p.id), authorId: p.author_id, author: p.author_name || 'Global Link Team', mentor: p.author_role === 'tutor', team: !p.author_id, group: p.group_id, type: p.type, title: p.title, body: p.body, likes: p.likes, liked: p.liked, at: ms(p.created_at),
      comments: comments.filter(c => c.post_id === p.id).map(c => ({ id: String(c.id), who: c.author_name || 'Global Link Team', mentor: c.author_role === 'tutor', t: c.body, at: ms(c.created_at) })) })),
    groupCounts: Object.fromEntries(counts.map(c => [c.g, c.n])),
    members,
  };
}

// ---- writes ----
async function saveState(req, res, s) {
  const b = body(req) || {};
  const patch = {};
  for (const k of STATE_KEYS) if (k in (b.state || {})) patch[k] = b.state[k];
  const json = JSON.stringify(patch);
  if (json.length > 60000) return fail(res, 413, 'Saved data is too large.');
  await profile(s.user.id);
  await sql`UPDATE portal_profiles SET state = state || ${json}::jsonb, updated_at = now() WHERE user_id = ${s.user.id}`;
  return res.status(200).json({ ok: true });
}

async function sync(req, res, s) {
  const u = s.user;
  const partners = await partnerIds(u);
  const [flags, maint, announce, reloadAt] = await Promise.all([getConfig('flags', DEFAULT_FLAGS), getConfig('maint', false), getConfig('announce', null), getConfig('reloadAt', 0)]);
  await sql`UPDATE portal_profiles SET last_seen_at = now() WHERE user_id = ${u.id}`;
  return res.status(200).json({ threads: await threadsFor(u, partners), config: { flags: { ...DEFAULT_FLAGS, ...flags }, maint: !!maint, announce, reloadAt }, now: Date.now() });
}

async function message(req, res, s) {
  const u = s.user, b = body(req) || {};
  const file = cleanFile(b.file);
  const text = str(b.text, 4000) || (file ? (file.type.startsWith('audio/') ? 'Voice note' : file.name) : '');
  if (!text) return fail(res, 400, 'Write a message first.');
  if ((await hit('msg', u.id, 60)) > 30) return fail(res, 429, 'You’re sending messages quickly. Please wait a moment.');
  const to = b.to === 'team' ? null : String(b.to || '');
  if (to !== null) {
    if (!isUuid(to) || !(await partnerIds(u)).includes(to)) return fail(res, 403, 'You can message your mentors, your students and the Global Link team.');
  }
  const mats = Array.isArray(b.mats) ? b.mats.slice(0, 10).map(String) : null;
  const [m] = await sql`INSERT INTO portal_messages (sender_id, recipient_id, body, mats, file) VALUES (${u.id}, ${to}, ${text}, ${mats ? JSON.stringify(mats) : null}::jsonb, ${file ? JSON.stringify(file) : null}::jsonb) RETURNING id, created_at`;
  if (to) await notify(to, { kind: 'message', title: u.name, body: text, path: '/#/messages', email: true, emailSubject: 'New message from ' + u.name });
  // Messages to the team also land in the website's team inbox (GET /api/submissions?type=support_message).
  if (to === null) await sql`INSERT INTO submissions (type, data, email, user_id, ip_hash) VALUES ('support_message', ${JSON.stringify({ name: u.name, username: u.username, text })}::jsonb, ${u.email}, ${u.id}, ${ipHash(req)})`;
  return res.status(201).json({ id: String(m.id), at: ms(m.created_at) });
}

async function read(req, res, s) {
  const b = body(req) || {};
  if (b.from === 'team') await sql`UPDATE portal_messages SET read_at = now() WHERE recipient_id = ${s.user.id} AND sender_id IS NULL AND read_at IS NULL`;
  else if (isUuid(b.from)) await sql`UPDATE portal_messages SET read_at = now() WHERE recipient_id = ${s.user.id} AND sender_id = ${b.from} AND read_at IS NULL`;
  return res.status(200).json({ ok: true });
}

// Student asks Global Link for a mentor (same record type the website uses).
async function request(req, res, s) {
  const u = s.user, b = body(req) || {};
  if (u.role !== 'student') return fail(res, 403, 'Only students can request a mentor.');
  if ((await hit('mreq', u.id, 3600)) > 10) return fail(res, 429, 'Too many requests. Please try again later.');
  const subject = str(b.subject, 80) || 'English conversation', note = str(b.note, 1000);
  const mentorName = str(b.mentorName, 120);
  const [r] = await sql`INSERT INTO submissions (type, data, email, user_id, ip_hash) VALUES ('mentor_request', ${JSON.stringify({ subject, note, mentorName, via: 'portal', times: b.times || null })}::jsonb, ${u.email}, ${u.id}, ${ipHash(req)}) RETURNING id, created_at`;
  return res.status(201).json({ id: String(r.id), at: ms(r.created_at) });
}
async function cancelRequest(req, res, s) {
  const b = body(req) || {};
  await sql`UPDATE submissions SET status = 'cancelled' WHERE id = ${int(b.id, 0, 9e15, 0)} AND user_id = ${s.user.id} AND type = 'mentor_request' AND status IN ('new', 'reviewing')`;
  return res.status(200).json({ ok: true });
}

// Mentor accepts or declines a student the team matched them with.
async function respond(req, res, s) {
  const u = s.user, b = body(req) || {};
  if (u.role !== 'tutor') return fail(res, 403, 'Only mentors can answer requests.');
  const status = b.accept ? 'active' : 'declined';
  const [m] = await sql`UPDATE portal_matches SET status = ${status}, updated_at = now() WHERE id = ${int(b.id, 0, 9e15, 0)} AND tutor_id = ${u.id} AND status = 'proposed' RETURNING *`;
  if (!m) return fail(res, 404, 'That request is no longer open.');
  if (m.request_id) await sql`UPDATE submissions SET status = ${b.accept ? 'matched' : 'new'} WHERE id = ${m.request_id}`;
  const note = b.accept ? `Great news! ${u.name} is now your mentor for ${m.subject || 'your lessons'}. You can message them and book a lesson.` : `Your mentor request is still open. We’re finding the right person for ${m.subject || 'you'}.`;
  await teamMsg(m.student_id, note, 'match', '/#/mentors');
  return res.status(200).json({ ok: true });
}

async function book(req, res, s) {
  const u = s.user, b = body(req) || {};
  if (u.role !== 'student') return fail(res, 403, 'Only students can book lessons.');
  const tutorId = String(b.tutorId || ''), start = int(b.start, 0, 9e15, 0);
  if (!(await partnerIds(u)).includes(tutorId)) return fail(res, 403, 'Book with one of your mentors.');
  if (start < Date.now() + 30 * 60000 || start > Date.now() + 60 * 86400000) return fail(res, 400, 'Pick a time at least 30 minutes from now.');
  const [p] = await sql`SELECT state->'avail' AS avail FROM portal_profiles WHERE user_id = ${tutorId}`;
  if (!inGrid(start, p?.avail)) return fail(res, 409, 'That time is no longer open. Pick another.');
  const iso = new Date(start).toISOString();
  const clash = await sql`SELECT 1 FROM portal_lessons WHERE status = 'scheduled' AND (tutor_id = ${tutorId} OR student_id = ${u.id})
    AND start_at < ${iso}::timestamptz + interval '40 minutes' AND start_at + make_interval(mins => dur_min) > ${iso}::timestamptz LIMIT 1`;
  if (clash.length) return fail(res, 409, 'That time was just booked. Pick another.');
  const [m] = await sql`SELECT subject FROM portal_matches WHERE student_id = ${u.id} AND tutor_id = ${tutorId}`;
  const cls = str(b.cls, 80) || (m && m.subject ? m.subject.replace(/^\w/, c => c.toUpperCase()) : 'English Conversation');
  if ((await addCredits(u.id, -1, 'Booked a lesson', iso)) === null) return fail(res, 402, 'You’re out of lesson credits. Buy more lessons first (most families pay us on WeChat).', { needCredits: true });
  const [l] = await sql`INSERT INTO portal_lessons (student_id, tutor_id, start_at, cls, topic, credit_used) VALUES (${u.id}, ${tutorId}, ${iso}, ${cls}, ${str(b.topic, 200) || 'Open conversation'}, true) RETURNING *`;
  await teamMsg(tutorId, `${u.name} booked a lesson with you. It’s on your schedule.`, 'lesson', '/#/schedule');
  return res.status(201).json({ id: String(l.id) });
}

async function lesson(req, res, s) {
  const u = s.user, b = body(req) || {}, id = int(b.id, 0, 9e15, 0);
  const [l] = await sql`SELECT * FROM portal_lessons WHERE id = ${id} AND (student_id = ${u.id} OR tutor_id = ${u.id})`;
  if (!l) return fail(res, 404, 'Lesson not found.');
  if (b.op === 'cancel') {
    if (l.status !== 'scheduled') return fail(res, 409, 'This lesson can’t be cancelled.');
    await sql`UPDATE portal_lessons SET status = 'cancelled' WHERE id = ${id}`;
    const early = new Date(l.start_at).getTime() - Date.now() > 24 * 3600000;
    if (l.credit_used && (early || u.id === l.tutor_id)) await addCredits(l.student_id, 1, 'Lesson cancelled', 'lesson:' + l.id);
    const other = u.id === l.student_id ? l.tutor_id : l.student_id;
    if (other) await teamMsg(other, `${u.name} cancelled the lesson on ${new Date(l.start_at).toUTCString().slice(0, 22)} UTC.`, 'lesson', '/#/schedule');
    return res.status(200).json({ ok: true });
  }
  if (b.op === 'feedback' && u.id === l.tutor_id) {
    const fb = { text: str(b.text, 1000), next: str(b.next, 300), color: str(b.color, 12) || 'pink', at: Date.now() };
    await sql`UPDATE portal_lessons SET feedback = ${JSON.stringify(fb)}::jsonb, status = CASE WHEN status = 'scheduled' AND start_at < now() THEN 'done' ELSE status END WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  }
  return fail(res, 400, 'Unknown lesson change.');
}

async function task(req, res, s) {
  const u = s.user, b = body(req) || {};
  if (b.op === 'create') {
    const title = str(b.title, 200);
    if (title.length < 3) return fail(res, 400, 'Give the task a title.');
    const partners = await partnerIds(u);
    const share = (Array.isArray(b.shareWith) ? b.shareWith : []).filter(id => partners.includes(id)).slice(0, 10);
    let studentId = u.id, tutorId = null;
    if (u.role === 'tutor') { if (!partners.includes(b.studentId)) return fail(res, 403, 'Assign tasks to your own students.'); studentId = b.studentId; tutorId = u.id; }
    const mats = (Array.isArray(b.mats) ? b.mats : []).slice(0, 10).map(String);
    const [t] = await sql`INSERT INTO portal_tasks (student_id, tutor_id, title, kind, cls, due, mats, shared_with) VALUES (${studentId}, ${tutorId}, ${title}, ${str(b.kind, 30) || 'Practice'}, ${str(b.cls, 80) || 'Personal'}, ${str(b.due, 60)}, ${JSON.stringify(mats)}::jsonb, ${JSON.stringify(share)}::jsonb) RETURNING id`;
    return res.status(201).json({ id: String(t.id) });
  }
  const id = int(b.id, 0, 9e15, 0);
  if (b.op === 'done') {
    await sql`UPDATE portal_tasks SET done = ${!!b.done} WHERE id = ${id} AND student_id = ${u.id}`;
    return res.status(200).json({ ok: true });
  }
  if (b.op === 'submit') {
    const file = cleanFile(b.file);
    if (!file) return fail(res, 400, 'Record or attach something first.');
    const [t] = await sql`UPDATE portal_tasks SET done = true, submission = ${JSON.stringify(file)}::jsonb WHERE id = ${id} AND student_id = ${u.id} RETURNING tutor_id, title`;
    if (!t) return fail(res, 404, 'Task not found.');
    if (t.tutor_id) {
      await sql`INSERT INTO portal_messages (sender_id, recipient_id, body, file) VALUES (${u.id}, ${t.tutor_id}, ${'For “' + t.title + '”'}, ${JSON.stringify(file)}::jsonb)`;
      await notify(t.tutor_id, { kind: 'message', title: u.name, body: 'Sent: ' + t.title, path: '/#/messages' });
    }
    return res.status(200).json({ ok: true });
  }
  if (b.op === 'delete') {
    await sql`DELETE FROM portal_tasks WHERE id = ${id} AND (student_id = ${u.id} AND tutor_id IS NULL OR tutor_id = ${u.id})`;
    return res.status(200).json({ ok: true });
  }
  return fail(res, 400, 'Unknown task change.');
}

async function ask(req, res, s) {
  const u = s.user, b = body(req) || {};
  if (u.role !== 'student') return fail(res, 403, 'Only students can ask questions.');
  const q = str(b.q, 1500);
  if (q.length < 4) return fail(res, 400, 'Write your question first.');
  if ((await hit('ask', u.id, 86400)) > 10) return fail(res, 429, 'You’ve asked a lot today. Try again tomorrow.');
  const [t] = await sql`SELECT id FROM users WHERE id = ${isUuid(b.to) ? b.to : null} AND role = 'tutor' AND status = 'active'`;
  if (!t) return fail(res, 404, 'Pick a mentor.');
  const [r] = await sql`INSERT INTO portal_questions (student_id, tutor_id, body, kind, shared) VALUES (${u.id}, ${t.id}, ${q}, ${b.kind === 'video' ? 'video' : 'text'}, ${!!b.share}) RETURNING id`;
  await teamMsg(t.id, `${u.name} asked you a question: “${q.slice(0, 140)}”. Answer it in Questions.`, 'reply', '/#/questions');
  return res.status(201).json({ id: String(r.id) });
}
async function answer(req, res, s) {
  const u = s.user, b = body(req) || {};
  const video = cleanFile(b.video);
  const text = str(b.text, 4000) || (video ? 'Video reply' : '');
  if (text.length < 2) return fail(res, 400, 'Write your reply first.');
  const [q] = await sql`UPDATE portal_questions SET answer = ${text}, video_url = ${video && video.type.startsWith('video/') ? video.url : null}, answered_at = now() WHERE id = ${int(b.id, 0, 9e15, 0)} AND tutor_id = ${u.id} AND answer IS NULL RETURNING student_id, body`;
  if (!q) return fail(res, 404, 'That question was already answered.');
  await teamMsg(q.student_id, `${u.name} answered your question “${q.body.slice(0, 100)}”. See it in Ask a mentor.`, 'reply', '/#/ask');
  return res.status(200).json({ ok: true });
}

// Mentor material builder: create/update own materials, or send one for review.
const STATUSES_T = ['Private', 'In review'];
async function material(req, res, s) {
  const u = s.user, b = body(req) || {};
  if (u.role !== 'tutor') return fail(res, 403, 'Only mentors make materials.');
  const m = cleanMaterial(b);
  if (!m.title) return fail(res, 400, 'Give the material a title.');
  const status = STATUSES_T.includes(b.status) ? b.status : 'Private';
  const blocks = JSON.stringify(m.blocks);
  if (isUuid(b.id) || !/^\d+$/.test(String(b.id || ''))) {
    const [r] = await sql`INSERT INTO portal_materials (owner_id, title, type, pack, level, blocks, status) VALUES (${u.id}, ${m.title}, ${m.type}, ${m.pack}, ${m.level}, ${blocks}::jsonb, ${status}) RETURNING id`;
    return res.status(201).json({ id: String(r.id), status });
  }
  const [r] = await sql`UPDATE portal_materials SET title = ${m.title}, type = ${m.type}, pack = ${m.pack}, level = ${m.level}, blocks = ${blocks}::jsonb, status = CASE WHEN status = 'Published' THEN status ELSE ${status} END, updated_at = now()
    WHERE id = ${b.id} AND owner_id = ${u.id} RETURNING id, status`;
  if (!r) return fail(res, 404, 'Material not found.');
  return res.status(200).json({ id: String(r.id), status: r.status });
}
export function cleanMaterial(b) {
  const KINDS = ['h', 't', 'q', 'v', 'p', 'm'];
  const blocks = (Array.isArray(b.blocks) ? b.blocks : []).slice(0, 80).filter(x => x && KINDS.includes(x.k)).map(x => ({
    id: str(x.id, 40), k: x.k, text: str(x.text, 2000), zh: str(x.zh, 300), ex: str(x.ex, 500),
    opts: (Array.isArray(x.opts) ? x.opts : ['', '', '']).slice(0, 3).map(o => str(o, 300)), ok: int(x.ok, 0, 2, 0), sec: int(x.sec, 10, 600, 60),
    ...(x.k === 'm' && cleanFile(x.file) ? { file: cleanFile(x.file) } : {}),
  }));
  return { title: str(b.title, 160), type: str(b.type, 40) || 'Lesson plan', pack: str(b.pack, 20) || 'free', level: str(b.level, 20) || 'Intermediate', blocks };
}

async function assign(req, res, s) {
  const u = s.user, b = body(req) || {};
  if (u.role !== 'tutor') return fail(res, 403, 'Only mentors assign materials.');
  const partners = await partnerIds(u);
  const to = (Array.isArray(b.to) ? b.to : []).filter(id => partners.includes(id));
  const mats = (Array.isArray(b.mats) ? b.mats : []).map(x => int(x, 0, 9e15, 0)).filter(Boolean).slice(0, 20);
  if (!to.length || !mats.length) return fail(res, 400, 'Pick materials and students.');
  const ok = await sql`SELECT id, title, type FROM portal_materials WHERE id = ANY(${mats}::bigint[]) AND (owner_id = ${u.id} OR status = 'Published')`;
  if (!ok.length) return fail(res, 404, 'Those materials aren’t available.');
  const due = str(b.due, 60), note = str(b.note, 500);
  for (const st of to) for (const m of ok) {
    await sql`INSERT INTO portal_assignments (material_id, tutor_id, student_id, due, note) VALUES (${m.id}, ${u.id}, ${st}, ${due}, ${note})`;
    if (b.task) {
      const verb = m.type === 'Video' ? 'Watch: ' : m.type === 'Word list' ? 'Review: ' : 'Read: ';
      await sql`INSERT INTO portal_tasks (student_id, tutor_id, title, kind, cls, due, mats) VALUES (${st}, ${u.id}, ${verb + m.title}, ${m.type}, 'Materials', ${due}, ${JSON.stringify([String(m.id)])}::jsonb)`;
    }
  }
  await sql`UPDATE portal_materials SET uses = uses + ${to.length} WHERE id = ANY(${ok.map(m => m.id)}::bigint[])`;
  return res.status(201).json({ ok: true });
}
async function unassign(req, res, s) {
  const b = body(req) || {};
  await sql`DELETE FROM portal_assignments WHERE id = ${int(b.id, 0, 9e15, 0)} AND tutor_id = ${s.user.id}`;
  return res.status(200).json({ ok: true });
}
async function progress(req, res, s) {
  const b = body(req) || {};
  await sql`UPDATE portal_assignments SET progress = GREATEST(progress, ${int(b.progress, 0, 100, 0)}), opened_at = COALESCE(opened_at, now()) WHERE id = ${int(b.id, 0, 9e15, 0)} AND student_id = ${s.user.id}`;
  return res.status(200).json({ ok: true });
}

// ---- community ----
async function post(req, res, s) {
  const u = s.user, b = body(req) || {};
  const flags = { ...DEFAULT_FLAGS, ...(await getConfig('flags', {})) };
  if (!flags.community) return fail(res, 403, 'Community is paused right now.');
  if ((await hit('post', u.id, 3600)) > 8) return fail(res, 429, 'You’re posting quickly. Try again in a bit.');
  const title = str(b.title, 200), text = str(b.body, 4000);
  if (title.length < 4) return fail(res, 400, 'Give your post a title.');
  const rules = await getConfig('modRules', { auto: true, first: false, links: true });
  if (rules.links && /(https?:\/\/|www\.|weixin|wechat\s*id|微信号|vx[:：])/i.test(title + ' ' + text)) return fail(res, 400, 'Links and contact IDs aren’t allowed in posts.');
  let hidden = false;
  if (rules.first) { const [{ n }] = await sql`SELECT count(*)::int AS n FROM portal_posts WHERE author_id = ${u.id} AND NOT hidden`; hidden = n === 0; }
  const [p] = await sql`INSERT INTO portal_posts (author_id, group_id, type, title, body, hidden) VALUES (${u.id}, ${GROUP_IDS.includes(b.group) ? b.group : 'g2'}, ${POST_TYPES.includes(b.type) ? b.type : 'Discussion'}, ${title}, ${text}, ${hidden}) RETURNING id`;
  if (hidden) await sql`INSERT INTO portal_reports (post_id, reporter_id, reason) VALUES (${p.id}, NULL, 'First post')`;
  return res.status(201).json({ id: String(p.id), pending: hidden });
}
async function comment(req, res, s) {
  const u = s.user, b = body(req) || {};
  const text = str(b.text, 1500);
  if (!text) return fail(res, 400, 'Write a comment first.');
  if ((await hit('comment', u.id, 3600)) > 40) return fail(res, 429, 'Slow down a little.');
  const [r] = await sql`INSERT INTO portal_comments (post_id, author_id, body) SELECT id, ${u.id}, ${text} FROM portal_posts WHERE id = ${int(b.postId, 0, 9e15, 0)} AND NOT hidden RETURNING id`;
  if (!r) return fail(res, 404, 'Post not found.');
  return res.status(201).json({ id: String(r.id) });
}
async function like(req, res, s) {
  const b = body(req) || {}, id = int(b.postId, 0, 9e15, 0);
  if (b.on) await sql`INSERT INTO portal_likes (post_id, user_id) SELECT id, ${s.user.id} FROM portal_posts WHERE id = ${id} ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM portal_likes WHERE post_id = ${id} AND user_id = ${s.user.id}`;
  return res.status(200).json({ ok: true });
}
async function report(req, res, s) {
  const b = body(req) || {}, id = int(b.postId, 0, 9e15, 0);
  await sql`INSERT INTO portal_reports (post_id, reporter_id, reason) SELECT id, ${s.user.id}, ${str(b.reason, 40) || 'Other'} FROM portal_posts WHERE id = ${id} ON CONFLICT DO NOTHING`;
  const rules = await getConfig('modRules', { auto: true });
  if (rules.auto) {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM portal_reports WHERE post_id = ${id} AND status = 'open'`;
    if (n >= 3) await sql`UPDATE portal_posts SET hidden = true WHERE id = ${id}`;
  }
  return res.status(200).json({ ok: true });
}

// ---- AI: Lumi and translation (provider waterfall in _lib/llm.js) ----
const LUMI = (u, ctx) => `You are Lumi, the friendly AI helper inside the Global Link learning app. ${u.role === 'tutor'
  ? `You help ${first(u.name)}, a bilingual American high-school mentor, plan short lessons and explain things simply to Chinese students.`
  : `You help ${first(u.name)}, a Chinese high-school student, practice English between lessons with American mentors.`}
${ctx ? 'Context: ' + ctx + '\n' : ''}Reply in 1-3 short, warm sentences of simple English. Gently correct one mistake if there is one (show the better phrasing), then ask one follow-up question. If they write Chinese, answer in English and add a short Chinese hint. No emoji, no markdown. Only help with learning, school and Global Link; politely decline anything else.`;

async function lumi(req, res, s) {
  const u = s.user, b = body(req) || {};
  const flags = { ...DEFAULT_FLAGS, ...(await getConfig('flags', {})) };
  if (!flags.lumi) return fail(res, 403, 'Lumi is turned off right now.');
  const raw = Array.isArray(b.messages) ? b.messages.slice(-12) : [];
  const messages = raw.map(m => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: str(m?.content, 1200) })).filter(m => m.content);
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages.at(-1).role !== 'user') return fail(res, 400, 'Say something to Lumi first.');
  const key = u.id || 'admin';
  if ((await hit('lumi-min', key, 60)) > 8) return fail(res, 429, 'You’re sending messages quickly. Please wait a minute.');
  if ((await hit('lumi-day', key, 86400)) > 150) return fail(res, 429, 'You’ve reached today’s Lumi limit. Come back tomorrow!');
  if ((await hit('lumi-global', 'all', 86400)) > 3000) return fail(res, 429, 'Lumi is very busy today. Please try again tomorrow.');
  const words = u.id ? (await profile(u.id)).state?.savedWords || [] : [];
  const ctx = words.length ? 'Words they are practicing: ' + words.slice(-12).join(', ') + '.' : '';
  try {
    const r = await complete({ system: LUMI(u, ctx), messages, maxTokens: 300, thinking: 'minimal' }, 'smart');
    res.setHeader('x-llm-provider', r.provider + ':' + r.model);
    return res.status(200).json({ text: r.text });
  } catch (e) {
    console.error('[lumi]', e.message);
    return fail(res, 503, 'Lumi is resting for a moment. Try again soon.');
  }
}

async function translate(req, res, s) {
  const b = body(req) || {};
  const text = str(b.text, 3000);
  if (!text) return fail(res, 400, 'Nothing to translate.');
  if ((await hit('tr', s.user.id || 'admin', 3600)) > 120) return fail(res, 429, 'Too many translations this hour.');
  const toEn = /[一-鿿]/.test(text);
  try {
    const r = await complete({ system: 'You are a translator for a tutoring app. Translate the user message into ' + (toEn ? 'natural, friendly English' : 'natural, friendly Simplified Chinese') + '. Keep line breaks. Reply with only the translation.', messages: [{ role: 'user', content: text }], maxTokens: 600, thinking: 'minimal' }, 'smart');
    return res.status(200).json({ text: r.text });
  } catch (e) {
    console.error('[translate]', e.message);
    return fail(res, 503, 'Translation is unavailable right now.');
  }
}

// ---- uploads (Vercel Blob): voice notes, video replies, attachments, material files ----
const APP_URL = () => (process.env.APP_URL || 'https://global-link-portal.vercel.app').replace(/\/$/, '');
const UPLOAD_TYPES = /^(audio\/(webm|mp4|ogg|mpeg|wav|x-m4a|aac)|video\/(webm|mp4|quicktime)|image\/(png|jpeg|gif|webp)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/vnd\.ms-powerpoint|text\/plain)$/;
async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'latin1');
  const chunks = []; for await (const c of req) chunks.push(Buffer.from(c)); return Buffer.concat(chunks);
}
async function upload(req, res, s) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(res, 503, 'Uploads aren’t set up yet.');
  const type = String(req.query.type || '').split(';')[0].trim().toLowerCase();
  if (!UPLOAD_TYPES.test(type)) return fail(res, 415, 'That kind of file isn’t supported.');
  if ((await hit('upload', s.user.id, 3600)) > 40) return fail(res, 429, 'Too many uploads this hour. Try again later.');
  const buf = await rawBody(req);
  if (!buf.length) return fail(res, 400, 'The file is empty.');
  if (buf.length > 4.2e6) return fail(res, 413, 'Files can be up to 4 MB.');
  const name = (str(req.query.name, 100).replace(/[^\w.\- ]+/g, '_') || 'file').slice(0, 100);
  const kind = ['voice', 'video', 'file', 'image', 'material'].includes(req.query.kind) ? req.query.kind : 'file';
  const blob = await put('u/' + s.user.id + '/' + kind + '/' + randomBytes(9).toString('base64url') + '-' + name, buf, { access: 'public', contentType: type, token: process.env.BLOB_READ_WRITE_TOKEN });
  return res.status(201).json({ url: blob.url, name, type, size: buf.length, secs: int(req.query.secs, 0, 3600, 0) });
}

// ---- push notifications ----
async function pushSubscribe(req, res, s) {
  const b = body(req) || {}, k = b.keys || {};
  const endpoint = str(b.endpoint, 1000);
  if (!/^https:\/\//.test(endpoint) || !k.p256dh || !k.auth) return fail(res, 400, 'That notification subscription isn’t valid.');
  await sql`INSERT INTO portal_push (user_id, endpoint, p256dh, auth) VALUES (${s.user.id}, ${endpoint}, ${str(k.p256dh, 200)}, ${str(k.auth, 100)})
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
  return res.status(200).json({ ok: true });
}
async function pushUnsubscribe(req, res, s) {
  const b = body(req) || {};
  await sql`DELETE FROM portal_push WHERE endpoint = ${str(b.endpoint, 1000)} AND user_id = ${s.user.id}`;
  return res.status(200).json({ ok: true });
}

// ---- buying lessons ----
// Most families pay Global Link on WeChat: the app records a request, tells the
// team, and the team marks it paid in Admin -> Payments (which adds credits).
// Stripe Checkout (card / Alipay / WeChat Pay) is offered when it's configured.
async function buy(req, res, s) {
  const u = s.user, b = body(req) || {};
  if (u.role !== 'student') return fail(res, 403, 'Lesson packs are for student accounts.');
  const pk = (await packages()).find(p => p.on && p.id === b.packId);
  if (!pk) return fail(res, 404, 'That plan isn’t available.');
  if (Number(pk.price) <= 0) return fail(res, 400, 'Your free intro lesson is already in your account.');
  if ((await hit('buy', u.id, 3600)) > 10) return fail(res, 429, 'Too many attempts. Please try again later.');
  if (b.method === 'stripe') {
    if (!process.env.STRIPE_SECRET_KEY) return fail(res, 503, 'Paying by card in the app isn’t switched on yet. Please pay on WeChat.');
    return res.status(200).json({ url: await createCheckout({ user: u, pack: pk, appUrl: APP_URL() }) });
  }
  const [p] = await sql`INSERT INTO portal_payments (user_id, pack_id, name, amount, credits, method, status) VALUES (${u.id}, ${pk.id}, ${pk.name}, ${Number(pk.price)}, ${pk.credits}, 'wechat', 'pending') RETURNING id`;
  const text = 'I’d like to buy ' + pk.name + ' (¥' + pk.price + '). Payment request #' + p.id + '.';
  await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (${u.id}, NULL, ${text})`;
  await sql`INSERT INTO submissions (type, data, email, user_id, ip_hash) VALUES ('payment_request', ${JSON.stringify({ name: u.name, username: u.username, pack: pk.name, price: pk.price, paymentId: p.id })}::jsonb, ${u.email}, ${u.id}, ${ipHash(req)})`;
  const id = payInfo().wechatId;
  await teamMsg(u.id, 'Thanks! To pay for ' + pk.name + ' (¥' + pk.price + '), send it to us on WeChat' + (id ? ' (WeChat ID: ' + id + ')' : '') + ' and mention request #' + p.id + '. We add your ' + pk.credits + ' lesson credits as soon as it arrives, usually within a day.');
  return res.status(201).json({ id: String(p.id), wechatId: id });
}
async function checkoutStatus(req, res) {
  const r = await settleCheckout(str((body(req) || {}).sessionId, 200));
  return res.status(200).json(r || { paid: false });
}

// ---- community events ----
async function rsvp(req, res, s) {
  const b = body(req) || {}, id = int(b.id, 0, 9e15, 0);
  if (b.on) await sql`INSERT INTO portal_rsvps (event_id, user_id) SELECT id, ${s.user.id} FROM portal_events WHERE id = ${id} ON CONFLICT DO NOTHING`;
  else await sql`DELETE FROM portal_rsvps WHERE event_id = ${id} AND user_id = ${s.user.id}`;
  return res.status(200).json({ ok: true });
}
export function cleanEvent(b) {
  const title = str(b.title, 140), start = int(b.start, 0, 9e15, 0);
  if (title.length < 4) return { error: 'Give the event a title.' };
  if (start < Date.now() || start > Date.now() + 180 * 86400000) return { error: 'Pick a time in the next six months.' };
  const link = str(b.link, 300);
  if (link && !/^https:\/\//.test(link)) return { error: 'The link must start with https://' };
  return { title, start, kind: ['Live Q&A', 'Workshop', 'Club', 'Social'].includes(b.kind) ? b.kind : 'Live Q&A', body: str(b.body, 1000), dur: int(b.dur, 15, 240, 45), link };
}
async function event(req, res, s) {
  if (s.user.role !== 'tutor') return fail(res, 403, 'Mentors and the Global Link team host events.');
  const e = cleanEvent(body(req) || {});
  if (e.error) return fail(res, 400, e.error);
  const [r] = await sql`INSERT INTO portal_events (host_id, title, kind, body, start_at, dur_min, link) VALUES (${s.user.id}, ${e.title}, ${e.kind}, ${e.body}, ${new Date(e.start).toISOString()}, ${e.dur}, ${e.link || null}) RETURNING id`;
  return res.status(201).json({ id: String(r.id) });
}

const W = true; // route performs writes (blocked for read-only view-as sessions)
const ROUTES = {
  bootstrap: ['GET', bootstrap], sync: ['GET', sync],
  state: ['POST', saveState, W], message: ['POST', message, W], read: ['POST', read, W],
  request: ['POST', request, W], 'cancel-request': ['POST', cancelRequest, W], respond: ['POST', respond, W],
  book: ['POST', book, W], lesson: ['POST', lesson, W], task: ['POST', task, W],
  ask: ['POST', ask, W], answer: ['POST', answer, W],
  material: ['POST', material, W], assign: ['POST', assign, W], unassign: ['POST', unassign, W], progress: ['POST', progress, W],
  post: ['POST', post, W], comment: ['POST', comment, W], like: ['POST', like, W], report: ['POST', report, W],
  lumi: ['POST', lumi, W], translate: ['POST', translate],
  upload: ['POST', upload, W], 'push-subscribe': ['POST', pushSubscribe, W], 'push-unsubscribe': ['POST', pushUnsubscribe, W],
  buy: ['POST', buy, W], 'checkout-status': ['POST', checkoutStatus, W], rsvp: ['POST', rsvp, W], event: ['POST', event, W],
};

export default async function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader('cache-control', 'no-store');
  const r = ROUTES[req.query.action];
  if (!r) return fail(res, 404, 'Not found');
  if (req.method !== r[0]) return fail(res, 405, 'Method not allowed');
  try {
    let s = await session(req);
    // The admin can use Lumi and translation while previewing the sample accounts.
    if (s && s.kind === 'admin' && (req.query.action === 'lumi' || req.query.action === 'translate')) s = { kind: 'member', user: { id: null, name: s.name, role: 'tutor' }, admin: true };
    if (!s || s.kind !== 'member') return fail(res, 401, 'Please sign in again.');
    if (r[2] && s.readOnly) return fail(res, 403, 'You’re viewing this account read-only.');
    return await r[1](req, res, s);
  } catch (e) {
    console.error('[portal]', req.query.action, e.message);
    return fail(res, 500, 'Something went wrong. Please try again.');
  }
}
