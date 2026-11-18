# Sandbox

Runs code a person or a model wrote, in the browser, where it can't reach your page. `createSandbox` gives you a disk and a shell on a Node-compatible runtime ([`@agent-wasm/core`](https://www.npmjs.com/package/@agent-wasm/core), our build of almostnode): write files, run `node`, `npm install` and shell commands, read the output as it arrives. The code runs in a Web Worker that has **an origin of its own**, so it has no DOM, cookies or `localStorage`, and the browser refuses it your site's IndexedDB and caches. The sandbox reports the isolation it got, and never runs with your page's origin unless you say it may. It is headless: draw the terminal and the file tree with the kit's parts, as the [VS Code block](https://blamy.github.io/ui/#/blocks) does on this library.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/sandbox.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { createSandbox } from '@/lib/sandbox'
import { useSandbox } from '@/lib/sandbox/react'
import { serveSandbox } from '@/lib/sandbox/worker'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module (the Sandbox library's entry, `@brett_lamy/ui/sandbox`, has them too):

```tsx
import '@brett_lamy/ui/styles.css'

import { createSandbox } from '@brett_lamy/ui/lib/sandbox'
import { useSandbox } from '@brett_lamy/ui/lib/sandbox/react'
import { serveSandbox } from '@brett_lamy/ui/lib/sandbox/worker'
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
**Which one do I need?** Use Sandbox. It runs JavaScript, npm packages and a shell, costs your page a few kilobytes, and the code runs in a Worker that cannot read your page or its storage. **Linux VM** is for what Sandbox cannot do: a real Linux kernel, native binaries (compilers, `apk` packages, Python with C extensions) or a container image. It downloads from about 40 MB to several hundred, runs programs about 25 to 1,700 times slower than native in its own benchmarks, and is experimental. It is not shipped yet: there is no `@brett_lamy/ui/linux-vm` to import.
{% endhint %}

## Install the runtime

The runtime is `@agent-wasm/core`, an **optional peer dependency** of `@brett_lamy/ui`: it is not in the package, and an app that never starts a sandbox never installs or downloads it. The registry item lists it as an ordinary dependency, so `shadcn add` installs it for you. With npm, add it yourself:

{% command %}npm install @agent-wasm/core{% endcommand %}

It is a large install (about 90 MB to download, 296 MB on disk, most of it binaries for features you load only if you use them). What your users download is far less: see [The network](#the-network).

## Usage

A sandbox is two files. The Worker is yours, so that your bundler builds it with the runtime inside:

```ts
// sandbox.worker.ts
import { serveSandbox } from '@/lib/sandbox/worker'

serveSandbox()
```

The page starts it with the `new Worker(new URL(…, import.meta.url))` every bundler understands, and never loads the runtime itself:

```ts
import { createSandbox } from '@/lib/sandbox'

const sandbox = createSandbox({
  worker: () => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' }),
  files: { 'index.js': "console.log('Hello from', require('os').platform())" },
})

await sandbox.start()   // rejects when the host can't give it an origin of its own
sandbox.isolation       // 'opaque-origin'

const { exitCode } = await sandbox.run('node index.js', {
  onOutput: (chunk, { stream }) => console.log(stream, chunk),
}).exit
```

{% demo src="sandbox/run-script" %}

Nothing loads until `start()` or the first command: creating a sandbox starts no Worker and downloads nothing, and `sandbox.files` works at once. Build Workers as ES modules: an isolated start imports the Worker's module, so it needs one (and with Vite the whole runtime otherwise becomes one 79 MB file that downloads at start):

```ts
// vite.config.ts
export default defineConfig({ worker: { format: 'es' } })
```

## Where the code runs

Sandboxed code is JavaScript in your user's browser, so what protects your page is where it runs. Your Worker has your page's origin, so by default nothing is run in it: it only says where your bundler put its module. The sandbox then starts a second Worker from a `data:` URL that imports that same module, and ends the first. A `data:` Worker has an **opaque origin**: one of its own, that matches no site.

In that Worker, the code and every package it installs:

- has no `document`, `window.document`, `localStorage`, `sessionStorage` or `document.cookie` (no Worker has);
- is refused your site's IndexedDB, Cache API and origin private file system: `indexedDB.open`, `caches.open` and `navigator.storage.getDirectory` fail with a `SecurityError`;
- reaches your site only as another site would. In Chromium a request to it, even one that asks for credentials, goes without your page's cookies, because Chromium treats a cookie with no `SameSite` attribute as `Lax`; a cookie you marked `SameSite=None` goes to any site that asks, this one included. Firefox and Safari do not treat a cookie without the attribute as `Lax` by default, so there it may go with the request (not tested). **Set `SameSite=Lax` or `Strict` on your session cookies**;
- cannot freeze the page with a loop: a `while (true) {}` stops only its thread, and `kill()` replaces the Worker and keeps the files. The Worker's own code holds back output the page hasn't taken (8 MB); code that posts messages itself, past that, is caught on the page's side, which replaces a Worker with more than 16 MB of output waiting. A flood of other messages can still keep the page busy until it is killed.

What it does **not** do:

- **Limit the network.** The code can `fetch` anything the browser's CORS rules allow, and reads what an API would give any website. Don't put secrets in the sandbox's files or environment.
- **Vouch for what comes out.** The code shares its Worker's global with the library's own Worker code, so it can post any message that code can. Output, file names and file contents, exit codes, `interrupted`, and a shell's `cwd` and environment are whatever the code made them: one command can end another with exit code 0. Render them as text, never as HTML, and don't take an exit code of 0 as proof that tests passed. What the page checks: paths are absolute and written one way (no `..`, no doubled or trailing slash, never the root), the copy of the disk stays a tree, and nothing the code posts changes where code runs.
- **Limit memory.** A script that allocates without end can still take the tab down.

`sandbox.isolation` is what the sandbox got, not what you asked for: `'opaque-origin'`, `'same-origin'`, or `null` before a Worker is ready and after the sandbox has failed. It comes from the Worker's own report of its origin, before any of your users' code runs; a Worker that does not report an origin of its own is not used.

### What the host must serve

An opaque origin is a different origin from your site's, so the Worker's module is fetched across origins, and so is every chunk it imports. The host must answer them with `Access-Control-Allow-Origin: *`. GitHub Pages does by default (other hosts were not checked). If the page has a Content Security Policy, its `worker-src` must allow `data:` (from the specification; not verified here).

Where the host doesn't, **the sandbox does not start**. `start()` rejects with a `SandboxError` whose `code` is `'isolation'` and whose message says what to serve; `status` is `'failed'`; commands exit with `interrupted: 'unavailable'`. Nothing has run, and the runtime was never downloaded.

A Vite dev server sends CORS headers only to `localhost` origins, so an opaque Worker can't load from it. Two ways to develop:

```ts
// 1. Let the dev server answer any origin. The sandbox is isolated in development too.
//    Any website open in your browser can then read your dev server's files.
export default defineConfig({ server: { cors: true }, worker: { format: 'es' } })

// 2. Keep the dev server closed, and allow a same-origin Worker in development only.
const sandbox = createSandbox({ worker, fallback: import.meta.env.DEV ? 'same-origin' : 'none' })
```

### Running without an origin of its own

Two options run the code in your Worker as it is, with your page's origin. Both are yours to choose; the sandbox never picks them for you.

| Option | Effect |
| --- | --- |
| `fallback: 'same-origin'` | Tries for an origin of its own first. Where that fails on the first start, runs in your Worker, and `isolation` says `'same-origin'`. |
| `isolation: 'same-origin'` | Runs in your Worker without trying. For code you wrote yourself. |

**The rule.** The sandbox gives its files to a Worker of your page's origin in two cases only: you asked for one (`isolation: 'same-origin'`), or you allowed one (`fallback: 'same-origin'`) and the **first** start could not get an isolated Worker going: its module would not load, or it loaded and the runtime would not start. In both cases no Worker of the sandbox has been ready yet, so none of your users' code has run anywhere. The first Worker to be ready settles where the sandbox runs, for good:

- once code has run isolated, every later Worker (a restart, a `kill()` that replaces one) must be isolated too, and a restart that can't be fails with `code: 'isolation'` or `'runtime'`. It never continues in your page's origin, because the disk now holds what that code wrote. `restart()` tries again;
- a sandbox that fell back stays in your page's origin, and says so;
- nothing the code posts, no error it raises and no message it forges or holds back changes this. A `failed` from a Worker that is ready is dropped.

A same-origin Worker still has no DOM, `localStorage` or `document.cookie`. But your site's IndexedDB, caches and private file system open for it, and its requests to your site carry your users' cookies. Show which one you got, and read `isolation` again on every status change: the VS Code block's status bar does.

## Files

`sandbox.files` is the disk. Paths are absolute, or relative to the sandbox's `cwd` (`/project` unless you set it).

```ts
await sandbox.files.write('src/greet.js', 'module.exports = (name) => `Hello, ${name}!`')
await sandbox.files.readText('src/greet.js')
await sandbox.files.list('src')                      // [{ name: 'greet.js', kind: 'file' }]
await sandbox.files.rename('src/greet.js', 'lib/greet.js')
await sandbox.files.remove('lib', { recursive: true })

const stop = sandbox.files.watch('.', (events) => {
  // { type: 'change', path, kind } | { type: 'delete', path } | { type: 'rename', from, to }
})
```

`watch` reports every change, whoever made it: a command, or a call of yours. What a command wrote is there by the time its `exit` resolves, and a file a script writes while it runs arrives as it is written.

The page keeps a copy of the disk. That is how a Worker that had to be replaced gets its files back, and why reading never waits for a thread that may be busy. `write`, `mkdir`, `rename` and `remove` change that copy and resolve at once, even while a script blocks the Worker's thread; the Worker takes the change in order, before any command you run after it. When the Worker's disk can't take a change (a running command put a file where you wrote a folder), the copy is put back to what the Worker has, and `watch` says so.

`sandbox.mirror` is that copy, read without waiting: `mirror.files` is a `ReadonlyMap` of absolute path to content and `mirror.directories` a `ReadonlySet`. A file a command wrote is a string when it is valid UTF-8, else a `Uint8Array`; a file you wrote keeps the type you gave it. They are the live values: copy a `Uint8Array` before you change it. The disk lives in memory: it is gone when the page is. To keep files, save what `watch` reports and pass them back as `files`, and treat the paths as the code's (see above). A Worker that is replaced takes with it what the page had not heard of yet: a folder a running script made or renamed since the last report.

## Commands

`run` takes a shell line and returns at once with a process. Its `exit` never rejects: a command that could not run exits with a code and says why.

```ts
const process = sandbox.run('npm install lodash && node index.js', {
  cwd: 'app',
  env: { NODE_ENV: 'test' },
  onOutput: (chunk, { stream }) => terminal.write(chunk),
})
process.write('yes\n')     // input: held until the script reads it
process.kill()             // Ctrl-C
const { exitCode, interrupted } = await process.exit
```

`kill()` asks the command to stop, as Ctrl-C does. A command that doesn't stop within `killAfter` (800 ms; `Infinity` waits for ever) is ended by replacing its Worker: its `exit` says `interrupted: 'unresponsive'`, every other running command's says `'restarted'`, and the files and each shell's folder carry over to the new Worker. `signal` does the same from an `AbortSignal`; a signal that is already aborted never sends the command, nor starts the sandbox. A command killed before it reached a Worker (the sandbox was still loading) exits 130 at once and costs nothing. `sandbox.restart()` replaces the Worker yourself.

**What `kill` costs.** A command that stops when asked can leave its timers behind, so once nothing else is running the Worker is replaced anyway: `status` goes `'restarting'`, the runtime starts again, and every file is sent to the new Worker, `node_modules` included. Expect a second or so before the next command runs.

Each `run` has a shell of its own: one command's `cd` or `export` does not reach the next. For a terminal, open a shell, which remembers:

```ts
const shell = sandbox.shell({ cols: 80, rows: 24 })
await shell.run('cd src').exit
shell.cwd                                   // '/project/src'
await shell.run('node greet.js', { onOutput }).exit
shell.resize(120, 40)
shell.dispose()
```

A script reads its input only once it has asked for it. `write` holds what you send until then; `onReadingChange(reading)` tells a terminal when keys belong to the script and when to the next prompt.

## React

`useSandbox` makes one sandbox for the component, starts it, follows its status and disposes of it when the component goes. The sandbox is made in an effect, so nothing starts on a server, and it starts a moment later, so that Strict Mode's rehearsal disposes of the first one before it has started a Worker.

```tsx
import { useSandbox } from '@/lib/sandbox/react'

const newWorker = () => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })

function Runner() {
  const { sandbox, status, isolation, error } = useSandbox({ worker: newWorker, files })
  if (error) return <p role="alert">{error.message}</p>
  return <Button disabled={status !== 'ready'} onClick={() => sandbox?.run('node index.js', { onOutput }).exit}>Run</Button>
}
```

The options are read once, when the component mounts; give the component another `key` for another sandbox. The callbacks are the exception: `onHostFetch` and `onStatusChange` are those of the latest render, so a gate that closes over state sees it as it is. `autoStart: false` waits for `sandbox.start()` or the first command; this page's example does that, so that reading the page starts nothing.

## Requests the page answers

The code's `fetch` goes out from its Worker. Sometimes the page has what the Worker must not have: a session, a private network. Then the Worker hands the requests you pick to the page, and the page decides:

```ts
// sandbox.worker.ts: which addresses go to the page
serveSandbox({ hostFetch: (url) => new URL(url).hostname.endsWith('.internal.example') })

// the page: it runs with your origin and your user's sign-ins, so it is the gate
createSandbox({
  worker,
  async onHostFetch(request, { signal }) {
    // Compare the parsed host, never the string: 'https://evil.example/?.internal.example' ends with it too.
    if (!new URL(request.url).hostname.endsWith('.internal.example')) throw new Error('Not allowed.')
    const response = await fetch(request.url, {
      method: request.method, headers: request.headers, body: request.body,
      redirect: 'error', // a redirect would take the page's credentials to wherever it points
      signal,
    })
    return {
      status: response.status, statusText: response.statusText, headers: [...response.headers],
      body: response.body ? new Uint8Array(await response.arrayBuffer()) : null,
    }
  },
})
```

The Worker is not to be trusted: it can ask for any address, whatever `hostFetch` says. Check the address in `onHostFetch`, every time, and pick the fetch options yourself. What the handler is given is a new object of exactly the five fields, each checked: `url` (always an absolute `http:` or `https:` address, as the browser reads it; anything else is refused before your handler is called), `method`, `headers`, `body` and `redirect`. Requests are taken only from a Worker whose file passed `hostFetch` to `serveSandbox`, and without `onHostFetch` they are refused. A status of 204, 205 or 304 reaches the code without a body, whatever you return. The VS Code block uses this to let the terminal's `fetch` reach a tailnet through the page's Tailscale connection, and only tailnet addresses.

## The network

What a sandbox contacts for what this library does itself, as observed in Chromium on an app built with Vite from the published package:

| When | Contacted | What |
| --- | --- | --- |
| `createSandbox()`, `files` | nothing | The page's side is about 5 kB gzipped and loads no runtime. |
| `start()`, the first command | your own host | The Worker's module (twice: once to find it, once isolated) and 8 chunks of the runtime, about 0.6 MB gzipped (2.2 MB raw). |
| CommonJS and ES module scripts, the shell | nothing more | An ES module script loads one more chunk from your host. |
| `npm install <package>` | `registry.npmjs.org` | The package's metadata and its tarball, straight from the Worker. |
| the code's own `fetch` | whatever it asks for | Straight from the Worker, as far as CORS allows. A request CORS refuses fails. |

The runtime's default is to send the code's requests through a CORS proxy on a third party's server. This library turns that off for the runtime's fetch (`noProxy: '*'`): a request the browser refuses is refused.

**Third parties it cannot switch off yet.** Some of the runtime's own commands contact servers of their own, whatever this library sets. These are from reading the runtime's code (`@agent-wasm/core` 0.4.0), not observed:

| Command | Contacts |
| --- | --- |
| `git clone`, `fetch`, `pull`, `push` | Through the CORS proxy `almostnode-cors-proxy.langtail.workers.dev` unless `GIT_CORS_PROXY` names another, sending `GIT_TOKEN` or `GITHUB_TOKEN` with the request when either is set. |
| `replayio` | The same proxy, hard-coded, and `api.replay.io`, `dispatch.replay.io`, `app.replay.io`, `webreplay.us.auth0.com`. |
| `jina` | `r.jina.ai`. |
| `soundcloud` | `napster.brett-lamy.workers.dev`. |
| the cloud commands (`aws`, `netlify`, `neon`, `infisical`, Fly, Cloudflare) | Their providers' APIs. |
| dev servers and bundling commands | CDNs: esbuild from `unpkg.com` and `esm.sh`, Rollup, React, Tailwind (`cdn.tailwindcss.com`), `cdn.jsdelivr.net`, Google Fonts. |

None of them runs unless a command calls it, and code in the sandbox could reach these hosts with its own `fetch` anyway. Don't put a token in the sandbox's environment that you would not hand that proxy. To hold the sandbox to an allowlist, a Content Security Policy on your page with `connect-src` is the place (a `data:` Worker inherits the policy of the page that starts it; not verified here).

## Not in this version

- **Previews.** A dev server's pages are served by a service worker, and an opaque origin can't have one. `vite` starts in the sandbox but nothing can reach it. An isolated preview needs a dedicated origin that hosts nothing else; that is not built yet.
- **A runtime you don't have to install.** The runtime is an npm package your bundler builds into the Worker. Serving it as files from a URL needs a build of the runtime that does not exist yet.
- **TypeScript files.** `node file.ts` fails with a syntax error in this runtime. Run JavaScript, or compile first.
- **A network policy.** There is no allowlist of hosts beyond CORS and your page's Content Security Policy, and no switch for the third parties listed under [The network](#the-network).
- **A limit on memory, or on messages.** A script that allocates without end can take the tab down, and one that posts a flood of messages other than output can keep the page busy until it is killed.
- **Other bundlers and browsers, verified.** The isolated path was tested with Vite 8 in Chromium. The Worker is started with the standard syntax, which webpack, Parcel and Turbopack also bundle, but an isolated start also needs the bundler to emit the Worker as an ES module, and that was not tested with them. Firefox and Safari were not tested: where a `data:` module Worker can't start, the sandbox fails or falls back as above, and their cookie defaults differ (see [Where the code runs](#where-the-code-runs)).
- **Linux VM.** Planned, with the same files and commands; not shipped.

## Verified

In Chromium (Playwright, `tools/e2e/sandbox.e2e.mjs`), on this page's example: with CORS headers on the Worker's files, the sandbox reports `opaque-origin`, and a probe run in it, which takes the Worker's real global the way a hostile package would, finds its origin is `null`, no `document`, `localStorage` or `sessionStorage`, IndexedDB, the Cache API and the origin private file system refused, and a credentialed request to the page's site sent without the page's cookie. On the dev server as it is (no CORS headers for an opaque origin) the sandbox fails with the `isolation` error, runs nothing and never requests the runtime. The same probe in a same-origin Worker, as a control, reads the secret the page stored in IndexedDB, a cache and the private file system, and its request carries the cookie. With `fallback: 'same-origin'` on a host that isolates, a script that posts the library's `failed` message from the Worker's real global leaves the sandbox isolated, and the probe run after it is refused everything as before; a restart stays isolated; and once the host stops serving the Worker across origins, a restart fails with the `isolation` error, and no Worker of the page's origin ever loads the runtime. The CORS headers in these runs are added by the test, not by a real host, and the cookie result rests on Chromium's `Lax` default. Unit tests run the Worker's own code against a fake runtime, both sides of the message protocol joined, including the messages sandboxed code can forge, and the React hook in Strict Mode.

## API

### createSandbox(options)

| Option | Default | Effect |
| --- | --- | --- |
| `worker` | required | `() => Worker`: starts your Worker file, the one that calls `serveSandbox()`. |
| `files` | none | The starting disk: path (relative to `cwd`, or absolute) to a string or a `Uint8Array`. |
| `cwd` | `/project` | The folder commands start in. |
| `env` | none | Environment variables for every command. |
| `isolation` | `'opaque-origin'` | Where the code runs. `'same-origin'` runs it in your Worker as it is. |
| `fallback` | `'none'` | `'same-origin'` allows your Worker to stand in when an isolated one can't start, on the first start only, before any code has run. |
| `onHostFetch` | none | `(request, { signal }) => Promise<SandboxFetchResponse>`: answers the requests the Worker hands over. |
| `onStatusChange` | none | `(status, { error, isolation })`, on every change of `status`. |
| `killAfter` | `800` | How long a command gets to stop after `kill()` before its Worker is replaced, in ms. `Infinity`: never. |
| `startTimeout` | `30000` | How long a Worker gets to load its module, and then the runtime to start, in ms each. `Infinity`: for ever. |

### Sandbox

| Member | What it is |
| --- | --- |
| `status` | `'idle'` (nothing loaded), `'loading'`, `'ready'`, `'restarting'` (the Worker is being replaced), `'failed'` or `'disposed'`. |
| `isolation` | `'opaque-origin'`, `'same-origin'`, or `null` until a Worker is ready and once the sandbox has failed. |
| `error` | The `SandboxError` behind `'failed'`, else `null`. |
| `cwd` | The folder commands start in. |
| `files` | `read`, `readText`, `write`, `mkdir`, `list`, `remove`, `rename`, `watch`. Changes resolve when the page's copy has them. |
| `mirror` | The page's copy of the disk: `files` (a `ReadonlyMap`) and `directories` (a `ReadonlySet`). |
| `start()` | Starts it if need be. Resolves when ready; rejects with a `SandboxError`. |
| `restart()` | Replaces the Worker. Files and each shell's folder carry over. |
| `run(command, options?)` | A `SandboxProcess`: `write`, `resize`, `kill`, `exit`. Options: `cwd`, `env`, `cols`, `rows`, `signal`, `onOutput`, `onReadingChange`. |
| `shell(options?)` | A `SandboxShell`: `cwd`, `run`, `resize`, `dispose`. Options: `cwd`, `env`, `cols`, `rows`. |
| `subscribe(listener)` | Calls `listener` when `status`, `isolation` or `error` changes. Returns the unsubscribe. |
| `dispose()` | Ends the Worker and everything in it. |

`SandboxError.code` is `'isolation'` (no origin of its own: the message says what to serve), `'worker'` (your Worker could not start, or is not a file that calls `serveSandbox()`), `'runtime'` (the runtime failed to start in the Worker), `'files'` (the disk refused a change) or `'disposed'`.

A command's `exit` resolves to `{ exitCode, interrupted? }`. `interrupted` is `'unresponsive'` (it ignored `kill()`), `'restarted'` (its Worker was replaced under it) or `'unavailable'` (the sandbox could not start, or was disposed).

### serveSandbox(options?)

Call it once, at the top of the Worker's file. `hostFetch: (url) => boolean` picks the requests that go to the page's `onHostFetch`. Called outside a Worker, it throws.

### useSandbox(options)

`createSandbox`'s options and `autoStart` (default `true`). Returns `{ sandbox, status, isolation, error }`; `sandbox` is `null` until the component has mounted. Options are read once; `onHostFetch` and `onStatusChange` follow the latest render.
