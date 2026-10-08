// Scheduled jobs, run every 10 minutes by .github/workflows/cron.yml (and daily
// by Vercel Cron as a backup). Requires Authorization: Bearer <CRON_SECRET>.
//  - lesson reminders a day before and 15 minutes before (push + email)
//  - lessons that ended are marked done
//  - questions with no answer after 72 hours: the student is told it doesn't count
//  - stale WeChat payment requests expire after 14 days
import { timingSafeEqual } from 'node:crypto';
import { sql } from './_lib/db.js';
import { notify } from './_lib/notify.js';
import { BJ, CA, parts } from './_lib/time.js';

const clock = (ms, tz) => { const p = parts(ms, tz), h = p.h % 12 || 12; return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.dow] + ' ' + h + ':' + String(p.mi).padStart(2, '0') + ' ' + (p.h >= 12 ? 'PM' : 'AM'); };

function authorized(req) {
  const want = process.env.CRON_SECRET || '';
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return want.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  const out = { reminders: 0, done: 0, expired: 0, payments: 0 };
  try {
    const soon = await sql`SELECT l.*, s.name AS sn, t.name AS tn FROM portal_lessons l JOIN users s ON s.id = l.student_id LEFT JOIN users t ON t.id = l.tutor_id
      WHERE l.status = 'scheduled' AND l.start_at > now() AND l.start_at < now() + interval '24 hours'`;
    for (const l of soon) {
      const start = new Date(l.start_at).getTime(), mins = (start - Date.now()) / 60000, r = l.reminded || {};
      const key = mins <= 16 ? 'm15' : mins >= 120 ? 'd1' : null;
      if (!key || r[key]) continue;
      await sql`UPDATE portal_lessons SET reminded = reminded || ${JSON.stringify({ [key]: true })}::jsonb WHERE id = ${l.id}`;
      const when = key === 'm15' ? 'in 15 minutes' : 'tomorrow';
      await notify(l.student_id, { kind: 'reminder', title: 'Lesson ' + when, body: l.cls + ' with ' + (l.tn || 'your mentor') + ' · ' + clock(start, BJ) + ' Beijing time', path: '/#/schedule', email: key === 'd1' });
      if (l.tutor_id) await notify(l.tutor_id, { kind: 'reminder', title: 'Lesson ' + when, body: l.cls + ' with ' + l.sn + ' · ' + clock(start, CA) + ' California time', path: '/#/schedule', email: key === 'd1' });
      out.reminders++;
    }
    out.done = (await sql`UPDATE portal_lessons SET status = 'done' WHERE status = 'scheduled' AND start_at + make_interval(mins => dur_min) < now() - interval '30 minutes' RETURNING id`).length;
    const late = await sql`UPDATE portal_questions SET expired = true WHERE answer IS NULL AND NOT expired AND created_at < now() - interval '72 hours' RETURNING student_id, body`;
    for (const q of late) await notify(q.student_id, { kind: 'reply', title: 'No reply yet', body: 'Nobody answered “' + q.body.slice(0, 80) + '” within 3 days, so it doesn’t count toward your plan. Try asking another mentor.', path: '/#/ask' });
    out.expired = late.length;
    out.payments = (await sql`UPDATE portal_payments SET status = 'expired' WHERE status = 'pending' AND created_at < now() - interval '14 days' RETURNING id`).length;
    if (Math.random() < 0.2) await sql`DELETE FROM oauth_pending WHERE expires_at < now() - interval '1 day'`;
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    console.error('[cron]', e.message);
    return res.status(500).json({ error: 'Cron failed' });
  }
}
