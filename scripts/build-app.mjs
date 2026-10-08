// Builds index.html from the Claude Design export (design/Global Link App.dc.html).
//
// The design is kept 1:1. This script only:
//   - adds the web-app <head> (icons, manifest, self-hosted React, live.js, shell.js)
//   - keeps the design's sample data as the DEMO mode (Admin -> Developer accounts)
//   - adds LIVE mode: real accounts load their data from the API through live.js
//   - adds empty states for brand-new accounts and moves admin sign-in to the server
// Every patch must match exactly once (or the stated count), so a changed design
// export fails loudly instead of silently producing a broken app.
//   node scripts/build-app.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SCRIPT_PATCHES, METHODS, MODE_CODE } from './patches-script.mjs';
import { TEMPLATE_PATCHES } from './patches-template.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = readFileSync(root + 'design/Global Link App.dc.html', 'utf8');
const split = src.indexOf('<script type="text/x-dc" data-dc-script');
let tpl = src.slice(0, split), js = src.slice(split);

function apply(text, patches, where) {
  for (const p of patches) {
    const [from, to, n = 1] = p;
    const re = from instanceof RegExp;
    const count = re ? (text.match(new RegExp(from.source, 'g')) || []).length : text.split(from).length - 1;
    if (count !== n) throw new Error(`[${where}] expected ${n} match(es), found ${count}:\n  ${String(from).slice(0, 160)}`);
    text = re ? text.replace(new RegExp(from.source, 'g'), typeof to === 'function' ? to : () => to) : text.split(from).join(to);
  }
  return text;
}

// Sample data becomes swappable (DEMO <-> LIVE).
const SWAP = ['MENTORS', 'STUDENTS', 'REQS', 'TREQS', 'MDETAIL', 'PLANS', 'LIB', 'MYMATS0', 'PAST', 'GROUPS', 'EVENTS', 'POSTS', 'DATES', 'SESS', 'BOOK_SLOTS', 'TASKS', 'MSTAT', 'MATS', 'CLASSES', 'RECAPS', 'TH_S', 'TH_T', 'QS', 'SHARED', 'TQ', 'NOTIF_S', 'NOTIF_T', 'USERS', 'AUDIT0', 'MQ0', 'MOD0', 'LESSONS_A', 'TXN0', 'PKG0'];
for (const name of SWAP) {
  const from = '\nconst ' + name + '=';
  if (js.split(from).length !== 2) throw new Error('constant not found once: ' + name);
  js = js.replace(from, '\nlet ' + name + '=');
}
js = apply(js, [[
  "function initAvail(){const a={};for(let d=1;d<=5;d++)[16,17,18,19].forEach(h=>a[d+'-'+h]=1);[0,6].forEach(d=>[9,10,11,17,18,19,20].forEach(h=>a[d+'-'+h]=1));return a;}",
  "function initAvail(){const a={};for(let d=1;d<=5;d++)[16,17,18,19].forEach(h=>a[d+'-'+h]=1);[0,6].forEach(d=>[9,10,11,17,18,19,20].forEach(h=>a[d+'-'+h]=1));return a;}\n" + MODE_CODE,
], [
  "  isT(){return this.state.role==='tutor';}",
  "  isT(){return this.state.role==='tutor';}\n" + METHODS,
]], 'mode');
js = apply(js, SCRIPT_PATCHES, 'script');
tpl = apply(tpl, TEMPLATE_PATCHES, 'template');

// The DC runtime reads the template from the live DOM, where the HTML parser has
// already lowercased camelCase attributes (onChange -> onchange). In Claude Design
// it gets the source text instead; it also refetches the page to recover it, but
// only when window.__resources is unset, and we set it to self-host React. So the
// template is pre-encoded here exactly like the runtime's own encodeCase()
// (support.js, src/encode.ts) does for source text.
const RAW_WRAP = { select: 'sc-raw-select', table: 'sc-raw-table', tbody: 'sc-raw-tbody', thead: 'sc-raw-thead', tfoot: 'sc-raw-tfoot', tr: 'sc-raw-tr', td: 'sc-raw-td', th: 'sc-raw-th', caption: 'sc-raw-caption' };
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;
function encodeCase(html) {
  html = html.replace(new RegExp('<(x-import|dc-import)(' + ATTRS + ')/>', 'gi'), (_, t, a) => '<' + t + a + '></' + t + '>');
  html = html.replace(/<helmet(\s|>)/gi, '<sc-helmet$1').replace(/<\/helmet\s*>/gi, '</sc-helmet>');
  html = html.replace(/(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g, (_, sp, name, eq) => sp + 'sc-camel-' + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + eq);
  for (const [real, alias] of Object.entries(RAW_WRAP)) html = html.replace(new RegExp('(</?)' + real + '(?=[\\s>])', 'gi'), '$1' + alias);
  return html;
}
const open = tpl.indexOf('<x-dc>'), close = tpl.lastIndexOf('</x-dc>');
if (open < 0 || close < 0) throw new Error('<x-dc> block not found');
tpl = tpl.slice(0, open + 6) + encodeCase(tpl.slice(open + 6, close)) + tpl.slice(close);

writeFileSync(root + 'index.html', tpl + js);
console.log('index.html written (' + Math.round((tpl + js).length / 1024) + ' KB)');
