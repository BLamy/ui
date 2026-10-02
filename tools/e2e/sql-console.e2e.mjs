import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* SqlConsole against a real PGlite in Chromium: queries, errors, the schema tree, history, copying, export / import,
   persistence across a reload (IndexedDB), the single-tab lock between two pages, a refused version mismatch — and
   axe on the loaded console, which the generic a11y audit (it looks 0.9 s after load, mid-download) cannot see. */
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const READY = '[data-slot=sql-console][data-status=ready]';
const editor = (page) => page.locator('[data-slot=sql-editor-input]');
const results = (page) => page.locator('[data-slot=sql-console-results]');
const setSql = async (page, sql) => {
  await editor(page).fill(sql);
};
const run = async (page) => {
  await editor(page).press('Control+Enter');
};

async function openConsole(page, demo = 'sql-console/console') {
  await openDemo(page, demo, READY);
}

test.describe('queries', () => {
  test.beforeEach(async ({ page }) => {
    await openConsole(page);
  });

  test('the seeded console shows the versions and runs the starter query with ⌘/Ctrl+Enter', async ({ page }) => {
    await expect(page.locator('[data-slot=sql-console-header]')).toContainText(/PostgreSQL 1\d\.\d/);
    await run(page);
    const table = results(page).getByRole('grid');
    await expect(table.getByRole('row')).toHaveCount(1 + 4); // header + four authors
    await expect(table).toContainText('Ursula K. Le Guin');
    await expect(results(page).locator('[data-slot=result-table-summary]')).toHaveText(/4 rows · (<1|\d+) ms/);
  });

  test('a script of several statements gets one result each, formatted by type', async ({ page }) => {
    await setSql(page, "select 1 as a; select null as n, true as b, '{\"k\":[1,2]}'::jsonb as j, '\\xdead'::bytea as x, date '2026-01-02' as d, 12.50::numeric as price;");
    await run(page);
    await expect(results(page).locator('figure')).toHaveCount(2);
    const second = results(page).locator('figure').nth(1);
    await expect(second.locator('[data-kind=null]')).toHaveText('NULL');
    await expect(second.locator('[data-kind=boolean]')).toHaveText('true');
    await expect(second.locator('[data-kind=json]')).toHaveText('{"k":[1,2]}');
    await expect(second.locator('[data-kind=bytea]')).toHaveText('\\xdead');
    await expect(second.locator('[data-kind=date]')).toHaveText('2026-01-02');
    await expect(second.locator('[data-kind=number]').last()).toHaveText('12.50');
  });

  test('a write reports its rows and the schema tree follows', async ({ page }) => {
    await setSql(page, 'create table scratch (id int); insert into scratch values (1), (2);');
    await run(page);
    await expect(results(page).locator('figure')).toHaveCount(2);
    await expect(results(page)).toContainText('2 rows affected');
    await expect(page.getByRole('treegrid', { name: 'Database schema' }).or(page.getByRole('tree', { name: 'Database schema' }))).toContainText('scratch');
  });

  test('an error shows the message, SQLSTATE, the line with a caret, and underlines the token', async ({ page }) => {
    await setSql(page, 'select 1;\nselect * from nope');
    await run(page);
    const alert = page.locator('[data-slot=sql-console-error]');
    await expect(alert).toContainText('relation "nope" does not exist');
    await expect(alert).toContainText('SQLSTATE 42P01');
    await expect(alert).toContainText('LINE 2: select * from nope');
    await expect(alert).toContainText('none of its 2 statements were applied');
    await expect(page.locator('[data-slot=sql-editor-highlight] .underline')).toHaveText('nope');
    // fixing the SQL clears it
    await setSql(page, 'select 1');
    await run(page);
    await expect(alert).toHaveCount(0);
  });

  test('a syntax error carries the position, and the next statement still runs', async ({ page }) => {
    await setSql(page, 'selec 1');
    await run(page);
    await expect(page.locator('[data-slot=sql-console-error]')).toContainText('syntax error at or near "selec"');
    await expect(page.locator('[data-slot=sql-console-error]')).toContainText('LINE 1: selec 1');
    await setSql(page, 'select 2 as ok');
    await run(page);
    await expect(results(page).getByRole('grid')).toContainText('ok');
  });

  test('running a selection runs only the selection', async ({ page }) => {
    await setSql(page, 'select 1 as first_one;\nselect 2 as second_one;');
    await editor(page).evaluate((el) => {
      const i = el.value.indexOf('select 2');
      el.focus();
      el.setSelectionRange(i, el.value.length);
    });
    await run(page);
    await expect(results(page).getByRole('grid')).toContainText('second_one');
    await expect(results(page).getByRole('grid')).not.toContainText('first_one');
  });

  test('choosing a table in the schema tree pastes a select into the editor', async ({ page }) => {
    await setSql(page, '');
    const books = page.getByRole('row', { name: /^books/ }).first();
    await books.click();
    await expect(editor(page)).toHaveValue('select * from books limit 100;');
    await run(page);
    await expect(results(page).locator('[data-slot=result-table-summary]')).toHaveText(/8 rows/);
    // a second pick appends rather than replacing what you wrote
    await page.getByRole('row', { name: /^authors/ }).first().click();
    await expect(editor(page)).toHaveValue(/books limit 100;\nselect \* from authors limit 100;/);
  });

  test('the schema tree is keyboard accessible: arrows expand, Enter picks', async ({ page }) => {
    await setSql(page, '');
    const books = page.getByRole('row', { name: /^books/ }).first();
    await books.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('row', { name: /^title, text/ }).first()).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expect(editor(page)).toHaveValue('select * from books limit 100;');
  });

  test('history lists what you ran; ⌥↑ steps back to it and Escape returns the draft', async ({ page }) => {
    await setSql(page, 'select 41 + 1 as answer');
    await run(page);
    await setSql(page, 'draft text');
    await editor(page).press('Alt+ArrowUp');
    await expect(editor(page)).toHaveValue('select 41 + 1 as answer');
    await editor(page).press('Escape');
    await expect(editor(page)).toHaveValue('draft text');
    await page.getByRole('tab', { name: /History/ }).click();
    await expect(page.getByRole('tabpanel')).toContainText('select 41 + 1 as answer');
  });

  test('Copy CSV and Copy JSON put the rows on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setSql(page, "select 1 as id, 'a, \"b\"' as note");
    await run(page);
    await page.getByRole('button', { name: 'Copy CSV' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('id,note\r\n1,"a, ""b"""');
    await page.getByRole('button', { name: 'Copy JSON' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('"note": "a, \\"b\\""');
  });

  test('a long value is cut and expands', async ({ page }) => {
    await setSql(page, "select repeat('x', 300) as long_value");
    await run(page);
    const cell = results(page).locator('[data-kind=text]').first();
    await expect(cell).toBeVisible();
    await results(page).getByRole('button', { name: 'Expand value' }).click();
    await expect(results(page).locator('pre')).toHaveText('x'.repeat(300));
  });

  test('the loaded console has no axe violations, light or dark', async ({ page }) => {
    await setSql(page, 'select * from books');
    await run(page);
    await expect(results(page).getByRole('grid')).toBeVisible();
    await page.waitForTimeout(1000); // the Run button's label morphs back from "Running…"
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme);
      await page.addScriptTag({ content: AXE });
      const violations = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ') + ' :: ' + n.html.slice(0, 120)) }));
      });
      expect(violations, `axe (${theme})`).toEqual([]);
    }
  });
});

test.describe('export and import', () => {
  test('a SQL export imports into a fresh database, and a data-dir archive is refused by a running one', async ({ page, browser }, testInfo) => {
    await openConsole(page);
    await setSql(page, "create table kept (id int primary key, v text); insert into kept values (1, 'it''s fine'), (2, null);");
    await run(page);
    await expect(results(page)).toContainText('2 rows affected');

    const [sqlDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export SQL' }).click()]);
    expect(sqlDownload.suggestedFilename()).toMatch(/^database-pg\d+\.sql$/);
    const sqlPath = testInfo.outputPath(sqlDownload.suggestedFilename());
    await sqlDownload.saveAs(sqlPath);
    await expect(page.locator('[data-slot=sql-console-notice]')).toContainText(/Exported database-pg\d+\.sql .* from Postgres \d+\.\d+/);
    expect(readFileSync(sqlPath, 'utf8')).toContain('CREATE TABLE public.kept');

    const [dirDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export data dir' }).click()]);
    expect(dirDownload.suggestedFilename()).toMatch(/^database-pg\d+-pglite[\d.]+\.tar\.gz$/);
    await expect(page.locator('[data-slot=sql-console-notice]')).toContainText(/restores only into Postgres \d+/);
    const dirPath = testInfo.outputPath(dirDownload.suggestedFilename());
    await dirDownload.saveAs(dirPath);

    // into a brand-new database (another context: nothing shared)
    const fresh = await (await browser.newContext()).newPage();
    await openConsole(fresh);
    await fresh.locator('[data-slot=sql-editor-input]').fill('select * from kept');
    await fresh.locator('[data-slot=sql-editor-input]').press('Control+Enter');
    await expect(fresh.locator('[data-slot=sql-console-error]')).toContainText('relation "kept" does not exist');
    // importing a dump into a database that already holds those objects changes nothing and says why…
    const [clash] = await Promise.all([fresh.waitForEvent('filechooser'), fresh.getByRole('button', { name: 'Import…' }).click()]);
    await clash.setFiles(sqlPath);
    await expect(fresh.locator('[data-slot=sql-console-error]', { hasText: 'Could not finish' })).toContainText('nothing was changed');
    // …so empty the (seeded) database first, as you would a fresh one
    await fresh.locator('[data-slot=sql-editor-input]').fill('drop schema public cascade; create schema public;');
    await fresh.locator('[data-slot=sql-editor-input]').press('Control+Enter');
    await expect(fresh.locator('[data-slot=sql-console-results]')).toContainText('CREATE');
    const [chooser] = await Promise.all([fresh.waitForEvent('filechooser'), fresh.getByRole('button', { name: 'Import…' }).click()]);
    await chooser.setFiles(sqlPath);
    await expect(fresh.locator('[data-slot=sql-console-notice]')).toContainText(/Imported database-pg\d+\.sql \(dumped from Postgres \d+\.\d+\)/);
    await fresh.locator('[data-slot=sql-editor-input]').fill('select * from kept order by id');
    await fresh.locator('[data-slot=sql-editor-input]').press('Control+Enter');
    const grid = fresh.locator('[data-slot=sql-console-results]').getByRole('grid');
    await expect(grid).toContainText("it's fine");
    await expect(grid.getByRole('row')).toHaveCount(3);
    // the schema tree shows the imported table; a second import clashes and changes nothing
    await expect(fresh.getByRole('row', { name: /^kept/ }).first()).toBeVisible();
    const [again] = await Promise.all([fresh.waitForEvent('filechooser'), fresh.getByRole('button', { name: 'Import…' }).click()]);
    await again.setFiles(sqlPath);
    await expect(fresh.locator('[data-slot=sql-console-error]', { hasText: 'Could not finish' })).toContainText('nothing was changed');

    // a data directory only loads into a NEW database: the open console says so instead of overwriting
    const [dirChooser] = await Promise.all([fresh.waitForEvent('filechooser'), fresh.getByRole('button', { name: 'Import…' }).click()]);
    await dirChooser.setFiles(dirPath);
    await expect(fresh.locator('[data-slot=sql-console-error]', { hasText: 'Could not finish' })).toContainText('only be loaded into a new database');
    await fresh.context().close();
  });
});

test.describe('persistence', () => {
  test('an idb:// database survives a reload', async ({ page }) => {
    await openConsole(page, 'sql-console/persistent');
    await expect(page.locator('[data-slot=sql-console-header]')).toContainText('idb://bl-docs-console');
    await setSql(page, "insert into notes (body) values ('written before the reload')");
    await run(page);
    await expect(results(page)).toContainText('1 row');
    await page.reload();
    await page.locator(READY).waitFor({ timeout: 30_000 });
    await setSql(page, 'select body from notes order by id');
    await run(page);
    const grid = results(page).getByRole('grid');
    await expect(grid).toContainText('Stored in IndexedDB');
    await expect(grid).toContainText('written before the reload');
    // …and the migration did not run a second time
    await setSql(page, 'select count(*)::int as n from notes');
    await run(page);
    await expect(grid).toContainText('2');
  });

  test('a database written by another Postgres major is refused, untouched, with both versions named', async ({ page }) => {
    await openConsole(page, 'sql-console/persistent');
    await setSql(page, "insert into notes (body) values ('precious')");
    await run(page);
    await expect(results(page)).toContainText('1 row');
    await page.goto('about:blank'); // lets go of the database and the lock

    // stamp the data directory as Postgres 15, as an older PGlite would have left it
    await page.goto('/?demo=button/variants&theme=light').catch(() => undefined);
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('/pglite/bl-docs-console');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const store = db.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA');
            const get = store.get('/pglite/bl-docs-console/PG_VERSION');
            get.onsuccess = () => {
              const record = get.result;
              record.contents = new TextEncoder().encode('15\n');
              const put = store.put(record, '/pglite/bl-docs-console/PG_VERSION');
              put.onsuccess = () => {
                db.close();
                resolve(null);
              };
              put.onerror = () => reject(put.error);
            };
            get.onerror = () => reject(get.error);
          };
        }),
    );
    await page.goto('/?demo=sql-console/persistent&theme=light');
    const alert = page.locator('[data-slot=sql-console-error]');
    await expect(alert).toContainText('different Postgres version', { timeout: 30_000 });
    await expect(alert).toContainText('Postgres 15');
    await expect(alert).toContainText(/Postgres 1[6-9]/);
    await expect(alert).toContainText('left untouched');
    // nothing was deleted: the record is still there, still stamped 15
    const stamp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open('/pglite/bl-docs-console');
          req.onsuccess = () => {
            const get = req.result.transaction('FILE_DATA').objectStore('FILE_DATA').get('/pglite/bl-docs-console/PG_VERSION');
            get.onsuccess = () => {
              req.result.close();
              resolve(new TextDecoder().decode(get.result.contents).trim());
            };
          };
        }),
    );
    expect(stamp).toBe('15');
  });
});

test.describe('two tabs', () => {
  test('the second tab on one idb:// database is blocked, can take over, and the first steps aside', async ({ context }) => {
    const a = await context.newPage();
    await openDemo(a, 'sql-console/persistent', READY);
    const b = await context.newPage();
    await b.goto('/?demo=sql-console/persistent&theme=light');
    await expect(b.getByText('This database is open in another tab.')).toBeVisible({ timeout: 30_000 });
    await expect(b.locator('[data-slot=sql-console]')).toHaveCount(0);
    // the first tab is untouched and still works
    await a.locator('[data-slot=sql-editor-input]').fill('select 1 as still_here');
    await a.locator('[data-slot=sql-editor-input]').press('Control+Enter');
    await expect(a.locator('[data-slot=sql-console-results]')).toContainText('still_here');

    await b.getByRole('button', { name: 'Use it here instead' }).click();
    await b.locator(READY).waitFor({ timeout: 30_000 });
    await expect(a.getByText('This database is open in another tab.')).toBeVisible();
    await expect(a.locator('[data-slot=sql-console]')).toHaveCount(0);
    // the data is the same database
    await b.locator('[data-slot=sql-editor-input]').fill('select count(*)::int as n from notes');
    await b.locator('[data-slot=sql-editor-input]').press('Control+Enter');
    await expect(b.locator('[data-slot=sql-console-results]').getByRole('grid')).toContainText('1');
  });

  test('closing the first tab hands the database to the waiting one', async ({ context }) => {
    const a = await context.newPage();
    await openDemo(a, 'sql-console/persistent', READY);
    const b = await context.newPage();
    await b.goto('/?demo=sql-console/persistent&theme=light');
    await expect(b.getByText('This database is open in another tab.')).toBeVisible({ timeout: 30_000 });
    await a.close();
    await b.locator(READY).waitFor({ timeout: 30_000 });
  });
});
