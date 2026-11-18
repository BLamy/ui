/* @internal Starting the Worker where the code is safe to run.

   The app starts a Worker the way every bundler understands, `new Worker(new URL('./sandbox.worker.ts', import.meta.url),
   { type: 'module' })`, so its bundler builds the file with the runtime in it. That Worker has the page's origin, so by
   default nothing is run in it: it only says where it was loaded from. A second Worker is then started from a `data:`
   URL that imports that same module. A `data:` Worker has an opaque origin of its own: IndexedDB, the Cache API, OPFS
   and locks refuse it, it has no cookies, localStorage or DOM, and what it fetches from the site goes without
   credentials. The first Worker is ended as soon as the second one answers.

   The module then has to be fetched across origins, so the host must serve it, and every chunk it imports, with
   `Access-Control-Allow-Origin`. Where it doesn't, the sandbox fails to start and says so. A Worker of the page's origin
   is given to the sandbox only when the caller asked for that (`isolation: 'same-origin'`) or allowed it
   (`fallback: 'same-origin'`), and never when the sandbox asks for an isolated Worker and nothing else (`only`): it
   does that once code has run in one (host.ts). */
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
  /** How long a Worker gets to say it has loaded, ms. Not finite: for ever. */
  timeout?: number;
  /** Starts the Worker with its own origin, from a `data:` URL. The default is the browser's `Worker`. */
  isolated?: (url: string, options: WorkerOptions) => WorkerLike;
}

const WORKER_NAME = 'bl-sandbox';

const HOST_MUST = 'The host must serve the Worker\'s module, and every chunk it imports, with the header '
  + '"Access-Control-Allow-Origin: *" (GitHub Pages does; a Vite dev server does not by default), and a '
  + 'Content-Security-Policy, if the page has one, must allow data: in worker-src.';
const OR_ELSE = 'To run without an origin of its own instead, pass fallback: \'same-origin\' or isolation: \'same-origin\': '
  + 'the code can then reach this site\'s IndexedDB and caches.';
const NO_WAY_BACK = 'This sandbox has run code in a Worker with an origin of its own, so it does not continue in one of the '
  + 'page\'s origin: what that code wrote is on its disk. Restart it once the host serves the Worker again.';

/** What a `data:` Worker runs: the app's Worker module, imported by its address. */
export const isolatedSource = (href: string) =>
  `import(${JSON.stringify(href)}).catch((error) => postMessage({ type: 'load-failed', message: String(error) }));`;

interface Opened {
  transport: SandboxTransport;
  /** Where the Worker's module was loaded from, and the origin it reports. */
  href: string;
  origin: string;
}

const calledOff = () => new SandboxError('worker', 'The start of the sandbox\'s Worker was called off.');

/** Resolves once the Worker's module says hello; rejects with why it couldn't. The Worker is ended when it can't, and
 *  when `signal` is aborted first. */
function open(worker: WorkerLike, isolation: SandboxIsolation, timeout: number, signal?: AbortSignal): Promise<Opened> {
  return new Promise((resolve, reject) => {
    const transport: SandboxTransport = {
      isolation,
      hostFetch: false,
      post: (message, transfer) => worker.postMessage(message, transfer ?? []),
      terminate: () => worker.terminate(),
      onmessage: null,
      onerror: null,
    };
    let said = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (why: Error) => {
      if (said) return;
      said = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      reject(why);
    };
    const abort = () => fail(calledOff());
    if (Number.isFinite(timeout)) timer = setTimeout(() => fail(new Error('it did not answer. Is it a file that calls serveSandbox()?')), Math.max(0, timeout));
    signal?.addEventListener('abort', abort, { once: true });
    worker.addEventListener('message', ({ data }: MessageEvent<RuntimeMessage>) => {
      if (said) {
        transport.onmessage?.(data);
        return;
      }
      if (data?.type === 'hello') {
        said = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        // Said by the library's code, before anything else is loaded in the Worker.
        transport.hostFetch = data.hostFetch === true;
        resolve({ transport, href: typeof data.href === 'string' ? data.href : '', origin: typeof data.origin === 'string' ? data.origin : '' });
      } else if (data?.type === 'load-failed') {
        fail(new Error(typeof data.message === 'string' ? data.message : 'its module could not be loaded'));
      }
    });
    worker.addEventListener('error', (event: Event) => {
      event.preventDefault?.();
      const message = (event as ErrorEvent).message || 'its script could not be loaded';
      // After hello, the Worker is the sandbox's: it decides what an error means.
      if (said) transport.onerror?.(message);
      else fail(new Error(message));
    });
  });
}

export function createSpawner(options: SpawnerOptions): SpawnTransport {
  const { fallback, timeout = 30_000 } = options;
  const isolated = options.isolated ?? ((url, workerOptions) => new Worker(url, workerOptions));
  /** Where the app's bundler put the Worker's module, once a Worker has said. */
  let located: string | null = null;
  /** Whether a Worker of the page's origin may be handed to the sandbox at all. */
  const mayBeSameOrigin = options.isolation === 'same-origin' || fallback;

  const sameOrigin = async (signal?: AbortSignal): Promise<Opened> => {
    if (signal?.aborted) throw calledOff();
    let worker: WorkerLike;
    try {
      worker = options.worker();
    } catch (reason) {
      throw new SandboxError('worker', `The sandbox's Worker could not be started: ${messageOf(reason)}`, { cause: reason });
    }
    try {
      const opened = await open(worker, 'same-origin', timeout, signal);
      if (/^https?:/.test(opened.href)) located = opened.href;
      return opened;
    } catch (reason) {
      if (reason instanceof SandboxError) throw reason;
      throw new SandboxError('worker', `The sandbox's Worker could not be started: ${messageOf(reason)}`, { cause: reason });
    }
  };

  const opaque = async (href: string, signal?: AbortSignal): Promise<Opened> => {
    const worker = isolated(`data:text/javascript;charset=utf-8,${encodeURIComponent(isolatedSource(href))}`, { type: 'module', name: WORKER_NAME });
    const opened = await open(worker, 'opaque-origin', timeout, signal);
    // A browser that gave a `data:` Worker the page's origin would not be isolating anything.
    if (opened.origin !== 'null') {
      opened.transport.terminate();
      throw new Error(`this browser gave the Worker the origin ${opened.origin}`);
    }
    return opened;
  };

  return async ({ only, signal } = {}) => {
    if (signal?.aborted) throw calledOff();
    if (only === 'same-origin' && !mayBeSameOrigin) {
      throw new SandboxError('isolation', 'The sandbox asked for a Worker of the page\'s origin, which the caller did not allow.');
    }
    if (only === 'same-origin' || (!only && options.isolation === 'same-origin')) return (await sameOrigin(signal)).transport;
    /** Whether, if the isolated Worker can't load, one of the page's origin may stand in. */
    const mayFallBack = !only && fallback;
    // The first time, a Worker of this origin has to say where its module is. It runs nothing meanwhile.
    const launcher = located ? null : await sameOrigin(signal);
    const href = located;
    try {
      if (!href) throw new Error('the Worker did not say where it was loaded from');
      const opened = await opaque(href, signal);
      launcher?.transport.terminate();
      return opened.transport;
    } catch (reason) {
      if (signal?.aborted) {
        launcher?.transport.terminate();
        throw calledOff();
      }
      if (mayFallBack) return (launcher ?? (await sameOrigin(signal))).transport;
      launcher?.transport.terminate();
      const why = `The sandbox could not start in a Worker with an origin of its own: ${messageOf(reason)}.`;
      throw new SandboxError('isolation', only ? `${why} ${NO_WAY_BACK} ${HOST_MUST}` : `${why} ${HOST_MUST} ${OR_ELSE}`, { cause: reason });
    }
  };
}
