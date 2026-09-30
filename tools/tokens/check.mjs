#!/usr/bin/env node
/* Guards the token rules in CONVENTIONS.md: component source styles itself with theme utilities, not literals.
 *
 *   node tools/tokens/check.mjs            → exit 1 on a violation that isn't in the allowlist
 *   node tools/tokens/check.mjs --update   → rewrite the allowlist (tools/tokens/allowlist.json) to today's counts
 *
 * Checked in packages/ui/src/components/**.tsx and registry/blocks/**.tsx (stories, tests and *.data files skipped):
 *   - hex / rgb() / rgba() color literals (use a theme color, or a named content constant)
 *   - arbitrary radii  rounded-[Npx]   for the values the radius scale covers (use rounded-ctl, rounded-card, …)
 *   - arbitrary sizes  text-[Npx]      for the values the text scale covers (use text-footnote, text-body, …)
 *   - arbitrary shadows shadow-[…]     for the shared hairlines (use shadow-hairline, …)
 *   - font-ios (use font-sans; the bl-theme sets --font-sans to the iOS stack)
 *
 * The allowlist stores a per-file count of violations that already exist; the check fails when a file goes over its
 * count, so the debt can only shrink. Hex colors inside a `const NAME = …` line written in UPPER_SNAKE case are
 * named content constants (brand tints, terminal inks) and are not counted.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ALLOW = join(ROOT, 'tools/tokens/allowlist.json');
const update = process.argv.includes('--update');

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.(stories|test)\./.test(name)) out.push(p);
  }
  return out;
};

const RADII = /\brounded(?:-[trbl]{1,2})?-\[(?:10|12|14|8|6|4|18)px\]/g;
const TEXT = /\btext-\[(?:11|12|13|14|15|16|17|20)px\]/g;
const SHADOW = /\bshadow-\[inset_0_(?:-1px_0|1px_0|0_0)_(?:1px_)?var\(--border\)\]/g;
const HEX = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![\w-])/g;
const RGB = /\brgba?\(/g;
const FONT = /\bfont-ios\b/g;

function count(src) {
  const lines = src.split('\n');
  const c = { color: 0, radius: 0, text: 0, shadow: 0, font: 0 };
  for (const line of lines) {
    // Named content constants: `const BRAND = '#5E5CE6'`, `TINTS = [...]`.
    if (/^\s*(export\s+)?const\s+[A-Z][A-Z0-9_]*\b/.test(line)) continue;
    if (/^\s*[A-Z][A-Z0-9_]*\s*[:=]/.test(line)) continue;
    c.color += (line.match(HEX) || []).length + (line.match(RGB) || []).length;
    c.radius += (line.match(RADII) || []).length;
    c.text += (line.match(TEXT) || []).length;
    c.shadow += (line.match(SHADOW) || []).length;
    c.font += (line.match(FONT) || []).length;
  }
  return c;
}

const files = [...walk(join(ROOT, 'packages/ui/src/components')), ...walk(join(ROOT, 'registry/blocks'))];
const current = {};
for (const f of files) {
  const c = count(readFileSync(f, 'utf8'));
  if (Object.values(c).some(Boolean)) current[relative(ROOT, f)] = c;
}

if (update) {
  writeFileSync(ALLOW, JSON.stringify(current, null, 2) + '\n');
  const total = Object.values(current).reduce((n, c) => n + Object.values(c).reduce((a, b) => a + b, 0), 0);
  console.log(`tokens: allowlist rewritten (${Object.keys(current).length} files, ${total} violations)`);
  process.exit(0);
}

const allow = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, 'utf8')) : {};
const errors = [];
for (const [file, c] of Object.entries(current)) {
  const a = allow[file] || {};
  for (const k of Object.keys(c)) {
    if (c[k] > (a[k] || 0)) errors.push(`${file}: ${c[k]} ${k} literal(s), allowed ${a[k] || 0}`);
  }
}
if (errors.length) {
  console.error(errors.map((e) => '✗ ' + e).join('\n'));
  console.error('\nUse a theme utility (see the Theming page), or a named content constant. `--update` only to record a deliberate exception.');
  process.exit(1);
}
console.log(`tokens: ${files.length} files clean`);
