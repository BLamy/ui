import { chromium } from '@playwright/test';
const idx = await (await fetch('http://localhost:6006/index.json')).json();
const stories = Object.values(idx.entries).filter(e => e.type === 'story');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const fails = [];
for (const s of stories) {
  const errs = [];
  const onErr = m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); };
  page.on('console', onErr);
  const pageErrs = [];
  const onPageErr = e => pageErrs.push(String(e).slice(0, 200));
  page.on('pageerror', onPageErr);
  try {
    await page.goto(`http://localhost:6006/iframe.html?id=${s.id}`, { waitUntil: 'load', timeout: 20000 });
    // Cold dependency chunks can take longer than the old fixed delay. Wait for Storybook
    // to either mount the story or display its error surface so slow starts are not failures.
    await page.waitForFunction(() => {
      const root = document.getElementById('storybook-root');
      const err = document.querySelector('.sb-show-errordisplay, .sb-errordisplay');
      return (root?.children.length ?? 0) > 0 || (!!err && getComputedStyle(err).display !== 'none');
    }, undefined, { timeout: 3000 }).catch(() => undefined);
    const state = await page.evaluate(() => {
      const root = document.getElementById('storybook-root');
      const err = document.querySelector('.sb-show-errordisplay, .sb-errordisplay');
      return { kids: root ? root.children.length : -1, err: !!err && getComputedStyle(err).display !== 'none' };
    });
    if (state.kids <= 0 || state.err || pageErrs.length) fails.push({ id: s.id, kids: state.kids, err: state.err, pageErrs, errs });
  } catch (e) { fails.push({ id: s.id, crash: String(e).slice(0, 150) }); }
  page.off('console', onErr); page.off('pageerror', onPageErr);
}
console.log(`total=${stories.length} fails=${fails.length}`);
for (const f of fails) console.log(JSON.stringify(f));
await browser.close();
if (fails.length) process.exit(1);
