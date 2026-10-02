import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* PGlite in a real browser: lazy loading (no WASM until a provider mounts, one download under StrictMode), the hooks,
   persistence in IndexedDB and in OPFS (through a worker), tabs that share one worker database, and hosting the
   WebAssembly yourself (`assets`). The docs app mounts every demo inside <StrictMode>. */
// Booting Postgres (and a worker) on a cold dev server takes a while on a CI runner.
test.describe.configure({ timeout: 120_000 });

/** The dev server's base (`/ui/` in CI, see apps/docs/vite.config.mts), read from the Vite client script it injected. */
const DEV_BASE = () => document.querySelector('script[src*="@vite/client"]')?.getAttribute('src')?.replace('@vite/client', '') ?? '/';

const wasmRequests = (page) => {
  const seen = [];
  page.on('request', (r) => {
    if (/pglite\.wasm|initdb\.wasm|pglite\.data/.test(r.url())) seen.push(r.url().split('/').pop().split('?')[0]);
  });
  return seen;
};

test('nothing downloads until a provider mounts', async ({ page }) => {
  const seen = wasmRequests(page);
  await openDemo(page, 'badge/variants', '[data-slot=badge]');
  await page.waitForTimeout(1500);
  expect(seen).toEqual([]);
});

test('one database is opened under StrictMode: each binary is fetched once', async ({ page }) => {
  const seen = wasmRequests(page);
  await openDemo(page, 'pglite/basic', 'ul');
  await expect(page.getByRole('status').last()).toContainText(/PostgreSQL \d+\.\d+ · PGlite \d+\.\d+\.\d+ · memory:\/\//, { timeout: 30_000 });
  expect(seen.sort()).toEqual(['initdb.wasm', 'pglite.data', 'pglite.wasm']);
});

test('useQuery and useExec: add and delete notes, parameters are bound', async ({ page }) => {
  await openDemo(page, 'pglite/basic', 'form');
  const list = page.getByRole('list');
  await expect(list.getByRole('listitem')).toHaveCount(2, { timeout: 30_000 });
  await page.getByLabel('New note').fill("Robert'); drop table notes;--");
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByRole('listitem').first()).toContainText("Robert'); drop table notes;--");
  await list.getByRole('listitem').first().getByRole('button', { name: /Delete note/ }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
});

test('useLiveQuery follows writes', async ({ page }) => {
  await openDemo(page, 'pglite/live', 'ol');
  const board = page.getByRole('list', { name: 'Leaderboard' });
  await expect(board.getByRole('listitem')).toHaveCount(3, { timeout: 30_000 });
  const total = async () => (await board.innerText()).split('\n').filter((l) => /^\d+$/.test(l.trim())).map(Number);
  const before = (await total()).reduce((a, b) => a + b, 0);
  await page.getByRole('button', { name: 'Score some points' }).click();
  await expect.poll(async () => (await total()).reduce((a, b) => a + b, 0)).toBeGreaterThan(before);
});

test('an idb:// database persists across a reload, and two pages never open it together', async ({ context }) => {
  const a = await context.newPage();
  await openDemo(a, 'pglite/persistent', '[data-testid=visit-count]');
  const count = (p) => p.getByTestId('visit-count');
  await expect(count(a)).toHaveText('0', { timeout: 30_000 });
  await a.getByRole('button', { name: 'Record a visit' }).click();
  await a.getByRole('button', { name: 'Record a visit' }).click();
  await expect(count(a)).toHaveText('2');

  // a second page: blocked while the first holds the lock, with no wasm fetched for it
  const b = await context.newPage();
  const seen = wasmRequests(b);
  await b.goto('/?demo=pglite/persistent&theme=light');
  await expect(b.getByText('This database is open in another tab.')).toBeVisible({ timeout: 30_000 });
  await b.waitForTimeout(1500);
  expect(seen).toEqual([]);
  await expect(count(b)).toHaveCount(0);

  // closing the first hands it over; the data survived
  await a.close();
  await expect(count(b)).toHaveText('2', { timeout: 30_000 });
  await b.reload();
  await expect(count(b)).toHaveText('2', { timeout: 30_000 });
});

test('in a worker, tabs share one database live (IndexedDB)', async ({ context }) => {
  const a = await context.newPage();
  await openDemo(a, 'pglite/worker', '[data-testid=click-count]');
  await expect(a.getByRole('status').last()).toContainText('idb://bl-docs-worker · Web Worker', { timeout: 60_000 });
  const b = await context.newPage();
  await openDemo(b, 'pglite/worker', '[data-testid=click-count]');
  await expect(b.getByRole('status').last()).toContainText('Web Worker', { timeout: 60_000 });
  await a.getByRole('button', { name: 'Click' }).click();
  await a.getByRole('button', { name: 'Click' }).click();
  await expect(a.getByTestId('click-count')).toHaveText('2');
  // the other tab sees it without reloading: one database, two tabs
  await expect(b.getByTestId('click-count')).toHaveText('2', { timeout: 15_000 });
  await b.getByRole('button', { name: 'Click' }).click();
  await expect(a.getByTestId('click-count')).toHaveText('3', { timeout: 15_000 });
  await a.close();
  await b.reload();
  await expect(b.getByTestId('click-count')).toHaveText('3', { timeout: 60_000 });
});

test('in a worker, opfs-ahp:// persists across a reload', async ({ page }) => {
  await openDemo(page, 'pglite/worker', '[data-testid=click-count]');
  await page.getByRole('button', { name: 'OPFS' }).click();
  await expect(page.getByRole('status').last()).toContainText('opfs-ahp://bl-docs-worker · Web Worker', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Click' }).click();
  await expect(page.getByTestId('click-count')).toHaveText('1');
  await page.reload();
  await page.getByRole('button', { name: 'OPFS' }).click();
  await expect(page.getByTestId('click-count')).toHaveText('1', { timeout: 60_000 });
});

test('assets: the WebAssembly can be hosted at URLs of your choosing', async ({ page }) => {
  // The engine's three binaries, served from a path the page names — here, intercepted from node_modules.
  const dist = join(dirname(createRequire(import.meta.url).resolve('@electric-sql/pglite')), '');
  const files = { 'pglite.wasm': 'application/wasm', 'initdb.wasm': 'application/wasm', 'pglite.data': 'application/octet-stream' };
  const hosted = [];
  await page.route('**/hosted-assets/*', (route) => {
    const name = route.request().url().split('/').pop();
    hosted.push(name);
    return route.fulfill({ body: readFileSync(join(dist, name)), contentType: files[name] });
  });
  // Any binary the default location serves would be a failure of the option.
  const fromDefault = [];
  page.on('request', (r) => {
    if (/@electric-sql.*\.(wasm|data)/.test(r.url())) fromDefault.push(r.url());
  });
  await page.goto('/?demo=badge/variants');
  // The library module straight from the dev server, as an app that imports `openDatabase` would have it.
  const core = '@fs' + new URL('../../packages/ui/src/lib/pglite-core.ts', import.meta.url).pathname;
  const base = await page.evaluate(DEV_BASE);
  const answer = await page.evaluate(async (path) => {
    const { openDatabase } = await import(/* @vite-ignore */ path);
    const opened = await openDatabase({
      assets: { wasm: '/hosted-assets/pglite.wasm', initdbWasm: '/hosted-assets/initdb.wasm', data: '/hosted-assets/pglite.data' },
    });
    const { rows } = await opened.db.query('select 40 + 2 as answer');
    await opened.close();
    return rows[0].answer;
  }, base + core);
  expect(answer).toBe(42);
  expect(hosted.sort()).toEqual(['initdb.wasm', 'pglite.data', 'pglite.wasm']);
  expect(fromDefault).toEqual([]);
});

test('a data-directory archive restores into a NEW idb:// database; an existing one is refused; the stored version is readable', async ({ page }) => {
  await page.goto('/?demo=badge/variants');
  const root = (await page.evaluate(DEV_BASE)) + '@fs' + new URL('../../packages/ui/src/lib/', import.meta.url).pathname;
  const out = await page.evaluate(async (base) => {
    const core = await import(/* @vite-ignore */ `${base}pglite-core.ts`);
    const transfer = await import(/* @vite-ignore */ `${base}pglite-transfer.ts`);
    const src = await core.openDatabase();
    await src.db.exec("create table kept (v text); insert into kept values ('from the archive')");
    const { file, postgresMajor } = await transfer.exportDatabase(src.db, 'datadir');
    await src.close();

    const restored = await transfer.importDatabase({ dataDir: 'idb://restored' }, file);
    const rows = (await restored.db.query('select v from kept')).rows;
    await restored.close();
    const stored = await core.peekDataDirVersion('idb://restored');

    const again = await transfer.importDatabase({ dataDir: 'idb://restored' }, file).catch((e) => e.code);
    await core.deleteDatabase('idb://restored');
    const afterDelete = await core.peekDataDirVersion('idb://restored');
    return { rows, stored, postgresMajor, again, afterDelete };
  }, root);
  expect(out.rows).toEqual([{ v: 'from the archive' }]);
  expect(out.stored).toBe(String(out.postgresMajor));
  expect(out.again).toBe('DATABASE_EXISTS');
  expect(out.afterDelete).toBeNull();
});
