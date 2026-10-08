// A message from "Global Link Team" to someone, plus a push/email notification.
import { sql } from './db.js';
import { notify } from './notify.js';

export async function teamMsg(userId, text, kind = 'team', path = '/') {
  if (!userId) return;
  await sql`INSERT INTO portal_messages (sender_id, recipient_id, body) VALUES (NULL, ${userId}, ${text})`;
  await notify(userId, { kind, title: 'Global Link', body: text, path, email: kind !== 'team' });
}
