/* @internal The Worker's side of the requests the page answers. Sandboxed code reaches the network straight from its
   Worker, as far as the browser's CORS rules allow. A request whose address the Worker's `hostFetch` picks goes to the
   page instead, which decides whether and how to answer it (`onHostFetch`). */
import type { SandboxFetchRequest, SandboxFetchResponse } from './model';

/** A `fetch` that hands the requests `toHost` picks to `send`, and leaves the rest to `fallback`. */
export function createHostFetch(
  toHost: (url: string) => boolean,
  send: (request: SandboxFetchRequest, signal: AbortSignal) => Promise<SandboxFetchResponse>,
  fallback: typeof fetch,
): typeof fetch {
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!toHost(url)) return fallback(input, init);
    const request = new Request(input, init);
    request.signal.throwIfAborted();
    const result = await send({
      url: request.url,
      method: request.method,
      headers: [...request.headers],
      body: request.method === 'GET' || request.method === 'HEAD' ? null : new Uint8Array(await request.arrayBuffer()),
      redirect: request.redirect,
    }, request.signal);
    return new Response(result.body as BodyInit | null, { status: result.status, statusText: result.statusText, headers: result.headers });
  };
}
