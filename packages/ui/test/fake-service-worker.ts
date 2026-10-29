/* A fake service-worker global for unit tests: runs lib/tailscale-router/tailscale-sw.js in Node with a stand-in
   `self` (location, clients, events) and lets a test dispatch fetch and message events to it, and a stand-in
   `navigator.serviceWorker` that registers it. Real Request/Response/Headers/ReadableStream/MessageChannel (Node's). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(fileURLToPath(new URL('../src/lib/tailscale-router/tailscale-sw.js', import.meta.url)), 'utf8');

type Listener = (event: unknown) => void;

export interface FakeWindowClient {
  id: string;
  type: 'window';
  frameType: 'top-level' | 'nested';
  url: string;
  postMessage(message: unknown): void;
  received: unknown[];
}

export interface SwMatch { route: boolean; reason: string }

export interface FakeServiceWorkerGlobal {
  scriptUrl: string;
  clients: FakeWindowClient[];
  /** Calls to the worker's `fetch` (the network fallback). */
  network: Request[];
  /** Dispatches a fetch event; resolves to the response the worker gave, or null when it did not call respondWith. `event`
   *  sets the client ids, and the mode and destination a Request built in Node cannot have (`navigate`, `iframe`). */
  fetch(request: Request, event?: FetchEventInit): Promise<Response | null>;
  message(data: unknown, source: FakeWindowClient, ports?: MessagePort[]): void;
  exposed: { version: number; policy: Record<string, unknown>; match: (url: string, method: string, policy: unknown, origin?: string) => SwMatch };
}

export interface FetchEventInit {
  clientId?: string;
  resultingClientId?: string;
  mode?: string;
  destination?: string;
}

/** `request` with the mode and destination overridden (Node's Request refuses `navigate`). */
function asRequest(request: Request, init: FetchEventInit): Request {
  if (!init.mode && !init.destination) return request;
  return new Proxy(request, {
    get(target, key) {
      if (key === 'mode' && init.mode) return init.mode;
      if (key === 'destination' && init.destination) return init.destination;
      const v = Reflect.get(target, key, target) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}

export function loadServiceWorker(scriptUrl: string, network: (r: Request) => Promise<Response> = async () => new Response('from the network', { headers: { 'x-from': 'network' } })): FakeServiceWorkerGlobal {
  const listeners: Record<string, Listener[]> = {};
  const clients: FakeWindowClient[] = [];
  const networkCalls: Request[] = [];
  const self: Record<string, unknown> = {
    location: new URL(scriptUrl),
    registration: { scope: new URL('./', scriptUrl).href },
    addEventListener: (type: string, fn: Listener) => { (listeners[type] ??= []).push(fn); },
    skipWaiting: () => Promise.resolve(),
    clients: { matchAll: async () => clients, claim: async () => undefined },
  };
  const fakeFetch = (input: Request) => { networkCalls.push(input); return network(input); };
  // eslint-disable-next-line no-new-func -- runs the worker script as the browser would, with our stand-in globals
  new Function('self', 'fetch', SOURCE)(self, fakeFetch);
  const exposed = self.__blTailscaleRouter as FakeServiceWorkerGlobal['exposed'];
  return {
    scriptUrl,
    clients,
    network: networkCalls,
    exposed,
    async fetch(request, init = {}) {
      let responded: Promise<Response> | null = null;
      const event = {
        request: asRequest(request, init), clientId: init.clientId ?? '', resultingClientId: init.resultingClientId ?? '',
        respondWith: (p: Promise<Response> | Response) => { responded = Promise.resolve(p); },
      };
      for (const l of listeners.fetch ?? []) l(event);
      return responded ? await responded : null;
    },
    message(data, source, ports = []) {
      for (const l of listeners.message ?? []) l({ data, source, ports, origin: new URL(scriptUrl).origin });
    },
  };
}

export function fakeWindowClient(id = 'tab-1', frameType: 'top-level' | 'nested' = 'top-level'): FakeWindowClient {
  const received: unknown[] = [];
  const client: FakeWindowClient = {
    id, type: 'window', frameType, url: 'https://app.example/', received,
    postMessage: (m) => { received.push(m); onClientMessage?.(m); },
  };
  let onClientMessage: ((m: unknown) => void) | null = null;
  Object.defineProperty(client, 'onMessage', { set: (fn: (m: unknown) => void) => { onClientMessage = fn; } });
  return client;
}

/** A `navigator.serviceWorker` whose `register()` loads the worker script into a fake global, controlled by `client`. */
export function fakeServiceWorkerContainer(client: FakeWindowClient, network?: (r: Request) => Promise<Response>) {
  const listeners: Record<string, Set<(e: unknown) => void>> = {};
  let sw: FakeServiceWorkerGlobal | null = null;
  const worker = {
    state: 'activated',
    postMessage: (data: unknown, transfer: unknown[] = []) => {
      sw?.message(data, client, transfer.filter((t): t is MessagePort => typeof (t as MessagePort).postMessage === 'function'));
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  const container = {
    controller: null as typeof worker | null,
    register: async (url: string) => {
      sw = loadServiceWorker(url, network);
      sw.clients.push(client);
      container.controller = worker;
      (client as unknown as { onMessage: (m: unknown) => void }).onMessage = (m) => listeners.message?.forEach((l) => l({ data: m }));
      return { active: worker, waiting: null, installing: null, unregister: async () => true };
    },
    addEventListener: (type: string, fn: (e: unknown) => void) => { (listeners[type] ??= new Set()).add(fn); },
    removeEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type]?.delete(fn); },
  };
  return { container: container as unknown as ServiceWorkerContainer, worker: () => sw };
}
