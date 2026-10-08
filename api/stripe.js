// POST /api/stripe - Stripe webhook (checkout.session.completed).
// The event is re-fetched from Stripe by id with our secret key, so a forged
// request can't add credits; the success redirect settles payments too, so this
// is a backup for people who close the tab before returning to the app.
import { stripeEvent, settleCheckout } from './_lib/payments.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe is not configured' });
  try {
    const raw = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(String(req.body || '{}'));
    const ev = await stripeEvent(raw && raw.id);
    if (ev && ev.type === 'checkout.session.completed' && ev.data && ev.data.object) await settleCheckout(ev.data.object.id);
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('[stripe]', e.message);
    return res.status(400).json({ error: 'Bad event' });
  }
}
