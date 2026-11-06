import { isTailnetHost } from '@/lib/tailscale-policy';
import type { RuntimeFetchRequest, RuntimeFetchResponse } from './protocol';

export function isTailnetUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return (url.protocol === 'http:' || url.protocol === 'https:') && isTailnetHost(url.hostname);
  } catch { return false; }
}

/** Leave package downloads and ordinary web requests in the Worker. Only tailnet HTTP uses the page's device. */
export function createWorkerTailnetFetch(
  send: (request: RuntimeFetchRequest, signal: AbortSignal) => Promise<RuntimeFetchResponse>,
  fallback: typeof fetch,
): typeof fetch {
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!isTailnetUrl(url)) return fallback(input, init);
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
