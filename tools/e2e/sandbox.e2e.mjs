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
   to an origin it doesn't know. This plays the host that does, as GitHub Pages does: it adds the header to what the dev
   server answers such a Worker, and counts what it asked for. (So the header comes from `page.route`, not a real host.) */
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

/** Every request for the runtime, and whether it came from a Worker with an origin of its own. */
function watchRuntime(page) {
  const runtime = [];
  page.on('request', (request) => {
    if (/@agent-wasm[+/_]core/.test(request.url())) runtime.push({ url: request.url(), isolated: request.headers().origin === 'null' });
  });
  return runtime;
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
  const runtime = watchRuntime(page);
  await echoCookies(page);
  await openDemo(page, 'sandbox/run-script', '[data-testid=sandbox-status]');
  await storeSecrets(page);
  // Nothing has started: reading the page loads no Worker and no runtime, from any origin.
  await expect(status(page)).toHaveAttribute('data-status', 'idle');
  expect(runtime).toEqual([]);
  expect(asked).toEqual([]);

  const report = await runProbe(page);
  await expect(status(page)).toHaveAttribute('data-status', 'ready');
  // What the library reports is what the Worker itself found.
  await expect(status(page)).toHaveAttribute('data-isolation', 'opaque-origin');
  expect(report.origin).toBe('null');
  expect(asked.some((url) => url.includes('sandbox.worker'))).toBe(true);
  // The runtime was loaded, and only by the isolated Worker.
  expect(runtime.length).toBeGreaterThan(0);
  expect(runtime.every(({ isolated }) => isolated)).toBe(true);

  // No DOM, and nothing a document keeps.
  expect(report).toMatchObject({ document: 'undefined', windowDocument: 'undefined', localStorage: 'undefined', sessionStorage: 'undefined', documentCookie: 'undefined' });
  // The browser refuses an opaque origin every store the page's origin has.
  expect(report.indexedDB).toMatch(/^refused: /);
  expect(report.caches).toMatch(/^refused: /);
  expect(report.opfs).toMatch(/^refused: /);
  // A request to the page's own site, asking for credentials, goes without the page's cookie. The cookie has no
  // SameSite attribute, so this rests on Chromium treating it as Lax: the docs tell readers to set the attribute.
  expect(report.cookie).toBe('sent: no cookies');
  expect(JSON.stringify(report)).not.toContain(SECRET);
});

test('a host without CORS headers gets an error, never a silent same-origin run; allowed to, the same code reads the site\'s storage', async ({ page }) => {
  test.setTimeout(120_000);
  const runtime = watchRuntime(page);
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
  // This time the runtime was loaded, so the check above could have seen it, and by a Worker the request log tells
  // apart from an isolated one: the fallback tests below rest on that.
  expect(runtime.length).toBeGreaterThan(0);
  expect(runtime.every(({ isolated }) => !isolated)).toBe(true);
  // But the site's stores open, and its cookie goes along.
  expect(report.indexedDB).toBe(`read: ${SECRET}`);
  expect(report.caches).toBe(`read: ${SECRET}`);
  expect(report.opfs).toBe(`read: ${SECRET}`);
  expect(report.cookie).toBe(`sent: bl_sandbox_probe=${SECRET}`);
});

/* ── With `fallback: 'same-origin'`, as the VS Code block passes it ──
   The library is imported into the docs page itself and given the example's Worker file, so that the test can pass an
   option the example doesn't, and post what sandboxed code can post. */

/** Captures where the dev server serves the library and the example's Worker, as the example loads. */
function watchModules(page) {
  const found = {};
  page.on('request', (request) => {
    const url = request.url();
    if (!found.library && /\/lib\/sandbox\/index\.ts(\?|$)/.test(url)) found.library = url;
    if (!found.example && /\/run-script\/index\.tsx(\?|$)/.test(url)) found.example = url;
  });
  return found;
}

/** Makes `window.__sandbox` in the page: a sandbox with fallback allowed, on the example's Worker file. */
async function makeSandbox(page, found) {
  expect(found.library, 'the page loaded the library').toBeTruthy();
  expect(found.example, 'the page loaded the example').toBeTruthy();
  const worker = new URL('sandbox.worker.ts?worker_file&type=module', found.example).href;
  await page.evaluate(async ({ library, worker }) => {
    const { createSandbox } = await import(library);
    window.__sandbox = createSandbox({ worker: () => new Worker(worker, { type: 'module' }), fallback: 'same-origin' });
    window.__exec = async (command) => {
      const chunks = [];
      const exit = await window.__sandbox.run(command, { onOutput: (chunk) => chunks.push(chunk) }).exit;
      return { ...exit, text: chunks.join('') };
    };
  }, { library: found.library, worker });
}

const where = (page) => page.evaluate(() => ({ status: window.__sandbox.status, isolation: window.__sandbox.isolation, error: window.__sandbox.error?.code ?? null }));

/** The probe, run in the page's sandbox: what the code there can reach. */
async function probeIn(page) {
  const source = probe(new URL(COOKIE_URL, page.url()).href);
  const result = await page.evaluate(async (code) => {
    await window.__sandbox.files.write('probe.js', code);
    return window.__exec('node probe.js');
  }, source);
  expect(result.text).toContain('PROBE {');
  return JSON.parse(result.text.split('PROBE ')[1]);
}

/* What sandboxed code does to ask for a Worker of the page's origin: it takes the Worker's real global and posts the
   message the library's own Worker code posts when the runtime can't start. */
const FORGE_FAILED = `Function('return this')().postMessage({ type: 'failed', message: 'pretend the runtime broke' }); console.log('posted')`;

test('with fallback allowed, sandboxed code that posts `failed` stays isolated, and still cannot read the page\'s storage', async ({ page }) => {
  test.setTimeout(120_000);
  await serveWithCors(page);
  const runtime = watchRuntime(page);
  const found = watchModules(page);
  await echoCookies(page);
  await openDemo(page, 'sandbox/run-script', '[data-testid=sandbox-status]');
  await storeSecrets(page);
  await makeSandbox(page, found);

  await page.evaluate(() => window.__sandbox.start());
  expect(await where(page)).toEqual({ status: 'ready', isolation: 'opaque-origin', error: null });

  // The attack: a script asks, in the library's words, for the sandbox to fall back.
  const forged = await page.evaluate(async (code) => {
    await window.__sandbox.files.write('forge.js', code);
    return window.__exec('node forge.js');
  }, FORGE_FAILED);
  expect(forged).toMatchObject({ exitCode: 0, text: expect.stringContaining('posted') });
  await page.waitForTimeout(500);
  expect(await where(page)).toEqual({ status: 'ready', isolation: 'opaque-origin', error: null });

  // Its next command runs where it did: an origin of its own, refused the page's stores and cookie.
  const report = await probeIn(page);
  expect(report.origin).toBe('null');
  expect(report.indexedDB).toMatch(/^refused: /);
  expect(report.caches).toMatch(/^refused: /);
  expect(report.opfs).toMatch(/^refused: /);
  expect(report.cookie).toBe('sent: no cookies');
  expect(JSON.stringify(report)).not.toContain(SECRET);
  // No Worker of the page's origin ever loaded the runtime.
  expect(runtime.length).toBeGreaterThan(0);
  expect(runtime.filter(({ isolated }) => !isolated)).toEqual([]);
});

test('with fallback allowed, a restart stays isolated, and one that can\'t isolate fails instead of running in the page\'s origin', async ({ page }) => {
  test.setTimeout(120_000);
  await serveWithCors(page);
  const runtime = watchRuntime(page);
  const found = watchModules(page);
  await echoCookies(page);
  await openDemo(page, 'sandbox/run-script', '[data-testid=sandbox-status]');
  await storeSecrets(page);
  await makeSandbox(page, found);

  expect((await page.evaluate(() => window.__exec('echo hi'))).text).toContain('hi');
  expect(await where(page)).toEqual({ status: 'ready', isolation: 'opaque-origin', error: null });

  // A restart keeps the isolation it had.
  await page.evaluate(() => { window.__sandbox.restart(); return window.__sandbox.start(); });
  expect(await where(page)).toEqual({ status: 'ready', isolation: 'opaque-origin', error: null });
  expect((await probeIn(page)).origin).toBe('null');

  // The host stops serving the Worker across origins. Code has run isolated, so the sandbox fails rather than fall back.
  await page.unroute('**/*');
  const failure = await page.evaluate(async () => {
    window.__sandbox.restart();
    try {
      await window.__sandbox.start();
      return null;
    } catch (error) {
      return { code: error.code, message: error.message };
    }
  });
  expect(failure).toMatchObject({ code: 'isolation', message: expect.stringContaining('has run code in a Worker with an origin of its own') });
  expect(await where(page)).toEqual({ status: 'failed', isolation: null, error: 'isolation' });
  expect(await page.evaluate(() => window.__exec('echo hi'))).toMatchObject({ exitCode: 1, interrupted: 'unavailable' });
  expect(runtime.filter(({ isolated }) => !isolated)).toEqual([]);
});
