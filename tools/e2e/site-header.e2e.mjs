import { test, expect } from '@playwright/test';

/* The BL site has one bar. Every docs site it mounts (the ui docs, the libraries, docstream's, the editor's, the roadmap) is a
   DocsSite without a header of its own (`header={false}`), and the site's header holds that site's search and, while
   the site is narrow enough to fold its sidebar away, the button that opens its navigation. These run against the
   site itself (`#/<route>`), not a `?demo=`. */
const DOCS_ROUTES = ['introduction', 'dialog', 'blocks', 'docstream', 'docstream-editor', 'roadmap', 'roadmap/packages', 'libraries', 'libraries/ui'];
const OTHER_ROUTES = [''];

const open = async (page, route) => {
  await page.goto(`/?theme=light#/${route}`, { waitUntil: 'load' });
  await page.getByRole('banner').first().waitFor({ timeout: 30_000 });
};
const openDocs = async (page, route) => {
  await open(page, route);
  await page.locator('.ds-site-article').first().waitFor({ timeout: 30_000 });
};
const bar = (page) => page.getByRole('banner');
const search = (page) => bar(page).locator('button[aria-keyshortcuts]');
const navigation = (page) => bar(page).getByRole('button', { name: 'Open the docs navigation' });
const searchDialog = (page) => page.locator('[role="dialog"].ds-site-search');
const drawer = (page) => page.locator('[role="dialog"].ds-site-drawer');

for (const route of DOCS_ROUTES) {
  test(`#/${route}: one bar, and the docs start right under it`, async ({ page }) => {
    await openDocs(page, route);
    await expect(bar(page)).toHaveCount(1);
    await expect(page.locator('.ds-site-header')).toHaveCount(0);
    const [barBox, bodyBox] = await Promise.all([bar(page).boundingBox(), page.locator('.ds-site-body').boundingBox()]);
    expect(Math.round(bodyBox.y)).toBe(Math.round(barBox.y + barBox.height));
    // The bar holds the docs site's search.
    await expect(search(page)).toHaveCount(1);
    await expect(search(page)).toBeVisible();
  });
}

for (const route of OTHER_ROUTES) {
  test(`#/${route}: one bar, with no docs controls off the docs`, async ({ page }) => {
    await open(page, route);
    await expect(bar(page)).toHaveCount(1);
    await expect(search(page)).toHaveCount(0);
    await expect(navigation(page)).toHaveCount(0);
  });
}

test('the bar marks the section a ui docs page is in', async ({ page }) => {
  const current = () => bar(page).getByRole('navigation', { name: 'Site' }).locator('[aria-current="page"]');
  await openDocs(page, 'dialog');
  await expect(current()).toHaveText('Docs');
  await openDocs(page, 'blocks');
  await expect(current()).toHaveText('Blocks');
  await openDocs(page, 'roadmap');
  await expect(current()).toHaveText('Roadmap');
});

test('the bar’s search opens the mounted docs site’s search, finds a page and goes to it', async ({ page }) => {
  await openDocs(page, 'introduction');
  await expect(search(page)).toHaveAccessibleName('Search BL UI');
  await search(page).click();
  await expect(searchDialog(page)).toBeVisible();
  await page.keyboard.type('dialog');
  await expect(searchDialog(page).getByRole('option').first()).toContainText('Dialog');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/dialog/);
  await expect(searchDialog(page)).toHaveCount(0);
});

test('⌘K searches the docs site of the route', async ({ page }) => {
  await openDocs(page, 'docstream');
  await expect(search(page)).toHaveAccessibleName('Search Docstream');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(searchDialog(page)).toBeVisible();
  await page.keyboard.type('stepper');
  await expect(searchDialog(page).getByRole('option').first()).toHaveAttribute('href', /^#\/docstream\//);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/docstream\//);
  await expect(searchDialog(page)).toHaveCount(0);
});

test('Escape closes the search and gives focus back to the bar’s button', async ({ page }) => {
  await openDocs(page, 'roadmap');
  await search(page).click();
  await expect(searchDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(searchDialog(page)).toHaveCount(0);
  await expect(search(page)).toBeFocused();
});

test.describe('a window too narrow for the sidebar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of ['introduction', 'docstream', 'roadmap']) {
    test(`#/${route}: the bar opens the docs navigation, and a page picked there closes it`, async ({ page }) => {
      await openDocs(page, route);
      await expect(bar(page)).toHaveCount(1);
      await expect(page.locator('.ds-site-sidebar')).toBeHidden();
      await navigation(page).click();
      await expect(drawer(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(drawer(page)).toHaveCount(0);
      await expect(navigation(page)).toBeFocused();
      await navigation(page).click();
      const row = drawer(page).locator('a.ds-site-nav-link').nth(2);
      const href = await row.getAttribute('href');
      await row.click();
      await expect(drawer(page)).toHaveCount(0);
      expect(page.url().endsWith(href)).toBe(true);
    });
  }

  test('the navigation button follows the docs site’s layout', async ({ page }) => {
    await openDocs(page, 'introduction');
    await expect(navigation(page)).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.ds-site-sidebar')).toBeVisible();
    await expect(navigation(page)).toHaveCount(0);
  });
});
