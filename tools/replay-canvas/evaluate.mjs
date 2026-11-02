// Studies Replay Canvas on downloaded Replay QA test runs: each one loaded into the block (the docs dev server's
// `?harness=replay-canvas-local`, recordings from serve-recordings.mjs), measured and screenshotted.
//   node tools/replay-canvas/evaluate.mjs <out dir> [--only <substring>] [--docs http://localhost:4421]
// Writes <out>/<project>.png and <out>/results.json: the map's counts, and per frame whether its crop was found in
// the replayed page and whether it shows anything (visible text or media inside the frame).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const out = args[0];
const flag = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d; };
const docs = flag('--docs', 'http://localhost:4421');
const only = flag('--only');
const root = flag('--root', join(homedir(), 'Documents/Codex/replay-qa-recordings'));
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).filter((m) => !only || m.name.includes(only) || m.dir.includes(only));

const browser = await chromium.launch();
const results = [];
for (const m of manifest) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const t0 = Date.now();
  try {
    await page.goto(`${docs}/?harness=replay-canvas-local&dir=${encodeURIComponent(m.dir)}`);
    await page.waitForSelector('[data-harness-ready]', { timeout: 120_000 });
    // Every frame settles (its crop found or given up on), or a minute passes.
    await page.waitForFunction(() => {
      const f = [...document.querySelectorAll('[data-slot=replay-canvas-frame]')];
      return f.length > 0 && f.every((el) => el.hasAttribute('data-rc-scope'));
    }, null, { timeout: 90_000 }).catch(() => undefined); // a frame that never settles is measured as it is
    await page.waitForTimeout(1500);
    await page.locator('[aria-label="Zoom to fit (⌘0)"]').click();
    await page.waitForTimeout(800);
    const stats = await page.evaluate(() => {
      const header = document.querySelector('[data-slot=replay-canvas] header')?.textContent ?? '';
      const frames = [...document.querySelectorAll('[data-rc-frame]')].map((box) => {
        const key = box.getAttribute('data-rc-frame');
        const w = parseFloat(box.style.width), h = parseFloat(box.style.height);
        const frame = box.querySelector('[data-slot=replay-canvas-frame]');
        const scope = frame?.getAttribute('data-rc-scope') ?? 'unmounted';
        const inner = frame?.firstElementChild;
        const ox = inner ? -parseFloat(inner.style.left || '0') : 0, oy = inner ? -parseFloat(inner.style.top || '0') : 0;
        const doc = frame?.querySelector('iframe')?.contentDocument;
        let ink = 0, chars = 0;
        if (doc?.body) {
          for (const el of doc.body.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2 || r.right < ox || r.bottom < oy || r.left > ox + w || r.top > oy + h) continue;
            const cs = doc.defaultView.getComputedStyle(el);
            if (cs.visibility !== 'visible' || cs.opacity === '0' || cs.display === 'none') continue;
            const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
            if (text || /^(IMG|SVG|CANVAS|VIDEO|INPUT|TEXTAREA|SELECT)$/i.test(el.tagName)) { ink++; chars += text.length; }
          }
        }
        return { key, w: Math.round(w), h: Math.round(h), scope, ink, chars, doc: !!doc };
      });
      return { header, frames };
    });
    const name = m.name.replace(/[^\w.-]+/g, '_').slice(0, 60);
    await page.screenshot({ path: join(out, `${name}.png`) });
    // And a closer look: the entry page's block, a few frames across.
    // (Through the outline, which flies to the frame, so no click lands on a segue dot.)
    const first = page.locator('nav[aria-label="Map outline"] button').filter({ hasNotText: 'shared' }).first();
    if (await first.count()) {
      await first.click();
      await page.waitForTimeout(400);
      await page.locator('[data-slot=canvas]').focus();
      for (let i = 0; i < 3; i++) await page.keyboard.press('Meta+Minus');
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(out, `${name}.detail.png`) });
    }
    const blank = stats.frames.filter((f) => f.ink === 0).length;
    const missing = stats.frames.filter((f) => f.scope === 'missing').length;
    results.push({ project: m.name, dir: m.dir, shot: `${name}.png`, detail: `${name}.detail.png`, recordings: m.journeys.filter((j) => j.file).length, header: stats.header, frames: stats.frames.length, blank, missing, errors: errors.slice(0, 5), ms: Date.now() - t0, detail: stats.frames });
    console.log(`${m.name}: ${stats.header.replace(/^Replay Canvas/, '').trim()} | blank ${blank} missing ${missing}${errors.length ? ` | ${errors.length} errors` : ''}`);
  } catch (e) {
    results.push({ project: m.name, dir: m.dir, error: String(e) });
    console.log(`${m.name}: FAILED ${e}`);
  }
  await page.close();
  writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 1));
}
await browser.close();
const ok = results.filter((r) => r.frames);
const sum = (k) => ok.reduce((n, r) => n + r[k], 0);
console.log(`\n${ok.length} runs · ${sum('frames')} frames · blank ${sum('blank')} (${(100 * sum('blank') / Math.max(1, sum('frames'))).toFixed(1)}%) · missing ${sum('missing')}`);
