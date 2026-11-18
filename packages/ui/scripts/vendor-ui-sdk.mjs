// UI SDK ships inside this package: no second npm package to install or publish.
//
// The library's source imports UI SDK under upstream's names (`@ui-sdk/core`, `@ui-sdk/react/dialog`), which in this
// workspace are the two private packages tools/ui-sdk/build.mjs compiles from the `vendor/ui-sdk` submodule
// (packages/ui-sdk-core, packages/ui-sdk-react). The Vite build and docstream's tsc build leave those imports as they
// are. This step, the last of the build, makes dist self-contained:
//
//   1. copies the compiled fork into dist/vendor/ui-sdk/{core,react}, a module per file as upstream publishes it,
//      with its LICENSE (Apache-2.0) and a NOTICE that says where it came from and what the fork changes;
//   2. rewrites every `@ui-sdk/…` specifier in dist (`.js` and `.d.ts`, ours and the copied ones) to the relative path
//      of the file that entry points at, read from the fork's own `exports`;
//   3. fails if any import of `@ui-sdk/…` is left.
//
// The fork's private specifiers (`#dev`, `#name-check`) stay as they are: package.json `imports` (written by
// tools/registry/build.mjs) points them into dist/vendor/ui-sdk, picked by the `development` condition as upstream does.
// An app reaches the same copy at `@brett_lamy/ui/sdk/…` (src/sdk, one re-export per entry).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const repo = resolve(root, '../..');
const dist = join(root, 'dist');
const vendor = join(dist, 'vendor/ui-sdk');
const PACKAGES = ['core', 'react'];
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const wrapper = (name) => join(repo, `packages/ui-sdk-${name}`);

if (!existsSync(join(dist, 'index.js'))) throw new Error('vendor-ui-sdk: dist/ is empty; this runs at the end of `vite build`');

// 1. The compiled fork.
rmSync(vendor, { recursive: true, force: true });
for (const name of PACKAGES) {
  const from = join(wrapper(name), 'dist');
  if (!existsSync(join(from, '.fork'))) throw new Error(`vendor-ui-sdk: packages/ui-sdk-${name} is not built. Run: node tools/ui-sdk/build.mjs`);
  cpSync(from, join(vendor, name), { recursive: true, filter: (src) => !src.endsWith(`${sep}.fork`) });
}
const fork = join(repo, 'vendor/ui-sdk');
const commit = existsSync(join(fork, '.git')) ? execFileSync('git', ['-C', fork, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() : readFileSync(join(wrapper('core'), 'dist/.fork'), 'utf8').split(' ')[0];
const upstream = read(join(wrapper('core'), 'package.json')).version.replace(/\.bl\.\d+$/, '');
cpSync(join(fork, 'LICENSE'), join(vendor, 'LICENSE'));
writeFileSync(
  join(vendor, 'NOTICE.md'),
  `# UI SDK, as shipped in @brett_lamy/ui

This folder is a build of UI SDK (https://ui-sdk.dev, https://github.com/vercel-labs/ui), licensed under the
Apache License 2.0 (see LICENSE). It is not the upstream packages: it is built from the fork at
https://github.com/BLamy/ui-sdk, commit ${commit}, which is upstream ${upstream} plus three additions:

- layer hosts: an element with \`data-layer-host\` keeps the popups rendered inside it out of the top layer, placed
  against its box and modal to it alone;
- a \`when\` option on the public \`bindLayer\`;
- the kernel type \`SlotProps\`, exported from the renderer entry.

Files changed from upstream say so at the top. \`core/\` is \`@ui-sdk/core\` and \`react/\` is \`@ui-sdk/react\`, a
module per file, unbundled. Import them through this package's entries: \`@brett_lamy/ui/sdk/core\`,
\`@brett_lamy/ui/sdk/core/<entry>\`, \`@brett_lamy/ui/sdk/react/<entry>\`.
`,
);

// 2. `@ui-sdk/<package>[/<entry>]` → the file its `exports` names, in the copy.
const targets = new Map();
for (const name of PACKAGES) {
  for (const [key, target] of Object.entries(read(join(wrapper(name), 'package.json')).exports)) {
    if (key === './package.json') continue;
    const file = typeof target === 'string' ? target : target.default;
    if (typeof target === 'object' && target.types !== file.replace(/\.js$/, '.d.ts')) throw new Error(`vendor-ui-sdk: @ui-sdk/${name}${key.slice(1)} has types apart from its module (${target.types})`);
    const abs = join(vendor, name, file.replace(/^\.\/dist\//, ''));
    if (!existsSync(abs)) throw new Error(`vendor-ui-sdk: no file behind @ui-sdk/${name}${key.slice(1)} (${file})`);
    targets.set(`@ui-sdk/${name}${key === '.' ? '' : key.slice(1)}`, abs);
  }
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
// A module specifier position: `from '…'`, `import('…')`, `import '…'`, `declare module '…'`.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bmodule\s+)(["'])(@ui-sdk\/(?:core|react)(?:\/[^"']*)?)\2/g;
let files = 0;
let specifiers = 0;
const unknown = new Set();
for (const file of walk(dist)) {
  if (!/\.(m?js|d\.ts)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (!text.includes('@ui-sdk/')) continue;
  const next = text.replace(SPECIFIER, (whole, head, quote, spec) => {
    const target = targets.get(spec);
    if (!target) { unknown.add(`${relative(root, file)}: ${spec}`); return whole; }
    let path = relative(dirname(file), target).split(sep).join('/');
    if (!path.startsWith('.')) path = `./${path}`;
    specifiers++;
    return `${head}${quote}${path}${quote}`;
  });
  if (next !== text) { writeFileSync(file, next); files++; }
}
if (unknown.size) throw new Error(`vendor-ui-sdk: UI SDK has no such entry:\n  ${[...unknown].join('\n  ')}`);

// 3. Nothing in dist may still import the packages by name: they are not dependencies of the published package.
const left = [];
for (const file of walk(dist)) {
  if (!/\.(m?js|d\.ts)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (!text.includes('@ui-sdk/')) continue;
  SPECIFIER.lastIndex = 0;
  if (SPECIFIER.test(text) || /\brequire\(\s*["']@ui-sdk\//.test(text)) left.push(relative(root, file));
}
if (left.length) throw new Error(`vendor-ui-sdk: still importing @ui-sdk by name:\n  ${left.join('\n  ')}`);

const size = walk(vendor).reduce((n, f) => n + statSync(f).size, 0);
console.log(`ui-sdk vendored: ${walk(vendor).length} files (${(size / 1e6).toFixed(1)} MB) in dist/vendor/ui-sdk; ${specifiers} imports in ${files} files now point at it`);
