import { chromium } from '@playwright/test';
const [theme, ...pages] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(`http://localhost:4417/?theme=${theme}`);
await p.waitForTimeout(1200);
for (const pg of pages) {
  await p.click(`[data-page="${pg}"]`);
  await p.waitForTimeout(1500);
  const sc = p.locator('#bldocs-scroll');
  const h = await sc.evaluate((e) => e.scrollHeight);
  for (let i = 0, y = 0; y < h && i < 6; i++, y += 850) {
    await sc.evaluate((e, y) => (e.scrollTop = y), y);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `/tmp/shot-${theme}-${pg}-${i}.png` });
  }
}
await b.close();
