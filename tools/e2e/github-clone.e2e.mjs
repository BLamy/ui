import { expect, test } from '@playwright/test';

/* The GitHub clone's workflows, end to end, on its in-page GitHub (sample-server.ts): every step is real clicks and keys,
   and each write is checked by what the next screen reads back. Stories give the permission and failure variants, so this
   runs against Storybook: SB_URL=http://localhost:6006 pnpm e2e github-clone */
const SB = process.env.SB_URL ?? 'http://localhost:6006';
const story = (name, route) => `${SB}/iframe.html?id=blocks-github-clone--${name}&viewMode=story${route ? `#/acme/orbit/${route}` : ''}`;
const open = async (page, name, route) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(story(name, route), { waitUntil: 'load' });
  await page.locator('#storybook-root > *').first().waitFor({ timeout: 30_000 });
  return errors;
};
const phone = { width: 422, height: 876 };
/** react-aria's real input is visually hidden: a person clicks the label around it. */
const tick = (page, name) => page.getByRole('checkbox', { name }).first().locator('xpath=ancestor::label').click();
const code = (page, path) => page.getByRole('region', { name: `Code of ${path}` });

test.describe('desktop', () => {
  test('an issue: required title, create, comment, edit, labels, close with a reason, reopen, counts', async ({ page }) => {
    const errors = await open(page, 'issues-list');
    const tab = page.getByRole('tab', { name: /^Issues/ });
    await expect(tab).toContainText('30');
    await page.getByRole('button', { name: 'New issue' }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'title is required' })).toBeVisible();
    await page.getByRole('textbox', { name: /Title/ }).fill('E2E: the widget is broken');
    await page.getByRole('textbox', { name: 'Description' }).fill('It **broke**.');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByLabel('Description preview').locator('strong')).toHaveText('broke');
    await page.getByRole('button', { name: 'Write' }).click();
    await page.getByRole('button', { name: /^Labels/ }).click();
    await page.getByRole('option', { name: /^bug/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: /E2E: the widget is broken/ })).toBeVisible();
    await expect(tab).toContainText('31');

    // Enter is a new line; only ⌘↵ or the button posts.
    const box = page.getByRole('textbox', { name: 'Add a comment' });
    await box.fill('First line');
    await box.press('Enter');
    await box.pressSequentially('second line');
    await expect(page.locator('[id^="issuecomment-"]')).toHaveCount(0);
    await box.press('ControlOrMeta+Enter');
    await expect(page.getByText(/First line\s*second line/).first()).toBeVisible();
    await expect(box).toHaveValue('');

    // Edit it.
    await page.getByRole('button', { name: /Comment actions for you/ }).last().click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await page.getByRole('textbox', { name: 'Edit comment' }).fill('Edited words');
    await page.getByRole('button', { name: 'Update comment' }).click();
    await expect(page.getByText('Edited words')).toBeVisible();

    // Labels from the sidebar, applied when the menu closes, and the timeline says so.
    await page.getByRole('button', { name: 'Edit labels' }).click();
    await page.getByRole('option', { name: /^performance/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: 'Details' }).getByText('performance')).toBeVisible();

    // Close as not planned; reopen.
    await page.getByRole('button', { name: 'Close with a reason' }).click();
    await page.getByRole('menuitem', { name: /Close as not planned/ }).click();
    await expect(page.getByText('Closed as not planned', { exact: true })).toBeVisible();
    await expect(tab).toContainText('30');
    await page.getByRole('button', { name: /Reopen/ }).click();
    await expect(page.getByText('reopened this')).toBeVisible();
    await expect(tab).toContainText('31');
    expect(errors).toEqual([]);
  });

  test('lists: qualifiers, filter menus, sort, pages, clear', async ({ page }) => {
    await open(page, 'issues-list');
    const search = page.getByRole('textbox', { name: 'Search all issues' });
    await search.fill('is:open author:avakim');
    await search.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'result' })).toBeVisible();
    await expect(page.getByText(/opened .* by avakim/).first()).toBeVisible();
    await expect(page.getByText(/opened .* by samokafor/)).toHaveCount(0);
    await page.getByRole('button', { name: /Clear current search/ }).click();
    await expect(page.getByText(/opened .* by samokafor/).first()).toBeVisible();

    await page.getByRole('button', { name: /^Labels/ }).last().click();
    await page.getByRole('option', { name: /^bug/ }).click();
    await page.keyboard.press('Escape');
    await expect(search).toHaveValue(/label:bug/);

    await page.getByRole('button', { name: /Clear current search/ }).click();
    await page.getByRole('button', { name: 'Page 2' }).click();
    await expect(page.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'Sort' }).click();
    await page.getByRole('menuitem', { name: 'Most commented' }).click();
    await expect(search).toHaveValue(/sort:comments-desc/);
    await expect(page.getByRole('link', { name: 'Drop Node 18 support in v4' })).toBeVisible();
  });

  test('merge box tells the truth, then a real merge moves everything', async ({ page }) => {
    await open(page, 'pull-request');
    const merge = page.getByRole('button', { name: 'Merge pull request' });
    await expect(merge).toBeEnabled();
    await merge.click();
    await page.getByRole('button', { name: 'Confirm merge' }).click();
    await expect(page.getByText('Pull request successfully merged and closed')).toBeVisible();
    await expect(page.getByText('Merged', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete branch' }).click();
    await expect(page.getByRole('button', { name: 'Restore branch' })).toBeVisible();
    // It closed the issue it said it would.
    await page.getByRole('link', { name: /#483/ }).first().click();
    await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
    // And its code is on main.
    await page.getByRole('tab', { name: 'Code' }).click();
    await page.getByRole('link', { name: 'Folder src' }).click();
    await page.getByRole('link', { name: 'File retry.ts' }).click();
    await expect(code(page, 'src/retry.ts')).toContainText('applyJitter');
  });

  for (const [n, text] of [[479, 'conflicts'], [486, 'Draft pull requests'], [484, 'Reviewers asked for changes'], [481, 'approving review']]) {
    test(`#${n} can't merge and says why`, async ({ page }) => {
      await page.goto(story('pull-request', `pull/${n}`));
      await expect(page.getByRole('button', { name: 'Merge pull request' })).toBeDisabled({ timeout: 30_000 });
      await expect(page.getByRole('region', { name: 'Merge status' }).getByText(new RegExp(text)).first()).toBeVisible();
    });
  }

  test('behind: update branch unblocks it; draft: ready for review', async ({ page }) => {
    await page.goto(story('pull-request', 'pull/478'));
    await page.getByRole('button', { name: 'Update branch' }).click();
    await expect(page.getByRole('button', { name: 'Merge pull request' })).toBeEnabled();
    await page.getByRole('tab', { name: /^Pull requests/ }).click();
    await page.getByRole('link', { name: /SQLite: poll/ }).click();
    await page.getByRole('button', { name: 'Ready for review' }).click();
    await expect(page.getByRole('button', { name: 'Convert to draft' })).toBeVisible();
    await expect(page.getByText('marked this pull request as ready for review')).toBeVisible();
  });

  test('close and reopen, edit title, change reviewers', async ({ page }) => {
    await page.goto(story('pull-request', 'pull/481'));
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('textbox', { name: 'Pull request title' }).fill('docs: Prisma guide');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /docs: Prisma guide/ })).toBeVisible();
    await page.getByRole('button', { name: /Close pull request/ }).click();
    await expect(page.getByText('Closed with unmerged commits')).toBeVisible();
    await page.getByRole('button', { name: /Reopen pull request/ }).click();
    await expect(page.getByRole('button', { name: 'Merge pull request' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit reviewers' }).click();
    await page.getByRole('option', { name: /avakim/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('requested a review from').last()).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Details' }).getByRole('link', { name: 'avakim' })).toBeVisible();
  });

  test('a review: line comments, a pending review, submit; threads resolve', async ({ page }) => {
    await page.goto(story('files-changed'));
    const diff = page.locator('[id="diff-src/retry.ts"]');
    await diff.waitFor({ timeout: 30_000 });
    // A thread is on its line.
    await expect(page.getByText(/from the first commit message/)).toBeVisible();
    await page.getByRole('button', { name: 'Resolve conversation' }).first().click();
    await expect(page.getByRole('button', { name: 'Unresolve conversation' }).first()).toBeVisible();
    // Start a review on a line.
    await diff.locator('tr', { hasText: 'export type Jitter' }).hover();
    await diff.getByRole('button', { name: /Comment on line 7$/ }).click();
    await page.getByRole('textbox', { name: /Comment on line 7/ }).fill('Could this be an enum?');
    await page.getByRole('button', { name: 'Start a review' }).click();
    await expect(page.getByRole('status').filter({ hasText: '1 comment pending' })).toBeVisible();
    await diff.locator('tr', { hasText: 'export type Jitter' }).scrollIntoViewIfNeeded();
    await expect(page.getByText('Could this be an enum?')).toBeVisible();
    await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /Finish your review/ }).click();
    await page.getByRole('textbox', { name: 'Review summary' }).fill('Two small things.');
    await page.getByRole('radio', { name: /Request changes/ }).check();
    await page.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'pending' })).toHaveCount(0);
    await page.getByRole('tab', { name: /^Conversation/ }).click();
    await expect(page.getByText('requested changes').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Merge pull request' })).toBeDisabled();
    await expect(page.getByText('Two small things.')).toBeVisible();
  });

  test('viewed files, split diff, file filter, commit filter', async ({ page }) => {
    await page.goto(story('files-changed'));
    await expect(page.getByRole('status').filter({ hasText: '1 / 3 viewed' })).toBeVisible({ timeout: 30_000 });
    await tick(page, 'Viewed');
    await expect(page.getByRole('status').filter({ hasText: '2 / 3 viewed' })).toBeVisible();
    await page.getByRole('button', { name: 'Split diff' }).click();
    await page.getByRole('textbox', { name: 'Filter changed files' }).fill('retries');
    await expect(page.locator('[id="diff-src/retry.ts"]')).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Filter changed files' }).fill('');
    await page.getByRole('button', { name: 'Filter changed files by commit' }).click();
    await page.getByRole('option', { name: /clamp jittered/ }).click();
    await expect(page.locator('[id="diff-src/retry.ts"]')).toBeVisible();
    await expect(page.locator('[id="diff-docs/retries.md"]')).toHaveCount(0);
  });

  test('code: refs change what you see, blame, history, commit page, go to file, search', async ({ page }) => {
    await open(page, 'light');
    await page.getByRole('link', { name: 'Folder src' }).click();
    await page.getByRole('link', { name: 'File retry.ts' }).click();
    await expect(code(page, 'src/retry.ts')).not.toContainText('applyJitter');
    // The switcher stays on the file.
    await page.getByRole('button', { name: /Switch branches or tags/ }).click();
    await page.getByRole('textbox', { name: /Find or create a branch/ }).fill('jitter');
    await page.getByRole('option', { name: /feat\/retry-jitter/ }).click();
    await expect(code(page, 'src/retry.ts')).toContainText('applyJitter');
    await page.getByRole('button', { name: 'Blame' }).click();
    await expect(page.getByRole('region', { name: /Blame of src\/retry.ts/ }).getByText('retry: add jitter strategies').first()).toBeVisible();
    await page.getByRole('button', { name: 'Code' }).click();
    await page.getByRole('button', { name: 'More file actions' }).click();
    await page.getByRole('menuitem', { name: 'History' }).click();
    await page.getByRole('link', { name: /clamp jittered delays/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: /clamp jittered/ })).toBeVisible();
    await expect(page.getByText(/1 parent/)).toBeVisible();
    await page.keyboard.press('t');
    await page.getByRole('textbox', { name: 'Go to file' }).fill('pgres');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'postgres.ts' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Go to file' })).toHaveCount(0);
    await page.keyboard.press('/');
    await page.getByRole('textbox', { name: /Search acme\/orbit/ }).fill('SKIP LOCKED');
    await expect(page.getByRole('region', { name: 'Search results' }).getByText('src/adapters/postgres.ts')).toBeVisible();
  });

  test('edit on a new branch and open a pull request from it, then it conflicts-free merges', async ({ page }) => {
    await open(page, 'light');
    await page.getByRole('link', { name: 'File README.md' }).click();
    await page.getByRole('button', { name: 'More file actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit file' }).click();
    const editor = page.getByRole('textbox', { name: 'Contents of README.md' });
    await editor.fill('# Orbit, edited\n');
    await page.getByRole('radio', { name: /new branch/ }).check();
    await page.getByRole('textbox', { name: 'New branch name' }).fill('e2e/readme');
    await page.getByRole('button', { name: 'Commit changes' }).click();
    // Lands on compare, form open.
    await expect(page.getByRole('heading', { name: 'Open a pull request' })).toBeVisible();
    await expect(page.getByText('1 ahead')).toBeVisible();
    await page.getByRole('textbox', { name: 'Description' }).fill('Fixes #485');
    await tick(page, 'Create as draft');
    await page.getByRole('button', { name: 'Create draft pull request' }).click();
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
    await page.getByRole('tab', { name: /^Files changed/ }).click();
    await expect(page.locator('[id="diff-README.md"]')).toBeVisible();
  });

  test('new file, branches page, tags page', async ({ page }) => {
    await open(page, 'light');
    await page.getByRole('button', { name: 'Add file' }).click();
    await page.getByRole('menuitem', { name: 'Create new file' }).click();
    await page.getByRole('textbox', { name: 'File name' }).fill('docs/new-page.md');
    await page.getByRole('textbox', { name: 'File contents' }).fill('# New page\n');
    await page.getByRole('button', { name: 'Commit new file' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'new-page.md' })).toBeVisible();
    await page.getByRole('tab', { name: 'Code' }).click();
    await page.getByRole('link', { name: /Branches/ }).first().click();
    await page.getByRole('button', { name: 'New branch' }).click();
    await page.getByRole('textbox', { name: 'New branch name' }).fill('e2e-branch');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('button', { name: 'Actions for e2e-branch' }).click();
    await page.getByRole('menuitem', { name: 'Delete branch' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Actions for e2e-branch' })).toHaveCount(0);
  });

  test('star, watch, fork, repository picker across permission levels', async ({ page }) => {
    await open(page, 'light');
    const star = page.getByRole('button', { name: /^Star\b/ }).first();
    await expect(star).toContainText('12.4k');
    await star.click();
    await expect(page.getByRole('button', { name: /^Starred/ })).toBeVisible();
    await page.getByRole('button', { name: /Notifications for acme\/orbit/ }).click();
    await page.getByRole('menuitem', { name: /All Activity/ }).click();
    await expect(page.getByRole('button', { name: /Notifications for acme\/orbit: All Activity/ })).toBeVisible();
    await page.getByRole('button', { name: /Repository acme\/orbit/ }).click();
    await page.getByRole('textbox', { name: /Search repositories/ }).fill('hello');
    await page.getByRole('button', { name: /octo\/hello-world/ }).click();
    await expect(page.getByRole('button', { name: /Repository octo\/hello-world/ })).toBeVisible();
    // Read-only here: no Settings; forking is how you change it.
    await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Fork/ }).first().click();
    await page.getByRole('button', { name: 'Create fork' }).click();
    await expect(page.getByRole('button', { name: /Repository you\/hello-world/ })).toBeVisible();
    await expect(page.getByText(/forked from/)).toBeVisible();
  });

  test('read-only: the UI offers only what the role allows, on code, issues and pull requests', async ({ page }) => {
    await open(page, 'read-only');
    await expect(page.getByRole('button', { name: 'Merge pull request' })).toBeDisabled({ timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Merge status' }).getByText(/Only people with write access/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit labels' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit reviewers' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Code' }).click();
    await expect(page.getByRole('button', { name: 'Add file' })).toHaveCount(0);
    // Commenting is open to anyone signed in.
    await page.getByRole('tab', { name: /^Issues/ }).click();
    await page.getByRole('link', { name: /rolled-back/ }).click();
    await page.getByRole('textbox', { name: 'Add a comment' }).fill('As a reader');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByText('As a reader')).toBeVisible();
    await expect(page.getByRole('button', { name: /Close/ })).toHaveCount(0);
  });

  test('archived, empty, signed out, not found, rate limited, refused', async ({ page }) => {
    await open(page, 'archived');
    await expect(page.getByText('This repository has been archived', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('textbox', { name: 'Add a comment' })).toHaveCount(0);

    await open(page, 'empty-repository');
    await expect(page.getByRole('heading', { name: 'This repository is empty' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Create a README' }).click();
    await page.getByRole('button', { name: 'Commit new file' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'README.md' })).toBeVisible();

    await open(page, 'signed-out');
    await expect(page.getByRole('heading', { level: 1, name: /Greeting is not localized/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('textbox', { name: 'Add a comment' })).toHaveCount(0);
    await expect(page.getByText('to join this conversation')).toBeVisible();

    await open(page, 'not-found');
    await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Choose a repository' })).toBeVisible();

    await open(page, 'rate-limited');
    await expect(page.getByRole('heading', { name: 'Rate limited' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('tab', { name: 'Code' })).toBeVisible();

    await open(page, 'writes-refused');
    const box = page.getByRole('textbox', { name: 'Add a comment' });
    await box.fill('Keep me');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Resource not accessible' })).toBeVisible();
    await expect(box).toHaveValue('Keep me');
  });

  test('actions: filters, a run, re-run failed jobs, cancel, dispatch with inputs, disable', async ({ page }) => {
    await open(page, 'actions');
    await page.getByRole('button', { name: /^Status/ }).click();
    await page.getByRole('option', { name: 'failure' }).click();
    await page.getByRole('link', { name: /Dashboard: show attempt history/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard: show attempt/ })).toBeVisible();
    await expect(page.getByText('Failure').first()).toBeVisible();
    await page.getByRole('button', { name: 'Re-run jobs' }).click();
    await page.getByRole('menuitem', { name: 'Re-run failed jobs' }).click();
    await expect(page.getByText('attempt 2')).toBeVisible();
    await expect(page.getByText('Success').first()).toBeVisible();
    // The failed job started open; it stays open after the re-run.
    const log = page.getByRole('button', { name: 'View log' }).first();
    if (!(await log.isVisible())) await page.getByRole('button', { name: /test/ }).first().click();
    await log.click();
    await expect(page.getByText(/Run test/).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Actions' }).click();
    await page.getByRole('complementary', { name: 'Workflows' }).getByRole('link', { name: 'Release' }).click();
    await page.getByRole('button', { name: 'Run workflow' }).click();
    await expect(page.getByLabel('Version to publish')).toHaveValue('patch');
    await page.getByLabel('Version to publish').selectOption('minor');
    await page.getByRole('button', { name: 'Run workflow' }).last().click();
    await expect(page.getByRole('status').filter({ hasText: '2 workflow runs' })).toBeVisible();
    await page.getByRole('button', { name: 'More about Release' }).click();
    await page.getByRole('menuitem', { name: 'Disable workflow' }).click();
    await expect(page.getByRole('button', { name: 'Run workflow' })).toHaveCount(0);
  });

  test('labels and milestones: create, edit, delete; releases: generate notes, publish', async ({ page }) => {
    await open(page, 'issues-list');
    await page.getByRole('button', { name: /^Labels/ }).first().click();
    await page.getByRole('button', { name: 'New label' }).click();
    await page.getByRole('textbox', { name: 'Label name' }).fill('e2e-label');
    await page.getByRole('button', { name: 'Create label' }).click();
    await expect(page.getByRole('button', { name: 'Edit label e2e-label' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete label e2e-label' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit label e2e-label' })).toHaveCount(0);
    await page.getByRole('link', { name: /Milestones/ }).click();
    await page.getByRole('button', { name: 'New milestone' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill('e2e-milestone');
    await page.getByRole('button', { name: 'Create milestone' }).click();
    await page.getByRole('button', { name: 'Close e2e-milestone' }).click();
    await expect(page.getByRole('button', { name: 'Close e2e-milestone' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Code' }).click();
    await page.getByRole('link', { name: 'Releases' }).click();
    await page.getByRole('button', { name: 'Draft a new release' }).click();
    await page.getByRole('textbox', { name: /Tag/ }).fill('v9.9.9');
    await page.getByRole('button', { name: 'Generate release notes' }).click();
    await expect(page.getByRole('textbox', { name: 'Release notes' })).toHaveValue(/What's Changed/);
    await page.getByRole('button', { name: 'Publish release' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'v9.9.9' })).toBeVisible();
    await expect(page.getByText('Latest')).toBeVisible();
  });

  test('settings change what the rest of the app does; insights draw from real history', async ({ page }) => {
    await open(page, 'settings');
    await page.getByRole('textbox', { name: 'Description' }).fill('A new description');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Pull requests' }).click();
    await tick(page, 'Allow merge commits');
    await page.goto(page.url().replace(/#.*/, '#/acme/orbit'));
    await page.getByRole('tab', { name: 'Insights' }).click();
    await expect(page.getByRole('heading', { name: 'Pulse' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Insights' }).getByRole('link', { name: 'Contributors' }).click();
    await expect(page.getByText(/maya-chen/).first()).toBeVisible();
    await page.getByRole('navigation', { name: 'Insights' }).getByRole('link', { name: 'Traffic' }).click();
    await expect(page.getByText(/unique visitors/)).toBeVisible();
  });

  test('deep links and the browser back button', async ({ page }) => {
    await page.goto(story('light', 'issues/489'));
    await expect(page.getByRole('heading', { level: 1, name: /rolled-back/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: '#483' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /lockstep/ })).toBeVisible();
    expect(page.url()).toContain('#/acme/orbit/issues/483');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: /rolled-back/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /rolled-back/ })).toBeVisible({ timeout: 30_000 });
    // A number that's a pull request moves to its page.
    await page.goto(story('light', 'issues/488'));
    await expect(page.getByRole('tab', { name: /^Files changed/ })).toBeVisible({ timeout: 30_000 });
  });

  test('your work and notifications', async ({ page }) => {
    await open(page, 'light');
    await page.getByRole('button', { name: /^Notifications: 3 unread/ }).click();
    await page.getByRole('button', { name: /Mark “Add exponential backoff/ }).click();
    await expect(page.getByRole('button', { name: /Mark “Add exponential backoff/ })).toHaveCount(0);
    await page.getByRole('button', { name: /Jobs enqueued inside/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: /rolled-back/ })).toBeVisible();
    await page.getByRole('button', { name: 'Your pull requests' }).click();
    await page.getByText('Assigned', { exact: true }).click();
    await expect(page.getByText(/Nothing here/)).toBeVisible();
  });
});

test.describe('phone', () => {
  test.use({ viewport: phone });

  test('the whole issue flow, with details reachable and back', async ({ page }) => {
    await open(page, 'phone');
    await page.getByRole('tab', { name: /^Issues/ }).click();
    await page.getByRole('link', { name: /rolled-back/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /rolled-back/ })).toBeVisible();
    await page.getByRole('button', { name: /^Details/ }).click();
    await page.getByRole('button', { name: 'Edit labels' }).click();
    await page.getByRole('option', { name: /^performance/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('performance').first()).toBeVisible();
    await page.getByRole('textbox', { name: 'Add a comment' }).fill('From a phone');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByText('From a phone')).toBeVisible();
    await page.getByRole('button', { name: /^Close issue/ }).click();
    await expect(page.getByRole('button', { name: /^Reopen issue/ })).toBeVisible();
    await page.getByRole('button', { name: /^(Back|orbit)$/ }).last().click();
    await expect(page.getByRole('link', { name: 'Support per-key rate limits' }).first()).toBeVisible();
  });

  test('a pull request: metadata, a line comment by touch target, review, merge', async ({ page }) => {
    await open(page, 'pull-on-phone');
    await page.getByRole('button', { name: /^Details/ }).click({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Edit reviewers' })).toBeVisible();
    await page.getByRole('tab', { name: /^Files changed/ }).click();
    const plus = page.getByRole('button', { name: /Comment on line/ }).first();
    await plus.click();
    await page.getByRole('textbox', { name: /Comment on line/ }).fill('Nit');
    await page.getByRole('button', { name: 'Add single comment' }).click();
    await expect(page.getByText('Nit', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /^Conversation/ }).click();
    await page.getByRole('button', { name: 'Merge pull request' }).click();
    await page.getByRole('button', { name: 'Confirm merge' }).click();
    await expect(page.getByText('Pull request successfully merged and closed')).toBeVisible();
  });

  test('code, filters and actions are all reachable; targets are finger-sized', async ({ page }) => {
    await open(page, 'phone');
    const row = page.getByRole('link', { name: 'Folder src' });
    expect((await row.evaluate((el) => el.parentElement.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    await row.click();
    await page.getByRole('link', { name: 'File retry.ts' }).click();
    await expect(page.getByRole('button', { name: 'Blame' })).toBeVisible();
    await page.getByRole('button', { name: /^(Back|src)$/ }).last().click();
    await page.getByRole('button', { name: /^(Back|orbit)$/ }).last().click();
    await page.getByRole('tab', { name: /^Issues/ }).click();
    await page.getByRole('button', { name: /^Author/ }).click();
    await page.getByRole('option', { name: /avakim/ }).click();
    await expect(page.getByRole('textbox', { name: 'Search all issues' })).toHaveValue(/author:avakim/);
    await page.getByRole('tab', { name: 'Actions' }).click();
    await page.getByRole('button', { name: /All workflows/ }).click();
    await page.getByRole('option', { name: /^Release/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Release' })).toBeVisible();
    const size = await page.getByRole('button', { name: 'Run workflow' }).boundingBox();
    expect(size.height).toBeGreaterThanOrEqual(44);
  });
});

/* The PM's findings: each one failed before, and stays fixed. */
test.describe('regressions', () => {
  const shared = (page, route) => page.goto(`${SB}/iframe.html?id=blocks-github-clone--shared-repository&viewMode=story#/acme/orbit/${route}`);

  test('an edit never overwrites a commit that landed meanwhile', async ({ page }) => {
    await shared(page, 'edit/main/README.md');
    const editor = page.getByRole('textbox', { name: 'Contents of README.md' });
    await expect(editor).toHaveValue(/Orbit/, { timeout: 30_000 });
    await editor.fill('# Mine\n');
    // Someone else commits, and the page revalidates.
    await page.evaluate(async () => {
      const s = globalThis.__githubSharedServer;
      const url = 'https://api.github.com/repos/acme/orbit/contents/README.md';
      const { sha } = await (await s.fetch(url + '?ref=main')).json();
      await s.fetch(url, { method: 'PUT', body: JSON.stringify({ message: 'theirs', content: btoa('# Theirs\n'), branch: 'main', sha }) });
    });
    await page.getByRole('button', { name: 'Reload from GitHub' }).click();
    await page.getByRole('button', { name: 'Commit changes' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'changed on GitHub while you were editing' })).toBeVisible();
    await expect(editor).toHaveValue('# Mine\n');
    const text = await page.evaluate(async () => (await globalThis.__githubSharedServer.fetch('https://api.github.com/repos/acme/orbit/readme', { headers: { accept: 'application/vnd.github.raw+json' } })).text());
    expect(text).toBe('# Theirs\n');
  });

  test('drafts survive leaving; Cancel asks; no-change commits are off', async ({ page }) => {
    await page.goto(story('light', 'issues/489'));
    const box = page.getByRole('textbox', { name: 'Add a comment' });
    await box.fill('half a thought', { timeout: 30_000 });
    await page.getByRole('tab', { name: /^Pull requests/ }).click();
    await page.goBack();
    await expect(box).toHaveValue('half a thought');
    await expect(page.getByText('Your unsent comment is still here.')).toBeVisible();

    await page.goto(story('light', 'edit/main/README.md'));
    await page.reload();
    const editor = page.getByRole('textbox', { name: 'Contents of README.md' });
    await expect(editor).toHaveValue(/Orbit/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Commit changes' })).toBeDisabled();
    await editor.fill('# Changed\n');
    await page.getByRole('tab', { name: /^Issues/ }).click();
    await page.goBack();
    await expect(editor).toHaveValue('# Changed\n');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(editor).toHaveValue('# Changed\n');
  });

  test('a failed refresh keeps the screen and what you typed', async ({ page }) => {
    await shared(page, 'issues/489');
    const box = page.getByRole('textbox', { name: 'Add a comment' });
    await box.fill('still here', { timeout: 30_000 });
    await page.evaluate(() => { for (let i = 0; i < 4; i++) globalThis.__githubSharedServer.fail(/GET \/repos\/acme\/orbit\/issues\/489/, 500, 'Server Error'); });
    await page.getByRole('button', { name: 'Reload from GitHub' }).click();
    await expect(page.getByText(/Couldn’t refresh this/).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /rolled-back/ })).toBeVisible();
    await expect(box).toHaveValue('still here');
  });

  test('back crosses a repository switch; picks honor their route', async ({ page }) => {
    await page.goto(story('light', 'issues'));
    await expect(page.getByRole('heading', { name: 'Issues' })).toBeAttached({ timeout: 30_000 });
    const pick = async (text) => {
      await page.getByRole('button', { name: /^Repository / }).click();
      await page.getByRole('textbox', { name: /Search repositories/ }).fill(text);
      await page.getByRole('button', { name: 'Open', exact: true }).click();
    };
    await pick('octo/hello-world');
    await expect(page.getByRole('button', { name: /Repository octo\/hello-world/ })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('button', { name: /Repository acme\/orbit/ })).toBeVisible();
    await expect(page).toHaveURL(/#\/acme\/orbit\/issues/);
    await pick('octo/hello-world');
    await expect(page.getByRole('button', { name: /Repository octo\/hello-world/ })).toBeVisible();
    await pick('https://github.com/acme/orbit/pull/488');
    await expect(page.getByRole('heading', { level: 1, name: /jitter/ })).toBeVisible();
    await pick('octo/hello-world');
    await expect(page.getByRole('button', { name: /Repository octo\/hello-world/ })).toBeVisible();
    await pick('acme/orbit');
    await expect(page.getByRole('link', { name: 'Folder src' })).toBeVisible();
  });

  test('tags and shas take no commits; a missing file says so', async ({ page }) => {
    await page.goto(story('light', 'blob/v3.2.0/README.md'));
    await page.getByRole('button', { name: 'More file actions' }).click({ timeout: 30_000 });
    await expect(page.getByRole('menuitem', { name: /Edit file/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto(story('light', 'edit/v3.2.0/README.md'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'You can’t commit here' })).toBeVisible({ timeout: 30_000 });
    await page.goto(story('light', 'delete/main/nope.txt'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Nothing to delete' })).toBeVisible({ timeout: 30_000 });
  });

  test('settings: rename with topics, archive and unarchive, owner row', async ({ page }) => {
    await open(page, 'settings');
    await page.getByRole('textbox', { name: 'Repository name' }).fill('orbit2');
    await page.getByRole('textbox', { name: 'Topics' }).fill('queues, postgres');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: /Repository acme\/orbit2/ })).toBeVisible();
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByRole('textbox', { name: /to confirm/ }).fill('acme/orbit2');
    await page.getByRole('button', { name: 'I understand' }).click();
    await expect(page.getByRole('button', { name: 'Unarchive', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Unarchive', exact: true }).click();
    await page.getByRole('textbox', { name: /to confirm/ }).fill('acme/orbit2');
    await page.getByRole('button', { name: 'I understand' }).click();
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Collaborators' }).click();
    await expect(page.getByRole('button', { name: 'Remove acme' })).toHaveCount(0);
    await page.getByLabel('Role for jonasw').selectOption('triage');
    await expect(page.getByLabel('Role for jonasw')).toHaveValue('triage');
  });

  test('refused writes: REST and GraphQL, naming the action, once', async ({ page }) => {
    await open(page, 'writes-refused');
    await page.getByRole('button', { name: 'Unpin' }).click({ timeout: 30_000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Resource not accessible' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unpin' })).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss this error' }).first().click();
    await page.getByRole('textbox', { name: 'Add a comment' }).fill('Keep me');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t post your comment' })).toHaveCount(1);
  });

  test('task lists write back; readers can’t tick them', async ({ page }) => {
    await page.goto(story('light', 'issues/480'));
    const boxes = page.locator('[id^="composer"]').locator('xpath=preceding::input[@type="checkbox"]');
    await expect(boxes).toHaveCount(3, { timeout: 30_000 });
    await boxes.nth(1).click();
    await expect(boxes.nth(1)).toBeChecked();
  });

  test('navigation moves focus and announces', async ({ page }) => {
    await page.goto(story('light', 'issues/489'));
    await page.getByRole('link', { name: '#483' }).first().click({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: /lockstep/ })).toBeFocused();
    await expect(page.locator('[role="status"][aria-live="polite"]').first()).toHaveText('#483');
  });

  test('without write access: fork, edit there, open the pull request back', async ({ page }) => {
    await open(page, 'read-only');
    await page.getByRole('tab', { name: 'Code' }).click({ timeout: 30_000 });
    await page.getByRole('link', { name: 'File README.md' }).click();
    await page.getByRole('button', { name: 'More file actions' }).click();
    await page.getByRole('menuitem', { name: 'Fork and edit file' }).click();
    await page.getByRole('button', { name: 'Fork this repository' }).click();
    await expect(page.getByRole('button', { name: /Repository you\/orbit/ })).toBeVisible();
    await page.getByRole('textbox', { name: 'Contents of README.md' }).fill('# Better\n');
    await page.getByRole('button', { name: 'Commit changes' }).click();
    await expect(page.getByRole('button', { name: /Repository acme\/orbit/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Open a pull request' })).toBeVisible();
    await page.getByRole('button', { name: 'Create pull request' }).click();
    await expect(page.getByRole('tab', { name: /^Files changed/ })).toBeVisible();
    await expect(page.getByText('you:main').first()).toBeVisible();
  });

  test('revert, re-request, commit a suggestion, expand, bulk, autocomplete', async ({ page }) => {
    await page.goto(story('light', 'pull/473'));
    await page.getByRole('button', { name: 'Revert' }).click({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: /Revert/ })).toBeVisible();

    await page.goto(story('light', 'pull/484/files'));
    await page.reload();
    await page.getByRole('button', { name: 'Commit suggestion' }).click({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Unresolve conversation' })).toBeVisible();
    await page.getByRole('tab', { name: /^Conversation/ }).click();
    await page.getByRole('button', { name: 'Re-request review from maya-chen' }).click();
    await expect(page.getByText('Changes requested', { exact: true })).toHaveCount(0);

    await page.goto(story('light', 'pull/488/files'));
    await page.reload();
    const diff = page.locator('[id="diff-docs/retries.md"]');
    await diff.getByRole('button', { name: 'Expand all' }).click({ timeout: 30_000 });
    await expect(diff.getByRole('button', { name: 'Expand all' })).toHaveCount(0);

    await page.goto(story('light', 'issues'));
    await page.reload();
    await page.getByRole('checkbox', { name: /Select “Drop Node 18/ }).click({ timeout: 30_000 });
    await page.getByRole('checkbox', { name: /Select “Add an OpenTelemetry/ }).click().catch(() => undefined);
    await page.getByRole('button', { name: 'Mark selected issues as' }).click();
    await page.getByRole('menuitem', { name: 'Closed as not planned' }).click();
    await expect(page.getByRole('link', { name: 'Drop Node 18 support in v4' })).toHaveCount(0);

    await page.getByRole('link', { name: /rolled-back/ }).click();
    const box = page.getByRole('textbox', { name: 'Add a comment' });
    await box.click();
    await box.pressSequentially('thanks @may');
    await page.getByRole('listbox', { name: 'People to mention' }).getByRole('option', { name: /maya-chen/ }).click();
    await expect(box).toHaveValue('thanks @maya-chen ');
    await box.pressSequentially('see #48');
    await expect(page.getByRole('listbox', { name: /to reference/ })).toBeVisible();
  });

  test('phone: long titles wrap, wide tables scroll, the main targets are 44px', async ({ page }) => {
    await page.setViewportSize(phone);
    await open(page, 'issue-on-phone');
    await expect(page.getByRole('heading', { level: 1, name: /rolled-back/ })).toBeVisible({ timeout: 30_000 });
    for (const name of ['Bold', 'Add reaction']) {
      const box = await page.getByRole('button', { name }).first().boundingBox();
      expect(box.height, name).toBeGreaterThan(43.9);
      expect(box.width, name).toBeGreaterThan(43.9);
    }
    const kebab = await page.getByRole('button', { name: /Comment actions/ }).first().boundingBox();
    expect(kebab.height).toBeGreaterThan(43.9);
  });
});

/* Round 3: what the last review found. These read the server back: that a control appeared proves nothing about what it wrote. */
test.describe('writes land where they should', () => {
  const shared = async (page, route) => {
    await page.goto(`${SB}/iframe.html?id=blocks-github-clone--shared-repository&viewMode=story#/acme/orbit/${route}`);
    await page.locator('#storybook-root > *').first().waitFor({ timeout: 30_000 });
  };
  const API = 'https://api.github.com/repos/acme/orbit';
  /** Asks the server directly. */
  const server = (page, path, init) => page.evaluate(async ({ url, init }) => {
    const res = await globalThis.__githubSharedServer.fetch(url, init);
    return res.status === 204 ? null : res.json();
  }, { url: API + path, init });
  const fileOn = (page, path, ref = 'main') => page.evaluate(async ({ url }) => (await (await globalThis.__githubSharedServer.fetch(url, { headers: { accept: 'application/vnd.github.raw+json' } })).text()), { url: `${API}/contents/${path}?ref=${encodeURIComponent(ref)}` });
  /** Someone else commits. */
  const push = (page, path, ref, edit) => page.evaluate(async ({ url, ref, edit }) => {
    const s = globalThis.__githubSharedServer;
    const raw = await (await s.fetch(`${url}?ref=${encodeURIComponent(ref)}`, { headers: { accept: 'application/vnd.github.raw+json' } })).text();
    const { sha } = await (await s.fetch(`${url}?ref=${encodeURIComponent(ref)}`)).json();
    await s.fetch(url, { method: 'PUT', body: JSON.stringify({ message: 'theirs', content: btoa(unescape(encodeURIComponent(edit.prepend ? edit.prepend + raw : raw.split(edit.from).join(edit.to)))), branch: ref, sha }) });
  }, { url: `${API}/contents/${path}`, ref, edit });

  test('a comment goes on the issue it was typed on', async ({ page }) => {
    await shared(page, 'issues/489');
    const box = page.getByRole('textbox', { name: 'Add a comment' });
    await box.fill('AAA for 489', { timeout: 30_000 });
    await page.getByRole('link', { name: '#483' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: /lockstep/ })).toBeVisible();
    await expect(box).toHaveValue('');
    await box.fill('BBB for 483');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: /rolled-back/ })).toBeVisible();
    await expect(box).toHaveValue('AAA for 489');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(box).toHaveValue('');
    const on489 = await server(page, '/issues/489/comments?per_page=100');
    expect(on489.at(-1).body).toBe('AAA for 489');
    const on483 = await server(page, '/issues/483/comments?per_page=100');
    expect(on483.some((c) => /BBB|AAA/.test(c.body))).toBe(false);
    await page.goForward();
    await expect(box).toHaveValue('BBB for 483');
  });

  test('an open title editor doesn’t follow you to another issue or pull request', async ({ page }) => {
    await shared(page, 'issues/489');
    await page.getByRole('button', { name: 'Edit', exact: true }).click({ timeout: 30_000 });
    await page.getByRole('textbox', { name: 'Issue title' }).fill('RENAMED');
    await page.getByRole('link', { name: '#483' }).first().click();
    await expect(page.getByRole('textbox', { name: 'Issue title' })).toHaveCount(0);
    expect((await server(page, '/issues/483')).title).toMatch(/lockstep/);
    await page.evaluate(() => { location.hash = '#/acme/orbit/pull/488'; });
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('textbox', { name: 'Pull request title' }).fill('RENAMED PR');
    await page.evaluate(() => { location.hash = '#/acme/orbit/pull/481'; });
    await expect(page.getByRole('heading', { level: 1, name: /Prisma/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Pull request title' })).toHaveCount(0);
  });

  test('an edit goes to the file it was typed on', async ({ page }) => {
    await shared(page, 'edit/main/src/queue.ts');
    const queue = page.getByRole('textbox', { name: 'Contents of queue.ts' });
    await expect(queue).toHaveValue(/class Queue/, { timeout: 30_000 });
    await page.evaluate(() => { location.hash = '#/acme/orbit/edit/main/src/retry.ts'; });
    const retry = page.getByRole('textbox', { name: 'Contents of retry.ts' });
    await expect(retry).toHaveValue(/RetryPolicy/);
    await retry.fill('RRR\n');
    await page.evaluate(() => { location.hash = '#/acme/orbit/edit/main/src/queue.ts'; });
    await expect(queue).toHaveValue(/class Queue/);
    await page.evaluate(() => { location.hash = '#/acme/orbit/edit/main/src/retry.ts'; });
    await expect(retry).toHaveValue('RRR\n');
    await page.getByRole('button', { name: 'Commit changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'retry.ts' })).toBeVisible();
    expect(await fileOn(page, 'src/retry.ts')).toBe('RRR\n');
    expect(await fileOn(page, 'src/queue.ts')).toMatch(/class Queue/);
  });

  test('a suggestion refuses when its line moved; applies when it hasn’t', async ({ page }) => {
    await shared(page, 'pull/484/files');
    const commit = page.getByRole('button', { name: 'Commit suggestion' });
    await expect(commit).toBeVisible({ timeout: 30_000 });
    // Someone pushes above it; the page hasn't refreshed, so the button is still there.
    await push(page, 'src/dashboard/timeline.tsx', 'dash/attempts', { prepend: '// inserted\n' });
    const before = await fileOn(page, 'src/dashboard/timeline.tsx', 'dash/attempts');
    await commit.click();
    await expect(page.getByRole('alert').filter({ hasText: 'has changed since this was suggested' })).toBeVisible();
    expect(await fileOn(page, 'src/dashboard/timeline.tsx', 'dash/attempts')).toBe(before);
    // With fresh data it says it's outdated and stops offering.
    await page.getByRole('button', { name: 'Reload from GitHub' }).click();
    await expect(page.getByText('Outdated').first()).toBeVisible();
    await expect(commit).toHaveCount(0);
  });

  test('a suggestion on the line it was made for lands exactly there', async ({ page }) => {
    await shared(page, 'pull/484/files');
    await page.getByRole('button', { name: 'Commit suggestion' }).click({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Unresolve conversation' })).toBeVisible();
    const after = await fileOn(page, 'src/dashboard/timeline.tsx', 'dash/attempts');
    expect(after.split('\n')[2]).toBe('export function Timeline({ job }: { job: JobRecord }) {');
    expect(after.split('\n')[3]).toContain('attemptsOf(job)');
  });

  test('a committed draft is gone, on a new branch too', async ({ page }) => {
    await shared(page, 'edit/main/src/retry.ts');
    const editor = page.getByRole('textbox', { name: 'Contents of retry.ts' });
    await expect(editor).toHaveValue(/RetryPolicy/, { timeout: 30_000 });
    await editor.fill('Changed on a branch\n');
    await page.getByText(/new branch/).first().click();
    await page.getByRole('textbox', { name: 'New branch name' }).fill('from-edit');
    await page.getByRole('button', { name: 'Commit changes' }).click();
    await expect(page.getByRole('heading', { name: 'Open a pull request' })).toBeVisible();
    expect(await fileOn(page, 'src/retry.ts', 'from-edit')).toBe('Changed on a branch\n');
    await page.evaluate(() => { location.hash = '#/acme/orbit/edit/main/src/retry.ts'; });
    await expect(editor).toHaveValue(/RetryPolicy/);
    await expect(page.getByText('your unsaved edits')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Commit changes' })).toBeDisabled();
    expect(await fileOn(page, 'src/retry.ts')).toMatch(/RetryPolicy/);
  });

  test('delete won’t remove a version you never saw', async ({ page }) => {
    await shared(page, 'delete/main/src/retry.ts');
    await expect(page.getByRole('button', { name: 'Delete file' })).toBeEnabled({ timeout: 30_000 });
    await push(page, 'src/retry.ts', 'main', { prepend: '// theirs\n' });
    await page.getByRole('button', { name: 'Reload from GitHub' }).click();
    await page.getByRole('button', { name: 'Delete file' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'changed on GitHub' })).toBeVisible();
    expect(await fileOn(page, 'src/retry.ts')).toMatch(/theirs/);
  });

  test('rename, and upload', async ({ page }) => {
    await shared(page, 'edit/main/docs/adapters.md');
    const path = page.getByRole('textbox', { name: /Path/ });
    await expect(path).toHaveValue('docs/adapters.md', { timeout: 30_000 });
    await path.fill('docs/backends.md');
    await page.getByRole('button', { name: 'Commit changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'backends.md' })).toBeVisible();
    expect(await fileOn(page, 'docs/backends.md')).toMatch(/Adapters/);
    expect((await server(page, '/contents/docs?ref=main')).map((f) => f.name)).not.toContain('adapters.md');

    await page.evaluate(() => { location.hash = '#/acme/orbit/upload/main/docs'; });
    await page.locator('input[type="file"]').setInputFiles([{ name: 'one.txt', mimeType: 'text/plain', buffer: Buffer.from('uploaded one\n') }, { name: 'two.txt', mimeType: 'text/plain', buffer: Buffer.from('uploaded two\n') }]);
    await expect(page.getByRole('list', { name: 'Files to upload' })).toContainText('docs/two.txt');
    await page.getByRole('button', { name: 'Commit changes' }).click();
    await expect(page.getByRole('link', { name: 'File one.txt' })).toBeVisible();
    expect(await fileOn(page, 'docs/two.txt')).toBe('uploaded two\n');
    const log = await server(page, '/commits?sha=main&per_page=1');
    expect(log[0].commit.message).toBe('Add 2 files');
  });

  test('Cancel stays in the block on a deep link', async ({ page }) => {
    for (const route of ['edit/main/README.md', 'issues/new', 'releases/new']) {
      await shared(page, route);
      await page.reload();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click({ timeout: 30_000 });
      expect(page.url()).toContain('blocks-github-clone');
      await expect(page.getByRole('button', { name: /Repository acme\/orbit/ })).toBeVisible();
    }
  });

  test('arrows along the tabs stay on the tabs', async ({ page }) => {
    await shared(page, '');
    const code = page.getByRole('tab', { name: 'Code' });
    await code.focus({ timeout: 30_000 });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    await expect(page.getByRole('tab', { name: /^Issues/ })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    await expect(page.getByRole('tab', { name: /^Pull requests/ })).toBeFocused();
  });

  test('drafts on the rest of the forms; Cancel asks; a range keeps its text', async ({ page }) => {
    await shared(page, 'issues/489');
    await page.getByRole('button', { name: /Comment actions for maya-chen/ }).first().click({ timeout: 30_000 });
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const edit = page.getByRole('textbox', { name: 'Edit comment' });
    await edit.fill('half an edit');
    await page.getByRole('tab', { name: /^Pull requests/ }).click();
    await page.goBack();
    await expect(edit).toHaveValue('half an edit');
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await expect(page.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeVisible();

    await page.evaluate(() => { location.hash = '#/acme/orbit/pull/488/files'; });
    const diff = page.locator('[id="diff-src/retry.ts"]');
    await diff.locator('tr', { hasText: 'export type Jitter' }).hover();
    await diff.getByRole('button', { name: /Comment on line 7$/ }).click();
    await page.getByRole('textbox', { name: /Comment on line 7/ }).fill('keep me');
    await diff.locator('tr', { hasText: 'export interface BackoffOptions' }).hover();
    await diff.getByRole('button', { name: /Comment on line 9$/ }).click({ modifiers: ['Shift'] });
    await expect(page.getByRole('textbox', { name: /Comment on line 9/ })).toHaveValue('keep me');
    await expect(page.getByText('Comment on lines 7 to 9')).toBeVisible();
  });

  test('autocomplete: Enter is a new line until you choose; none in code; ⌘↵ posts', async ({ page }) => {
    await shared(page, 'issues/485');
    const box = page.getByRole('textbox', { name: 'Add a comment' });
    await box.click({ timeout: 30_000 });
    await box.pressSequentially('see @');
    await expect(page.getByRole('listbox', { name: 'People to mention' })).toBeVisible();
    await box.press('Enter');
    await expect(box).toHaveValue('see @\n');
    await box.fill('');
    await box.pressSequentially('```\nconst a = @');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await box.fill('');
    await box.pressSequentially('hi @may');
    await box.press('ArrowDown');
    await expect(box).toHaveAttribute('aria-activedescendant', /.+/);
    await box.press('Enter');
    await expect(box).toHaveValue('hi @maya-chen ');
    await box.pressSequentially('@');
    await box.press('ControlOrMeta+Enter');
    await expect(box).toHaveValue('');
    expect((await server(page, '/issues/485/comments?per_page=100')).at(-1).body).toMatch(/^hi @maya-chen @/);
  });

  test('tasks flip the one you clicked, on the server', async ({ page }) => {
    await shared(page, 'issues/480');
    const body = page.locator('input[type="checkbox"]');
    await expect(body).toHaveCount(3, { timeout: 30_000 });
    await body.nth(2).click();
    await expect.poll(async () => (await server(page, '/issues/480')).body).toContain('- [x] Empty state');
    expect((await server(page, '/issues/480')).body).toContain('- [ ] Timeline component');
  });

  test('a refused Viewed rolls back; Reload doesn’t claim success when it failed', async ({ page }) => {
    await page.goto(`${SB}/iframe.html?id=blocks-github-clone--writes-refused&viewMode=story#/acme/orbit/pull/488/files`);
    await expect(page.getByRole('status').filter({ hasText: '1 / 3 viewed' })).toBeVisible({ timeout: 30_000 });
    await tick(page, 'Viewed');
    await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t mark that file' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '1 / 3 viewed' })).toBeVisible();

    await shared(page, 'issues/489');
    await expect(page.getByRole('button', { name: 'Unpin' })).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => { const s = globalThis.__githubSharedServer; for (let i = 0; i < 40; i++) s.fail(/^(GET|POST) /, 500, 'Server Error'); });
    await page.getByRole('button', { name: 'Reload from GitHub' }).click();
    await expect(page.getByText('Couldn’t reach GitHub').first()).toBeVisible();
    await expect(page.getByText('Up to date')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unpin' })).toBeVisible();
  });

  test('metadata on a new pull request; Development on the issue; bulk adds', async ({ page }) => {
    await shared(page, 'compare/main...docs%2Fprisma?expand=1');
    await expect(page.getByText('A pull request already exists')).toBeVisible({ timeout: 30_000 });
    await push(page, 'README.md', 'spike/redis', { prepend: '# x\n' });
    await page.evaluate(() => { location.hash = '#/acme/orbit/compare/main...spike%2Fredis?expand=1'; });
    await page.getByRole('textbox', { name: 'Description' }).fill('Closes #472');
    await page.getByRole('button', { name: /^Labels/ }).click();
    await page.getByRole('option', { name: /^bug/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Reviewers/ }).click();
    await page.getByRole('option', { name: /jonasw/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Create pull request' }).click();
    await expect(page.getByRole('tab', { name: /^Files changed/ })).toBeVisible();
    const n = Number(/pull\/(\d+)/.exec(page.url())[1]);
    const pr = await server(page, `/pulls/${n}`);
    expect(pr.labels.map((l) => l.name)).toEqual(['bug']);
    expect(pr.requested_reviewers.map((u) => u.login)).toEqual(['jonasw']);
    await page.evaluate(() => { location.hash = '#/acme/orbit/issues/472'; });
    await expect(page.getByRole('complementary', { name: 'Details' }).getByRole('link', { name: new RegExp(`#${n}`) })).toBeVisible();

    await page.evaluate(() => { location.hash = '#/acme/orbit/issues?q=is:open%20label:%22help%20wanted%22'; });
    await page.getByRole('checkbox', { name: /Select “Support per-key/ }).click();
    await page.getByRole('button', { name: /^Label$/ }).click();
    await page.getByRole('option', { name: /^performance/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await server(page, '/issues/487')).labels.map((l) => l.name).sort()).toEqual(['enhancement', 'help wanted', 'performance']);
  });

  test('tag, commit comment, job re-run, artifacts, issue forms', async ({ page }) => {
    await shared(page, 'tags');
    await page.getByRole('button', { name: 'New tag' }).click({ timeout: 30_000 });
    await page.getByRole('textbox', { name: 'Tag name' }).fill('v9.9.9');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('link', { name: 'v9.9.9' })).toBeVisible();
    expect((await server(page, '/tags?per_page=100')).map((t) => t.name)).toContain('v9.9.9');

    const [head] = await server(page, '/commits?sha=main&per_page=1');
    await page.evaluate((sha) => { location.hash = `#/acme/orbit/commit/${sha}`; }, head.sha);
    await page.getByRole('textbox', { name: 'Comment on this commit' }).fill('Nice commit');
    await page.getByRole('button', { name: 'Comment on this commit' }).click();
    await expect(page.getByText('Nice commit')).toBeVisible();
    expect((await server(page, `/commits/${head.sha}/comments`)).map((c) => c.body)).toEqual(['Nice commit']);

    await page.evaluate(() => { location.hash = '#/acme/orbit/actions/runs/5001'; });
    await page.getByRole('button', { name: 'Re-run job test' }).click();
    await expect.poll(async () => (await server(page, '/actions/runs/5001')).conclusion).toBe('success');
    await page.evaluate(() => { location.hash = '#/acme/orbit/actions/runs/5003'; });
    await expect(page.getByRole('region', { name: 'Artifacts' })).toContainText('coverage-report');
    await expect(page.getByRole('region', { name: 'Artifacts' })).toContainText('Expired');

    await page.evaluate(() => { location.hash = '#/acme/orbit/issues/new'; });
    await page.getByRole('button', { name: 'Feature request' }).click();
    await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue(/### What problem does this solve/);
    await expect(page.getByRole('textbox', { name: /Title/ })).toHaveValue('Feature: ');
  });
});

test.describe('phone: review fits', () => {
  test.use({ viewport: phone });
  test('threads and the line composer stay on screen, submit included', async ({ page }) => {
    await page.goto(`${SB}/iframe.html?id=blocks-github-clone--pull-on-phone&viewMode=story`);
    await page.getByRole('tab', { name: /^Files changed/ }).click({ timeout: 30_000 });
    const resolve = page.getByRole('button', { name: 'Resolve conversation' }).first();
    await resolve.scrollIntoViewIfNeeded();
    const frame = await page.locator('[id="diff-docs/retries.md"]').boundingBox();
    const box = await resolve.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
    await page.getByRole('button', { name: /Comment on line/ }).first().click();
    const submit = page.getByRole('button', { name: 'Start a review' });
    await submit.scrollIntoViewIfNeeded();
    const s = await submit.boundingBox();
    expect(s.x + s.width).toBeLessThanOrEqual(422);
  });
});
