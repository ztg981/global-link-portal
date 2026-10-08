// LLM provider waterfall with cost-aware routing.
//
// Tiers:
//   lite  - busy-time fallback: Gemini Flash-Lite, thinking off (fastest, biggest free quota)
//   smart - default: Gemini Flash with low thinking
// Each tier tries every Gemini key in order, then the secondary provider.
// The secondary provider (OpenRouter) is restricted to ":free" models unless
// ALLOW_PAID_MODELS=1, so a fallback can never spend money.

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 15000);

const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
const keys = (...names) => names.flatMap(n => list(process.env[n]));

const OPENAI_COMPAT = {
  openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  openrouter: { base: 'https://openrouter.ai/api/v1', model: 'nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free' },
  groq: { base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  mistral: { base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
};

export const MODELS = {
  lite: () => list(process.env.GEMINI_MODEL_LITE || 'gemini-3.5-flash-lite'),
  // 3.5 Flash: same Flash family as 3.8 but far fewer 'high demand' 503s in testing.
  smart: () => list(process.env.GEMINI_MODEL_SMART || 'gemini-3.5-flash'),
};

export function buildChain(tier = 'lite', think = 'low') {
  const chain = [];
  const gKeys = keys('GEMINI_API_KEY', 'GEMINI_API_KEYS');
  // smart: try the thinking model first, then fall back to lite on the same keys.
  const models = tier === 'smart' ? [...MODELS.smart(), ...MODELS.lite()] : MODELS.lite();
  for (const model of models) for (const key of gKeys) chain.push({ provider: 'gemini', model, key, thinking: MODELS.smart().includes(model) ? think : 'minimal' });

  const p = (process.env.SECONDARY_PROVIDER || 'openrouter').toLowerCase();
  const allowPaid = process.env.ALLOW_PAID_MODELS === '1';
  for (const key of keys('SECONDARY_API_KEY', 'SECONDARY_API_KEYS')) {
    if (p === 'anthropic') {
      if (allowPaid) chain.push({ provider: 'anthropic', model: process.env.SECONDARY_MODEL || 'claude-haiku-4-5-20251001', key });
      continue;
    }
    const d = OPENAI_COMPAT[p] || {};
    const base = process.env.SECONDARY_BASE_URL || d.base;
    if (!base) continue;
    for (const model of list(process.env.SECONDARY_MODEL || d.model)) {
      // Never call a paid model by accident: OpenRouter models must be ":free".
      if (p === 'openrouter' && !model.endsWith(':free') && !allowPaid) continue;
      if (p !== 'openrouter' && !allowPaid) continue;
      chain.push({ provider: p, model, key, base });
    }
  }
  return chain;
}

async function post(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    return json;
  } finally { clearTimeout(timer); }
}

const CALLERS = {
  async gemini({ model, key, thinking }, { system, messages, maxTokens }) {
    const j = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': key }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      // Thinking tokens count toward maxOutputTokens, so the smart tier gets headroom.
      generationConfig: { maxOutputTokens: thinking === 'low' ? maxTokens + 800 : maxTokens, thinkingConfig: { thinkingLevel: thinking || 'minimal' } },
    });
    return (j.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
  },
  async anthropic({ model, key }, { system, messages, maxTokens }) {
    const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, { model, system, messages, max_tokens: maxTokens });
    return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  },
  async openai({ model, key, base }, { system, messages, maxTokens }) {
    const j = await post(`${base.replace(/\/$/, '')}/chat/completions`, { authorization: `Bearer ${key}` }, { model, max_tokens: maxTokens, temperature: 0.6, messages: [{ role: 'system', content: system }, ...messages] });
    return (j.choices?.[0]?.message?.content || '').trim();
  },
};

// Heuristic: send long or effortful questions to the thinking model.
const HARD = /\b(explain|compare|difference between|essay|step[- ]by[- ]step|solve|calculate|prove|proofread|correct (my|this)|grammar|rewrite|translate|plan (for|my)|strategy|college application|personal statement|sat question)\b|解释|比较|作文|步骤|解题|计算|修改|翻译|申请|文书/i;
export function pickTier(messages) {
  const last = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  return last.length > 280 || HARD.test(last) ? 'smart' : 'lite';
}

export async function complete(req, tier = 'lite') {
  const chain = buildChain(tier, req.thinking || 'low');
  if (!chain.length) throw new Error('No LLM API keys configured');
  const errors = [], overloaded = new Set();
  for (const link of chain) {
    // A 503 'high demand' is model-wide: don't retry the same model on another key.
    if (overloaded.has(link.provider + '/' + link.model)) continue;
    const call = CALLERS[link.provider] || CALLERS.openai;
    try {
      const text = await call(link, req);
      if (text) return { text, provider: link.provider, model: link.model, tier };
      errors.push(`${link.provider}/${link.model}: empty reply`);
    } catch (e) {
      errors.push(`${link.provider}/${link.model} …${link.key.slice(-4)}: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
      if (e.name === 'AbortError' || /HTTP 503/.test(e.message)) overloaded.add(link.provider + '/' + link.model);
    }
    console.warn('[llm] fallback after failure:', errors.at(-1));
  }
  throw new Error('All providers failed: ' + errors.join(' | '));
}
