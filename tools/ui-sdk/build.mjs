// Builds the UI SDK fork (the `vendor/ui-sdk` submodule) into the two packages that publish it under our scope:
//
//   vendor/ui-sdk/packages/core   →  packages/ui-sdk-core    (@brett_lamy/ui-sdk-core)
//   vendor/ui-sdk/packages/react  →  packages/ui-sdk-react   (@brett_lamy/ui-sdk-react)
//
// Everything in this workspace imports them as `@ui-sdk/core` and `@ui-sdk/react` (npm aliases), so source
// reads exactly like upstream's docs and the fork stays a small diff. The fork's own package.json files are
// never edited for this: each wrapper's manifest is generated from the fork's `publishConfig`.
//
//   node tools/ui-sdk/build.mjs              Build both, always.
//   node tools/ui-sdk/build.mjs --if-stale   Build only when the fork changed since the last build (postinstall).
//   node tools/ui-sdk/build.mjs --check      Fail when a committed wrapper manifest is out of date (CI).
//   node tools/ui-sdk/build.mjs --docs       Also write the Markdown docs each package ships (needs the fork's
//                                            own `pnpm install`; the release runs this).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const fork = path.join(root, 'vendor/ui-sdk');
const args = new Set(process.argv.slice(2));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const { revision } = read(path.join(import.meta.dirname, 'fork.json'));

const PACKAGES = ['core', 'react'];
const wrapperDir = (name) => path.join(root, `packages/ui-sdk-${name}`);
const forkDir = (name) => path.join(fork, 'packages', name);
const wrapperName = (name) => `@brett_lamy/ui-sdk-${name}`;

if (!existsSync(path.join(forkDir('core'), 'package.json'))) {
  console.error('vendor/ui-sdk is empty. Run: git submodule update --init');
  process.exit(args.has('--if-stale') ? 0 : 1);
}

/** The wrapper's package.json: the fork's published shape, under our name. */
function manifest(name) {
  const src = read(path.join(forkDir(name), 'package.json'));
  const { exports, imports } = src.publishConfig ?? {};
  // The adapter needs the core it was built with, so it depends on it (as the alias) rather than peering on
  // upstream's `@ui-sdk/core`, which would install a core without the fork's additions.
  const peers = { ...src.peerDependencies };
  const dependencies = { ...src.dependencies };
  for (const dep of Object.keys(peers)) {
    if (dep.startsWith('@ui-sdk/')) {
      delete peers[dep];
      dependencies[dep] = `workspace:${wrapperName(dep.slice('@ui-sdk/'.length))}@*`;
    }
  }
  const has = (o) => o && Object.keys(o).length > 0;
  return {
    name: wrapperName(name),
    version: `${src.version}.bl.${revision}`,
    description: `${src.description} BL fork of ${src.name}: upstream plus layer hosts.`,
    keywords: src.keywords,
    type: src.type,
    license: src.license,
    homepage: 'https://github.com/BLamy/ui-sdk',
    repository: { type: 'git', url: 'git+https://github.com/BLamy/ui-sdk.git', directory: `packages/${name}` },
    ...(has(imports) ? { imports } : {}),
    exports,
    sideEffects: src.sideEffects ?? false,
    files: ['dist', 'docs', 'LICENSE', 'README.md'],
    // `--if-stale`: a task runner building everything at once must not wipe `dist` under a typecheck that is reading it.
    scripts: { build: `node ../../tools/ui-sdk/build.mjs --only ${name} --if-stale` },
    ...(has(dependencies) ? { dependencies } : {}),
    ...(has(peers) ? { peerDependencies: peers } : {}),
    ...(src.peerDependenciesMeta ? { peerDependenciesMeta: src.peerDependenciesMeta } : {}),
    publishConfig: { access: 'public' },
  };
}

const serialize = (value) => JSON.stringify(value, null, 2) + '\n';

function readme(name) {
  return `# ${wrapperName(name)}

The BL fork of [\`@ui-sdk/${name}\`](https://ui-sdk.dev), built from [BLamy/ui-sdk](https://github.com/BLamy/ui-sdk).
It is upstream UI SDK plus the one thing \`@brett_lamy/ui\` cannot build from its public API: layer hosts
(an element with \`data-layer-host\` keeps the popups rendered inside it out of the top layer, placed against its
box and modal to it alone), \`active\` on \`bindLayer\`, and two exported kernel types. Each is written to be
proposed upstream.

Install it under upstream's name, so imports read like the UI SDK docs:

\`\`\`bash
npm install @ui-sdk/${name}@npm:${wrapperName(name)}
\`\`\`

Licensed under Apache-2.0, like upstream. Files changed from upstream say so at the top.
`;
}

/** What the fork looks like right now: its commit, plus a digest of any uncommitted source change. */
function forkStamp() {
  const git = (...a) => execFileSync('git', ['-C', fork, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const scope = ['--', 'packages/core', 'packages/react', 'scripts/build'];
  const hash = createHash('sha1').update(git('diff', 'HEAD', ...scope));
  for (const file of git('ls-files', '--others', '--exclude-standard', ...scope).split('\n').filter(Boolean)) {
    hash.update(file).update(readFileSync(path.join(fork, file)));
  }
  return `${git('rev-parse', 'HEAD').trim()} ${revision} ${hash.digest('hex')}`;
}

function check() {
  let stale = false;
  for (const name of PACKAGES) {
    const file = path.join(wrapperDir(name), 'package.json');
    if (!existsSync(file) || readFileSync(file, 'utf8') !== serialize(manifest(name))) {
      console.error(`packages/ui-sdk-${name}/package.json is out of date. Run: node tools/ui-sdk/build.mjs`);
      stale = true;
    }
  }
  process.exit(stale ? 1 : 0);
}

/** tsc for declarations: the fork's own when it is installed, else this workspace's. */
function tscFor(packageDir) {
  for (const from of [packageDir, root]) {
    try {
      return createRequire(path.join(from, 'package.json')).resolve('typescript/bin/tsc');
    } catch {
      /* next */
    }
  }
  throw new Error('typescript is not installed');
}

async function build(name) {
  const packageDir = forkDir(name);
  const sourceDir = path.join(packageDir, 'src');
  const out = wrapperDir(name);
  const outDir = path.join(out, 'dist');
  const src = read(path.join(packageDir, 'package.json'));
  // The fork says how each package is compiled in its own build script; read the flags from there.
  const script = src.scripts?.build ?? '';
  const useClient = script.includes('--use-client');
  const serverModules = [...script.matchAll(/--server (\S+)/g)].map((m) => m[1]);

  const load = (file) => import(pathToFileURL(path.join(fork, 'scripts/build', file)).href);
  const { transpile } = await load('transpile.mjs');
  const { withJsExtension } = await load('specifiers.mjs');

  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'package.json'), serialize(manifest(name)));
  writeFileSync(path.join(out, 'README.md'), readme(name));
  cpSync(path.join(fork, 'LICENSE'), path.join(out, 'LICENSE'));
  rmSync(outDir, { recursive: true, force: true });
  await transpile({ sourceDir, outDir, useClient, serverModules });

  // Declarations, as the fork's `emitDeclarations` does, but with a tsc we pick (see `tscFor`).
  execFileSync(
    process.execPath,
    [tscFor(packageDir), '-p', 'tsconfig.json', '--noEmit', 'false', '--declaration', '--emitDeclarationOnly', '--rootDir', sourceDir, '--outDir', outDir],
    { cwd: packageDir, stdio: 'inherit' },
  );
  const relativeImport = /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.{1,2}(?:\/[^"']*)?)\2/g;
  for (const file of readdirSync(outDir, { recursive: true })) {
    if (file.endsWith('.d.ts')) {
      const full = path.join(outDir, file);
      const text = readFileSync(full, 'utf8');
      const next = text.replace(relativeImport, (_, keyword, quote, specifier) =>
        `${keyword}${quote}${withJsExtension(specifier, path.dirname(full), ['.d.ts'])}${quote}`);
      if (next !== text) writeFileSync(full, next);
    }
  }
  for (const file of readdirSync(sourceDir, { recursive: true })) {
    if (file.endsWith('.css')) cpSync(path.join(sourceDir, file), path.join(outDir, file));
  }

  // Every published path must have a file behind it.
  const missing = [];
  const walk = (value) => {
    if (typeof value === 'string') {
      if (value.startsWith('./dist/') && !value.includes('*') && !existsSync(path.join(out, value))) missing.push(value);
    } else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(manifest(name).exports);
  walk(manifest(name).imports);
  if (missing.length) throw new Error(`${wrapperName(name)}: no file behind ${missing.join(', ')}`);
}

function docs() {
  // The fork writes each package's docs folder; ship the same Markdown from the wrappers.
  execFileSync(process.execPath, ['scripts/package-docs.mjs', ...PACKAGES], { cwd: fork, stdio: 'inherit' });
  for (const name of PACKAGES) {
    const from = path.join(forkDir(name), 'docs');
    if (existsSync(from)) {
      rmSync(path.join(wrapperDir(name), 'docs'), { recursive: true, force: true });
      cpSync(from, path.join(wrapperDir(name), 'docs'), { recursive: true });
    }
  }
}

if (args.has('--check')) check();

const only = process.argv.includes('--only') ? [process.argv[process.argv.indexOf('--only') + 1]] : PACKAGES;
const stampFile = (name) => path.join(wrapperDir(name), 'dist/.fork');
const stamp = forkStamp();
const fresh = (name) => existsSync(stampFile(name)) && readFileSync(stampFile(name), 'utf8') === stamp;

if (args.has('--if-stale') && only.every(fresh)) process.exit(0);

const started = Date.now();
for (const name of only) {
  await build(name);
  writeFileSync(stampFile(name), stamp);
}
if (args.has('--docs')) docs();
console.log(`ui-sdk fork built (${only.join(', ')}) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
