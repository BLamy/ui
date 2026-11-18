/* @internal Starting the Worker where the code is safe to run.

   The app starts a Worker the way every bundler understands, `new Worker(new URL('./sandbox.worker.ts', import.meta.url),
   { type: 'module' })`, so its bundler builds the file with the runtime in it. That Worker has the page's origin, so by
   default nothing is run in it: it only says where it was loaded from. A second Worker is then started from a `data:`
   URL that imports that same module. A `data:` Worker has an opaque origin of its own: IndexedDB, the Cache API, OPFS
   and locks refuse it, it has no cookies, localStorage or DOM, and what it fetches from the site goes without
   credentials. The first Worker is ended as soon as the second one answers.

   The module then has to be fetched across origins, so the host must serve it, and every chunk it imports, with
   `Access-Control-Allow-Origin`. Where it doesn't, the sandbox fails to start and says so. It runs in the first Worker,
   with the page's origin, only when the caller asked for that (`isolation: 'same-origin'`) or allowed it
   (`fallback: 'same-origin'`). */
import { SandboxError, messageOf } from './error';
import type { SandboxTransport, SpawnTransport } from './host';
import type { SandboxIsolation } from './model';
import type { RuntimeMessage } from './protocol';

/** What this needs of a Worker. */
export interface WorkerLike {
  postMessage: (message: unknown, transfer: Transferable[]) => void;
  terminate: () => void;
  addEventListener: {
    (type: 'message', listener: (event: MessageEvent) => void): void;
    (type: 'error' | 'messageerror', listener: (event: Event) => void): void;
  };
}

export interface SpawnerOptions {
  /** Starts the app's Worker: an ordinary one, of the page's origin. */
  worker: () => WorkerLike;
  isolation: SandboxIsolation;
  /** May a Worker of the page's origin stand in when one with its own origin can't load? */
  fallback: boolean;
  /** How long a Worker gets to say it has loaded, ms. */
  timeout?: number;
  /** Starts the Worker with its own origin, from a `data:` URL. The default is the browser's `Worker`. */
  isolated?: (url: string, options: WorkerOptions) => WorkerLike;
}

const WORKER_NAME = 'bl-sandbox';

const HOST_MUST = 'The host must serve the Worker\'s module, and every chunk it imports, with the header '
  + '"Access-Control-Allow-Origin: *" (GitHub Pages and Cloudflare Pages do; a Vite dev server does not by default), and a '
  + 'Content-Security-Policy, if the page has one, must allow data: in worker-src. To run without an origin of its own '
  + 'instead, pass fallback: \'same-origin\' or isolation: \'same-origin\': the code can then reach this site\'s IndexedDB '
  + 'and caches.';

/** What a `data:` Worker runs: the app's Worker module, imported by its address. */
export const isolatedSource = (href: string) =>
  `import(${JSON.stringify(href)}).catch((error) => postMessage({ type: 'load-failed', message: String(error) }));`;

interface Opened {
  transport: SandboxTransport;
  /** Where the Worker's module was loaded from, and the origin it reports. */
  href: string;
  origin: string;
}

/** Resolves once the Worker's module says hello; rejects with why it couldn't. The Worker is ended when it can't. */
function open(worker: WorkerLike, isolation: SandboxIsolation, timeout: number): Promise<Opened> {
  return new Promise((resolve, reject) => {
    const transport: SandboxTransport = {
      isolation,
      post: (message, transfer) => worker.postMessage(message, transfer ?? []),
      terminate: () => worker.terminate(),
      onmessage: null,
    };
    let said = false;
    const fail = (why: string) => {
      if (said) return;
      said = true;
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(why));
    };
    const timer = setTimeout(() => fail('it did not answer. Is it a file that calls serveSandbox()?'), timeout);
    worker.addEventListener('message', ({ data }: MessageEvent<RuntimeMessage>) => {
      if (said) {
        transport.onmessage?.(data);
        return;
      }
      if (data?.type === 'hello') {
        said = true;
        clearTimeout(timer);
        resolve({ transport, href: typeof data.href === 'string' ? data.href : '', origin: typeof data.origin === 'string' ? data.origin : '' });
      } else if (data?.type === 'load-failed') {
        fail(typeof data.message === 'string' ? data.message : 'its module could not be loaded');
      }
    });
    worker.addEventListener('error', (event: Event) => {
      event.preventDefault?.();
      fail((event as ErrorEvent).message || 'its script could not be loaded');
    });
  });
}

export function createSpawner(options: SpawnerOptions): SpawnTransport {
  const { fallback, timeout = 30_000 } = options;
  const isolated = options.isolated ?? ((url, workerOptions) => new Worker(url, workerOptions));
  /** Where the app's bundler put the Worker's module, once a Worker has said. */
  let located: string | null = null;

  const sameOrigin = async (): Promise<Opened> => {
    let worker: WorkerLike;
    try {
      worker = options.worker();
    } catch (reason) {
      throw new SandboxError('worker', `The sandbox's Worker could not be started: ${messageOf(reason)}`, { cause: reason });
    }
    try {
      const opened = await open(worker, 'same-origin', timeout);
      if (/^https?:/.test(opened.href)) located = opened.href;
      return opened;
    } catch (reason) {
      throw new SandboxError('worker', `The sandbox's Worker could not be started: ${messageOf(reason)}`, { cause: reason });
    }
  };

  const opaque = async (href: string): Promise<Opened> => {
    const worker = isolated(`data:text/javascript;charset=utf-8,${encodeURIComponent(isolatedSource(href))}`, { type: 'module', name: WORKER_NAME });
    const opened = await open(worker, 'opaque-origin', timeout);
    // A browser that gave a `data:` Worker the page's origin would not be isolating anything.
    if (opened.origin !== 'null') {
      opened.transport.terminate();
      throw new Error(`this browser gave the Worker the origin ${opened.origin}`);
    }
    return opened;
  };

  return async (request) => {
    if (options.isolation === 'same-origin' || request?.sameOrigin) return (await sameOrigin()).transport;
    // The first time, a Worker of this origin has to say where its module is. It runs nothing meanwhile.
    const launcher = located ? null : await sameOrigin();
    const href = located;
    try {
      if (!href) throw new Error('the Worker did not say where it was loaded from');
      const opened = await opaque(href);
      launcher?.transport.terminate();
      return opened.transport;
    } catch (reason) {
      if (fallback) return (launcher ?? (await sameOrigin())).transport;
      launcher?.transport.terminate();
      throw new SandboxError('isolation', `The sandbox could not start in a Worker with an origin of its own: ${messageOf(reason)}. ${HOST_MUST}`, { cause: reason });
    }
  };
}
