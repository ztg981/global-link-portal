// Local development only: creates a test student and mentor in the local
// database (PGlite in .pglite/), like signing up on globallink.com would.
//   PGLITE_DIR=.pglite node scripts/seed-dev.mjs
import { hashPassword } from '../api/_lib/auth.js';
import { sql } from '../api/_lib/db.js';
if (process.env.DATABASE_URL) { console.error('Refusing to seed a real database.'); process.exit(1); }
const pw = await hashPassword('password123');
for (const [username, name, role] of [['test_student', 'Ava Chen', 'student'], ['test_mentor', 'Sam Lee', 'tutor'], ['test_student2', 'Leo Wang', 'student']]) {
  await sql`INSERT INTO users (email, username, name, role, password_hash) VALUES (${username + '@example.org'}, ${username}, ${name}, ${role}, ${pw}) ON CONFLICT (email) DO NOTHING`;
}
console.log('Seeded test_student / test_mentor / test_student2 (password: password123)');
process.exit(0);
