import { test, expect } from '@playwright/test';
import { openDemo, openHarness } from './helpers.mjs';

const vscode = (page) => page.locator('[data-slot=vscode]');
const terminal = (page) => vscode(page).locator('[data-slot=vscode-terminal]').first();
const input = (page) => terminal(page).getByRole('textbox', { name: 'Terminal 1', exact: true });
const openCode = (page) => terminal(page).locator('section[aria-label=OpenCode]');

async function ready(page) {
  await expect(vscode(page).locator('[data-slot=vscode-runtime-status]')).toHaveText('Node: Ready', { timeout: 60_000 });
  await expect(input(page)).toBeVisible();
}

async function command(page, line) {
  await input(page).pressSequentially(line);
  await input(page).press('Enter');
}

test('typing opencode launches the real TUI in this terminal and Stop returns to a working shell', async ({ page }) => {
  test.setTimeout(120_000);
  const runtimeRequests = [];
  page.on('request', (request) => { if (request.url().includes('/opencode/runtime.js')) runtimeRequests.push(request.url()); });
  await openDemo(page, 'blocks/vscode', '[data-slot=vscode]');
  await ready(page);
  expect(runtimeRequests).toEqual([]);
  const providerRequests = [];
  await page.route(/https:\/\/(?:api\.(?:openai|anthropic)\.com|openrouter\.ai)\/.*(?:messages|completions|responses)/, (route) => {
    providerRequests.push(route.request().url());
    return route.abort();
  });
  await command(page, 'opencode');
  await expect(openCode(page)).toHaveAttribute('data-state', 'running', { timeout: 60_000 });
  await expect(openCode(page).getByRole('textbox', { name: 'Terminal input', exact: true })).toBeVisible();
  await expect(openCode(page).getByRole('alert')).toHaveCount(0);
  await openCode(page).getByRole('button', { name: 'Stop OpenCode', exact: true }).click();
  await expect(openCode(page)).toHaveCount(0);
  await command(page, 'node index.js');
  await expect(terminal(page).locator('.wterm')).toContainText('Hello, browser!');
  await command(page, 'opencode');
  await expect(openCode(page)).toHaveAttribute('data-state', 'running', { timeout: 60_000 });
  await terminal(page).getByRole('button', { name: 'Return to terminal', exact: true }).click();
  await expect(openCode(page)).toHaveCount(0);
  expect(providerRequests).toEqual([]);
});

test('OpenCode tools edit the same Explorer files and execute them in the same Node runtime', async ({ page }) => {
  await page.route('https://blamy.github.io/opencode/runtime.js', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `export async function mount({container, directory, workspaceBridge, processBridge}) {
      workspaceBridge.writeFile(directory + '/created.js', "console.log('shared file ran')");
      const result = await processBridge.exec({command: 'node', args: ['created.js'], cwd: directory});
      container.textContent = directory + ': ' + result.stdout;
      return {dispose() {container.replaceChildren();}};
    }`,
  }));
  await openDemo(page, 'blocks/vscode', '[data-slot=vscode]');
  await ready(page);
  await command(page, 'opencode');
  await expect(openCode(page)).toHaveAttribute('data-state', 'running');
  await expect(openCode(page)).toContainText('/project: shared file ran');
  await terminal(page).getByRole('button', { name: 'Return to terminal', exact: true }).click();
  await expect(vscode(page).getByRole('treeitem', { name: /created.js/ })).toBeVisible();
  await command(page, 'node created.js');
  await expect(terminal(page).locator('.wterm')).toContainText('shared file ran');
});

test('the VS Code Tailscale menu connects and Node fetch reaches a device through that connection', async ({ page }) => {
  await openHarness(page, 'vscode', '[data-slot=vscode]');
  await ready(page);
  await vscode(page).getByRole('button', { name: 'Tailscale connection', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in with Tailscale', exact: true }).click();
  await expect(vscode(page).getByRole('button', { name: 'Tailscale connection', exact: true })).toHaveAttribute('data-status', 'connected');
  await page.keyboard.press('Escape');
  await command(page, "node -e \"fetch('http://notes.demo-tailnet.ts.net/').then(r => r.text()).then(console.log)\"");
  await expect(terminal(page).locator('.wterm')).toContainText('Buy milk');
  await expect(terminal(page).locator('.wterm')).toContainText('by the fake tailnet');
});

test('VS Code launches from Alfred and the Dock, stays mounted while minimized and shares the desktop tailnet', async ({ page }) => {
  await openHarness(page, 'macos-vscode', '[data-slot=macos-dock]');
  await page.getByRole('combobox').fill('vscode');
  await page.getByRole('combobox').press('Enter');
  const window = page.locator('[data-slot=macos-window][data-app=vscode]');
  await expect(window).toBeVisible();
  await ready(page);
  await window.getByRole('button', { name: 'Minimize Visual Studio Code', exact: true }).click();
  await expect(window).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Show Visual Studio Code', exact: true }).click();
  await expect(window).not.toHaveAttribute('inert', '');
  await vscode(page).getByRole('button', { name: 'Tailscale connection', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in with Tailscale', exact: true }).click();
  await expect(vscode(page).getByRole('button', { name: 'Tailscale connection', exact: true })).toHaveAttribute('data-status', 'connected');
  await page.keyboard.press('Escape');
  await window.getByRole('button', { name: 'Close Visual Studio Code', exact: true }).click();
  await expect(window).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Visual Studio Code', exact: true }).click();
  await expect(window).toBeVisible();
  await expect(vscode(page).getByRole('button', { name: 'Tailscale connection', exact: true })).toHaveAttribute('data-status', 'connected');
});
