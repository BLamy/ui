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
    return responseOf(result);
  };
}

/** Statuses a response has no body with: `new Response` refuses one, even an empty one. */
const NULL_BODY = new Set([204, 205, 304]);

/** The page's answer as a `Response`, or a `TypeError`, as `fetch` fails, when it can't be one: a status outside 200 to
 *  599 (a page's `fetch` gives 0 for a redirect it was told not to follow), or a status text that isn't one. */
function responseOf(result: SandboxFetchResponse): Response {
  const { status } = result;
  if (!Number.isInteger(status) || status < 200 || status > 599) throw new TypeError(`The page answered with the status ${status}, which a response can't have.`);
  const body = NULL_BODY.has(status) ? null : result.body as BodyInit | null;
  try {
    return new Response(body, { status, statusText: result.statusText, headers: result.headers });
  } catch (error) {
    throw new TypeError(`The page's answer can't be a response: ${error instanceof Error ? error.message : String(error)}`);
  }
}
