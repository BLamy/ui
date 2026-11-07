import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

const root = (page) => page.locator('[data-slot="replay-debugger"]');
const position = (page) => page.locator('[data-slot="debugger-position"]');

test('the plain-data host steps in both directions through keyboard-activated controls', async ({
  page,
}) => {
  await openDemo(
    page,
    'blocks/replay-debugger',
    '[data-slot="replay-debugger"]',
  );
  await expect(position(page)).toContainText('step 0 of 18');
  await expect(root(page)).toContainText('in-memory table');
  await expect(root(page)).not.toContainText('native arm64');
  const forward = root(page).locator('[data-action="stepIn"]');
  await forward.focus();
  await page.keyboard.press('Enter');
  await expect(position(page)).toContainText('step 1 of 18');
  await root(page).locator('[data-action="stepInBack"]').click();
  await expect(position(page)).toContainText('step 0 of 18');
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
  await root(page).locator('[data-action="stepIn"]').click();
  await expect(position(page)).toContainText('step 1 of 18');
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
  await expect(root(page)).toHaveAttribute('data-narrow', 'true');
  await expect(position(page)).toContainText('step 1 of 18');
  await page.getByRole('tab', { name: 'Console', exact: true }).click();
  await expect(
    page.locator('[data-slot="debugger-eval-result"]'),
  ).toContainText('kept through resize');
  await page.getByRole('tab', { name: 'Stack', exact: true }).click();
  await expect(
    root(page).getByRole('grid', { name: 'Call stack' }),
  ).toContainText('(top level)');
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(root(page)).not.toHaveAttribute('data-narrow');
  await expect(position(page)).toContainText('step 1 of 18');
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
  await expect(root(page)).toContainText('0 steps indexed');
  await expect(root(page)).toContainText('No frames');
  await expect(root(page)).toContainText('No messages');
  await expect(page.locator('[data-slot="code-editor-line"]')).toHaveCount(0);
  await root(page).locator('[data-action="stepIn"]').click();
  await page.getByRole('textbox', { name: 'Evaluate', exact: true }).fill('42');
  await page
    .getByRole('textbox', { name: 'Evaluate', exact: true })
    .press('Enter');
  await expect(page.locator('[data-slot="debugger-evaluation"]')).toHaveCount(
    0,
  );
  await expect(position(page)).toHaveText('');
  await expect(root(page)).toContainText('No frames');
  expect(errors).toEqual([]);
});
