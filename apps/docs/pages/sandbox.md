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

Nothing loads until `start()` or the first command: creating a sandbox starts no Worker and downloads nothing, and `sandbox.files` works at once. With Vite, build Workers as ES modules, or the whole runtime becomes one 79 MB file that downloads at start:

```ts
// vite.config.ts
export default defineConfig({ worker: { format: 'es' } })
```

## Where the code runs

Sandboxed code is JavaScript in your user's browser, so what protects your page is where it runs. Your Worker has your page's origin, so by default nothing is run in it: it only says where your bundler put its module. The sandbox then starts a second Worker from a `data:` URL that imports that same module, and ends the first. A `data:` Worker has an **opaque origin**: one of its own, that matches no site.

In that Worker, the code and every package it installs:

- has no `document`, `window.document`, `localStorage`, `sessionStorage` or `document.cookie` (no Worker has);
- is refused your site's IndexedDB, Cache API and origin private file system: `indexedDB.open`, `caches.open` and `navigator.storage.getDirectory` fail with a `SecurityError`;
- reaches your site only as another site would: a request to it, even one that asks for credentials, goes without your page's cookies (a cookie you marked `SameSite=None` goes to any site that asks, and to this one too);
- cannot freeze the page: a `while (true) {}` stops only its thread, and `kill()` replaces the Worker and keeps the files.

What it does **not** do:

- **Limit the network.** The code can `fetch` anything the browser's CORS rules allow, and reads what an API would give any website. Don't put secrets in the sandbox's files or environment.
- **Vouch for what comes out.** Output, file names and file contents are whatever the code made them. Render them as text, never as HTML.
- **Limit memory.** A script that allocates without end can still take the tab down.

`sandbox.isolation` is what the sandbox got, not what you asked for: `'opaque-origin'`, or `'same-origin'`. It comes from the Worker's own report of its origin, before any of your users' code runs; a Worker that does not report an origin of its own is not used.

### What the host must serve

An opaque origin is a different origin from your site's, so the Worker's module is fetched across origins, and so is every chunk it imports. The host must answer them with `Access-Control-Allow-Origin: *`. GitHub Pages and Cloudflare Pages do by default. If the page has a Content Security Policy, its `worker-src` must allow `data:` (from the specification; not verified here).

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
| `fallback: 'same-origin'` | Tries for an origin of its own first. Where that fails, runs in your Worker, and `isolation` says `'same-origin'`. |
| `isolation: 'same-origin'` | Runs in your Worker without trying. For code you wrote yourself. |

A same-origin Worker still has no DOM, `localStorage` or `document.cookie`. But your site's IndexedDB, caches and private file system open for it, and its requests to your site carry your users' cookies. Show which one you got: the VS Code block's status bar does.

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

The page keeps a copy of the disk. That is how a Worker that had to be replaced gets its files back, and why reading never waits for a thread that may be busy. `sandbox.mirror` is that copy, read without waiting: `mirror.files` is a `ReadonlyMap` of absolute path to content (a string when the file is valid UTF-8, else a `Uint8Array`) and `mirror.directories` a `ReadonlySet`. The disk lives in memory: it is gone when the page is. To keep files, save what `watch` reports and pass them back as `files`.

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

`kill()` asks the command to stop, as Ctrl-C does. A command that doesn't stop within `killAfter` (800 ms) is ended by replacing its Worker: its `exit` says `interrupted: 'unresponsive'`, every other running command's says `'restarted'`, and the files and each shell's folder carry over to the new Worker. `signal` does the same from an `AbortSignal`. `sandbox.restart()` replaces the Worker yourself.

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

`useSandbox` makes one sandbox for the component, starts it, follows its status and disposes of it when the component goes. The sandbox is made in an effect, so nothing starts on a server, and Strict Mode's rehearsal ends the first one cleanly.

```tsx
import { useSandbox } from '@/lib/sandbox/react'

const newWorker = () => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })

function Runner() {
  const { sandbox, status, isolation, error } = useSandbox({ worker: newWorker, files })
  if (error) return <p role="alert">{error.message}</p>
  return <Button disabled={status !== 'ready'} onClick={() => sandbox?.run('node index.js', { onOutput }).exit}>Run</Button>
}
```

The options are read once, when the component mounts; give the component another `key` for another sandbox. `autoStart: false` waits for `sandbox.start()` or the first command, which is what the example above does, so that reading this page starts nothing.

## Requests the page answers

The code's `fetch` goes out from its Worker. Sometimes the page has what the Worker must not have: a session, a private network. Then the Worker hands the requests you pick to the page, and the page decides:

```ts
// sandbox.worker.ts: which addresses go to the page
serveSandbox({ hostFetch: (url) => new URL(url).hostname.endsWith('.internal.example') })

// the page: it runs with your origin and your user's sign-ins, so it is the gate
createSandbox({
  worker,
  async onHostFetch(request, { signal }) {
    if (!isAllowed(request.url)) throw new Error('Not allowed.')
    const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body, signal })
    return { status: response.status, statusText: response.statusText, headers: [...response.headers], body: new Uint8Array(await response.arrayBuffer()) }
  },
})
```

The Worker is not to be trusted: it can ask for any address, whatever `hostFetch` says. Check the address in `onHostFetch`, every time. Without `onHostFetch`, such requests are refused. The VS Code block uses this to let the terminal's `fetch` reach a tailnet through the page's Tailscale connection, and only tailnet addresses.

## The network

Nothing is sent through a server of ours or anyone else's. What a sandbox contacts, as observed in Chromium on an app built with Vite from the published package:

| When | Contacted | What |
| --- | --- | --- |
| `createSandbox()`, `files` | nothing | The page's side is about 5 kB gzipped and loads no runtime. |
| `start()`, the first command | your own host | The Worker's module (twice: once to find it, once isolated) and 8 chunks of the runtime, about 0.6 MB gzipped (2.2 MB raw). |
| CommonJS and ES module scripts, the shell | nothing more | An ES module script loads one more chunk from your host. |
| `npm install <package>` | `registry.npmjs.org` | The package's metadata and its tarball, straight from the Worker. |
| the code's own `fetch` | whatever it asks for | Straight from the Worker, as far as CORS allows. A request CORS refuses fails. |

The runtime's default is to send requests through a CORS proxy on a third party's server. This library turns that off, and has no option to turn it on: a request the browser refuses is refused. The runtime can also load build tools from CDNs (esbuild from unpkg.com and esm.sh, Rollup, React, Tailwind) for its dev servers and bundling commands. This library doesn't use those and doesn't block them: a command that reaches for them fetches them from inside the Worker. To hold the sandbox to an allowlist, a Content Security Policy on your page with `connect-src` is the place (a `data:` Worker inherits the policy of the page that starts it; not verified here).

## Not in this version

- **Previews.** A dev server's pages are served by a service worker, and an opaque origin can't have one. `vite` starts in the sandbox but nothing can reach it. An isolated preview needs a dedicated origin that hosts nothing else; that is not built yet.
- **A runtime you don't have to install.** The runtime is an npm package your bundler builds into the Worker. Serving it as files from a URL needs a build of the runtime that does not exist yet.
- **TypeScript files.** `node file.ts` fails with a syntax error in this runtime. Run JavaScript, or compile first.
- **A network policy.** There is no allowlist of hosts beyond CORS and your page's Content Security Policy.
- **Other bundlers and browsers, verified.** The isolated path was tested with Vite 8 in Chromium. The Worker is started with the standard syntax, which webpack, Parcel and Turbopack also bundle, but an isolated start also needs the bundler to emit the Worker as an ES module, and that was not tested with them. Firefox and Safari were not tested: where a `data:` module Worker can't start, the sandbox fails or falls back as above.
- **Linux VM.** Planned, with the same files and commands; not shipped.

## Verified

In Chromium (Playwright, `tools/e2e/sandbox.e2e.mjs`), on this page's example: with CORS headers on the Worker's files, the sandbox reports `opaque-origin`, and a probe run in it, which takes the Worker's real global the way a hostile package would, finds its origin is `null`, no `document`, `localStorage` or `sessionStorage`, IndexedDB, the Cache API and the origin private file system refused, and a credentialed request to the page's site sent without the page's cookie. On the dev server as it is (no CORS headers for an opaque origin) the sandbox fails with the `isolation` error, runs nothing and never requests the runtime. The same probe in a same-origin Worker, as a control, reads the secret the page stored in IndexedDB, a cache and the private file system, and its request carries the cookie. Unit tests run the Worker's own code against a fake runtime, both sides of the message protocol joined, and the React hook in Strict Mode.

## API

### createSandbox(options)

| Option | Default | Effect |
| --- | --- | --- |
| `worker` | required | `() => Worker`: starts your Worker file, the one that calls `serveSandbox()`. |
| `files` | none | The starting disk: path (relative to `cwd`, or absolute) to a string or a `Uint8Array`. |
| `cwd` | `/project` | The folder commands start in. |
| `env` | none | Environment variables for every command. |
| `isolation` | `'opaque-origin'` | Where the code runs. `'same-origin'` runs it in your Worker as it is. |
| `fallback` | `'none'` | `'same-origin'` allows your Worker to stand in when an isolated one can't load. |
| `onHostFetch` | none | `(request, { signal }) => Promise<SandboxFetchResponse>`: answers the requests the Worker hands over. |
| `onStatusChange` | none | `(status, { error, isolation })`, on every change of `status`. |
| `killAfter` | `800` | How long a command gets to stop after `kill()` before its Worker is replaced, in ms. |

### Sandbox

| Member | What it is |
| --- | --- |
| `status` | `'idle'` (nothing loaded), `'loading'`, `'ready'`, `'restarting'` (the Worker is being replaced), `'failed'` or `'disposed'`. |
| `isolation` | `'opaque-origin'`, `'same-origin'`, or `null` until a Worker has started. |
| `error` | The `SandboxError` behind `'failed'`, else `null`. |
| `cwd` | The folder commands start in. |
| `files` | `read`, `readText`, `write`, `mkdir`, `list`, `remove`, `rename`, `watch`. |
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

`createSandbox`'s options and `autoStart` (default `true`). Returns `{ sandbox, status, isolation, error }`; `sandbox` is `null` until the component has mounted.
