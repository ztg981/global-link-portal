// Fails if a secret-looking value is in a file git would publish.
//   npm run security:scan
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(f => f && !/\.(png|jpg|ico|icns)$/.test(f));
const RULES = [
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}/], ['Google key (AQ.)', /\bAQ\.[A-Za-z0-9_-]{30,}/], ['OpenRouter key', /\bsk-or-v1-[a-f0-9]{20,}/],
  ['Anthropic/OpenAI key', /\bsk-(ant-)?[A-Za-z0-9_-]{32,}/], ['Neon password', /\bnpg_[A-Za-z0-9]{10,}/], ['Postgres URL with password', /postgres(ql)?:\/\/[^\s:'"@]+:[^\s'"@]{6,}@/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/], ['scrypt hash', /scrypt\$\d+\$[A-Za-z0-9+/=]{16,}\$/], ['admin password', new RegExp('aurence' + 'iscute')],
];
let bad = 0;
for (const f of files) {
  let text; try { text = readFileSync(f, 'utf8'); } catch { continue; }
  for (const [name, re] of RULES) if (re.test(text)) { console.error(`✖ ${name} in ${f}`); bad++; }
}
if (bad) { console.error(`\n${bad} possible secret(s). Move them to environment variables.`); process.exit(1); }
console.log(`✔ No secrets in ${files.length} files`);
