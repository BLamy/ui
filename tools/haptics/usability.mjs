/* Haptics usability check. Runs the same scripted sessions in WebKit posing as an iPhone (iOS 18.5 Safari: touch,
   mobile viewport) twice — haptics on, and Haptics.enabled = false — and requires the page to end up identical:
   visible text, focused element, scroll positions and field values. With haptics on it also requires that the
   engine never focused its switch, added nothing to the page but its one hidden <label>, and that no Haptics call
   took more than a few milliseconds.
   Usage: node tools/haptics/usability.mjs   (SB_URL default http://localhost:6006, DOCS_URL default :4417) */
import { webkit, devices } from '@playwright/test';

const SB = process.env.SB_URL || 'http://localhost:6006';
const DOCS = process.env.DOCS_URL || 'http://localhost:4417';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const story = (id) => `${SB}/iframe.html?id=${id}&viewMode=story`;
const R = '#storybook-root';

/** [name, url, steps]. Steps: ['reveal', sel] ['tap', sel] ['click', sel] (mouse) ['type', text] ['key', key] ['wheel', sel, dy] ['drag', sel, dx, dy] ['wait', ms] */
const SESSIONS = [
  ['scroll a long list, tap a row', story('organisms-list--contacts-with-index-bar'),
    [['wheel', `${R} [data-slot=list-row] >> nth=3`, 1400], ['wait', 400], ['tap', `${R} [data-slot=list-row] >> nth=8`]]],
  ['scrub the index bar', story('organisms-list--contacts-with-index-bar'),
    [['drag', `${R} [data-slot=index-bar]`, 0, 160]]],
  ['scroll a docs page, switch install tabs', `${DOCS}/#/haptics`,
    [['wheel', '#bldocs-scroll', 900], ['wait', 300], ['wheel', '#bldocs-scroll', -900], ['wait', 300], ['tap', '[role=tab]:has-text("shadcn CLI") >> nth=0']]],
  ['docs: native haptic slider, type a code, verify', `${DOCS}/#/haptics`,
    [['reveal', '[data-docstream-demo] >> nth=0'], ['wait', 1500], ['click', '[aria-label="Haptic slider"]'],
      ['reveal', '[data-docstream-demo] >> nth=1'], ['wait', 1500], ['tap', 'input[placeholder="123456"]'], ['type', '123456'],
      ['tap', 'button:has-text("Verify")']]],
  ['type into SearchField', story('atoms-searchfield--empty'),
    [['tap', `${R} input`], ['type', 'anna'], ['tap', `${R} input`], ['type', ' lee']]],
  ['type into MarkdownEditor, use the toolbar', story('atoms-markdowneditor--with-toolbar'),
    [['tap', `${R} [contenteditable=true]`], ['type', 'Hello world'], ['tap', `${R} button >> nth=0`], ['type', ' bold']]],
  ['type into the Composer and send', story('molecules-composer--default'),
    [['tap', `${R} input`], ['type', 'hi there'], ['key', 'Enter'], ['type', 'again']]],
  ['type into the workbench Composer, tap its buttons', story('molecules-workbench-composer--interactive'),
    [['tap', `${R} textarea, ${R} [contenteditable=true] >> nth=0`], ['type', 'draft'], ['tap', `${R} button >> nth=0`], ['type', ' more']]],
  ['drag a Slider', story('atoms-slider--labeled'),
    [['drag', `${R} [data-slot=slider-track] >> nth=0`, 120, 0]]],
  ['swipe a row to delete', story('molecules-listrow--swipe-to-delete'),
    [['drag', `${R} [data-slot=list-row] >> nth=0`, -260, 0], ['wait', 600]]],
  ['swipe a row to reveal actions, tap one', story('molecules-listrow--swipe-actions'),
    [['drag', `${R} [data-slot=list-row] >> nth=0`, -120, 0], ['wait', 400], ['tap', `${R} button >> nth=0`]]],
  ['drag a sheet', story('organisms-snapsheet--open'),
    [['drag', `${R} [data-slot=snap-sheet], ${R} [role=dialog] >> nth=0`, 0, 220], ['wait', 600]]],
  ['reorder rows', story('organisms-list--animated-reorder'),
    [['drag', `${R} [data-slot=list-row] >> nth=0`, 0, 110], ['wait', 600]]],
  ['open and close a dialog', story('organisms-dialog--closed'),
    [['tap', `${R} button >> nth=0`], ['wait', 400], ['tap', 'button:has-text("Cancel")']]],
  ['open a menu, pick an item', story('molecules-dropdownmenu--closed'),
    [['tap', `${R} button >> nth=0`], ['wait', 400], ['tap', '[role=menuitem], [role=menuitemradio], [role=menuitemcheckbox] >> nth=1']]],
  ['switch tabs', story('molecules-tabbar--interactive'),
    [['tap', `${R} [role=tab] >> nth=1`], ['tap', `${R} [role=tab] >> nth=2`], ['tap', `${R} [role=tab] >> nth=0`]]],
  ['navigation stack push / pop', story('organisms-navigationstack--push-pop'),
    [['tap', `${R} [data-slot=list-row] >> nth=0`], ['wait', 600], ['tap', `${R} button >> nth=0`], ['wait', 600]]],
];

async function run(browser, [, url, steps], hapticsOn) {
  // Mobile WebKit can't synthesize scrolling, so sessions that scroll drop isMobile (still iPhone UA, touch, size).
  const scrolls = steps.some(([op]) => op === 'wheel');
  const ctx = await browser.newContext({ ...devices['iPhone 13'], userAgent: IOS_UA, ...(scrolls ? { isMobile: false } : {}) });
  await ctx.addInitScript((on) => {
    if (!on) localStorage.setItem('bl-ui:haptics', 'off');
    const hp = (window.__hp = { ticks: 0, focusSteals: 0, maxRunMs: 0 });
    addEventListener('click', (e) => { if (!e.isTrusted && e.target?.hasAttribute?.('data-bl-haptics')) hp.ticks++; }, true);
    addEventListener('focusin', (e) => { if (e.target?.closest?.('[data-bl-haptics]')) hp.focusSteals++; }, true);
  }, hapticsOn);
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/arcgisonline|openstreetmap|tile\./, (r) => r.abort());
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const H = window.__BL_HAPTICS__; if (!H) return;
    const run = H._run;
    H._run = function (...a) { const t = performance.now(); run.apply(this, a); window.__hp.maxRunMs = Math.max(window.__hp.maxRunMs, performance.now() - t); };
  });
  const errors = [];
  for (const [op, a, b, c] of steps) {
    try {
      if (op === 'wait') { await page.waitForTimeout(a); continue; }
      if (op === 'type') { await page.keyboard.type(a, { delay: 20 }); continue; }
      if (op === 'key') { await page.keyboard.press(a); continue; }
      if (op === 'reveal') { await page.locator(a).first().scrollIntoViewIfNeeded({ timeout: 4000 }); continue; }
      if (op === 'tap' || op === 'click') await page.locator(a).first().scrollIntoViewIfNeeded({ timeout: 4000 });
      const box = await page.locator(a).first().boundingBox({ timeout: 4000 });
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      if (op === 'tap') await page.touchscreen.tap(cx, cy);
      else if (op === 'click') await page.mouse.click(box.x + box.width * 0.8, cy);
      else if (op === 'wheel') { await page.mouse.move(cx, cy); await page.mouse.wheel(0, b); }
      else if (op === 'drag') {
        const sx = b ? (b < 0 ? box.x + box.width - 20 : box.x + 20) : cx, sy = c && !b ? box.y + Math.min(20, box.height / 2) : cy;
        await page.mouse.move(sx, sy); await page.mouse.down();
        for (let i = 1; i <= 16; i++) { await page.mouse.move(sx + (b * i) / 16, sy + (c * i) / 16); await page.waitForTimeout(16); }
        await page.mouse.up();
      }
    } catch (e) { errors.push(`${op} ${a}: ${String(e).split('\n')[0]}`); }
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(900);
  const state = await page.evaluate(() => {
    const el = document.activeElement;
    const scrolls = [];
    document.querySelectorAll('*').forEach((n) => { if (n.scrollTop || n.scrollLeft) scrolls.push(`${n.tagName}.${n.getAttribute('data-slot') || n.id || ''}:${Math.round(n.scrollTop)},${Math.round(n.scrollLeft)}`); });
    const values = [...document.querySelectorAll('input:not([data-bl-haptics] *):not([aria-label=Haptics]), textarea')].map((i) => i.type === 'checkbox' || i.type === 'radio' ? String(i.checked) : i.value);
    const own = document.querySelectorAll('[data-bl-haptics]').length;
    return {
      text: document.body.innerText.replace(/\s+/g, ' ').replace(/On for this device · Haptics.enabled|Off — no ticks, no events/, '(haptics setting)').trim(),
      active: el ? `${el.tagName}[${el.getAttribute('aria-label') || el.getAttribute('role') || el.getAttribute('data-slot') || ''}]` : 'none',
      scrolls: scrolls.join(' '),
      values: values.join('|'),
      // Top-level layers (portals, overlays), minus Storybook's own chrome and the engine's hidden label.
      layers: [...document.body.children].filter((e) => e.tagName !== 'SCRIPT' && !e.matches('.sb-wrapper, [data-bl-haptics]') && !e.textContent.includes('#storybook-highlights')).map((e) => e.tagName + '.' + (e.getAttribute('data-slot') || e.getAttribute('role') || '')).join(' '),
      foreignSwitches: document.querySelectorAll('input[switch]:not([data-bl-haptics] *)').length,
      own,
    };
  });
  const hp = await page.evaluate(() => window.__hp);
  await ctx.close();
  return { state, hp, errors };
}

const browser = await webkit.launch();
let failed = 0;
for (const s of SESSIONS) {
  const on = await run(browser, s, true);
  const off = await run(browser, s, false);
  const diff = ['text', 'active', 'scrolls', 'values', 'layers', 'foreignSwitches'].filter((k) => on.state[k] !== off.state[k]);
  const problems = [...diff.map((k) => `differs: ${k}`), ...on.errors, ...off.errors.map((e) => 'off: ' + e)];
  if (on.hp.focusSteals) problems.push('switch took focus');
  if (on.state.own > 1) problems.push(`${on.state.own} hidden switches`);
  if (off.state.own) problems.push('switch created while disabled');
  if (off.hp.ticks) problems.push('ticked while disabled');
  if (on.hp.maxRunMs > 8) problems.push(`slow Haptics call ${on.hp.maxRunMs.toFixed(1)}ms`);
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${s[0].padEnd(48)} ticks=${on.hp.ticks} active=${on.state.active} maxRun=${on.hp.maxRunMs.toFixed(2)}ms ${problems.join('; ')}`);
  if (diff.length && process.env.VERBOSE) for (const k of diff) console.log(`      on:  ${String(on.state[k]).slice(0, 300)}\n      off: ${String(off.state[k]).slice(0, 300)}`);
}
await browser.close();
process.exit(failed ? 1 : 0);
