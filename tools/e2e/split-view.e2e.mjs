import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* SplitView's sidebar as the phone tab bar (`compactPresentation="tabs"`), through the Podcasts demo, which opens in a
   390px frame: the Library tab group's rows, a push from them, and pressing the selected tab again. */
const SPLIT = '[data-slot=split-view]';

test.beforeEach(async ({ page }) => {
  await openDemo(page, 'split-view/sidebar-tab-bar', SPLIT);
});

const tab = (page, name) => page.getByRole('tab', { name });
const column = (page, name) => page.locator(`${SPLIT} [data-slot=split-view-${name}]`);
/** The column on top of the compact stack has settled where it rests. */
const onTop = async (page, name) => {
  await expect(column(page, name)).toHaveAttribute('data-top', '');
  await expect.poll(async () => {
    const [c, s] = await Promise.all([column(page, name).boundingBox(), page.locator(SPLIT).boundingBox()]);
    return c && s ? Math.round(c.x - s.x) : null;
  }).toBe(0);
};

test('the Library tab shows its rows, and a row pushes its page with the way back', async ({ page }) => {
  await tab(page, 'Library').click();
  await onTop(page, 'sidebar');
  const sidebar = column(page, 'sidebar');
  await expect(sidebar.getByRole('heading', { name: 'Library' })).toBeVisible();
  for (const row of ['Shows', 'Saved', 'Downloaded']) await expect(sidebar.getByRole('button', { name: row })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Home' })).toBeHidden();
  // The selected tab controls the column on top.
  const controls = await tab(page, 'Library').getAttribute('aria-controls');
  expect(await sidebar.getAttribute('id')).toBe(controls);
  await expect(sidebar).toHaveAttribute('role', 'tabpanel');

  await sidebar.getByRole('button', { name: 'Saved' }).click();
  await onTop(page, 'detail');
  await expect(column(page, 'detail').getByRole('button', { name: 'Back to Library' })).toBeVisible();
  await expect(tab(page, 'Library')).toHaveAttribute('aria-selected', 'true');

  // The selected tab again: back to its rows.
  await tab(page, 'Library').click();
  await onTop(page, 'sidebar');
});

test('pressing the selected tab again pops the stack beside the bar to its first page', async ({ page }) => {
  await onTop(page, 'detail');
  const detail = column(page, 'detail');
  await detail.locator('[data-slot=list-row]', { hasText: 'Field Notes' }).click();
  await expect(detail.locator('[data-slot=navigation-stack-page]')).toHaveCount(2);
  await tab(page, 'Home').click();
  await expect(detail.locator('[data-slot=navigation-stack-page]')).toHaveCount(1);
  await expect(detail.getByRole('heading', { name: 'Home' })).toBeVisible();
});
