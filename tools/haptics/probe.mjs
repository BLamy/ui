/* Haptics check. Drives interactive stories in WebKit posing as iOS 18.5 Safari — where ios-vibrator-pro-max
   installs itself — and counts, per gesture:
     requests  Haptics events the engine emitted (what the component asked for)
     ticks     switch <input>s the polyfill flipped; each flip is one Taptic tick on a real iPhone
   A healthy gesture ticks exactly as often as it requests, and still does what the tap should do.
   `--chromium` runs the Android/desktop path, where every request must reach navigator.vibrate.
   Usage: node tools/haptics/probe.mjs [--chromium]   (needs Storybook on :6006) */
import { webkit, chromium } from '@playwright/test';

const BASE = process.env.SB_URL || 'http://localhost:6006';
const useChromium = process.argv.includes('--chromium');
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const root = '#storybook-root';

/** [story, gesture, after-gesture assertion (optional)] */
const CASES = [
  ['atoms-switch--off', { tap: `${root} label` }],
  ['atoms-segmented--three-options', { tap: `${root} button >> nth=1` }],
  ['molecules-tabbar--interactive', { tap: `${root} button >> nth=1` }],
  ['organisms-navigationstack--push-pop', { tap: `${root} [data-slot=list-row] >> nth=0` }, (t) => t.includes('Pop with the back button')],
  ['molecules-indexbar--alpha-az', { drag: `${root} [data-slot=index-bar]` }],
  ['pages-haptics-playground--bare', { tap: `${root} [role=switch], ${root} label >> nth=0` }],
];

const browser = await (useChromium ? chromium : webkit).launch();
const ctx = await browser.newContext(useChromium
  ? { hasTouch: true, viewport: { width: 1000, height: 900 } }
  : { hasTouch: true, isMobile: true, userAgent: IOS_UA, viewport: { width: 1000, height: 900 } });
await ctx.addInitScript(() => {
  window.__hp = { requests: 0, ticks: 0, vibrates: 0 };
  addEventListener('input', (e) => { if (e.target?.hasAttribute?.('switch')) window.__hp.ticks++; }, true);
});
let failed = 0;
for (const [id, gesture, check] of CASES) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'load' });
  await page.locator(`${root} > *`).first().waitFor();
  await page.waitForTimeout(1500); // the polyfill wraps the DOM 250ms after load
  await page.evaluate(() => {
    window.__BL_HAPTICS__?.on(() => window.__hp.requests++);
    const v = navigator.vibrate?.bind(navigator);
    if (v) navigator.vibrate = (p) => { window.__hp.vibrates++; return v(p); };
  });
  let note = '';
  try {
    const box = await page.locator(gesture.tap ?? gesture.drag).first().boundingBox({ timeout: 5000 });
    const cx = box.x + box.width / 2;
    if (gesture.tap) {
      // Tap by coordinates, like a finger: the polyfill's overlay deliberately sits above every control.
      await page.touchscreen.tap(cx, box.y + box.height / 2);
    } else {
      await page.mouse.move(cx, box.y + 10);
      await page.mouse.down();
      for (let y = box.y + 10; y < box.y + box.height - 10; y += 6) await page.mouse.move(cx, y);
      await page.mouse.up();
    }
    await page.waitForTimeout(1000);
  } catch (e) { note = 'gesture failed: ' + String(e).split('\n')[0]; }
  const hp = await page.evaluate(() => window.__hp);
  const text = await page.evaluate(() => document.body.innerText);
  // Requests made during one click merge into one pulse, so a tap ticks at least once and never more
  // than it asked. Drags are reported only: Playwright can't synthesize a touch drag in WebKit, and the
  // polyfill's drag ticks only follow touch pointers.
  const hapticsOk = useChromium
    ? hp.vibrates === hp.requests
    : hp.requests === 0 ? hp.ticks === 0 : hp.ticks >= 1 && hp.ticks <= hp.requests;
  const actionOk = check ? check(text) : true;
  const ok = gesture.drag && !useChromium ? true : !note && hapticsOk && actionOk && (hp.requests > 0 || !!check);
  if (!ok) failed++;
  console.log(`${gesture.drag && !useChromium ? 'info' : ok ? 'ok  ' : 'FAIL'}  ${id.padEnd(40)} requests=${hp.requests} ${useChromium ? 'vibrates=' + hp.vibrates : 'ticks=' + hp.ticks}${check ? ' action=' + (actionOk ? 'ok' : 'MISSING') : ''} ${note}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
