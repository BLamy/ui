import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

const root = (page) => page.locator('[data-slot="replay-debugger"]');
const toolbar = (page) => page.locator('[data-slot="debugger-toolbar"]');

test('the plain-data host steps in both directions through keyboard-activated controls', async ({
  page,
}) => {
  await openDemo(
    page,
    'blocks/replay-debugger',
    '[data-slot="replay-debugger"]',
  );
  await expect(toolbar(page)).toHaveAttribute('data-step', '0');
  const forward = root(page).locator('[data-action="step-into"]');
  await forward.focus();
  await page.keyboard.press('Enter');
  await expect(toolbar(page)).toHaveAttribute('data-step', '1');
  await root(page).locator('[data-action="step-back"]').click();
  await expect(toolbar(page)).toHaveAttribute('data-step', '0');
});

test('window resizing preserves the step and an evaluated value across panels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await openDemo(
    page,
    'blocks/replay-debugger',
    '[data-slot="replay-debugger"]',
  );
  await root(page).locator('[data-action="step-into"]').click();
  await expect(toolbar(page)).toHaveAttribute('data-step', '1');
  await page
    .getByRole('textbox', { name: 'Evaluate', exact: true })
    .fill('"kept through resize"');
  await page
    .getByRole('textbox', { name: 'Evaluate', exact: true })
    .press('Enter');
  await expect(
    page.locator('[data-slot="debugger-eval-result"]'),
  ).toContainText('kept through resize');
  await page.setViewportSize({ width: 390, height: 720 });
  await expect(root(page)).toHaveAttribute('data-size-class', 'compact');
  await expect(toolbar(page)).toHaveAttribute('data-step', '1');
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await expect(
    page.locator('[data-slot="debugger-eval-result"]'),
  ).toContainText('kept through resize');
  await page.getByRole('tab', { name: 'Stack', exact: true }).click();
  await expect(
    root(page).getByRole('tree', { name: 'Call stack' }),
  ).toContainText('(top level)');
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(root(page)).not.toHaveAttribute('data-size-class', 'compact');
  await expect(toolbar(page)).toHaveAttribute('data-step', '1');
  await expect(
    page.locator('[data-slot="debugger-eval-result"]'),
  ).toContainText('kept through resize');
});

test('a completed empty host stays empty when stepping and evaluating are requested', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openDemo(
    page,
    'blocks/replay-debugger&variant=empty',
    '[data-slot="replay-debugger"]',
  );
  await expect(root(page)).toContainText('No frames');
  await expect(root(page)).toContainText('No messages');
  await expect(page.locator('[data-slot="code-editor-line"]')).toHaveCount(0);
  await expect(root(page).locator('[data-action="step-into"]')).toBeDisabled();
  await page.getByRole('textbox', { name: 'Evaluate', exact: true }).fill('42');
  await page
    .getByRole('textbox', { name: 'Evaluate', exact: true })
    .press('Enter');
  await expect(page.locator('[data-slot="debugger-evaluation"]')).toHaveCount(
    0,
  );
  await expect(toolbar(page)).not.toHaveAttribute('data-step');
  await expect(root(page)).toContainText('No frames');
  expect(errors).toEqual([]);
});

test('pressing a console message pauses where it was logged', async ({ page }) => {
  await openDemo(page, 'blocks/replay-debugger&variant=cached', '[data-slot="replay-debugger"]');
  const console = root(page).locator('[data-slot="debugger-console"]');
  await console.getByText('Alice pays 2.4').click();
  await expect(toolbar(page)).toHaveAttribute('data-step', '114');
  await expect(root(page).locator('[data-slot="code-editor-gutter-row"][data-current]')).toHaveAttribute('data-line', '42');
  await console.getByText('grand total 20.25').click();
  await expect(toolbar(page)).not.toHaveAttribute('data-step', '114');
});
