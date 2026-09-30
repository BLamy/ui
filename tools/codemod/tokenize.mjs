#!/usr/bin/env node
/* Replaces arbitrary Tailwind values with the theme's tokens (tokens.css), value for value, so the output is unchanged:
 *
 *   node tools/codemod/tokenize.mjs [--dry]
 *
 *   rounded-[10px|12px|14px|18px]   → rounded-ctl | rounded-panel | rounded-card | rounded-sheet   (multiples of --radius)
 *   rounded-[8px|6px|4px]           → rounded-lg | rounded-md | rounded-sm
 *   text-[11..20px]                 → text-caption2 … text-title                                   (font-size only)
 *   shadow-[inset_0_…_var(--border)]→ shadow-hairline | shadow-hairline-t | shadow-hairline-b
 *   min-h-/h-[46px|52px]            → h-row | h-toolbar
 *   font-ios                        → font-sans
 * Runs over library components and blocks (not stories or tests).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dry = process.argv.includes('--dry');

const RADIUS = { 10: 'ctl', 12: 'panel', 14: 'card', 18: 'sheet', 8: 'lg', 6: 'md', 4: 'sm' };
const TEXT = { 11: 'caption2', 12: 'caption', 13: 'footnote', 14: 'detail', 15: 'subhead', 16: 'callout', 17: 'body', 20: 'title' };
const SHADOW = {
  'inset_0_0_0_1px_var(--border)': 'hairline',
  'inset_0_1px_0_var(--border)': 'hairline-t',
  'inset_0_-1px_0_var(--border)': 'hairline-b',
};
const HEIGHT = { 46: 'row', 52: 'toolbar' };

const rules = [
  [/\b(rounded(?:-[trbl]{1,2}|-(?:tl|tr|bl|br|ss|se|es|ee))?)-\[(\d+)px\]/g, (m, p, n) => (RADIUS[n] ? `${p}-${RADIUS[n]}` : m)],
  [/\btext-\[(\d+)px\]/g, (m, n) => (TEXT[n] ? `text-${TEXT[n]}` : m)],
  [/\bshadow-\[([^\]]+)\]/g, (m, v) => (SHADOW[v] ? `shadow-${SHADOW[v]}` : m)],
  [/\b(min-h|h|max-h)-\[(\d+)px\]/g, (m, p, n) => (HEIGHT[n] ? `${p}-${HEIGHT[n]}` : m)],
  [/\bfont-ios\b/g, () => 'font-sans'],
];

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.(stories|test)\./.test(name)) out.push(p);
  }
  return out;
};

let files = 0;
let changes = 0;
for (const file of [...walk(join(ROOT, 'packages/ui/src/components')), ...walk(join(ROOT, 'registry/blocks'))]) {
  const src = readFileSync(file, 'utf8');
  let out = src;
  for (const [re, fn] of rules) out = out.replace(re, (...a) => { const r = fn(...a); if (r !== a[0]) changes++; return r; });
  if (out !== src) {
    files++;
    if (!dry) writeFileSync(file, out);
  }
}
console.log(`${dry ? 'would rewrite' : 'rewrote'} ${changes} values in ${files} files`);
