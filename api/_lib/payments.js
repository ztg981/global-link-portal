// Plan packs, payments and Stripe.
//
// Most families pay Global Link on WeChat; the team then records the payment in
// Admin -> Payments, which adds lesson credits. Paying in the app goes through
// Stripe Checkout (card, Alipay, WeChat Pay) when STRIPE_SECRET_KEY is set.
// Direct WeChat Pay / Alipay merchant accounts are placeholders until there is a
// Chinese business license. Prices are in yuan.
import { sql, getConfig, addCredits, audit } from './db.js';
import { teamMsg } from './team.js';

export const DEFAULT_PKGS = [
  { id: 'p1', name: 'Free intro lesson', price: '0', on: true, credits: 1, packs: ['free'] },
  { id: 'p2', name: 'Conversation 5-pack', price: '1250', on: true, credits: 5, packs: ['conv'] },
  { id: 'p3', name: 'Conversation 10-pack', price: '2300', on: true, credits: 10, packs: ['conv'] },
  { id: 'p4', name: 'IELTS Speaking 12-pack', price: '3480', on: true, credits: 12, packs: ['conv', 'ielts'] },
  { id: 'p5', name: 'Pronunciation add-on', price: '480', on: true, credits: 5, packs: ['pron'] },
  { id: 'p6', name: 'SAT Math 10-pack', price: '2900', on: false, credits: 10, packs: ['sat'] },
];
// Credits a pack gives: the configured number, else the number in its name ("5-pack").
export const packCredits = p => Number(p.credits) || Number((/(\d+)-pack/.exec(p.name) || [])[1]) || 1;
export async function packages() {
  const saved = await getConfig('pkgs', DEFAULT_PKGS);
  return saved.map(p => ({ ...(DEFAULT_PKGS.find(d => d.id === p.id) || {}), ...p, credits: packCredits(p) }));
}
export const payInfo = () => ({
  wechatId: process.env.WECHAT_PAY_ID || '', // shown on the pay screen once set
  stripe: !!process.env.STRIPE_SECRET_KEY,
  // Placeholders until merchant accounts exist.
  wechatPay: !!process.env.WECHAT_PAY_MCH_ID, alipay: !!process.env.ALIPAY_APP_ID,
});

// Marks a payment paid (once) and adds its credits and packs.
export async function markPaid(paymentId, actor) {
  const [p] = await sql`UPDATE portal_payments SET status = 'paid', paid_at = now() WHERE id = ${paymentId} AND status <> 'paid' AND status <> 'refunded' RETURNING *`;
  if (!p) return null;
  if (p.user_id) {
    if (p.credits) await addCredits(p.user_id, p.credits, 'Bought ' + p.name, 'pay:' + p.id);
    const pk = (await packages()).find(x => x.id === p.pack_id);
    if (pk && pk.packs) await sql`UPDATE portal_profiles SET packs = (SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(packs || ${JSON.stringify(pk.packs)}::jsonb) x) WHERE user_id = ${p.user_id}`;
    await teamMsg(p.user_id, `Payment received for ${p.name}. ${p.credits} lesson credit${p.credits === 1 ? '' : 's'} added. Thank you!`);
  }
  if (actor) await audit(actor, 'Recorded payment: ' + p.name + ' (¥' + p.amount + ')', 'wallet');
  return p;
}

// ---- Stripe (REST, no SDK) ----
async function stripe(path, params, method = 'POST') {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method, headers: { authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? new URLSearchParams(params) : undefined,
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error(j.error?.message || 'Stripe error'); e.status = r.status; throw e; }
  return j;
}
export async function createCheckout({ user, pack, appUrl }) {
  const amount = Math.round(Number(pack.price) * 100);
  const [p] = await sql`INSERT INTO portal_payments (user_id, pack_id, name, amount, credits, method, status) VALUES (${user.id}, ${pack.id}, ${pack.name}, ${Number(pack.price)}, ${pack.credits}, 'stripe', 'pending') RETURNING id`;
  const base = { mode: 'payment', success_url: appUrl + '/?paid={CHECKOUT_SESSION_ID}', cancel_url: appUrl + '/?paid=cancelled', customer_email: user.email, client_reference_id: String(p.id),
    'metadata[payment_id]': String(p.id), 'metadata[user_id]': user.id, 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': (process.env.STRIPE_CURRENCY || 'cny').toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(amount), 'line_items[0][price_data][product_data][name]': 'Global Link · ' + pack.name };
  const methods = String(process.env.STRIPE_METHODS || 'card,alipay,wechat_pay').split(',').map(s => s.trim()).filter(Boolean);
  const withMethods = m => ({ ...base, ...Object.fromEntries(m.map((x, i) => ['payment_method_types[' + i + ']', x])), ...(m.includes('wechat_pay') ? { 'payment_method_options[wechat_pay][client]': 'web' } : {}) });
  let session;
  try { session = await stripe('checkout/sessions', withMethods(methods)); }
  catch (e) { session = await stripe('checkout/sessions', withMethods(['card'])); } // a method the account can't use yet
  await sql`UPDATE portal_payments SET ref = ${session.id} WHERE id = ${p.id}`;
  return session.url;
}
// Records a completed Checkout session (from the success redirect or the webhook).
export async function settleCheckout(sessionId) {
  if (!process.env.STRIPE_SECRET_KEY || !/^cs_[A-Za-z0-9_]+$/.test(String(sessionId))) return null;
  const s = await stripe('checkout/sessions/' + sessionId, null, 'GET');
  if (s.payment_status !== 'paid') return { paid: false };
  const [p] = await sql`SELECT id FROM portal_payments WHERE ref = ${s.id}`;
  if (!p) return null;
  await sql`UPDATE portal_payments SET note = ${s.payment_intent || ''} WHERE id = ${p.id}`;
  await markPaid(p.id);
  return { paid: true };
}
export async function stripeRefund(payment) {
  if (!process.env.STRIPE_SECRET_KEY || payment.method !== 'stripe' || !payment.note) return;
  await stripe('refunds', { payment_intent: payment.note });
}
export async function stripeEvent(id) {
  if (!/^evt_[A-Za-z0-9]+$/.test(String(id))) return null;
  return stripe('events/' + id, null, 'GET'); // re-fetched from Stripe, so it can't be forged
}
