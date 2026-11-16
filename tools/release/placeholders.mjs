#!/usr/bin/env node
/* npm only accepts a trusted publisher for a package that already exists. For every planned package in the site's
   library manifest (apps/docs/src/site/libraries.ts) that isn't on npm yet, this packs a 0.0.0 placeholder — a
   package.json and a README pointing at the roadmap — and prints the one-time `npm publish` for each. Publish them
   (logged in, with 2FA), then add BLamy/ui + publish.yml as each one's trusted publisher; the split's real releases
   come from CI after that.

     node tools/release/placeholders.mjs [outDir]   (default: a fresh folder in the OS temp dir) */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const manifest = readFileSync(join(root, 'apps/docs/src/site/libraries.ts'), 'utf8');
const planned = [...manifest.matchAll(/id: '([\w-]+)', name: '([^']+)', npm: '(@brett_lamy\/[\w-]+)', category: '\w+', status: 'planned'/g)]
  .map(([, id, name, npm]) => ({ id, name, npm, tagline: new RegExp(`id: '${id}'[\\s\\S]*?tagline: '((?:[^'\\\\]|\\\\.)*)'`).exec(manifest)?.[1].replace(/\\'/g, "'") ?? '' }));

const out = resolve(process.argv[2] ?? mkdtempSync(join(tmpdir(), 'bl-placeholders-')));
const onNpm = (name) => {
  try {
    execFileSync('npm', ['view', name, 'version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

const commands = [];
for (const lib of planned) {
  if (onNpm(lib.npm)) {
    console.log(`✓ ${lib.npm} is on npm — add its trusted publisher`);
    continue;
  }
  const dir = join(out, lib.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: lib.npm,
    version: '0.0.0',
    description: `${lib.tagline} Placeholder: this package is coming out of @brett_lamy/ui — see https://blamy.github.io/ui/#/roadmap`,
    license: 'MIT',
    repository: { type: 'git', url: 'git+https://github.com/BLamy/ui.git', directory: `packages/${lib.id}` },
    homepage: `https://blamy.github.io/ui/#/libraries/${lib.id}`,
    publishConfig: { access: 'public' },
  }, null, 2) + '\n');
  writeFileSync(join(dir, 'README.md'), `# ${lib.npm}\n\n${lib.tagline}\n\nNot released yet: this code ships inside [\`@brett_lamy/ui\`](https://www.npmjs.com/package/@brett_lamy/ui) today, and becomes its own package in the split — see [the plan](https://blamy.github.io/ui/#/roadmap) and [${lib.name}](https://blamy.github.io/ui/#/libraries/${lib.id}).\n`);
  const tarball = execFileSync('npm', ['pack', '--pack-destination', out], { cwd: dir, encoding: 'utf8' }).trim().split('\n').pop();
  commands.push(`npm publish ${join(out, tarball)} --access public`);
}

console.log(commands.length ? `\nPacked ${commands.length} placeholders in ${out}. Publish each once:\n\n${commands.join('\n')}\n` : '\nEvery planned package is on npm already.');
