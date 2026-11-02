// Downloads one test run per Replay QA project (the newest with recordings) for tools/replay-canvas/evaluate.mjs: every
// journey's rrweb events as <out>/<project>/<test run>/<run>.rrweb.json, with manifests. Resumable. Uses the replayio CLI login.
//   npx tsx tools/replay-canvas/fetch-test-runs.mts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createQaClient, groupTestRuns } from '../../registry/blocks/replay-canvas/qa.ts';
const OUT = `${homedir()}/Documents/Codex/replay-qa-recordings`;
const qa = createQaClient(JSON.parse(readFileSync(`${homedir()}/.replay/profile/auth.json`, 'utf8')).accessToken);
const playable = (ev: any[]) => ev.some((e, i) => e.type === 2 && ev[i - 1]?.type === 4);
const manifest: any[] = [];
const projects = await qa.projects();
for (const p of projects) {
  const runs = groupTestRuns(await qa.journeyRuns(p.id)).filter((t) => t.startedAt >= '2026-09-01');
  let picked = null;
  for (const t of runs) {
    // A test run has recordings when its first finished journey does.
    const probe = t.runs.find((r) => r.status === 'completed') ?? t.runs[0];
    const ev = await qa.recording(p.id, probe.id);
    if (playable(ev)) { picked = t; break; }
  }
  if (!picked) { console.log(`- ${p.name}: no test run with recordings`); continue; }
  const dir = `${OUT}/${p.id}/${picked.id}`;
  mkdirSync(dir, { recursive: true });
  const files: any[] = [];
  const queue = [...picked.runs];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const file = `${dir}/${r.id}.rrweb.json`;
      if (!existsSync(file)) {
        try {
          const ev = (await qa.recording(p.id, r.id)).sort((a: any, b: any) => a.timestamp - b.timestamp);
          if (!playable(ev)) { files.push({ run: r.id, journey: r.journey_name, empty: true }); continue; }
          writeFileSync(file, JSON.stringify(ev));
        } catch (e) { files.push({ run: r.id, journey: r.journey_name, error: String(e) }); continue; }
      }
      files.push({ run: r.id, journey: r.journey_name || r.goal, outcome: r.outcome_status, file: `${r.id}.rrweb.json` });
    }
  }));
  const entry = { project: p.id, name: p.name, target: p.target_url, testRun: picked.id, startedAt: picked.startedAt, journeys: files };
  writeFileSync(`${dir}/manifest.json`, JSON.stringify(entry, null, 1));
  manifest.push({ ...entry, dir: `${p.id}/${picked.id}` });
  console.log(`✓ ${p.name}: ${files.filter((f) => f.file).length}/${picked.runs.length} recordings`);
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
}
console.log('done', manifest.length, 'projects');
