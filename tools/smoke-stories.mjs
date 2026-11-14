/* Smoke test: every Storybook story must mount without throwing, without Storybook's error surface, and
   without logging a console error or a UI SDK development warning (`[ui-sdk] …`: a part used wrongly).
   Usage: STORYBOOK_URL=http://localhost:6210 SMOKE_WORKERS=4 SMOKE_FILTER=sheet node tools/smoke-stories.mjs */
import { chromium } from '@playwright/test';
const BASE = (process.env.STORYBOOK_URL || 'http://localhost:6006').replace(/\/$/, '');
const WORKERS = Math.max(1, Number(process.env.SMOKE_WORKERS) || 1);
const FILTER = process.env.SMOKE_FILTER ? new RegExp(process.env.SMOKE_FILTER) : null;
const idx = await (await fetch(`${BASE}/index.json`)).json();
const stories = Object.values(idx.entries).filter(e => e.type === 'story' && (!FILTER || FILTER.test(e.id)));
const browser = await chromium.launch();
const fails = [];
const rootState = () => {
  const root = document.getElementById('storybook-root');
  const err = document.querySelector('.sb-show-errordisplay, .sb-errordisplay');
  return { kids: root ? root.children.length : -1, err: !!err && getComputedStyle(err).display !== 'none' };
};
async function check(page, s) {
  const errs = [];
  const onConsole = m => {
    const text = m.text();
    // A demo page asking a reserved example host (Safari's simulated tailnet page reaches for a tracker on
    // tracker.example.com to show the router refusing it): the refusal is the demo, not an error in the story.
    if (/^https?:\/\/([^/]+\.)?example\.(com|org|net)\//.test(m.location()?.url ?? '')) return;
    if (m.type() === 'error' || (m.type() === 'warning' && text.startsWith('[ui-sdk]'))) errs.push(text.slice(0, 300));
  };
  page.on('console', onConsole);
  const pageErrs = [];
  const onPageErr = e => pageErrs.push(String(e).slice(0, 300));
  page.on('pageerror', onPageErr);
  try {
    await page.goto(`${BASE}/iframe.html?id=${s.id}`, { waitUntil: 'load', timeout: 20000 });
    // Cold dependency chunks can take longer than the old fixed delay. Wait for Storybook
    // to either mount the story or display its error surface so slow starts are not failures.
    await page.waitForFunction(() => {
      const root = document.getElementById('storybook-root');
      const err = document.querySelector('.sb-show-errordisplay, .sb-errordisplay');
      return (root?.children.length ?? 0) > 0 || (!!err && getComputedStyle(err).display !== 'none');
    }, undefined, { timeout: 3000 }).catch(() => undefined);
    let state = await page.evaluate(rootState);
    // Vite can finish a cold dependency optimization after the first iframe request. A
    // blank, error-free root is inconclusive, so retry that story once after optimization.
    if (state.kids <= 0 && !state.err && !pageErrs.length) {
      errs.length = 0;
      await page.reload({ waitUntil: 'load', timeout: 20000 });
      await page.waitForFunction(() => (document.getElementById('storybook-root')?.children.length ?? 0) > 0, undefined, { timeout: 10000 }).catch(() => undefined);
      state = await page.evaluate(rootState);
    }
    // Effects and lazy parts warn after mount: give them a moment.
    await page.waitForTimeout(500);
    if (state.kids <= 0 || state.err || pageErrs.length || errs.length) fails.push({ id: s.id, kids: state.kids, err: state.err, pageErrs, errs });
  } catch (e) { fails.push({ id: s.id, crash: String(e).slice(0, 150) }); }
  page.off('console', onConsole); page.off('pageerror', onPageErr);
}
const queue = [...stories];
await Promise.all(Array.from({ length: WORKERS }, async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  for (let s; (s = queue.shift());) await check(page, s);
  await page.close();
}));
console.log(`total=${stories.length} fails=${fails.length}`);
for (const f of fails.sort((a, b) => a.id.localeCompare(b.id))) console.log(JSON.stringify(f));
await browser.close();
if (fails.length) process.exit(1);
