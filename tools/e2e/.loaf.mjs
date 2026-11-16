import { chromium } from '@playwright/test';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1000, height: 720 } });
await page.goto('http://localhost:4421/?demo=diagram/layout&theme=light&n=100');
await page.locator('[data-demo-status=ready]').waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__loaf = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__loaf.push(e.toJSON()); }).observe({ type: 'long-animation-frame' }); });
await page.getByRole('button', { name: '2000' }).click();
await page.waitForTimeout(1500);
const loaf = await page.evaluate(() => window.__loaf);
for (const f of loaf.filter((f) => f.duration > 40)) {
  console.log('FRAME', f.duration.toFixed(0), 'render', (f.renderStart ? (f.startTime + f.duration - f.renderStart) : 0).toFixed(0), 'styleLayout', (f.styleAndLayoutStart ? f.startTime + f.duration - f.styleAndLayoutStart : 0).toFixed(0), 'blocking', f.blockingDuration);
  for (const s of f.scripts) console.log('   ', s.duration.toFixed(0), s.invokerType, s.invoker, (s.sourceURL || '').split('/').pop().split('?')[0], s.sourceFunctionName, 'forcedSL', s.forcedStyleAndLayoutDuration.toFixed(0), 'start', (s.startTime - f.startTime).toFixed(0));
}
await b.close();
