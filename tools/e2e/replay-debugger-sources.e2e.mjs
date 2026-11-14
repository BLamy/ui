import { test, expect } from '@playwright/test';
import { openDemo, openHarness } from './helpers.mjs';

const position = (page) => page.locator('[data-slot=debugger-position]');
const picker = (page) => page.getByRole('dialog', { name: 'Choose a recorded source' });
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.__debuggerErrors = errors;
});
test.afterEach(async ({ page }) => { expect(page.__debuggerErrors).toEqual([]); });

const path = (page) => page.getByRole('navigation', { name: 'Source path' });

for (const width of [1400, 390]) {
  test(`breadcrumbs reveal a source tree at ${width}px and file selection preserves the pause`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await openHarness(page, 'debugger-sources', '[data-slot=replay-debugger]');
    await expect(position(page)).toContainText('step 12 of 18');
    const before = await position(page).textContent();
    await expect(page.locator('[data-slot=debugger-sources-place]')).toHaveCount(0);
    await expect(page.getByRole('tree', { name: 'Recorded sources' })).toHaveCount(0);
    await path(page).getByRole('button', { name: 'cart.js', exact: true }).click();
    await expect(picker(page)).toBeVisible();
    const tree = picker(page).getByRole('tree', { name: 'Recorded sources' });
    await expect(tree.getByRole('treeitem', { name: 'src', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(tree.getByRole('treeitem', { name: /Framework and generated code/ })).toHaveAttribute('aria-expanded', 'false');
    const file = tree.getByRole('treeitem', { name: 'discount.ts', exact: true });
    await file.click();
    await expect(picker(page)).toHaveCount(0);
    await expect(path(page)).toContainText('discount.ts');
    await expect(page.locator('[data-slot=code-editor-content]')).toContainText('export const discount = 0.9;');
    await expect(position(page)).toHaveText(before);
    await path(page).getByRole('button', { name: 'Sources', exact: true }).click();
    await expect(tree).toBeVisible();
    const framework = tree.getByRole('treeitem', { name: /Framework and generated code/ });
    await framework.click();
    await expect(framework).toHaveAttribute('aria-expanded', 'true');
    await picker(page).getByRole('searchbox').fill('runtime.js');
    await tree.getByRole('treeitem', { name: 'runtime.js', exact: true }).click();
    await expect(picker(page)).toHaveCount(0);
    await expect(path(page)).toContainText('runtime.js');
    const bounds = await path(page).boundingBox();
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(position(page)).toHaveText(before);
  });
}

test('tree keys browse without stepping, Escape returns focus and outside press dismisses', async ({ page }) => {
  await openHarness(page, 'debugger-sources', '[data-slot=replay-debugger]');
  await expect(position(page)).toContainText('step 12 of 18');
  const crumb = path(page).getByRole('button', { name: 'cart.js', exact: true });
  await crumb.click();
  const file = picker(page).getByRole('treeitem', { name: 'cart.js', exact: true });
  await file.focus();
  await page.keyboard.press('ArrowDown');
  await expect(picker(page)).toBeVisible();
  await expect(path(page)).toContainText('cart.js');
  await expect(position(page)).toContainText('step 12 of 18');
  await page.setViewportSize({ width: 390, height: 850 });
  await expect(picker(page)).toBeVisible();
  await expect(position(page)).toContainText('step 12 of 18');
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect(crumb).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(picker(page)).toBeVisible();
  // A real pointer press outside the popover dismisses it.
  const outside = await position(page).boundingBox();
  expect(outside).toBeTruthy();
  await page.mouse.click(outside.x + outside.width / 2, outside.y + outside.height / 2);
  await expect(picker(page)).toHaveCount(0);
});

test('Return opens the highlighted source without changing the paused step', async ({ page }) => {
  await openHarness(page, 'debugger-sources', '[data-slot=replay-debugger]');
  await expect(position(page)).toContainText('step 12 of 18');
  await path(page).getByRole('button', { name: 'src', exact: true }).click();
  await picker(page).getByRole('searchbox').fill('discount.ts');
  // Tab enters the tree on its tab stop (the folder the crumb opened), and ArrowDown moves to the file in it.
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await expect(picker(page).getByRole('treeitem', { name: 'discount.ts', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(picker(page)).toHaveCount(0);
  await expect(path(page)).toContainText('discount.ts');
  await expect(position(page)).toContainText('step 12 of 18');
});

test('the toolbar uses the requested icons and order, grays unavailable Step out and navigates the recorded program', async ({ page }) => {
  await openDemo(page, 'blocks/replay-debugger', '[data-slot=replay-debugger]');
  const toolbar = page.getByRole('toolbar', { name: 'Debugger controls' });
  await expect(toolbar.getByRole('button')).toHaveCount(8);
  expect(await toolbar.getByRole('button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))).toEqual(['Continue', 'Step over', 'Step into', 'Step out', 'Step back', 'Reverse continue', 'Restart', 'Stop']);
  expect(await toolbar.getByRole('button').evaluateAll((buttons) => buttons.map((button) => [...button.querySelector('.codicon').classList].find((name) => name.startsWith('codicon-debug-'))))).toEqual(['codicon-debug-continue', 'codicon-debug-step-over', 'codicon-debug-step-into', 'codicon-debug-step-out', 'codicon-debug-step-back', 'codicon-debug-reverse-continue', 'codicon-debug-restart', 'codicon-debug-stop']);
  await expect(toolbar.getByRole('button', { name: 'Step out', exact: true })).toBeDisabled();
  expect(await toolbar.locator('[data-action=step-out]').evaluate((button) => getComputedStyle(button).opacity)).toBe('0.4');
  const appearance = await toolbar.evaluate((el) => ({
    border: getComputedStyle(el).borderTopWidth,
    background: getComputedStyle(el).backgroundColor,
    forward: getComputedStyle(el.querySelector('[data-action=continue] .codicon')).color,
    reverse: getComputedStyle(el.querySelector('[data-action=reverse-continue] .codicon')).color,
    stepping: getComputedStyle(el.querySelector('[data-action=step-into] .codicon')).color,
  }));
  expect(appearance.border).toBe('0px');
  expect(appearance.background).toBe('rgba(0, 0, 0, 0)');
  expect(appearance.forward).toBe(appearance.reverse);
  expect(appearance.forward).not.toBe(appearance.stepping);
  const step = async (action, expected) => {
    await toolbar.locator(`[data-action="${action}"]`).click();
    await expect(position(page)).toContainText(`step ${expected} of 18`);
  };
  for (let i = 1; i <= 5; i++) await step('step-into', i);
  await expect(toolbar.getByRole('button', { name: 'Step out', exact: true })).toBeEnabled();
  await step('step-over', 6);
  await step('step-into', 7);
  await step('step-out', 8);
  await step('step-back', 7);
  await step('reverse-continue', 0);
  await expect(toolbar.getByRole('button', { name: 'Step out', exact: true })).toBeDisabled();
  await step('continue', 17);
  await step('restart', 0);
  await expect(toolbar.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
});
