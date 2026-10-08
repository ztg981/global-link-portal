// Database access for the portal.
//
// Production: the SAME Neon Postgres database as the globallink.com website
// (DATABASE_URL), so accounts, mentor requests and bookings made on the
// website show up here. Local dev without DATABASE_URL: an in-process Postgres
// (PGlite) so there is one code path, not a separate in-memory store.
//
// Every query is a parameterized tagged template: sql`SELECT ... ${value}`.
// The connection string is server-only and never reaches the browser.
import { neon } from '@neondatabase/serverless';

let run, ready;

async function connect() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const q = neon(url);
    return (strings, ...vals) => q(strings, ...vals);
  }
  if (process.env.VERCEL) throw new Error('DATABASE_URL is not configured');
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || undefined; // undefined = in-memory
  const db = new PGlite(dir);
  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto').catch(() => {});
  return async (strings, ...vals) => {
    let text = '';
    strings.forEach((s, i) => { text += s + (i < vals.length ? '$' + (i + 1) : ''); });
    const r = await db.query(text, vals.map(v => (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) ? JSON.stringify(v) : v)));
    return r.rows;
  };
}

// sql`...` -> rows. Migrations run once per cold start.
export async function sql(strings, ...vals) {
  if (!run) run = connect();
  const q = await run;
  if (!ready) ready = migrate(q).catch(e => { ready = null; throw e; });
  await ready;
  return q(strings, ...vals);
}

// Tables shared with the website are created with the same definitions it
// uses (site/api/_lib/store.js in global-link-club), so either app can start
// first against an empty database. Portal-only tables are prefixed portal_.
async function migrate(q) {
  // ---- shared with globallink.com ----
  await q`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'parent', 'tutor')),
    password_hash TEXT NOT NULL,
    student_name TEXT,
    lang TEXT NOT NULL DEFAULT 'en',
    time_zone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
  )`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT`;
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username) WHERE username IS NOT NULL`;
  await q`CREATE TABLE IF NOT EXISTS submissions (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    data JSONB NOT NULL,
    email TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL`;
  await q`CREATE INDEX IF NOT EXISTS submissions_type_created ON submissions (type, created_at DESC)`;
  await q`CREATE INDEX IF NOT EXISTS submissions_user ON submissions (user_id, created_at DESC)`;
  await q`CREATE TABLE IF NOT EXISTS parent_links (
    id BIGSERIAL PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    UNIQUE (parent_id, student_id)
  )`;
  await q`CREATE TABLE IF NOT EXISTS rate_events (
    bucket TEXT NOT NULL,
    key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS rate_events_lookup ON rate_events (bucket, key, created_at)`;
  await q`CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  )`;

  // ---- portal ----
  await q`CREATE TABLE IF NOT EXISTS portal_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state JSONB NOT NULL DEFAULT '{}',
    credits INT NOT NULL DEFAULT 0,
    admin_note TEXT NOT NULL DEFAULT '',
    last_seen_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_matches (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'declined', 'ended')),
    request_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, tutor_id)
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_lessons (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tutor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    start_at TIMESTAMPTZ NOT NULL,
    dur_min INT NOT NULL DEFAULT 40,
    cls TEXT NOT NULL DEFAULT 'English Conversation',
    topic TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'done', 'no_show')),
    feedback JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS portal_lessons_student ON portal_lessons (student_id, start_at)`;
  await q`CREATE INDEX IF NOT EXISTS portal_lessons_tutor ON portal_lessons (tutor_id, start_at)`;
  // sender/recipient NULL = the Global Link team.
  await q`CREATE TABLE IF NOT EXISTS portal_messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    mats JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
  )`;
  await q`CREATE INDEX IF NOT EXISTS portal_messages_rcpt ON portal_messages (recipient_id, created_at)`;
  await q`CREATE INDEX IF NOT EXISTS portal_messages_sender ON portal_messages (sender_id, created_at)`;
  await q`CREATE TABLE IF NOT EXISTS portal_questions (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text',
    shared BOOLEAN NOT NULL DEFAULT false,
    answer TEXT,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // owner_id NULL = made by Global Link (admin studio).
  await q`CREATE TABLE IF NOT EXISTS portal_materials (
    id BIGSERIAL PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Lesson plan',
    pack TEXT NOT NULL DEFAULT 'free',
    level TEXT NOT NULL DEFAULT 'Intermediate',
    blocks JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'Private',
    uses INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_assignments (
    id BIGSERIAL PRIMARY KEY,
    material_id BIGINT NOT NULL REFERENCES portal_materials(id) ON DELETE CASCADE,
    tutor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    progress INT NOT NULL DEFAULT 0,
    opened_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_tasks (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tutor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'Practice',
    cls TEXT NOT NULL DEFAULT 'Personal',
    due TEXT NOT NULL DEFAULT '',
    done BOOLEAN NOT NULL DEFAULT false,
    mats JSONB NOT NULL DEFAULT '[]',
    shared_with JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_posts (
    id BIGSERIAL PRIMARY KEY,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Discussion',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES portal_posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_likes (
    post_id BIGINT NOT NULL REFERENCES portal_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_reports (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES portal_posts(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT 'Other',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, reporter_id)
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS portal_audit (
    id BIGSERIAL PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'check',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}

// Records one rate-limit event and returns how many this key had in the window.
export async function hit(bucket, key, windowSec) {
  const [{ n }] = await sql`WITH ins AS (INSERT INTO rate_events (bucket, key) VALUES (${bucket}, ${key}))
    SELECT count(*)::int + 1 AS n FROM rate_events WHERE bucket = ${bucket} AND key = ${key} AND created_at > now() - make_interval(secs => ${windowSec})`;
  if (Math.random() < 0.02) await sql`DELETE FROM rate_events WHERE created_at < now() - interval '2 days'`;
  return n;
}
export async function count(bucket, key, windowSec) {
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM rate_events WHERE bucket = ${bucket} AND key = ${key} AND created_at > now() - make_interval(secs => ${windowSec})`;
  return n;
}

export async function findUserById(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return null;
  const [u] = await sql`SELECT * FROM users WHERE id = ${id}`;
  return u || null;
}

export async function getConfig(key, fallback) {
  const [r] = await sql`SELECT value FROM portal_config WHERE key = ${key}`;
  return r ? r.value : fallback;
}
export async function setConfig(key, value) {
  await sql`INSERT INTO portal_config (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}
export async function audit(actor, action, icon) {
  await sql`INSERT INTO portal_audit (actor, action, icon) VALUES (${actor}, ${String(action).slice(0, 300)}, ${icon || 'check'})`;
}
