// Copy the almost-node service worker into public/ so the static Pages build
// serves it at <base>/__sw__.js (the vite plugin only serves it in dev).
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The bundled runtime references its web workers as root-absolute
// "/assets/<worker>.js" URLs; Vite resolves those against public/. Copy them
// so the worker entries resolve at build time and ship with the site.
import { readdirSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'node_modules', '@agent-wasm', 'core', 'dist', '__sw__.js');
const dest = path.join(here, '..', 'public', '__sw__.js');
mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log('copied __sw__.js -> public/');
const assetsSrc = path.join(here, '..', 'node_modules', '@agent-wasm', 'core', 'dist', 'assets');
const assetsDest = path.join(here, '..', 'public', 'assets');
mkdirSync(assetsDest, { recursive: true });
for (const f of readdirSync(assetsSrc)) {
  copyFileSync(path.join(assetsSrc, f), path.join(assetsDest, f));
  console.log(`copied assets/${f} -> public/assets/`);
}
