import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

const window = (page) => page.locator('[data-slot="macos-window"][data-app="opencode"]');
const terminal = (page) => window(page).locator('section[aria-label="OpenCode"]');
const preview = (page) => page.frameLocator('iframe[title="OpenCode · port 3000"]');

async function start(page) {
  await window(page).getByRole('button', { name: 'Start OpenCode', exact: true }).click();
  await expect(terminal(page)).toHaveAttribute('data-state', 'running', { timeout: 60_000 });
  await expect(window(page).getByRole('textbox', { name: 'Terminal input', exact: true })).toBeVisible();
  await expect(window(page).getByRole('alert')).toHaveCount(0);
}

async function runStarter(page) {
  await window(page).getByRole('button', { name: 'Run starter app', exact: true }).click();
  await expect(preview(page).getByRole('heading', { name: 'Your OpenCode workspace.' })).toBeVisible({ timeout: 30_000 });
  return preview(page).getByRole('button', { name: 'Clicked 0 times', exact: true });
}

test('OpenCode launches from Alfred and the Dock, stays lazy and fits the desktop and phone', async ({ page }) => {
  const runtimeRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/opencode/runtime.js')) runtimeRequests.push(request.url());
  });
  await openDemo(page, 'blocks/macos', '[data-slot=macos-dock]');
  await page.getByRole('combobox').fill('opencode');
  await page.getByRole('combobox').press('Enter');
  await expect(window(page)).toBeVisible();
  await expect(terminal(page)).toHaveAttribute('data-state', 'idle');
  await expect(window(page).getByRole('button', { name: 'Run starter app', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Show OpenCode', exact: true }).click();
  await expect(window(page)).toHaveCount(1);
  await window(page).getByRole('button', { name: 'Close OpenCode', exact: true }).click();
  await expect(window(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Open OpenCode', exact: true }).click();
  await expect(terminal(page)).toHaveAttribute('data-state', 'idle');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-slot=macos-springboard]')).toBeAttached();
  await expect(window(page).getByRole('button', { name: 'Start OpenCode', exact: true })).toBeVisible();
  expect(await window(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(runtimeRequests).toEqual([]);
});

// Uses the actual hosted OpenCode/OpenTUI WebAssembly runtime and agent-wasm container. No provider or AI call.
test('the real terminal and starter preview survive minimizing and restart cleanly on Stop or Close', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const providerRequests = [];
  await page.route(/https:\/\/(?:api\.(?:openai|anthropic)\.com|openrouter\.ai)\/.*(?:messages|completions|responses)/, (route) => {
    providerRequests.push(route.request().url());
    return route.abort();
  });
  await openDemo(page, 'blocks/macos', '[data-slot=macos-dock]');
  await page.getByRole('combobox').press('Escape');
  await page.getByRole('button', { name: 'Open OpenCode', exact: true }).click();
  await start(page);

  // Slash commands are handled locally by the real TUI; never submit an ordinary prompt.
  const input = window(page).getByRole('textbox', { name: 'Terminal input', exact: true });
  await input.pressSequentially('/help');
  await input.press('Enter');
  await input.press('Escape');

  const count = await runStarter(page);
  await count.click();
  await expect(preview(page).getByRole('button', { name: 'Clicked 1 times', exact: true })).toBeVisible();
  const firstPreview = await window(page).locator('iframe').getAttribute('src');
  await page.screenshot({ path: testInfo.outputPath('opencode-macos.png') });
  await testInfo.attach('OpenCode in the macOS desktop', { path: testInfo.outputPath('opencode-macos.png'), contentType: 'image/png' });

  await window(page).getByRole('button', { name: 'Minimize OpenCode', exact: true }).click();
  await expect(window(page)).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Show OpenCode', exact: true }).click();
  await expect(terminal(page)).toHaveAttribute('data-state', 'running');
  await expect(preview(page).getByRole('button', { name: 'Clicked 1 times', exact: true })).toBeVisible();
  await expect(window(page).locator('iframe')).toHaveAttribute('src', firstPreview);

  await window(page).getByRole('button', { name: 'Stop OpenCode', exact: true }).click();
  await expect(terminal(page)).toHaveAttribute('data-state', 'stopped');
  await expect(window(page).locator('iframe')).toHaveCount(0);
  await expect(window(page).getByRole('button', { name: 'Run starter app', exact: true })).toBeDisabled();
  await start(page);
  await expect(await runStarter(page)).toBeVisible();
  expect(await window(page).locator('iframe').getAttribute('src')).not.toBe(firstPreview);

  await window(page).getByRole('button', { name: 'Close OpenCode', exact: true }).click();
  await expect(window(page)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Terminal input', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open OpenCode', exact: true }).click();
  await expect(terminal(page)).toHaveAttribute('data-state', 'idle');
  await start(page); // Fails if the previous runtime's single-session lock or workspace was not released.
  await expect(await runStarter(page)).toBeVisible();
  expect(providerRequests).toEqual([]);
});

// This page is included only by the companion OpenCode runtime's BROWSER_QA build.
test('supported credential-store and OAuth header checks pass with synthetic credentials', async ({ page }, testInfo) => {
  test.skip(process.env.OPENCODE_KEYCHAIN_QA !== '1', 'Requires the unpublished companion runtime QA build.');
  await page.goto('/opencode/backend-smoke.html');
  await expect(page.locator('body')).toHaveAttribute('data-state', 'pass', { timeout: 60_000 });
  await expect(page.getByRole('status')).toHaveText('19 passed; 0 failed');
  await page.screenshot({ path: testInfo.outputPath('opencode-keychain-checks.png'), fullPage: true });
  await testInfo.attach('Synthetic keychain and OAuth checks', { path: testInfo.outputPath('opencode-keychain-checks.png'), contentType: 'image/png' });
});
