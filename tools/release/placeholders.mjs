#!/usr/bin/env node
/* npm only accepts a trusted publisher for a package that already exists. For every npm package the site's library plan
   (apps/docs/src/site/libraries.ts) publishes that isn't on npm yet — the planned packages, and the UI SDK wrappers
   that publish for the first time with 6.0 — this packs a 0.0.0 placeholder (a package.json and a README pointing at
   the roadmap) and prints the one-time `npm publish` for each. It publishes nothing itself. Publish them by hand
   (logged in, with 2FA), then add BLamy/ui + publish.yml as each one's trusted publisher; the real releases come from
   CI after that.

   Libraries that ship inside another package (docstream and the editor, entries of @brett_lamy/ui) have no package of
   their own, and their old names (@brett_lamy/docstream, @brett_lamy/docstream-editor) are frozen at 2.0.1: neither
   gets a placeholder.

     node tools/release/placeholders.mjs [outDir]   (default: a fresh folder in the OS temp dir)
     node tools/release/placeholders.mjs --list     (only print which packages would get one)

   Needs Node 22.18+ (it reads libraries.ts with Node's type stripping). */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const { LIBRARIES, packageNames } = await import(join(root, 'apps/docs/src/site/libraries.ts'));

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const wanted = LIBRARIES.filter((l) => l.status !== 'live').flatMap((lib) => packageNames(lib).map((npm) => ({ lib, npm })));

const onNpm = (name) => {
  try {
    execFileSync('npm', ['view', name, 'version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

const todo = wanted.filter(({ npm }) => {
  if (!onNpm(npm)) return true;
  console.log(`✓ ${npm} is on npm: add its trusted publisher`);
  return false;
});
if (listOnly) {
  console.log(todo.length ? `\nWould pack ${todo.length} placeholders:\n${todo.map(({ npm, lib }) => `  ${npm}  (${lib.name}, ${lib.status})`).join('\n')}` : '\nEvery package in the plan is on npm already.');
  process.exit(0);
}

const out = resolve(args.find((a) => !a.startsWith('--')) ?? mkdtempSync(join(tmpdir(), 'bl-placeholders-')));
const commands = [];
for (const { lib, npm } of todo) {
  const dir = join(out, npm.replace('@brett_lamy/', ''));
  mkdirSync(dir, { recursive: true });
  const why = lib.status === 'new'
    ? `Placeholder: the first release comes with @brett_lamy/ui 6.0`
    : `Placeholder: this code ships inside @brett_lamy/ui today and becomes this package in the split`;
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: npm,
    version: '0.0.0',
    description: `${lib.tagline} ${why} — see https://blamy.github.io/ui/#/roadmap`,
    license: 'MIT',
    repository: { type: 'git', url: 'git+https://github.com/BLamy/ui.git' },
    homepage: `https://blamy.github.io/ui/#/libraries/${lib.id}`,
    publishConfig: { access: 'public' },
  }, null, 2) + '\n');
  writeFileSync(join(dir, 'README.md'), [
    `# ${npm}`,
    lib.tagline,
    lib.status === 'new'
      ? `Not released yet: the first release comes with [\`@brett_lamy/ui\`](https://www.npmjs.com/package/@brett_lamy/ui) 6.0, which depends on it.`
      : `Not released yet: this code ships inside [\`@brett_lamy/ui\`](https://www.npmjs.com/package/@brett_lamy/ui) today, and becomes its own package in the split.`,
    `See [${lib.name}](https://blamy.github.io/ui/#/libraries/${lib.id}) and [the plan](https://blamy.github.io/ui/#/roadmap).`,
  ].join('\n\n') + '\n');
  const tarball = execFileSync('npm', ['pack', '--pack-destination', out], { cwd: dir, encoding: 'utf8' }).trim().split('\n').pop();
  commands.push(`npm publish ${join(out, tarball)} --access public`);
}

console.log(commands.length ? `\nPacked ${commands.length} placeholders in ${out}. Publish each once:\n\n${commands.join('\n')}\n` : '\nEvery package in the plan is on npm already.');
