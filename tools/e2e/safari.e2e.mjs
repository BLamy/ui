import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* The Safari block, in a real browser. Its default is the real Tailscale (Tailscale's client as WebAssembly, the real
   sign-in popup); these tests switch the demo to "Simulated", an in-memory tailnet, because they cannot sign in to an
   account — the same way tools/e2e/tailscale.e2e.mjs does. The one test that touches the real client checks only what
   needs no account: it loads on the press, and the sign-in popup is sent to Tailscale. What they prove: nothing works until
   Tailscale is connected; once it is, every page, stylesheet and picture comes through the tailnet; a page cannot make
   requests of its own; and a public address fails without an exit node and loads through one. */

const TAILNET = 'demo-tailnet.ts.net';
const frame = (page) => page.frameLocator('[data-slot=safari-frame]');
/* A CSS locator on purpose: behind the gate the field is inert and aria-hidden, so it is not in the accessibility tree. */
const address = (page) => page.locator('input[role=combobox]');
const gate = (page) => page.locator('[data-slot=safari-gate]');

/** Every host the page itself asks the network for, from the moment it is called until the test ends. */
function watchNetwork(page) {
  const hosts = new Set();
  page.on('request', (req) => { try { hosts.add(new URL(req.url()).hostname); } catch { /* data: and blob: URLs */ } });
  return hosts;
}

/** The docs demo, switched to the simulated tailnet. */
async function open(page) {
  await openDemo(page, 'safari/tailnet', '[data-slot=safari]');
  await page.getByText('Simulated', { exact: true }).click();
  await expect(gate(page)).toBeVisible();
}

async function signIn(page) {
  await page.getByRole('button', { name: 'Sign in with Tailscale' }).click();
  await expect(page.locator('[data-slot=safari]')).toHaveAttribute('data-status', 'connected', { timeout: 15_000 });
  await expect(gate(page)).toHaveCount(0);
}

async function visit(page, text) {
  await address(page).click();
  await address(page).fill(text);
  await address(page).press('Enter');
}

test('opens on a gate: nothing is reachable until Tailscale is connected', async ({ page }) => {
  await open(page);
  await expect(gate(page)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Connect to Tailscale' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Tailscale' })).toBeVisible();
  // The browser underneath is inert: not focusable, not clickable, hidden from assistive tech.
  await expect(page.locator('[data-slot=safari-toolbar]').locator('xpath=..')).toHaveAttribute('inert', '');
  await expect(page.locator('[data-slot=safari-toolbar]').locator('xpath=..')).toHaveAttribute('aria-hidden', 'true');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-slot=safari-toolbar]'))).toBe(false);
  const box = await address(page).boundingBox();
  const topmost = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-slot=safari-gate]'), { x: box.x + 20, y: box.y + box.height / 2 });
  expect(topmost).toBe(true);
});

test('signing in lifts the gate and shows the devices on the tailnet', async ({ page }) => {
  await open(page);
  await signIn(page);
  await expect(page.locator('[data-slot=safari-start]')).toBeVisible();
  for (const name of ['Home', 'Wiki', 'Notes', 'Status', 'Exit-node']) await expect(page.getByRole('button', { name: new RegExp(`^${name}, `) })).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`Devices on ${TAILNET}`, 'i') })).toBeVisible();
});

test('a page loads through the tailnet: styled, with its images, and with nothing that can run or reach out', async ({ page }) => {
  const hosts = watchNetwork(page);
  await open(page);
  await signIn(page);
  await page.getByRole('button', { name: /^Home, / }).click();
  const f = frame(page);
  await expect(f.getByRole('heading', { name: 'Welcome home' })).toBeVisible();
  await expect(address(page)).toHaveValue(`home.${TAILNET}`);

  const frameHandle = await page.locator('[data-slot=safari-frame]').elementHandle();
  const state = await frameHandle.evaluate((el) => {
    const doc = el.contentDocument;
    const h1 = doc.querySelector('h1');
    return {
      sandbox: el.getAttribute('sandbox'),
      csp: doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'),
      headingSize: getComputedStyle(h1).fontSize, // the stylesheet was fetched and applied
      background: getComputedStyle(doc.body).backgroundImage.slice(0, 40), // a url() inlined as data:
      scripts: doc.querySelectorAll('script').length,
      frames: doc.querySelectorAll('iframe, object, embed').length,
      imgs: [...doc.querySelectorAll('img')].map((i) => ({ data: (i.getAttribute('src') ?? '').startsWith('data:'), none: !i.hasAttribute('src'), loaded: i.complete && i.naturalWidth > 0 })),
      scriptLine: doc.getElementById('script-ran').textContent.trim(),
      requests: el.contentWindow.performance.getEntriesByType('resource').length,
    };
  });
  expect(state.sandbox).toBe('allow-same-origin allow-forms');
  expect(state.csp).toContain("default-src 'none'");
  expect(state.csp).not.toContain('script-src');
  expect(state.headingSize).toBe('34px');
  expect(state.background).toContain('data:image/svg+xml');
  expect(state.scripts).toBe(0);
  expect(state.frames).toBe(0);
  expect(state.imgs[0]).toMatchObject({ data: true, loaded: true }); // the logo, fetched through the tailnet
  expect(state.imgs[1]).toMatchObject({ none: true }); // the public tracker's pixel: never fetched
  expect(state.scriptLine).toMatch(/^A script on this page tried to change this line/); // not "A script ran."
  expect(state.requests).toBe(0); // the frame itself asked the network for nothing

  // And the page as a whole never contacted a tailnet name or a public host: all of it was the in-memory tailnet.
  for (const host of hosts) expect(host, host).not.toMatch(/ts\.net$|example\.com$/);
});

test('links, back and forward, same-page anchors and redirects all go through the browser', async ({ page }) => {
  await open(page);
  await signIn(page);
  await visit(page, `home.${TAILNET}`);
  const f = frame(page);
  await expect(f.getByRole('heading', { name: 'Welcome home' })).toBeVisible();

  await f.getByRole('link', { name: /^Wiki/ }).first().click();
  await expect(address(page)).toHaveValue(`wiki.${TAILNET}`);
  await expect(f.getByRole('heading', { name: 'How the tailnet is wired' })).toBeVisible();
  expect(page.url()).toContain('/?demo=safari/tailnet'); // the outer page never navigated

  // A link to an anchor on the same page scrolls the frame and does not reload it.
  await f.getByRole('link', { name: 'the end' }).click();
  await expect.poll(() => page.locator('[data-slot=safari-frame]').evaluate((el) => el.contentDocument.scrollingElement.scrollTop)).toBeGreaterThan(100);
  await expect(address(page)).toHaveValue(`wiki.${TAILNET}`);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(address(page)).toHaveValue(`home.${TAILNET}`);
  await page.getByRole('button', { name: 'Forward' }).click();
  await expect(address(page)).toHaveValue(`wiki.${TAILNET}`);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('[data-slot=safari-start]')).toBeVisible(); // back past the first page is the start page

  // A redirect: the address field shows where it ended up.
  await visit(page, `home.${TAILNET}/old`);
  await expect(address(page)).toHaveValue(`wiki.${TAILNET}`);
});

test('forms: GET puts the fields in the address, POST sends a body — both through the tailnet', async ({ page }) => {
  await open(page);
  await signIn(page);
  await visit(page, `home.${TAILNET}`);
  const f = frame(page);
  await f.getByRole('textbox', { name: 'Search' }).fill('router');
  await f.getByRole('button', { name: 'Search' }).click();
  await expect(address(page)).toHaveValue(`home.${TAILNET}/search?q=router`);
  await expect(f.getByRole('heading', { name: 'Search' })).toBeVisible();

  await visit(page, `notes.${TAILNET}`);
  await f.getByRole('textbox', { name: 'Title' }).fill('Water the plants');
  await f.getByRole('button', { name: 'Save' }).click();
  await expect(f.getByRole('heading', { name: 'Saved' })).toBeVisible();
  await expect(f.getByText('Water the plants')).toBeVisible();
  await expect(address(page)).toHaveValue(`notes.${TAILNET}/new`);
});

test('the address field: names, addresses and suggestions from the tailnet', async ({ page }) => {
  await open(page);
  await signIn(page);
  await address(page).click();
  // Focusing it lists the devices on the tailnet.
  await expect(page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option')).toHaveCount(5); // four sites and the exit node
  await address(page).fill('not');
  await expect(page.getByRole('option')).toHaveCount(1);
  await address(page).press('ArrowDown');
  await expect(page.getByRole('option', { selected: true })).toContainText(`notes.${TAILNET}`);
  await address(page).press('Enter');
  await expect(address(page)).toHaveValue(`notes.${TAILNET}`);
  await expect(frame(page).getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();

  // A bare word that names a device opens it; one that matches nothing is not sent anywhere.
  await visit(page, 'wiki');
  await expect(address(page)).toHaveValue(`wiki.${TAILNET}`);
  await address(page).click();
  await address(page).fill('zzz nothing');
  await address(page).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Nothing on your tailnet matches');
  await address(page).press('Escape');
  await expect(address(page)).toHaveValue(`wiki.${TAILNET}`);
});

test('a public address fails without an exit node, offers one, and loads through it — never from the network', async ({ page }) => {
  const hosts = watchNetwork(page);
  await open(page);
  await signIn(page);

  await visit(page, 'example.com');
  await expect(page.getByRole('heading', { name: 'example.com is not on your tailnet' })).toBeVisible();
  await expect(page.getByText(/only through an exit node/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();

  // The error page offers the exit node; choosing it reloads the page through it.
  await page.getByRole('button', { name: 'Use exit-node as the exit node' }).click();
  await expect(frame(page).getByRole('heading', { name: 'Example Domain' })).toBeVisible();
  await expect(address(page)).toHaveValue('example.com');
  await frame(page).getByRole('link', { name: 'More information…' }).click();
  await expect(address(page)).toHaveValue('example.com/more');

  // The shield menu shows and drops the choice; with it dropped the public site fails again.
  await page.getByRole('button', { name: 'Tailscale connection' }).click();
  const popover = page.getByRole('dialog', { name: 'Tailscale connection' });
  await expect(popover.getByRole('radio', { name: 'exit-node' })).toBeChecked();
  await popover.getByText('None: your devices only').click(); // radios are visually hidden inputs under a label: click the label
  await expect(popover.getByRole('radio', { name: /None/ })).toBeChecked();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reload page' }).click();
  await expect(page.getByRole('heading', { name: 'example.com is not on your tailnet' })).toBeVisible();

  // A tracker that was never on the tailnet stays an error, exit node or not.
  await visit(page, 'http://tracker.example.com/pixel.gif');
  await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
  for (const host of hosts) expect(host, host).not.toMatch(/example\.(com|net|org)$/);
});

test('the real client is the default: it loads only on the press, and the sign-in goes to Tailscale', async ({ page, context }) => {
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));
  await openDemo(page, 'safari/tailnet', '[data-slot=safari]');
  await expect(gate(page)).toBeVisible();
  await page.waitForTimeout(500);
  expect(requested.some((u) => u.endsWith('.wasm'))).toBe(false); // 26 MB of WebAssembly: not before someone signs in
  const popup = context.waitForEvent('page', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Sign in with Tailscale' }).click();
  await expect.poll(() => requested.some((u) => u.includes('main.wasm')), { timeout: 30_000 }).toBe(true);
  // Tailscale's own sign-in page, in a popup (or, if it is blocked, as a link the gate shows). It is never the simulation.
  const opened = await popup.then((p) => p.url(), () => null);
  if (opened) expect(opened).not.toContain('tailscale.example');
  else await expect(page.getByRole('link', { name: 'Continue to Tailscale' })).toHaveAttribute('href', /^https:\/\/login\.tailscale\.com\//);
  await expect(page.locator('[data-slot=safari]')).not.toHaveAttribute('data-status', 'connected'); // not signed in: nothing opens
  await expect(gate(page)).toBeVisible();
});

test('JSON shows as text, a picture as a picture, and a file it cannot show says so', async ({ page }) => {
  await open(page);
  await signIn(page);
  await visit(page, `status.${TAILNET}/api/status.json`);
  await expect(page.locator('[data-slot=safari-text]')).toContainText('"tailnet": "demo-tailnet.ts.net"');
  await visit(page, `status.${TAILNET}/photo.svg`);
  await expect(page.getByRole('img', { name: 'photo.svg' })).toBeVisible();
  await visit(page, `status.${TAILNET}/backup.bin`);
  await expect(page.getByRole('heading', { name: 'Safari can’t display this file' })).toBeVisible();
  await expect(page.getByText(/application\/octet-stream, 2 KB/)).toBeVisible();
});

test('tabs: a new tab, a ⌘-click in the background, the overview, and closing', async ({ page }) => {
  await open(page);
  await signIn(page);
  await visit(page, `home.${TAILNET}`);
  await expect(frame(page).getByRole('heading', { name: 'Welcome home' })).toBeVisible();
  await expect(page.locator('[data-slot=safari-tabs]')).toHaveCount(0); // one tab: no strip

  // ⌘-click opens a link in a background tab and stays on this one.
  await frame(page).getByRole('link', { name: /^Notes/ }).first().click({ modifiers: ['Meta'] });
  await expect(page.locator('[data-slot=safari-tabs]')).toBeVisible();
  await expect(page.locator('[data-slot=safari-tabs] button[aria-current=page]')).toContainText('Home');
  await expect(address(page)).toHaveValue(`home.${TAILNET}`);

  await page.locator('[data-slot=safari-tabs]').getByRole('button', { name: /Notes/ }).first().click();
  await expect(address(page)).toHaveValue(`notes.${TAILNET}`);
  await expect(frame(page).getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New tab' }).click();
  await expect(page.locator('[data-slot=safari-start]')).toBeVisible();
  await expect(address(page)).toBeFocused();

  await page.getByRole('button', { name: /^Show tab overview, 3 tabs/ }).click();
  await expect(page.locator('[data-slot=safari-overview]').getByRole('listitem')).toHaveCount(4); // three tabs and "New Tab"
  await page.locator('[data-slot=safari-overview]').getByRole('button', { name: /^Close Home/ }).click();
  await expect(page.locator('[data-slot=safari-overview]').getByRole('listitem')).toHaveCount(3);
  await page.locator('[data-slot=safari-overview]').getByRole('button', { name: /^Notes/ }).first().click();
  await expect(page.locator('[data-slot=safari-overview]')).toHaveCount(0);
  await expect(address(page)).toHaveValue(`notes.${TAILNET}`);
});

test('signing out brings the gate back and keeps the tabs; signing in again returns to them', async ({ page }) => {
  await open(page);
  await signIn(page);
  await visit(page, `wiki.${TAILNET}`);
  await expect(frame(page).getByRole('heading', { name: 'How the tailnet is wired' })).toBeVisible();

  await page.getByRole('button', { name: 'Tailscale connection' }).click();
  const popover = page.getByRole('dialog', { name: 'Tailscale connection' });
  await expect(popover).toContainText(`Connected to ${TAILNET}`);
  await expect(popover).toContainText(/[1-9]\d* requests this session, all through Tailscale/);
  await popover.getByRole('button', { name: 'Sign out of Tailscale' }).click();
  await expect(gate(page)).toBeVisible();
  await expect(page.locator('[data-slot=safari]')).not.toHaveAttribute('data-status', 'connected');

  await expect(popover).toHaveCount(0); // the popover does not stay up over the gate
  await gate(page).getByRole('button', { name: 'Sign in with Tailscale' }).click();
  await expect(page.locator('[data-slot=safari]')).toHaveAttribute('data-status', 'connected', { timeout: 15_000 });
  await expect(address(page)).toHaveValue(`wiki.${TAILNET}`);
  await expect(frame(page).getByRole('heading', { name: 'How the tailnet is wired' })).toBeVisible();
});

test('reload fetches the page again, through the tailnet', async ({ page }) => {
  await open(page);
  await signIn(page);
  await visit(page, `notes.${TAILNET}`);
  await expect(frame(page).getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
  const requests = async () => Number((await page.getByRole('button', { name: 'Tailscale connection' }).click(), (await page.getByRole('dialog', { name: 'Tailscale connection' }).textContent()).match(/(\d+) requests/)[1]));
  const before = await requests();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reload page' }).click();
  await expect.poll(requests).toBeGreaterThan(before);
});

test('the iPhone-sized window drops the tab strip for the overview', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page);
  await signIn(page);
  await visit(page, `home.${TAILNET}`);
  await frame(page).getByRole('link', { name: /^Notes/ }).first().click({ modifiers: ['Meta'] });
  await expect(page.getByRole('button', { name: /^Show tab overview, 2 tabs/ })).toBeVisible();
  await expect(page.locator('[data-slot=safari-tabs]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New tab' })).toHaveCount(0);
});

test('works in dark mode without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?demo=safari/tailnet&theme=dark', { waitUntil: 'load' });
  await page.locator('[data-slot=safari]').waitFor();
  await page.getByText('Simulated', { exact: true }).click();
  await signIn(page);
  await visit(page, `home.${TAILNET}`);
  await expect(frame(page).getByRole('heading', { name: 'Welcome home' })).toBeVisible();
  // The browser logs "Blocked script execution" when Playwright's helpers are refused in the script-less frame: that is the sandbox working.
  expect(errors.filter((e) => !/WebSocket|vite|Blocked script execution/.test(e)), errors.join('\n')).toEqual([]);
});
