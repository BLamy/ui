import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

test('Vibecoder starts with both keychain bridges and reopens after refresh', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const terminal = page.getByRole('region', { name: 'Vibecoder', exact: true });
  await openDemo(page, 'open-code/vibecoder', 'section[aria-label="Vibecoder"]');
  await expect(terminal).toHaveAttribute('data-state', 'running', {
    timeout: 60_000,
  });
  await expect(
    page.getByRole('button', { name: 'Set up Passwords keychain' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Connection: offline', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Connect Tailscale', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Unlock Passwords to restore or save Tailscale.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close connection settings' }).click();

  await page.reload();
  await expect(terminal).toHaveAttribute('data-state', 'running', {
    timeout: 60_000,
  });
  await expect(
    page.getByRole('button', { name: 'Set up Passwords keychain' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
