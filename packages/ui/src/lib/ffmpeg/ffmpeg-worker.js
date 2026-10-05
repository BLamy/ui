/* BL UI — FFmpeg worker. https://blamy.github.io/ui/#/ffmpeg
 *
 * Serve this file next to the FFmpeg wasm build (ffmpeg.js, ffmpeg_g.wasm, ffprobe.js, ffprobe_g.wasm; built from
 * openclaw/ffmpeg-wasm by tools/ffmpeg-wasm) and point lib/ffmpeg at that directory. lib/ffmpeg starts it as a module
 * worker and hands it one job at a time. A job runs a tool the way a command line would: a fresh FFmpeg (or FFprobe)
 * instance with the job's arguments, its working directory holding the inputs: Blobs and Files mounted read-only with
 * WORKERFS (nothing is copied into memory), bytes written as files. When it exits, the worker posts back the exit code,
 * stdout, stderr and every file the run wrote; `-progress pipe:2` reports and log lines stream while it runs. The worker
 * owns the Emscripten runtime and its threads, so a job is cancelled by terminating the worker.
 *
 * The page must be cross-origin isolated (COOP/COEP, with this file and the tool scripts served under the same
 * embedder policy): the build uses threads, which need SharedArrayBuffer. Module script, no imports, no build step.
 * MIT licensed, like the rest of BL UI; FFmpeg itself is LGPL-2.1-or-later. */

const tools = new Map();

/** The tool's module factory, imported once per location (a failed import is forgotten, so a later job retries). */
function load(base, tool) {
  const url = new URL(`${tool}.js`, base).href;
  if (!tools.has(url)) {
    const p = import(url).then((m) => m.default);
    p.catch(() => tools.delete(url));
    tools.set(url, p);
  }
  return tools.get(url);
}

const PROGRESS_KEYS = /^(frame|fps|bitrate|total_size|out_time_us|out_time_ms|out_time|dup_frames|drop_frames|speed|progress|stream_\d+_\d+_q)$/;

/** Reads `-progress` lines; true when the line was one (so it stays out of the log). */
function progressReader(onReport) {
  const fields = {};
  return (line) => {
    const m = /^([a-z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m || !PROGRESS_KEYS.test(m[1])) return false;
    fields[m[1]] = m[2];
    if (m[1] !== 'progress') return true;
    const us = Number(fields.out_time_us ?? fields.out_time_ms);
    const speed = parseFloat(fields.speed);
    const frame = Number(fields.frame);
    onReport({
      time: Number.isFinite(us) && us >= 0 ? us / 1e6 : 0,
      frame: Number.isFinite(frame) ? frame : undefined,
      speed: Number.isFinite(speed) ? speed : undefined,
      done: m[2] === 'end',
    });
    return true;
  };
}

/** The working directory: Blob inputs mounted (WORKERFS) and linked in by name, byte inputs written. */
function prepare(FS, inputs) {
  FS.mkdir('/work');
  const blobs = inputs.filter((i) => i.data instanceof Blob);
  if (blobs.length) {
    FS.mkdir('/in');
    FS.mount(FS.filesystems.WORKERFS, { blobs: blobs.map((i) => ({ name: i.name, data: i.data })) }, '/in');
    for (const i of blobs) FS.symlink(`/in/${i.name}`, `/work/${i.name}`);
  }
  for (const i of inputs) if (!(i.data instanceof Blob)) FS.writeFile(`/work/${i.name}`, new Uint8Array(i.data));
  FS.chdir('/work');
}

/** Every regular file the run left in the working directory, inputs aside. */
function collect(FS, inputs) {
  const skip = new Set(inputs.map((i) => i.name));
  const files = {};
  for (const name of FS.readdir('/work')) {
    if (name === '.' || name === '..' || skip.has(name)) continue;
    if (!FS.isFile(FS.lstat(`/work/${name}`).mode)) continue;
    const bytes = FS.readFile(`/work/${name}`);
    files[name] = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer;
  }
  return files;
}

async function run(job) {
  const { id, base, tool, args, inputs, logs } = job;
  const post = (message, transfer) => self.postMessage({ id, ...message }, transfer ?? []);
  const stdout = [];
  const stderr = [];
  const progress = progressReader((p) => post({ type: 'progress', progress: p }));
  let exit;
  let abort;
  const exited = new Promise((resolve, reject) => { exit = resolve; abort = reject; });
  // MODULARIZE keeps the object passed in as the Module, so its FS is reachable even if startup throws.
  const module = {
    arguments: args,
    thisProgram: tool,
    print: (line) => stdout.push(line),
    printErr: (line) => {
      if (progress(line)) return;
      stderr.push(line);
      if (logs) post({ type: 'log', line });
    },
    onExit: (code) => exit(code),
    // A crash (out of memory, a trap) ends the run without an exit code.
    onAbort: (reason) => abort(new Error(`${tool} aborted: ${reason}`)),
    preRun: [(m) => prepare(m.FS, inputs)],
  };
  try {
    const factory = await load(base, tool);
    await factory(module).catch((e) => {
      // An exit during startup surfaces as Emscripten's ExitStatus.
      if (e && e.name === 'ExitStatus') exit(e.status);
      else throw e;
    });
    const code = await exited;
    const files = code === 0 ? collect(module.FS, inputs) : {};
    post({ type: 'done', exitCode: code, stdout: stdout.join('\n'), stderr: stderr.join('\n'), files }, Object.values(files));
  } catch (e) {
    post({ type: 'error', error: e instanceof Error ? e.message : String(e), stderr: stderr.join('\n') });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'run') void run(event.data);
});
