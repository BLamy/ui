import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* The Sandbox library's promise, in a real browser: code run in a sandbox can't read the embedding page's storage or
   cookies and has no DOM, and a sandbox never runs with the page's origin unless it was told it may.

   The page is the docs' live example (`examples/sandbox/run-script`). The script it runs is replaced with a probe that
   reaches for everything a page keeps: it gets the real global object the way a hostile package would, and reports
   what each API answered. The same probe is then run in a same-origin Worker as a control, where it does read what the
   page stored: so a "refused" in the first run is the origin's doing, and not a probe that can't find anything. */

const SECRET = 'page-secret-4417';
const COOKIE_URL = '/__sandbox-probe/cookie';

const status = (page) => page.getByTestId('sandbox-status');
const output = (page) => page.getByTestId('sandbox-output');
const run = (page) => page.getByRole('button', { name: 'Run', exact: true });

/* What the sandboxed code runs. `Function('return this')()` is the Worker's real global, whatever the runtime wraps a
   script in. */
const probe = (cookieUrl) => `
const g = Function('return this')();
const tried = async (attempt) => { try { return await attempt(); } catch (error) { return 'refused: ' + error.name; } };
(async () => {
  const report = {
    origin: String(g.origin),
    document: typeof g.document,
    windowDocument: typeof (g.window && g.window.document),
    localStorage: typeof g.localStorage,
    sessionStorage: typeof g.sessionStorage,
    documentCookie: typeof (g.document && g.document.cookie),
    indexedDB: await tried(() => new Promise((resolve) => {
      const open = g.indexedDB.open('bl-sandbox-probe');
      open.onerror = () => resolve('refused: ' + (open.error && open.error.name));
      open.onsuccess = () => {
        if (!open.result.objectStoreNames.contains('secrets')) return resolve('empty');
        const get = open.result.transaction('secrets').objectStore('secrets').get('token');
        get.onsuccess = () => resolve('read: ' + get.result);
        get.onerror = () => resolve('refused: ' + get.error.name);
      };
    })),
    caches: await tried(async () => {
      const hit = await (await g.caches.open('bl-sandbox-probe')).match('/bl-sandbox-probe');
      return hit ? 'read: ' + await hit.text() : 'empty';
    }),
    opfs: await tried(async () => {
      const root = await g.navigator.storage.getDirectory();
      return 'read: ' + await (await (await root.getFileHandle('bl-sandbox-probe.txt')).getFile()).text();
    }),
    cookie: await tried(async () => 'sent: ' + await (await g.fetch(${JSON.stringify(cookieUrl)}, { credentials: 'include' })).text()),
  };
  console.log('PROBE ' + JSON.stringify(report));
})();
`;

/** Puts a secret everywhere a page keeps things. */
async function storeSecrets(page) {
  await page.evaluate(async (secret) => {
    localStorage.setItem('bl-sandbox-probe', secret);
    sessionStorage.setItem('bl-sandbox-probe', secret);
    document.cookie = `bl_sandbox_probe=${secret}; path=/`;
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('bl-sandbox-probe', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('secrets');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const put = open.result.transaction('secrets', 'readwrite').objectStore('secrets').put(secret, 'token');
        put.onsuccess = () => { open.result.close(); resolve(); };
        put.onerror = () => reject(put.error);
      };
    });
    await (await caches.open('bl-sandbox-probe')).put('/bl-sandbox-probe', new Response(secret));
    const file = await (await navigator.storage.getDirectory()).getFileHandle('bl-sandbox-probe.txt', { create: true });
    const writable = await file.createWritable();
    await writable.write(secret);
    await writable.close();
  }, SECRET);
}

/** An address on the page's own site that answers with the cookies the browser sent it, to whoever asks. */
async function echoCookies(page) {
  await page.route(`**${COOKIE_URL}`, async (route) => {
    const headers = await route.request().allHeaders();
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      headers: { 'access-control-allow-origin': headers.origin ?? '*', 'access-control-allow-credentials': 'true' },
      body: headers.cookie ?? 'no cookies',
    });
  });
}

/* A Worker with an origin of its own asks for its module across origins, and Vite's dev server sends no CORS headers
   to an origin it doesn't know. This plays the host that does, as GitHub Pages and Cloudflare Pages do: it adds the
   header to what the dev server answers such a Worker, and counts what it asked for. */
async function serveWithCors(page) {
  const asked = [];
  await page.route('**/*', async (route) => {
    if (route.request().headers().origin !== 'null') return route.fallback();
    asked.push(route.request().url());
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
  });
  return asked;
}

async function runProbe(page) {
  await page.getByRole('textbox', { name: 'index.js', exact: true }).fill(probe(new URL(COOKIE_URL, page.url()).href));
  await run(page).click();
  await expect(output(page)).toContainText('PROBE {', { timeout: 60_000 });
  const report = JSON.parse((await output(page).textContent()).split('PROBE ')[1]);
  if (process.env.SANDBOX_E2E_LOG) console.log(JSON.stringify(report));
  return report;
}

test('sandboxed code runs with an origin of its own: no DOM, and none of the page\'s storage or cookies', async ({ page }) => {
  test.setTimeout(120_000);
  const asked = await serveWithCors(page);
  await echoCookies(page);
  await openDemo(page, 'sandbox/run-script', '[data-testid=sandbox-status]');
  await storeSecrets(page);
  // Nothing has started: reading the page loads no Worker and no runtime.
  await expect(status(page)).toHaveAttribute('data-status', 'idle');
  expect(asked).toEqual([]);

  const report = await runProbe(page);
  await expect(status(page)).toHaveAttribute('data-status', 'ready');
  // What the library reports is what the Worker itself found.
  await expect(status(page)).toHaveAttribute('data-isolation', 'opaque-origin');
  expect(report.origin).toBe('null');
  expect(asked.some((url) => url.includes('sandbox.worker'))).toBe(true);

  // No DOM, and nothing a document keeps.
  expect(report).toMatchObject({ document: 'undefined', windowDocument: 'undefined', localStorage: 'undefined', sessionStorage: 'undefined', documentCookie: 'undefined' });
  // The browser refuses an opaque origin every store the page's origin has.
  expect(report.indexedDB).toMatch(/^refused: /);
  expect(report.caches).toMatch(/^refused: /);
  expect(report.opfs).toMatch(/^refused: /);
  // A request to the page's own site, asking for credentials, goes without the page's cookie.
  expect(report.cookie).toBe('sent: no cookies');
  expect(JSON.stringify(report)).not.toContain(SECRET);
});

test('a host without CORS headers gets an error, never a silent same-origin run; allowed to, the same code reads the site\'s storage', async ({ page }) => {
  test.setTimeout(120_000);
  const runtime = [];
  page.on('request', (request) => { if (/@agent-wasm[+/_]core/.test(request.url())) runtime.push(request.url()); });
  await echoCookies(page);
  await openDemo(page, 'sandbox/run-script', '[data-testid=sandbox-status]');
  await storeSecrets(page);

  // The dev server as it is: the Worker can't be given an origin of its own.
  await run(page).click();
  await expect(status(page)).toHaveAttribute('data-status', 'failed', { timeout: 60_000 });
  await expect(status(page)).not.toHaveAttribute('data-isolation');
  await expect(page.getByRole('alert')).toContainText('Access-Control-Allow-Origin');
  await expect(page.getByRole('alert')).toContainText("fallback: 'same-origin'");
  await expect(output(page)).toHaveText('');
  // Nothing ran anywhere: the runtime was never asked for.
  expect(runtime).toEqual([]);

  // The reader's decision, and the control for the test above: the same probe, in a Worker of the page's origin.
  await page.getByRole('button', { name: 'Run it in a same-origin Worker', exact: true }).click();
  await expect(status(page)).toHaveAttribute('data-isolation', 'same-origin', { timeout: 60_000 });
  await expect(output(page)).toContainText('Hello from');
  const report = await runProbe(page);
  expect(report.origin).toBe(new URL(page.url()).origin);
  // Still a Worker: no DOM, no localStorage, no document.cookie.
  expect(report).toMatchObject({ document: 'undefined', windowDocument: 'undefined', localStorage: 'undefined', sessionStorage: 'undefined', documentCookie: 'undefined' });
  // This time the runtime was loaded, so the check above could have seen it.
  expect(runtime.length).toBeGreaterThan(0);
  // But the site's stores open, and its cookie goes along.
  expect(report.indexedDB).toBe(`read: ${SECRET}`);
  expect(report.caches).toBe(`read: ${SECRET}`);
  expect(report.opfs).toBe(`read: ${SECRET}`);
  expect(report.cookie).toBe(`sent: bl_sandbox_probe=${SECRET}`);
});
