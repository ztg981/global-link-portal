// Notifications: Web Push (phones with the home-screen app, desktop browsers)
// and email (Resend). Both are optional: without VAPID keys or RESEND_API_KEY
// the call quietly does nothing. People choose which kinds they get in
// Settings -> Notifications (portal_profiles.state.notifPrefs).
import webpush from 'web-push';
import { sql } from './db.js';
import { sendEmail } from './email.js';

const APP = () => (process.env.APP_URL || 'https://global-link-portal.vercel.app').replace(/\/$/, '');
let vapidReady = null;
function vapid() {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  vapidReady = !!(pub && priv);
  if (vapidReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@globallink.com', pub, priv);
  return vapidReady;
}
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';

// kind: 'msgs' (messages), 'remind' (lessons), 'replies' (answers, matches)
const PREF = { message: 'msgs', lesson: 'remind', reminder: 'remind', reply: 'replies', match: 'replies', team: 'msgs' };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function notify(userId, { kind = 'message', title, body, path = '/', email = false, emailSubject }) {
  if (!userId) return;
  try {
    const [p] = await sql`SELECT u.email, u.name, u.status, p.state->'notifPrefs' AS prefs, p.last_seen_at, p.emailed_at FROM users u LEFT JOIN portal_profiles p ON p.user_id = u.id WHERE u.id = ${userId}`;
    if (!p || p.status === 'suspended') return;
    const prefs = { remind: true, msgs: true, replies: true, ...(p.prefs || {}) };
    if (prefs[PREF[kind] || 'msgs'] === false) return;
    if (vapid()) {
      const subs = await sql`SELECT id, endpoint, p256dh, auth FROM portal_push WHERE user_id = ${userId}`;
      const payload = JSON.stringify({ title, body: String(body || '').slice(0, 180), url: APP() + path, tag: kind });
      await Promise.all(subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 })
        .catch(async e => { if (e.statusCode === 404 || e.statusCode === 410) await sql`DELETE FROM portal_push WHERE id = ${s.id}`; })));
    }
    // Email only when asked for, and not more than once every 30 minutes for chat-like events.
    const away = !p.last_seen_at || Date.now() - new Date(p.last_seen_at).getTime() > 10 * 60000;
    const recent = p.emailed_at && Date.now() - new Date(p.emailed_at).getTime() < 30 * 60000;
    if (email && process.env.RESEND_API_KEY && (kind === 'reminder' || (away && !recent))) {
      const ok = await sendEmail({
        to: p.email, subject: emailSubject || title,
        text: `Hi ${p.name},\n\n${body}\n\nOpen Global Link: ${APP()}${path}\n\nYou can turn these emails off in Settings → Notifications.`,
        html: `<div style="font-family:Arial,sans-serif;color:#14305e;max-width:480px"><h2 style="color:#1f6fd1;font-size:20px">${esc(title)}</h2><p>Hi ${esc(p.name)},</p><p>${esc(body)}</p><p><a href="${esc(APP() + path)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#2f8cf3;color:#fff;text-decoration:none;font-weight:bold">Open Global Link</a></p><p style="color:#4a5b78;font-size:12px">You can turn these emails off in Settings → Notifications.</p></div>`,
      });
      if (ok) await sql`UPDATE portal_profiles SET emailed_at = now() WHERE user_id = ${userId}`;
    }
  } catch (e) { console.error('[notify]', e.message); }
}
