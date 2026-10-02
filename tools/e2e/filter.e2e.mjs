import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* Filter, through its docs demos, with real pointer and keyboard input: the Filter menu, editing a chip's operator and
   value, keyboard operation of the toolbar, removal, and the natural-language box (preview first, Enter applies). */

const toolbar = (page) => page.getByRole('toolbar', { name: 'Filters' });
const chip = (page, name) => page.getByRole('group', { name });
const count = (page) => page.getByText(/^\d+ of \d+ issues$/);

test.describe('issue tracker', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'filter/issue-tracker', '[data-slot=filter-bar]');
  });

  test('starts with the Status filter and its rows', async ({ page }) => {
    await expect(chip(page, 'Status is any of Open, In progress')).toBeVisible();
    await expect(count(page)).toHaveText('8 of 12 issues');
  });

  test('adds a filter from the menu: pick a field, search, tick values; the chip and the list follow live', async ({ page }) => {
    await page.getByRole('button', { name: /^Filter/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Add filter' });
    await expect(dialog).toBeVisible();
    // typing searches the fields; the first match is the active row, Enter picks it
    await page.keyboard.type('prio');
    await expect(dialog.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    const list = page.getByRole('listbox', { name: 'Priority' });
    await expect(list).toBeVisible();
    await expect(list.getByRole('option')).toHaveText([/Urgent/, /High/, /Medium/, /Low/]);
    await list.getByRole('option', { name: /Urgent/ }).click();
    await expect(chip(page, 'Priority is Urgent')).toBeVisible();
    await expect(count(page)).toHaveText('2 of 12 issues'); // open or in progress, and urgent
    await list.getByRole('option', { name: /High/ }).click();
    await expect(chip(page, 'Priority is any of Urgent, High')).toBeVisible();
    await expect(count(page)).toHaveText('4 of 12 issues');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Filter/ })).toBeFocused();
  });

  test('picks values with the keyboard alone: arrows move the active row, Enter ticks it', async ({ page }) => {
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.keyboard.type('assignee');
    await page.keyboard.press('Enter');
    const list = page.getByRole('listbox', { name: 'Assignee' });
    await expect(list).toBeVisible();
    await page.keyboard.press('ArrowDown'); // Alice
    await page.keyboard.press('ArrowDown'); // Bob
    await page.keyboard.press('Enter');
    await expect(chip(page, 'Assignee is Bob')).toBeVisible();
    await page.keyboard.type('car'); // the search narrows to Carol, who becomes the active row
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(chip(page, 'Assignee is any of Bob, Carol')).toBeVisible();
  });

  test('F opens the menu (and not while typing in a field)', async ({ page }) => {
    await page.keyboard.press('f');
    await expect(page.getByRole('dialog', { name: 'Add filter' })).toBeVisible();
    // the search box has focus: another f is typed, not a second menu
    await page.keyboard.press('f');
    await expect(page.getByRole('searchbox', { name: 'Filter by' })).toHaveValue('f');
    await page.keyboard.press('Escape'); // clears the search
    await page.keyboard.press('Escape'); // closes
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('changes the operator: its own small menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Status operator: is any of' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitemradio')).toHaveText(['is', 'is not', 'is any of', 'is none of']);
    await menu.getByRole('menuitemradio', { name: 'is none of' }).click();
    await expect(chip(page, 'Status is none of Open, In progress')).toBeVisible();
    await expect(count(page)).toHaveText('4 of 12 issues'); // done + canceled: BL-106, 107, 109, 112
    // "is" with several values keeps the first
    await page.getByRole('button', { name: 'Status operator: is none of' }).click();
    await page.getByRole('menuitemradio', { name: 'is not' }).click();
    await expect(chip(page, 'Status is not Open')).toBeVisible();
  });

  test('edits the values in place with the same searchable picker', async ({ page }) => {
    await page.getByRole('button', { name: 'Status value: Open, In progress' }).click();
    const list = page.getByRole('listbox', { name: 'Status' });
    await expect(list.getByRole('option', { name: /Open/ })).toHaveAttribute('aria-selected', 'true');
    await expect(list.getByRole('option', { name: /Done/ })).toHaveAttribute('aria-selected', 'false');
    await list.getByRole('option', { name: /Done/ }).click();
    await expect(chip(page, 'Status is any of Open, In progress, Done')).toBeVisible();
    await list.getByRole('option', { name: /Open/ }).click();
    await list.getByRole('option', { name: /In progress/ }).click();
    await expect(chip(page, 'Status is Done')).toBeVisible(); // one value reads "is"
    await page.keyboard.press('Escape');
    await expect(count(page)).toHaveText('3 of 12 issues');
  });

  test('the toolbar is one tab stop; arrows move across the parts; Backspace removes a chip', async ({ page }) => {
    // add a second chip first
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.keyboard.type('prio');
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: /Urgent/ }).click();
    await page.keyboard.press('Escape');
    await expect(chip(page, 'Priority is Urgent')).toBeVisible();

    const trigger = page.getByRole('button', { name: /^Filter/ });
    await trigger.focus();
    const order = [
      'Status operator: is any of', 'Status value: Open, In progress', 'Remove filter: Status is any of Open, In progress',
      'Priority operator: is', 'Priority value: Urgent', 'Remove filter: Priority is Urgent',
    ];
    for (const name of order) {
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('button', { name })).toBeFocused();
    }
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('button', { name: 'Remove filter: Priority is Urgent' })).toBeFocused();

    // Tab leaves the toolbar in one step
    await page.keyboard.press('Tab');
    await expect(toolbar(page).locator(':focus')).toHaveCount(0);

    // Backspace on the Priority chip's value removes the chip; focus lands on the neighbour (the Status chip), not <body>
    await page.getByRole('button', { name: 'Priority value: Urgent' }).focus();
    await page.keyboard.press('Backspace');
    await expect(chip(page, 'Priority is Urgent')).toHaveCount(0);
    await expect(count(page)).toHaveText('8 of 12 issues');
    await expect(chip(page, 'Status is any of Open, In progress').locator(':focus')).toHaveCount(1);
    // Delete removes the last one, and focus returns to the Filter button
    await page.keyboard.press('Delete');
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
    await expect(count(page)).toHaveText('12 of 12 issues');
    await expect(page.getByRole('button', { name: /^Filter/ })).toBeFocused();
  });

  test('× removes and Clear all clears; both are announced', async ({ page }) => {
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.keyboard.type('prio');
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: /High/ }).click();
    await page.keyboard.press('Escape');
    const announcer = page.locator('[data-slot=filter-announcer]');
    await page.getByRole('button', { name: 'Remove filter: Priority is High' }).click();
    await expect(announcer).toContainText('Filter removed: Priority is High');
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(announcer).toContainText('Filter cleared');
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear all' })).toHaveCount(0);
  });

  test('a click outside closes the menu and a half-made filter stays as made', async ({ page }) => {
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.keyboard.type('prio');
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: /Low/ }).click();
    await page.mouse.click(5, 5);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(chip(page, 'Priority is Low')).toBeVisible();
  });
});

test.describe('field kinds', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'filter/field-kinds', '[data-slot=filter-bar]');
  });

  test('number: operator menu, then a typed value applied with Enter', async ({ page }) => {
    await expect(chip(page, 'Points ≥ 3')).toBeVisible();
    await page.getByRole('button', { name: 'Points operator: ≥' }).click();
    await page.getByRole('menuitemradio', { name: '<', exact: true }).click();
    await expect(chip(page, 'Points < 3')).toBeVisible();
    await page.getByRole('button', { name: 'Points value: 3' }).click();
    const box = page.getByRole('spinbutton', { name: 'Points number' });
    await box.fill('6');
    await box.press('Enter');
    await expect(chip(page, 'Points < 6')).toBeVisible();
    await expect(page.getByText(/matching all of the filters/)).toContainText('of 6 tasks');
  });

  test('date: presets, a picked day, and "in the last" with a span', async ({ page }) => {
    await page.getByRole('button', { name: 'Created operator: in the last' }).click();
    await page.getByRole('menuitemradio', { name: 'after', exact: true }).click();
    await page.getByRole('button', { name: /^Created value/ }).click();
    await page.getByRole('option', { name: 'Last week' }).click();
    await expect(chip(page, /Created after Last week/)).toBeVisible();
    await page.getByRole('button', { name: /^Created operator/ }).click();
    await page.getByRole('menuitemradio', { name: 'in the last' }).click();
    await page.getByRole('button', { name: /^Created value/ }).click();
    const amount = page.getByRole('spinbutton', { name: 'How many' });
    await amount.fill('3');
    await page.locator('label', { hasText: 'months' }).click();
    await expect(chip(page, 'Created in the last 3 months')).toBeVisible();
    await expect(page.getByText(/^\?filters=/)).toContainText('created:in_the_last:3m');
  });

  test('match any / all', async ({ page }) => {
    await page.getByRole('button', { name: 'Match mode: all filters' }).click();
    await page.getByRole('menuitemradio', { name: 'Match any filter' }).click();
    await expect(page.getByRole('button', { name: 'Match mode: any filter' })).toBeVisible();
    await expect(page.getByText(/matching any of the filters/)).toBeVisible();
  });

  test('boolean and text editors from the Filter menu', async ({ page }) => {
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.getByRole('option', { name: 'Blocked' }).click();
    await page.getByRole('option', { name: 'Yes' }).click();
    await expect(chip(page, 'Blocked is Yes')).toBeVisible();
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.getByRole('option', { name: 'Title' }).click();
    const box = page.getByRole('textbox', { name: 'Title text' });
    await box.fill('upload');
    await box.press('Enter');
    await expect(chip(page, 'Title contains upload')).toBeVisible();
    await expect(page.getByText(/^\?filters=/)).toContainText('title:contains:upload');
  });
});

test.describe('natural language', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'filter/natural-language', '[data-slot=filter-input]');
  });

  const box = (page) => page.getByRole('textbox', { name: 'Describe the filters you want' });
  const count = (page) => page.getByText(/^\d+ of \d+ issues$/);

  test('a sentence previews its chips; Enter applies them as editable filters', async ({ page }) => {
    await expect(count(page)).toHaveText('12 of 12 issues');
    await box(page).click();
    await box(page).pressSequentially('urgent bugs assigned to bob', { delay: 12 });
    const preview = page.locator('[data-slot=filter-input-preview]');
    await expect(preview).toContainText('Will apply');
    await expect(preview.getByRole('group', { includeHidden: true })).toHaveCount(2);
    await expect(preview).toContainText('Urgent');
    await expect(preview).toContainText('Bob');
    await expect(preview).toContainText('Ignored'); // "bugs" matched no value, and says so
    // nothing has been applied yet
    await expect(count(page)).toHaveText('12 of 12 issues');
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
    await box(page).press('Enter');
    await expect(page.getByRole('group', { name: 'Priority is Urgent' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Assignee is Bob' })).toBeVisible();
    await expect(count(page)).toHaveText('1 of 12 issues');
    await expect(box(page)).toHaveValue('');
    // the applied chips are ordinary: edit one
    await page.getByRole('button', { name: 'Assignee value: Bob' }).click();
    await page.getByRole('option', { name: /Carol/ }).click();
    await expect(page.getByRole('group', { name: 'Assignee is any of Bob, Carol' })).toBeVisible();
  });

  test('says so when it understood nothing, and applies nothing', async ({ page }) => {
    await box(page).click();
    await box(page).pressSequentially('qwerty zxcvb', { delay: 12 });
    await expect(page.locator('[data-slot=filter-input-preview]')).toContainText('Nothing understood yet');
    await expect(page.getByRole('button', { name: 'Apply' })).toBeDisabled();
    await box(page).press('Enter');
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
    await box(page).press('Escape');
    await expect(box(page)).toHaveValue('');
  });

  test('a date phrase becomes a date filter', async ({ page }) => {
    await box(page).click();
    await box(page).pressSequentially('created in the last 3 days', { delay: 12 });
    await expect(page.locator('[data-slot=filter-input-preview]')).toContainText('3 days');
    await box(page).press('Enter');
    await expect(page.getByRole('group', { name: 'Created in the last 3 days' })).toBeVisible();
    await expect(count(page)).toHaveText('3 of 12 issues');
  });
});
