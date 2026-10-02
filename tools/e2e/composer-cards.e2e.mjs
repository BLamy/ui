import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

/* ComposerCards and ComposerQueue, through their docs demos: cards morph out of the composer (or out of a top bump)
   and sink back in, drawn as one outline while joined; queued messages feed into the chat when the reply ends. */
const skin = (page) => page.locator('[data-slot=composer-morph-skin]').first();
const cards = (page) => page.locator('[data-slot=composer-morph-card]');

/** Samples the skin and the merged surfaces every frame until the morph settles. */
const watchMorph = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const seen = { skin: 0, merged: new Set(), necks: 0 };
        const start = performance.now();
        const tick = () => {
          const svg = document.querySelector('[data-slot=composer-morph-skin]');
          if (svg && svg.style.display !== 'none') {
            seen.skin++;
            // A neck is a subpath with curves.
            if (/C/.test(svg.querySelectorAll('path')[1]?.getAttribute('d') ?? '')) seen.necks++;
          }
          document.querySelectorAll('[data-morph-merged]').forEach((el) => seen.merged.add(el.getAttribute('data-slot')));
          if (performance.now() - start < 1200) requestAnimationFrame(tick);
          else resolve({ skin: seen.skin, necks: seen.necks, merged: [...seen.merged].sort() });
        };
        requestAnimationFrame(tick);
      }),
  );

test.describe('morph cards', () => {
  test.beforeEach(async ({ page }) => openDemo(page, 'composer/morph-cards', '[data-slot=composer]'));

  test('a card morphs out of the composer card, joined by a neck, then stands on its own', async ({ page }) => {
    await page.getByRole('button', { name: 'Toggle top card' }).click(); // the demo starts with the card: remove it
    await expect(cards(page)).toHaveCount(0);
    const watching = watchMorph(page);
    await page.getByRole('button', { name: 'Toggle top card' }).click();
    const seen = await watching;
    expect(seen.skin).toBeGreaterThan(3);
    expect(seen.necks).toBeGreaterThan(0);
    expect(seen.merged).toEqual(['composer-card', 'composer-morph-card']);
    // At rest: separate surfaces, the composer's own look restored, no outline.
    await expect(skin(page)).toBeHidden();
    await expect(page.locator('[data-morph-merged]')).toHaveCount(0);
    const card = cards(page).first();
    const composer = page.locator('[data-slot=composer-card]').first();
    const [a, b] = [await card.boundingBox(), await composer.boundingBox()];
    expect(Math.round(b.y - (a.y + a.height))).toBe(8);
    expect(Math.round(a.width)).toBe(Math.round(b.width));
    // Same material as the composer card.
    const look = (el) => el.evaluate((e) => { const cs = getComputedStyle(e); return [cs.backgroundColor, cs.borderTopColor]; });
    expect(await look(card)).toEqual(await look(composer));
  });

  test('removing a card sinks it back in, then it leaves the DOM', async ({ page }) => {
    await expect(cards(page)).toHaveCount(1);
    const watching = watchMorph(page);
    await page.getByRole('button', { name: 'Skip' }).click();
    const seen = await watching;
    expect(seen.necks).toBeGreaterThan(0);
    await expect(cards(page)).toHaveCount(0);
    await expect(skin(page)).toBeHidden();
    await expect(page.locator('[data-slot=composer-card]').first()).not.toHaveAttribute('style', /transparent/);
  });

  test('a bottom card comes out of the bottom', async ({ page }) => {
    await page.getByRole('button', { name: 'Toggle bottom card' }).click();
    const card = page.locator('[data-slot=composer-cards][data-side=bottom] [data-slot=composer-morph-card]');
    await expect(card).toHaveCount(1);
    const gap = async () => {
      const [c, b] = [await card.boundingBox(), await page.locator('[data-slot=composer-card]').first().boundingBox()];
      return Math.round(c.y - (b.y + b.height));
    };
    await expect.poll(gap, { timeout: 3000 }).toBe(8);
    await expect(skin(page)).toBeHidden();
  });
});

test('with a top bump, cards come out of the bump and take its width', async ({ page }) => {
  await openDemo(page, 'composer/morph-from-bump', '[data-slot=composer]');
  const watching = watchMorph(page);
  await page.getByRole('button', { name: 'Add step' }).click();
  const seen = await watching;
  expect(seen.merged).toContain('composer-bump');
  expect(seen.merged).not.toContain('composer-card');
  await expect(cards(page)).toHaveCount(2);
  const bump = await page.locator('[data-slot=composer-bump]').first().boundingBox();
  const card = await cards(page).last().boundingBox();
  expect(Math.round(card.width)).toBe(Math.round(bump.width));
  expect(Math.round(bump.y - (card.y + card.height))).toBe(8);
});

test.describe('queue', () => {
  test.beforeEach(async ({ page }) => openDemo(page, 'composer/queue', '[data-slot=composer]'));
  const editor = (page) => page.locator('[data-slot=composer] [contenteditable=true]').first();
  const say = async (page, text) => {
    await editor(page).click();
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
  };
  const log = (page) => page.getByRole('log', { name: 'Conversation' });
  const queue = (page) => page.getByRole('list', { name: 'Queued messages' });

  test('messages sent during a reply queue up, then feed into the chat in order', async ({ page }) => {
    await say(page, 'First question');
    await expect(log(page)).toContainText('First question');
    await say(page, 'Follow-up one');
    await say(page, 'Follow-up two');
    await expect(queue(page).getByRole('listitem')).toHaveCount(2);
    // The oldest sits against the composer.
    await expect(queue(page).getByRole('listitem').last()).toContainText('Follow-up one');
    await expect(editor(page)).toHaveText('');
    await expect(page.getByRole('button', { name: 'Queue message' })).toHaveCount(0);
    // The reply ends: the oldest goes in first.
    await expect(log(page).locator('> div').nth(3)).toHaveText('Follow-up one', { timeout: 6000 });
    await expect(queue(page).getByRole('listitem')).toHaveCount(1);
    await expect(log(page).locator('> div').nth(5)).toHaveText('Follow-up two', { timeout: 6000 });
    await expect(queue(page).getByRole('listitem')).toHaveCount(0);
  });

  test('the send button queues while a reply streams with a draft', async ({ page }) => {
    await say(page, 'First question');
    await editor(page).click();
    await page.keyboard.type('Queued by button');
    await page.getByRole('button', { name: 'Queue message' }).click();
    await expect(queue(page).getByRole('listitem')).toHaveCount(1);
  });

  test('edit puts a queued message back in the draft; remove drops it', async ({ page }) => {
    await say(page, 'First question');
    await say(page, 'Keep me');
    await say(page, 'Drop me');
    await queue(page).getByRole('listitem').filter({ hasText: 'Drop me' }).getByRole('button', { name: 'Remove from queue' }).click();
    await queue(page).getByRole('listitem').filter({ hasText: 'Keep me' }).getByRole('button', { name: 'Edit queued message' }).click();
    await expect(queue(page).getByRole('listitem')).toHaveCount(0);
    await expect(editor(page)).toHaveText('Keep me');
  });

  test('send now stops the reply and sends the message', async ({ page }) => {
    await say(page, 'First question');
    await say(page, 'Urgent');
    await queue(page).getByRole('button', { name: 'Send now' }).click();
    await expect(log(page).locator('> div').nth(2)).toHaveText('Urgent');
  });
});

test('reduced motion: cards appear and leave without the morph', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await openDemo(page, 'composer/morph-cards', '[data-slot=composer]');
  const watching = watchMorph(page);
  await page.getByRole('button', { name: 'Toggle bottom card' }).click();
  const seen = await watching;
  expect(seen.skin).toBe(0);
  await expect(page.locator('[data-slot=composer-cards][data-side=bottom] [data-slot=composer-morph-card]')).toHaveCount(1);
  await context.close();
});
