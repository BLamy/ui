#!/usr/bin/env node
/* Builds the browser FFmpeg/FFprobe wasm that lib/ffmpeg runs (openclaw/ffmpeg-wasm's build with an editor's filter set;
   see build.sh):

     node tools/ffmpeg-wasm/build.mjs [--out apps/docs/public/ffmpeg] [--native]

   openclaw/ffmpeg-wasm publishes no binaries, so a site serves ones it built: ffmpeg.js, ffmpeg_g.wasm, ffprobe.js,
   ffprobe_g.wasm and the licence files go to --out, next to ffmpeg-worker.js (lib/ffmpeg/ffmpeg-worker.js).

   By default it runs in the emscripten/emsdk Docker image, keeping sources and objects in the `bl-ffmpeg-wasm` volume.
   `--native` uses an emsdk of that version installed (once) under ~/.cache/bl-ffmpeg-wasm instead, for a host without
   Docker or a Docker VM without room (emsdk needs Python 3.10+: EMSDK_PYTHON, else ~/.cache/bl-ffmpeg-wasm/python if
   present, else python3). Either way a rebuild only recompiles what changed. Env FFMPEG_VERSION, LAME_REF
   and LIBVPX_REF override the pinned refs; EMSDK_VERSION the Emscripten version. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const out = resolve(root, arg('--out') ?? 'apps/docs/public/ffmpeg');
const version = process.env.EMSDK_VERSION ?? '6.0.10';
mkdirSync(out, { recursive: true });

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.argv.includes('--native')) {
  const cache = resolve(homedir(), '.cache/bl-ffmpeg-wasm');
  const emsdk = resolve(cache, 'emsdk');
  const python = resolve(cache, 'python/bin/python3');
  if (!process.env.EMSDK_PYTHON && existsSync(python)) process.env.EMSDK_PYTHON = python;
  if (!existsSync(emsdk)) run('git', ['clone', '--depth', '1', 'https://github.com/emscripten-core/emsdk.git', emsdk]);
  run(resolve(emsdk, 'emsdk'), ['install', version]);
  run(resolve(emsdk, 'emsdk'), ['activate', version]);
  run('bash', ['-c', `source "${emsdk}/emsdk_env.sh" >/dev/null && bash "${here}/build.sh"`], {
    env: { ...process.env, CACHE: resolve(cache, 'src'), OUT: out },
  });
} else {
  const env = ['FFMPEG_VERSION', 'LAME_REF', 'LIBVPX_REF'].flatMap((k) => (process.env[k] ? ['-e', `${k}=${process.env[k]}`] : []));
  run('docker', [
    'run', '--rm', ...env,
    '-v', 'bl-ffmpeg-wasm:/cache',
    '-v', `${here}:/build:ro`,
    '-v', `${out}:/out`,
    `emscripten/emsdk:${version}`, 'bash', '/build/build.sh',
  ]);
}
