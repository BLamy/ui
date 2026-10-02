import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* Tailscale in a real browser, against the docs demos. The demos default to the real client (Tailscale's Go client as
   WebAssembly) and a real tailnet; most tests switch them to "Simulated", the in-page fake (lib/tailscale-fake) — no
   account, no control server — and check the real client only up to what needs no account. The service worker is real: Chromium registers tailscale-sw.js from
   the docs dev server, it intercepts plain fetch() calls, hands the matching ones to the page over a MessagePort, and
   streams the answers back. A *.ts.net name does not resolve on the public internet, so "the request went to the
   network" shows up as a failed fetch. */

const status = (page) => page.getByTestId('result-status');
const via = (page) => page.getByTestId('result-via');
const body = (page) => page.getByTestId('result-body');

/** Switch a demo from your tailnet to the simulated one. */
const simulated = (page) => page.getByText('Simulated', { exact: true }).click();

async function openRouter(page) {
  await openDemo(page, 'tailscale-router/intercept', '[data-testid=router-status]');
  await simulated(page);
  await expect(page.getByTestId('router-status')).toHaveAttribute('data-status', 'active', { timeout: 15_000 });
}

async function signIn(page) {
  await page.getByRole('button', { name: 'Sign in with Tailscale' }).click();
  await expect(page.getByRole('button', { name: 'Sign out of Tailscale' })).toBeVisible({ timeout: 10_000 });
}

test('sign-in walks idle → signing in → connected, and signs out', async ({ page }) => {
  await openDemo(page, 'tailscale-login/sign-in', '[data-slot=tailscale-login-button]');
  await simulated(page);
  const button = page.locator('[data-slot=tailscale-login-button]');
  await expect(button).toHaveAttribute('data-status', 'idle');
  await button.click();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('link', { name: 'Continue to Tailscale' })).toHaveAttribute('href', /^https:\/\/login\.tailscale\.example\/a\//);
  await expect(button).toHaveAttribute('data-status', 'connected', { timeout: 10_000 });
  await expect(page.getByTestId('self-name')).toHaveText(/^bl-[a-z0-9]{6}\.demo-tailnet\.ts\.net$/);
  await expect(page.getByRole('status').first()).toContainText('demo-tailnet.ts.net');
  await button.click();
  await expect(button).toHaveAttribute('data-status', 'idle');
});

test('a sign-in can be cancelled with the same button, and with the keyboard', async ({ page }) => {
  await openDemo(page, 'tailscale-login/sign-in', '[data-slot=tailscale-login-button]');
  await simulated(page);
  const button = page.locator('[data-slot=tailscale-login-button]');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('data-status', /signing-in|loading/);
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('data-status', /idle|needs-login/);
  await expect(button).toHaveAccessibleName('Sign in with Tailscale');
});

test('auth key: signs in without a person', async ({ page }) => {
  await openDemo(page, 'tailscale-login/auth-key', '[data-slot=tailscale-login-button]');
  await simulated(page);
  await page.getByRole('button', { name: 'Connect this kiosk' }).click();
  await expect(page.locator('[data-slot=tailscale-status-badge]')).toHaveAttribute('data-status', 'connected', { timeout: 10_000 });
});

test('the real client: nothing downloads until the press, then the WebAssembly loads and a sign-in popup opens', async ({ page, context }) => {
  const wasm = [];
  // The binary itself, not the tiny `main.wasm?import&url` module that only exports its URL.
  page.on('request', (r) => /main\.wasm(\?(?!import)|$)/.test(r.url()) && wasm.push(r.url()));
  await openDemo(page, 'tailscale-login/sign-in', '[data-slot=tailscale-login-button]');
  await page.waitForTimeout(500);
  expect(wasm).toEqual([]);
  const popup = context.waitForEvent('page');
  await page.locator('[data-slot=tailscale-login-button]').click();
  await popup; // opened on the press, so a popup blocker allows it
  await expect.poll(() => wasm.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(page.locator('[data-slot=tailscale-login-button]')).toHaveAttribute('data-status', /loading|starting|signing-in/);
});

test('the real client reaches Tailscale\'s sign-in page (TAILSCALE_LIVE=1: talks to login.tailscale.com)', async ({ page, context }) => {
  test.skip(!process.env.TAILSCALE_LIVE, 'needs the internet and Tailscale\'s control server');
  await openDemo(page, 'tailscale-login/sign-in', '[data-slot=tailscale-login-button]');
  const popup = context.waitForEvent('page');
  await page.locator('[data-slot=tailscale-login-button]').click();
  await (await popup).waitForURL(/^https:\/\/login\.tailscale\.com\//, { timeout: 60_000 });
  await expect(page.locator('[data-slot=tailscale-login-button]')).toHaveAttribute('data-status', 'signing-in');
  await expect(page.getByRole('link', { name: 'Continue to Tailscale' })).toHaveAttribute('href', /^https:\/\/login\.tailscale\.com\/a\//);
});

test('the router registers a real service worker that controls the page', async ({ page }) => {
  await openRouter(page);
  const info = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    // The site's base: `/` locally, `/ui/` under GitHub Actions (see apps/docs/vite.config.mts).
    const base = document.querySelector('script[src*="@vite/client"]')?.getAttribute('src')?.replace('@vite/client', '') ?? '/';
    return { controlled: !!navigator.serviceWorker.controller, script: reg?.active?.scriptURL ?? null, scope: reg?.scope ?? null, base };
  });
  expect(info.controlled).toBe(true);
  expect(info.script).toMatch(/\/tailscale-sw\.js\?p=[A-Za-z0-9_-]+$/);
  expect(new URL(info.scope).pathname).toBe(info.base);
});

test('signed in: a plain fetch to a *.ts.net name and to a Tailscale IP is answered through the tailnet', async ({ page }) => {
  await openRouter(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Fetch' }).click();
  await expect(status(page)).toHaveText('200');
  await expect(via(page)).toHaveText('routed');
  await expect(body(page)).toContainText('by the fake tailnet');

  await page.getByRole('button', { name: '100.101.102.103' }).click();
  await expect(body(page)).toHaveText('pong from 100.101.102.103');
  await expect(via(page)).toHaveText('routed');

  // from page script directly, cross-origin and in cors mode: readable, with the worker's CORS headers
  const direct = await page.evaluate(async () => {
    const res = await fetch('http://notes.demo-tailnet.ts.net/', { mode: 'cors', headers: { authorization: 'Bearer demo' } });
    return { status: res.status, type: res.type, acao: res.headers.get('access-control-allow-origin'), json: await res.json() };
  });
  expect(direct).toMatchObject({ status: 200, json: { served: 'by the fake tailnet' } });
  expect(direct.acao).toBe(new URL(page.url()).origin);
  await expect(page.getByTestId('router-status')).toContainText(/[1-9]\d* routed/);
});

test('request bodies go in, and streamed bodies come out part by part', async ({ page }) => {
  await openRouter(page);
  await signIn(page);
  await page.getByRole('button', { name: 'POST echo' }).click();
  await expect(body(page)).toHaveText('hello over the tailnet');

  const binary = await page.evaluate(async () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 251);
    const res = await fetch('http://notes.demo-tailnet.ts.net/echo', { method: 'PUT', body: bytes });
    const back = new Uint8Array(await res.arrayBuffer());
    return back.length === bytes.length && back.every((b, i) => b === bytes[i]);
  });
  expect(binary).toBe(true);

  const parts = await page.evaluate(async () => {
    const res = await fetch('http://notes.demo-tailnet.ts.net/stream');
    const reader = res.body.getReader();
    const seen = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen.push({ at: performance.now(), text: new TextDecoder().decode(value) });
    }
    return seen;
  });
  expect(parts.map((p) => p.text).join('')).toBe('part 1\npart 2\npart 3\npart 4\n');
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.at(-1).at - parts[0].at).toBeGreaterThan(400); // arrived over time, not all at once
});

test('requests that do not match never touch the worker', async ({ page }) => {
  await openRouter(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Same origin' }).click();
  await expect(status(page)).toHaveText('200');
  await expect(via(page)).toHaveText('network');
});

test('signed out: matching requests fall back to the network (where the name does not exist)', async ({ page }) => {
  await openRouter(page);
  await page.route(/demo-tailnet\.ts\.net/, (r) => r.abort('namenotresolved')); // never ask real DNS
  await page.getByRole('button', { name: 'Fetch' }).click();
  await expect(status(page)).toHaveText('failed');
  await signIn(page);
  await page.getByRole('button', { name: 'Fetch' }).click();
  await expect(via(page)).toHaveText('routed');
  await page.getByRole('button', { name: 'Sign out of Tailscale' }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Tailscale' })).toBeVisible();
  await page.getByRole('button', { name: 'Fetch' }).click();
  await expect(status(page)).toHaveText('failed');
});

test('after a reload the worker routes again (re-attach), and it can be removed', async ({ page }) => {
  await openRouter(page);
  await signIn(page);
  await page.reload();
  await simulated(page);
  await expect(page.getByTestId('router-status')).toHaveAttribute('data-status', 'active', { timeout: 15_000 });
  await signIn(page); // the demo keeps no session: each load is a new device
  await page.getByRole('button', { name: 'Fetch' }).click();
  await expect(via(page)).toHaveText('routed');
  await page.getByRole('button', { name: 'Remove service worker' }).click();
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});

test('the policy tester', async ({ page }) => {
  await openDemo(page, 'tailscale-router/policy', '[data-testid=verdict]');
  const verdict = page.getByTestId('verdict');
  await expect(verdict).toContainText('Routed through Tailscale · tailnet-name');
  await page.getByLabel('Request URL').fill('https://wiki.corp.example/');
  await expect(verdict).toContainText('host');
  await page.getByLabel('Request URL').fill('https://example.com/');
  await expect(verdict).toContainText('Normal network · no-match');
  await page.locator('[data-slot=switch]').click();
  await expect(verdict).toContainText('Routed through Tailscale · all');
  await page.getByLabel('Extra hosts and ranges').fill('*');
  await expect(verdict).toHaveText('Invalid policy');
});

test('pages without Tailscale never register a worker', async ({ page }) => {
  await openDemo(page, 'badge/variants', '[data-slot=badge]');
  await page.waitForTimeout(500);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});
