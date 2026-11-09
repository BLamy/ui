// public/assets/* exist only so Vite can resolve the runtime's root-absolute
// worker URLs at build time; Vite emits its own rebundled (hashed) copies with
// base-aware URLs. Drop the verbatim public passthrough from dist to halve it.
import { readdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public', 'assets');
const dist = path.join(here, '..', 'dist', 'assets');
if (existsSync(pub) && existsSync(dist)) {
  for (const f of readdirSync(pub)) {
    const target = path.join(dist, f);
    if (existsSync(target)) {
      rmSync(target);
      console.log(`pruned dist/assets/${f}`);
    }
  }
}
