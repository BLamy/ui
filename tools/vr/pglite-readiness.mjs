import { expect } from '@playwright/test';

const ready = { timeout: 30000 };

export async function waitForPgliteExamples(page) {
  const demos = page.locator('[data-docstream-demo]');
  await expect(demos).toHaveCount(4, ready);
  await expect(demos.nth(0).getByRole('button', { name: /^Delete note / })).toHaveCount(2, ready);
  await expect(demos.nth(1).getByTestId('visit-count')).toHaveText('0', ready);
  await expect(demos.nth(2).getByTestId('click-count')).toHaveText('0', ready);
  await expect(page.getByRole('status').filter({ hasText: /PostgreSQL \d/ })).toHaveCount(3, ready);
  for (const count of [demos.nth(1).getByTestId('visit-count'), demos.nth(2).getByTestId('click-count')]) {
    await expect(count.locator('xpath=ancestor::*[@aria-busy][1]')).toHaveAttribute('aria-busy', 'false', ready);
  }
  const rows = demos.nth(3).getByRole('list', { name: 'Leaderboard', exact: true }).getByRole('listitem');
  await expect(rows).toHaveText([/1\s*Grace\s*44/, /2\s*Ada\s*31/, /3\s*Linus\s*12/], ready);
  await expect(demos.locator('[aria-busy="true"]')).toHaveCount(0, ready);
  await expect(demos.getByRole('alert')).toHaveCount(0, ready);
  await expect(page.getByRole('status', { name: 'Starting PostgreSQL', exact: true })).toHaveCount(0, ready);
}
