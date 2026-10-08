// Transactional email via Resend (https://resend.com). Configure RESEND_API_KEY
// and EMAIL_FROM (an address on a domain verified in Resend). Without a key,
// emails are not sent and the caller is told so (logged server-side only).
export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export async function sendEmail({ to, subject, html, text }) {
  if (!emailEnabled()) { console.warn('[email] RESEND_API_KEY not set; not sending:', subject); return false; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Global Link <onboarding@resend.dev>', to: [to], subject, html, text }),
  });
  if (!res.ok) { console.error('[email] send failed', res.status, (await res.text()).slice(0, 300)); return false; }
  return true;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function resetEmail({ name, link }) {
  const n = esc(name || 'there');
  return {
    subject: 'Reset your Global Link password',
    text: `Hi ${name || 'there'},\n\nUse this link to choose a new password (valid for 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email.\n\nGlobal Link`,
    html: `<div style="font-family:Arial,sans-serif;color:#14305e;max-width:480px"><h2 style="color:#1f6fd1">Reset your password</h2><p>Hi ${n},</p><p>Use the button below to choose a new password. The link is valid for 1 hour.</p><p><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#2f8cf3;color:#fff;text-decoration:none;font-weight:bold">Choose a new password</a></p><p style="color:#4a5b78;font-size:13px">If you didn't ask for this, you can ignore this email.</p></div>`,
  };
}
