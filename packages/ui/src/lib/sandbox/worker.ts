/* ══ The sandbox's Worker ══
   The other half of `createSandbox` (lib/sandbox): the file your bundler builds into a Worker, with the runtime in it.
   Make it two lines, and start it from the page with the `new Worker(new URL(…, import.meta.url))` every bundler
   understands:

     // sandbox.worker.ts
     import { serveSandbox } from '@/lib/sandbox/worker';
     serveSandbox();

   The runtime, `@agent-wasm/core`, is an optional peer of the package. It is imported here and nowhere else, and only
   once the page starts the sandbox, so a page that imports `lib/sandbox` never loads it. ══ */
import { serve, type SandboxRuntimeModule, type SandboxWorkerScope } from './serve';

export interface ServeSandboxOptions {
  /** Picks, by address, the requests the sandboxed code's `fetch` hands to the page (`onHostFetch` there) instead of
   *  the network: a private API the page is signed in to, a tailnet. Everything else goes out from the Worker itself. */
  hostFetch?: (url: string) => boolean;
}

/** Serves a sandbox from this Worker. Call it once, at the top of the Worker's file. */
export function serveSandbox(options: ServeSandboxOptions = {}): void {
  if (!('WorkerGlobalScope' in globalThis)) throw new Error('serveSandbox() runs in a Worker: call it from the file you start with new Worker().');
  serve(globalThis as unknown as SandboxWorkerScope, () => import('@agent-wasm/core') as Promise<SandboxRuntimeModule>, options);
}
