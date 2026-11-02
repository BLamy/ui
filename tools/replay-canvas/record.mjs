/* Records the Replay Canvas block's sample sessions: Tandem, a small project-tracker SPA (app.html, served as
   https://app.tandem.test), driven through four journeys with real pointer and keyboard input in Chromium and
   recorded by rrweb 2.0.0-alpha.20. The journeys overlap on purpose (two open the row menu on different projects,
   two visit different projects' pages), which is what the canvas merges. Timestamps are rebased so the output is
   stable. Run: node tools/replay-canvas/record.mjs → registry/blocks/replay-canvas/recordings.ts */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
// The UI package's rrweb (the version docstream plays), as a page script.
const rrweb = readFileSync(join(here, '../../packages/ui/node_modules/rrweb/dist/rrweb.umd.cjs'), 'utf8');
const app = readFileSync(join(here, 'app.html'), 'utf8');
const out = join(here, '../../registry/blocks/replay-canvas/recordings.ts');
const ORIGIN = 'https://app.tandem.test';
/** 2026-10-30 16:00 UTC, plus an hour per journey. */
const BASE = Date.UTC(2026, 9, 30, 16);

const JOURNEYS = [
  {
    id: 'browse-and-add-task',
    name: 'Open Atlas from the row menu, add a task',
    path: '/projects',
    async run(u) {
      await u.rightClick('.row[data-id="1"]');
      await u.click('.menu [data-a=open]');
      await u.click('#add-task');
      await u.type('#task-title', 'Record onboarding demo');
      await u.click('#sheet-save');
      await u.click('#crumb');
    },
  },
  {
    id: 'create-project',
    name: 'Create a project (empty name first)',
    path: '/projects',
    async run(u) {
      await u.click('#new-project');
      await u.click('#np-create');
      await u.type('#np-name', 'Orbit');
      await u.click('#np-create');
      await u.wait(1800);
      await u.click('#add-task');
      await u.click('#sheet-cancel');
    },
  },
  {
    id: 'settings-delete-workspace',
    name: 'Account menu → Settings, back out of deleting',
    path: '/projects',
    async run(u) {
      await u.click('#avatar');
      await u.click('.menu [data-a=settings]');
      await u.click('#digest');
      await u.click('#delete-ws');
      await u.click('#cd-cancel');
      await u.click('#nav-projects');
    },
  },
  {
    id: 'delete-and-share',
    name: 'Delete Beacon, share Compass',
    path: '/projects',
    async run(u) {
      await u.rightClick('.row[data-id="2"]');
      await u.click('.menu [data-a=delete]');
      await u.click('#cd-ok');
      await u.wait(1800);
      await u.click('.row[data-id="3"] a');
      await u.click('#share');
      await u.type('#share-email', 'jun@studio.test');
      await u.click('#share-invite');
      await u.click('#share-link');
    },
  },
];

const browser = await chromium.launch();
const recordings = [];
for (const [i, journey] of JOURNEYS.entries()) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: 'text/html', body: app }));
  // Started once the page has loaded: rrweb's recorder overflows the stack when it starts at DOMContentLoaded here.
  await page.addInitScript({ content: `${rrweb};\nwindow.__events = [];` });
  await page.goto(ORIGIN + journey.path);
  await page.evaluate(() => rrweb.record({ emit: (e) => window.__events.push(e), sampling: { mousemove: 60, input: 'last' } }));
  await page.mouse.move(640, 420);
  await page.waitForTimeout(900);
  const u = {
    wait: (ms) => page.waitForTimeout(ms),
    async point(selector) {
      const box = await page.locator(selector).first().boundingBox();
      if (!box) throw new Error(`${journey.id}: nothing at ${selector}`);
      const x = box.x + Math.min(box.width / 2, 40), y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps: 14 });
      await page.waitForTimeout(160);
      return { x, y };
    },
    async click(selector) {
      await u.point(selector);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(900);
    },
    async rightClick(selector) {
      await u.point(selector);
      await page.mouse.down({ button: 'right' });
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(900);
    },
    async type(selector, text) {
      await u.click(selector);
      await page.keyboard.type(text, { delay: 45 });
      await page.waitForTimeout(500);
    },
  };
  await journey.run(u);
  await page.waitForTimeout(700);
  const events = await page.evaluate(() => window.__events);
  const shift = BASE + i * 3_600_000 - events[0].timestamp;
  recordings.push({ id: journey.id, name: journey.name, events: events.map((e) => ({ ...e, timestamp: e.timestamp + shift })) });
  console.log(`${journey.id}: ${events.length} events, ${((events.at(-1).timestamp - events[0].timestamp) / 1000).toFixed(1)}s`);
  await page.close();
}
await browser.close();

const body = recordings
  .map((r) => `  {\n    id: ${JSON.stringify(r.id)},\n    name: ${JSON.stringify(r.name)},\n    events: [\n${r.events.map((e) => `      ${JSON.stringify(e)},`).join('\n')}\n    ],\n  },`)
  .join('\n');
writeFileSync(
  out,
  `/* Generated by tools/replay-canvas/record.mjs — don't edit. Four rrweb 2.0.0-alpha.20 sessions of Tandem, a mock
   project-tracker SPA (tools/replay-canvas/app.html served as ${ORIGIN}, 1280×800), each a different journey through
   the same app: menus, a modal with a validation state, a side sheet, a popover, a confirm dialog and route changes.
   Timestamps rebased to 2026-10-30 16:00 UTC (an hour apart). */
import type { ReplayEvent } from '@/components/ui/replay-preview';

export interface SampleRecording {
  id: string;
  name: string;
  events: ReplayEvent[];
}

export const SAMPLE_RECORDINGS: SampleRecording[] = [
${body}
];
`,
);
console.log(`wrote ${out}`);
