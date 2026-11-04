#!/usr/bin/env node
/* Looks through what the package ships, for two things that have to stay true of the Cloudflare parts.
 *
 *   node tools/cloudflare/check-package.mjs     (after a build, as it reads packages/ui/dist)
 *
 * 1. The catalog's only on its own entry: dist/index.js can't reach it, and dist/cloudflare.js can.
 * 2. There's no Cloudflare artwork anywhere: every image in the package, the registry and the docs' demos is compared with the
 *    images in Cloudflare's docs at the pinned ref, by hash, and every text file's searched for their SVG paths. A Cloudflare part's
 *    source mustn't draw any image at all. It fetches what it compares with once, into the generator's cache.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS_REF = '5c2ac2bf064c2b8de82fdcd6f28d245b064f8da4';
const SCRATCH = process.env.CATALOG_CACHE ?? join(ROOT, 'node_modules/.cache/cloudflare-catalog');
const UPSTREAM = [['src/icons', () => true], ['src/assets', (name) => /logo|cloudflare/i.test(name)]];
const WHERE = ['packages/ui/dist', 'packages/ui/src', 'registry', 'apps/docs/examples/cloudflare-diagram', 'apps/docs/public/r'];
const IMAGE = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif']);
const OWN_SOURCES = /^(cloudflare(\.|-)|.*\/cloudflare(-[a-z-]+)?(\.[a-z.]+)$)/;

const gitBlob = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const findings = [];

/* ── 1. What can reach the catalog ── */

function reaches(entry, what) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    if (basename(file) === what) return true;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g)) queue.push(resolve(dirname(file), m[1]));
  }
  return false;
}

const DIST = join(ROOT, 'packages/ui/dist');
if (!existsSync(join(DIST, 'index.js'))) findings.push('packages/ui/dist/index.js is missing: build first');
else {
  if (reaches(join(DIST, 'index.js'), 'cloudflare-catalog.generated.js')) findings.push('the main entry can reach the catalog');
  if (!existsSync(join(DIST, 'cloudflare.js'))) findings.push('packages/ui/dist/cloudflare.js is missing');
  else if (!reaches(join(DIST, 'cloudflare.js'), 'cloudflare-catalog.generated.js')) findings.push('@brett_lamy/ui/cloudflare can’t reach the catalog');
}

/* ── 2. Cloudflare's own images ── */

const cache = join(SCRATCH, 'artwork');
mkdirSync(cache, { recursive: true });
async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'cloudflare-catalog-generator', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : null) } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
const blobs = new Set();
const paths = new Set();
let upstreamFiles = 0;
for (const [dir, wanted] of UPSTREAM) {
  const listing = join(cache, `${dir.replaceAll('/', '__')}.json`);
  if (!existsSync(listing)) writeFileSync(listing, await get(`https://api.github.com/repos/cloudflare/cloudflare-docs/contents/${dir}?ref=${DOCS_REF}`));
  const files = JSON.parse(readFileSync(listing, 'utf8')).filter((f) => f.type === 'file' && wanted(f.name) && IMAGE.has(extname(f.name).toLowerCase()));
  const queue = [...files];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const file = join(cache, f.sha);
      if (!existsSync(file)) writeFileSync(file, await get(`https://raw.githubusercontent.com/cloudflare/cloudflare-docs/${DOCS_REF}/${dir}/${f.name}`));
    }
  }));
  for (const f of files) {
    upstreamFiles++;
    blobs.add(f.sha);
    if (extname(f.name).toLowerCase() === '.svg') {
      // Paths short enough to turn up by chance, like a simple square, say nothing.
      for (const m of readFileSync(join(cache, f.sha), 'utf8').matchAll(/\bd="([^"]{40,})"/g)) paths.add(m[1]);
    }
  }
}

/* ── Looking ── */

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const file = join(dir, name);
    if (statSync(file).isDirectory()) yield* walk(file);
    else yield file;
  }
}
let looked = 0, images = 0;
const TEXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.css', '.html', '.md', '.map', '.svg']);
for (const dir of WHERE) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file), ext = extname(file).toLowerCase();
    if (rel.endsWith('.stories.tsx') && !rel.includes('cloudflare')) continue;
    looked++;
    const buf = readFileSync(file);
    if (IMAGE.has(ext)) {
      images++;
      if (blobs.has(gitBlob(buf))) findings.push(`${rel} is one of Cloudflare’s images`);
      if (/cloudflare|workers?-logo/i.test(basename(file))) findings.push(`${rel} is an image with Cloudflare’s name on it`);
    }
    if (!TEXT.has(ext)) continue;
    const text = buf.toString('utf8');
    for (const d of paths) if (text.includes(d)) { findings.push(`${rel} has a path from Cloudflare’s artwork: ${d.slice(0, 40)}…`); break; }
    if (OWN_SOURCES.test(basename(file)) && rel.startsWith('packages/ui/src') && !rel.endsWith('.generated.ts') && !rel.includes('.test.')) {
      const drawn = /<svg\b|<img\b|<image\b|data:image|\.(svg|png|jpe?g|webp|gif)\b|background-image|\bbg-\[url/i.exec(text);
      if (drawn) findings.push(`${rel} draws an image of its own: ${drawn[0]}`);
    }
  }
}

console.log(`looked at ${looked} files, ${images} of them images, against ${upstreamFiles} images of Cloudflare's, with ${paths.size} paths`);
if (findings.length) {
  for (const f of findings) console.error(`  ${f}`);
  console.error(`${findings.length} problem${findings.length === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log('the catalog is only on its own entry, and there is no Cloudflare artwork');
