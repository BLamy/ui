import type { OpenCodeHostBridge } from '@/lib/open-code-host';

export const DEFAULT_OPENCODE_PREVIEW_URL =
  'https://bl-cors-proxy.brett-lamy.workers.dev/opencode-preview/';

export function openCodePreviewFrameUrl(
  base: string,
  session: string,
  port: number,
  hostUrl: string,
): string {
  const url = new URL(base, hostUrl);
  if (url.origin === new URL(hostUrl).origin)
    throw new Error(
      'OpenCode app previews need a separate origin from the host page.',
    );
  if (!/^https?:$/.test(url.protocol) || !/^[a-f\d-]{36}$/.test(session))
    throw new Error('Invalid OpenCode preview host.');
  url.pathname = url.pathname.replace(/\/?$/, '/') + session + '/host.html';
  url.search = new URLSearchParams({ port: String(port) }).toString();
  return url.href;
}

function base64(bytes: Uint8Array): string {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}

/** Connect the unchanged AlmostNode worker protocol directly to this container. No app payload goes to Cloudflare. */
export function connectOpenCodePreview(options: {
  frame: HTMLIFrameElement;
  host: OpenCodeHostBridge;
  session: string;
  port: number;
  url: string;
  onError(message: string): void;
}): () => void {
  const origin = new URL(options.url).origin;
  let channel: MessageChannel | undefined;
  const timeout = setTimeout(
    () =>
      options.onError(
        'The AlmostNode preview service worker did not connect. Reload the app preview.',
      ),
    20000,
  );
  const keepalive = setInterval(
    () => channel?.port1.postMessage({ type: 'keepalive' }),
    15000,
  );
  let closed = false;
  const receive = (event: MessageEvent) => {
    if (
      event.source !== options.frame.contentWindow ||
      event.origin !== origin ||
      event.data?.session !== options.session
    )
      return;
    if (event.data.type === 'bl-opencode-preview:error') {
      clearTimeout(timeout);
      options.onError(String(event.data.message));
      return;
    }
    if (event.data.type === 'bl-opencode-preview:connected') {
      clearTimeout(timeout);
      return;
    }
    if (event.data.type !== 'bl-opencode-preview:ready' || channel) return;
    channel = new MessageChannel();
    const transport = channel.port1;
    transport.onmessage = async (message: MessageEvent) => {
      const input = message.data;
      if (
        closed ||
        !input ||
        input.type !== 'request' ||
        !['string', 'number'].includes(typeof input.id)
      )
        return;
      try {
        const data = input.data;
        if (
          data?.port !== options.port ||
          typeof data.url !== 'string' ||
          !data.url.startsWith('/') ||
          data.url.startsWith('//') ||
          typeof data.method !== 'string' ||
          !data.headers ||
          typeof data.headers !== 'object'
        )
          throw new Error('Invalid AlmostNode preview request.');
        if (
          !options.host.previews
            ?.list()
            .some((entry) => entry.port === options.port)
        )
          throw new Error('The app port is closed.');
        const headers = new Headers(data.headers);
        headers.delete('cookie');
        const response = await options.host.previews.fetch(
          options.port,
          new Request('https://preview.internal' + data.url, {
            method: data.method,
            headers,
            body:
              data.method === 'GET' || data.method === 'HEAD'
                ? undefined
                : data.body,
          }),
        );
        if (closed) return;
        const body = new Uint8Array(await response.arrayBuffer());
        const result = {
          statusCode: response.status,
          statusMessage: response.statusText,
          headers: Object.fromEntries(response.headers),
        };
        if (data.streaming) {
          transport.postMessage({
            type: 'stream-start',
            id: input.id,
            data: result,
          });
          if (body.length)
            transport.postMessage({
              type: 'stream-chunk',
              id: input.id,
              data: { chunkBase64: base64(body) },
            });
          transport.postMessage({ type: 'stream-end', id: input.id });
        } else
          transport.postMessage({
            type: 'response',
            id: input.id,
            data: { ...result, bodyBase64: base64(body) },
          });
      } catch (error) {
        if (closed) return;
        if (input.data?.streaming) {
          transport.postMessage({
            type: 'stream-start',
            id: input.id,
            data: {
              statusCode: 502,
              statusMessage: 'Preview unavailable',
              headers: { 'content-type': 'text/plain' },
            },
          });
          transport.postMessage({
            type: 'stream-chunk',
            id: input.id,
            data: {
              chunkBase64: base64(new TextEncoder().encode(String(error))),
            },
          });
          transport.postMessage({ type: 'stream-end', id: input.id });
        } else
          transport.postMessage({
            type: 'response',
            id: input.id,
            error: String(error),
          });
      }
    };
    transport.postMessage({
      type: 'server-registered',
      data: { port: options.port, hostname: '0.0.0.0' },
    });
    options.frame.contentWindow?.postMessage(
      { type: 'bl-opencode-preview:connect', session: options.session },
      origin,
      [channel.port2],
    );
  };
  window.addEventListener('message', receive);
  return () => {
    closed = true;
    clearTimeout(timeout);
    clearInterval(keepalive);
    window.removeEventListener('message', receive);
    channel?.port1.close();
  };
}
