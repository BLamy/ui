/* Haptics check. Drives interactive stories and counts, per gesture:
     requests  Haptics events the engine emitted (what the component asked for)
     ticks     clicks the engine made on its hidden <label><input switch></label>; each is one Taptic tick on an iPhone
     toggles   input events from that switch (a click that didn't toggle wouldn't tick)
   WebKit runs as iPhone Safari (iOS 18.5 UA, touch, mobile), where the engine takes the switch path. A tap must tick
   exactly as often as its strongest request allows — 1 for impact/selection, 2–3 for a notification — never more, and
   the tap must still do its job. Ticks must never steal focus or arrive after the gesture is over.
   `--chromium` runs the Android/desktop path, where every request must reach navigator.vibrate and nothing ticks.
   Usage: node tools/haptics/probe.mjs [--chromium]   (SB_URL, default http://localhost:6006) */
import { webkit, chromium, devices } from '@playwright/test';

const BASE = process.env.SB_URL || 'http://localhost:6006';
const useChromium = process.argv.includes('--chromium');
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const root = '#storybook-root';
/** Ticks the switch path plays per request kind (notification patterns become 2–3 ticks). */
const PULSES = { 'notify · success': 2, 'notify · warning': 3, 'notify · error': 3 };

/** [story, gesture, after-gesture assertion (optional)]
    gesture: { tap } finger tap · { key } focus + Enter · { drag } mouse scrub · { range } click a native range
    flags:   cold     → skip Haptics.boot(): the first request ever arrives inside the gesture
             early    → also request a selection from the target's pointerup, before the click (react-aria onPress on
                        iOS): it must be held, played at the click, and merged with the click's own request
             disabled → Haptics.enabled = false first (expects no requests, no ticks) */
const CASES = [
  ['atoms-button--press-counter', { tap: `${root} [data-testid=press]` }, (t) => t.includes('Pressed 1')],
  ['atoms-button--press-counter', { tap: `${root} [data-testid=press]`, cold: true }, (t) => t.includes('Pressed 1')],
  ['atoms-button--press-counter', { tap: `${root} [data-testid=press]`, early: true }, (t) => t.includes('Pressed 1')],
  ['atoms-button--press-counter', { key: `${root} [data-testid=press]` }, (t) => t.includes('Pressed 1')],
  ['atoms-button--press-counter', { key: `${root} [data-testid=press]`, cold: true }, (t) => t.includes('Pressed 1')],
  ['atoms-button--press-counter', { tap: `${root} [data-testid=press]`, disabled: true }, (t) => t.includes('Pressed 1')],
  ['atoms-button--press-counter', { idle: `${root} [data-testid=press]` }],
  ['atoms-switch--off', { tap: `${root} label` }],
  ['atoms-switch--off', { tap: `${root} label`, cold: true }], // first request arrives in the label's forwarded click
  ['atoms-segmented--three-options', { tap: `${root} [data-slot=segmented] label >> nth=1` }],
  ['molecules-tabbar--interactive', { tap: `${root} [role=tab] >> nth=1` }],
  ['molecules-tabview--vertical-rail', { tap: `${root} [role=tab] >> nth=0` }, (t) => t.includes('Everyone you know')],
  ['organisms-workspacerail--discord-style', { tap: `${root} [role=tab] >> nth=2` }],
  ['organisms-navigationstack--push-pop', { tap: `${root} [data-slot=list-row] >> nth=0` }, (t) => t.includes('Pop with the back button')],
  ['atoms-toggle--default', { tap: `${root} button >> nth=0` }],
  ['atoms-checkbox--default', { tap: `${root} label >> nth=0` }],
  ['molecules-tabs--segmented', { tap: `${root} [role=tab] >> nth=1` }],
  ['molecules-listbox--single-selection', { tap: `${root} [role=option] >> nth=1` }],
  ['molecules-dropdownmenu--selectable', { tap: `[role=menuitemradio] >> nth=1` }],
  ['organisms-dialog--closed', { tap: `${root} button >> nth=0` }, (t) => t.includes('Delete this photo?')],
  ['pages-mapchat--floating', { tap: `${root} button:has-text("Coffee near me")` }, (t) => !t.includes('Plan an afternoon in SoHo')], // sending hides the suggestions
  ['atoms-hapticindicator--interactive', { tap: `${root} button:has-text("Notification · success")` }],
  ['atoms-hapticindicator--interactive', { tap: `${root} button:has-text("Impact · heavy")` }],
  ['molecules-indexbar--alpha-az', { drag: `${root} [data-slot=index-bar]` }],
  ['molecules-indexbar--wave', { drag: `${root} [data-slot=index-bar]` }],
  ['pages-haptics-playground--bare', { tap: `${root} [role=switch], ${root} label >> nth=0` }],
  ['pages-haptics-playground--bare', { range: `${root} input[type=range]` }],
];

const browser = await (useChromium ? chromium : webkit).launch();
const ctxOpts = useChromium
  ? { hasTouch: true, viewport: { width: 1000, height: 900 } }
  : { ...devices['iPhone 13'], userAgent: IOS_UA, viewport: { width: 1000, height: 900 } };
let failed = 0;
for (const [id, gesture, check] of CASES) {
  // A fresh context per case: Haptics.enabled persists in localStorage.
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(() => {
    const hp = (window.__hp = { requests: 0, pulses: 0, ticks: 0, toggles: 0, vibrates: 0, focusSteals: 0, late: 0, lastGesture: 0 });
    // Registered before the engine's own listeners, so these see its synthetic clicks before it stops them.
    for (const t of ['click', 'keydown', 'keyup', 'pointerup', 'pointerdown', 'input', 'change'])
      addEventListener(t, (e) => { if (e.isTrusted && !e.target?.closest?.('[data-bl-haptics]')) hp.lastGesture = performance.now(); }, true);
    addEventListener('click', (e) => {
      if (e.isTrusted || !(e.target instanceof HTMLLabelElement) || !e.target.hasAttribute('data-bl-haptics')) return;
      hp.ticks++;
      if (performance.now() - hp.lastGesture > 1000) hp.late++;
    }, true);
    // The hidden switch must never take focus (that would blur a text field and close the iOS keyboard).
    addEventListener('focusin', (e) => { if (e.target?.closest?.('[data-bl-haptics]')) hp.focusSteals++; }, true);
    addEventListener('input', (e) => { if (e.target?.hasAttribute?.('switch') && e.target.closest('[data-bl-haptics]')) hp.toggles++; }, true);
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'load' });
  await page.locator(`${root} > *`).first().waitFor();
  await page.waitForTimeout(500);
  const sel = gesture.tap ?? gesture.drag ?? gesture.key ?? gesture.range ?? gesture.idle;
  await page.evaluate(({ g, sel, PULSES }) => {
    const H = window.__BL_HAPTICS__;
    if (g.disabled) H.enabled = false;
    if (!g.cold) H.boot();
    H.on((m) => { window.__hp.requests++; window.__hp.pulses = Math.max(window.__hp.pulses, PULSES[m.label] || 1); });
    const v = navigator.vibrate?.bind(navigator);
    if (v) navigator.vibrate = (p) => { window.__hp.vibrates++; return v(p); };
    if (g.early) document.querySelector(sel.split(' >> ')[0]).addEventListener('pointerup', () => H.selection());
  }, { g: gesture, sel, PULSES });
  let note = '';
  try {
    const box = await page.locator(sel).first().boundingBox({ timeout: 5000 });
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    if (gesture.idle) {
      // A request with no gesture at all (an async effect): held, then dropped — never played later.
      await page.evaluate(() => setTimeout(() => window.__BL_HAPTICS__.notification('success'), 0));
    } else if (gesture.tap) {
      // Tap by coordinates, like a finger.
      await page.touchscreen.tap(cx, cy);
    } else if (gesture.key) {
      await page.locator(sel).first().focus();
      await page.keyboard.press('Enter');
    } else if (gesture.range) {
      await page.mouse.click(box.x + box.width * 0.8, cy);
    } else {
      await page.mouse.move(cx, box.y + 10);
      await page.mouse.down();
      for (let y = box.y + 10; y < box.y + box.height - 10; y += 6) await page.mouse.move(cx, y);
      await page.mouse.up();
    }
    await page.waitForTimeout(700);
  } catch (e) { note = 'gesture failed: ' + String(e).split('\n')[0]; }
  const hp = await page.evaluate(() => window.__hp);
  const text = await page.evaluate(() => document.body.innerText);
  let expect;
  if (useChromium) expect = { ticks: 0 };
  else if (gesture.disabled || gesture.idle || hp.requests === 0) expect = { ticks: 0 };
  // A mouse scrub ticks at the press (a trackpad press is a gesture); its pointermove ticks have no gesture.
  else if (gesture.drag) expect = { ticks: 1 };
  // A dragged/clicked native range may tick on each of its input events.
  else if (gesture.range) expect = { ticks: hp.requests };
  else expect = { ticks: hp.pulses };
  const hapticsOk = hp.ticks === expect.ticks && hp.toggles === hp.ticks && !hp.focusSteals && !hp.late
    && (useChromium ? hp.vibrates === hp.requests : hp.vibrates === 0);
  const actionOk = check ? check(text) : true;
  const asked = gesture.disabled ? hp.requests === 0 : hp.requests > 0 || !!check;
  const ok = !note && hapticsOk && actionOk && asked;
  if (!ok) failed++;
  const label = id + (gesture.key ? ' (Enter)' : '') + ['cold', 'early', 'idle', 'disabled'].filter((f) => gesture[f]).map((f) => ` (${f})`).join('');
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(48)} requests=${hp.requests} ${useChromium ? 'vibrates=' + hp.vibrates : `ticks=${hp.ticks}/${expect.ticks} toggles=${hp.toggles}`}${hp.focusSteals ? ' FOCUS-STEAL' : ''}${hp.late ? ' LATE' : ''}${check ? ' action=' + (actionOk ? 'ok' : 'MISSING') : ''} ${note}`);
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
