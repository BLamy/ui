// Summarize the last `pnpm vr` run: each failing story, its diff pixel count, and the diff image path.
import { readFileSync } from 'node:fs';
const r = JSON.parse(readFileSync(new URL('./results.json', import.meta.url)));
const rows = [];
const walk = (s) => {
  for (const sp of s.specs ?? []) for (const t of sp.tests) {
    const res = t.results.at(-1);
    if (res.status === 'passed') continue;
    const msg = (res.errors ?? []).map((e) => e.message).join(' ').replace(/\x1b\[[0-9;]*m/g, '');
    const px = msg.match(/(\d+) pixels/)?.[1] ?? '?';
    const diff = res.attachments.find((a) => a.name.endsWith('-diff.png'))?.path ?? '';
    rows.push([sp.title, px, t.status, diff]);
  }
  (s.suites ?? []).forEach(walk);
};
r.suites.forEach(walk);
for (const row of rows) console.log(row.join('\t'));
console.log(`${rows.length} differing`);
