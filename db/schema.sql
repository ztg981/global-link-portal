-- Global Link app (portal) tables. Created automatically by api/_lib/db.js (migrate()).
-- Runs in the SAME Neon database as the website (global-link-club), whose tables
-- users, submissions, parent_links, rate_events and password_resets are shared.
-- The portal adds one column to users:
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'; -- 'active' | 'suspended'

CREATE TABLE IF NOT EXISTS portal_profiles (      -- per-user app data
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}',              -- preferences, onboarding, availability grid, SAT tracker, saved words…
  credits INT NOT NULL DEFAULT 0, admin_note TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS portal_matches (       -- student <-> mentor
  id BIGSERIAL PRIMARY KEY, student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'proposed', -- proposed | active | declined | ended
  request_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (student_id, tutor_id));
CREATE TABLE IF NOT EXISTS portal_lessons (       -- start_at is UTC; shown in Beijing / California time
  id BIGSERIAL PRIMARY KEY, student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, tutor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL, dur_min INT NOT NULL DEFAULT 40, cls TEXT, topic TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', feedback JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS portal_messages (      -- sender/recipient NULL = the Global Link team
  id BIGSERIAL PRIMARY KEY, sender_id UUID REFERENCES users(id) ON DELETE CASCADE, recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL, mats JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS portal_questions (id BIGSERIAL PRIMARY KEY, student_id UUID, tutor_id UUID, body TEXT, kind TEXT, shared BOOLEAN, answer TEXT, answered_at TIMESTAMPTZ, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS portal_materials (id BIGSERIAL PRIMARY KEY, owner_id UUID, title TEXT, type TEXT, pack TEXT, level TEXT, blocks JSONB, status TEXT, uses INT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ); -- owner NULL = Global Link
CREATE TABLE IF NOT EXISTS portal_assignments (id BIGSERIAL PRIMARY KEY, material_id BIGINT, tutor_id UUID, student_id UUID, due TEXT, note TEXT, progress INT, opened_at TIMESTAMPTZ, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS portal_tasks (id BIGSERIAL PRIMARY KEY, student_id UUID, tutor_id UUID, title TEXT, kind TEXT, cls TEXT, due TEXT, done BOOLEAN, mats JSONB, shared_with JSONB, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS portal_posts (id BIGSERIAL PRIMARY KEY, author_id UUID, group_id TEXT, type TEXT, title TEXT, body TEXT, hidden BOOLEAN, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS portal_comments (id BIGSERIAL PRIMARY KEY, post_id BIGINT, author_id UUID, body TEXT, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS portal_likes (post_id BIGINT, user_id UUID, PRIMARY KEY (post_id, user_id));
CREATE TABLE IF NOT EXISTS portal_reports (id BIGSERIAL PRIMARY KEY, post_id BIGINT, reporter_id UUID, reason TEXT, status TEXT, created_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS portal_config (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ); -- flags, maint, announce, annHist, modRules, pkgs, reloadAt
CREATE TABLE IF NOT EXISTS portal_audit (id BIGSERIAL PRIMARY KEY, actor TEXT, action TEXT, icon TEXT, created_at TIMESTAMPTZ);
-- (Abbreviated; the exact definitions with constraints and indexes are in api/_lib/db.js.)
