import serviceWorker from './opencode-preview-sw.txt';

/** Host the unchanged @agent-wasm/core 0.4 service worker on an origin separate from BL UI. */
export function openCodePreview(request: Request): Response | undefined {
  const url = new URL(request.url);
  const match = /^\/opencode-preview\/([a-f\d-]{36})\/(host\.html|__sw__\.js)$/.exec(url.pathname);
  if (!match || !['GET', 'HEAD'].includes(request.method)) return;
  const headers = { 'Cache-Control': 'no-store', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Cross-Origin-Embedder-Policy': 'credentialless', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
  if (match[2] === '__sw__.js') return new Response(request.method === 'HEAD' ? null : serviceWorker, { headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' } });
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AlmostNode app preview</title>
<style>body{font:14px system-ui;margin:32px;background:#f4f0e7;color:#244936}</style><p id="status">Connecting to the AlmostNode service worker…</p>
<script>
const session = location.pathname.split('/')[2];
const port = Number(new URLSearchParams(location.search).get('port'));
let connected = false;
addEventListener('message', async event => {
  if (connected || event.source !== parent || event.data?.type !== 'bl-opencode-preview:connect' || event.data.session !== session || !event.ports[0]) return;
  connected = true;
  try {
    const controlled = navigator.serviceWorker.controller ? Promise.resolve() : new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    const registration = await navigator.serviceWorker.register('./__sw__.js', { scope: './' });
    const worker = registration.active || registration.waiting || registration.installing;
    if (!worker) throw new Error('AlmostNode service worker did not start');
    if (worker.state !== 'activated') await new Promise(resolve => worker.addEventListener('statechange', () => { if (worker.state === 'activated') resolve(); }));
    worker.postMessage({ type: 'init', data: { basePath: '/opencode-preview/' + session }, port: event.ports[0] }, [event.ports[0]]);
    worker.postMessage({ type: 'eruda-toggle', data: { enabled: false } });
    await controlled;
    parent.postMessage({ type: 'bl-opencode-preview:connected', session }, event.origin);
    location.replace('./__virtual__/' + port + '/');
  } catch (error) {
    document.querySelector('#status').textContent = error.message;
    parent.postMessage({ type: 'bl-opencode-preview:error', session, message: error.message }, event.origin);
  }
});
if (!Number.isInteger(port) || port < 1 || port > 65535) document.querySelector('#status').textContent = 'Invalid preview port';
else parent.postMessage({ type: 'bl-opencode-preview:ready', session }, '*');
</script></html>`;
  return new Response(request.method === 'HEAD' ? null : html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
}
