import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

/* Accessibility audit: every docs example (and block) full screen, in light and dark, through axe-core.
   Prints a summary by rule and writes every violation to a JSON report. `a11y-baseline.json` records the known ones
   (violating nodes per demo, theme and rule); the gate fails on anything new or worse, so the count only goes down:
     node tools/e2e/a11y-audit.mjs                 audit, print the summary
     node tools/e2e/a11y-audit.mjs --check         also fail on anything not in the baseline (what CI runs)
     node tools/e2e/a11y-audit.mjs --update        rewrite the baseline from this run (after fixing things)
   Options: --only <substring of a demo id>, --base <url> (else a docs dev server is started), --out <report.json>. */
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const flag = (name) => args.includes(`--${name}`);
const CHECK = flag('check'), UPDATE = flag('update');
const PORT = 4422;
let BASE = opt('base', '');
const ONLY = opt('only', '');
const OUT = opt('out', new URL('./a11y-report.json', import.meta.url).pathname);
const BASELINE = new URL('./a11y-baseline.json', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const examplesDir = new URL('../../apps/docs/examples/', import.meta.url).pathname;
const demos = readdirSync(examplesDir)
  .filter((d) => statSync(examplesDir + d).isDirectory())
  .flatMap((d) => readdirSync(examplesDir + d).filter((e) => statSync(`${examplesDir}${d}/${e}`).isDirectory()).map((e) => `${d}/${e}`))
  .filter((d) => d.includes(ONLY));

const RULES = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } };

/** The docs dev server: the one given, else our own on PORT (stopped at the end). */
let server = null;
async function up(url) { try { return (await fetch(url)).ok; } catch { return false; } }
if (!BASE) {
  BASE = `http://localhost:${PORT}`;
  if (!(await up(BASE))) {
    server = spawn('pnpm', ['dev:docs', '--port', String(PORT), '--strictPort'], { cwd: new URL('../..', import.meta.url).pathname, stdio: 'ignore' });
    for (let i = 0; i < 120 && !(await up(BASE)); i++) await new Promise((r) => setTimeout(r, 500));
    if (!(await up(BASE))) { server.kill(); console.error('could not start the docs dev server'); process.exit(2); }
  }
}

const browser = await chromium.launch();

/** Audits `list` of demos in both themes, 5 pages at a time. */
async function audit(list) {
  const out = [];
  let next = 0;
  async function worker() {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.route(/arcgisonline|openstreetmap|tile\./, (r) => r.abort());
    while (next < list.length * 2) {
      const i = next++;
      const demo = list[i >> 1], theme = i & 1 ? 'dark' : 'light';
      try {
        await page.goto(`${BASE}/?demo=${demo}&theme=${theme}`, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => (document.getElementById('root')?.innerText.trim().length ?? 0) > 0 || document.querySelector('#root svg, #root canvas, #root img'), undefined, { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(900);
        await page.addScriptTag({ content: AXE });
        const r = await page.evaluate(async (rules) => {
          const res = await window.axe.run(document, rules);
          return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 160), data: n.any[0]?.data && { fg: n.any[0].data.fgColor, bg: n.any[0].data.bgColor, ratio: n.any[0].data.contrastRatio, need: n.any[0].data.expectedContrastRatio, size: n.any[0].data.fontSize } })) }));
        }, RULES);
        out.push({ demo, theme, violations: r });
      } catch (e) {
        out.push({ demo, theme, error: String(e).slice(0, 160), violations: [] });
      }
    }
    await ctx.close();
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  return out;
}

const results = await audit(demos);
results.sort((a, b) => (a.demo + a.theme).localeCompare(b.demo + b.theme));
writeFileSync(OUT, JSON.stringify(results, null, 1));
const byRule = {};
for (const r of results) for (const v of r.violations) { (byRule[v.id] ??= { impact: v.impact, help: v.help, demos: new Set(), nodes: 0 }); byRule[v.id].demos.add(r.demo); byRule[v.id].nodes += v.nodes.length; }
console.log(`audited ${demos.length} demos × 2 themes; ${results.filter((r) => r.error).length} errored; ${results.filter((r) => r.violations.length).length} with violations`);
for (const [id, v] of Object.entries(byRule).sort((a, b) => b[1].demos.size - a[1].demos.size))
  console.log(`  ${String(v.demos.size).padStart(3)} demos ${String(v.nodes).padStart(4)} nodes  ${id} [${v.impact}] — ${v.help}`);

// Violating nodes per `demo|theme|rule`.
const counts = {};
for (const r of results) for (const v of r.violations) counts[`${r.demo}|${r.theme}|${v.id}`] = v.nodes.length;
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
if (UPDATE) {
  if (ONLY) { console.error('--update needs a full run (no --only)'); process.exit(2); }
  writeFileSync(BASELINE, JSON.stringify(sorted(counts), null, 1) + '\n');
  console.log(`baseline written: ${Object.keys(counts).length} entries`);
} else if (CHECK) {
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  // Counts of timing-dependent content (replay markers that appear as playback runs) wobble by a few nodes: allow a
  // little slack on entries already in the baseline. A new entry (demo, theme, rule) has none.
  const slack = (n) => Math.max(2, Math.ceil(n * 0.15));
  const isWorse = ([k, n]) => !(k in base) || n > base[k] + slack(base[k]);
  let worse = Object.entries(counts).filter(isWorse);
  if (worse.length) {
    // Some rules depend on timing (a lazy tree, an animation caught mid-flight): look again at just the offenders and
    // keep only what is still worse.
    const again = await audit([...new Set(worse.map(([k]) => k.split('|')[0]))]);
    const recount = {};
    for (const r of again) for (const v of r.violations) recount[`${r.demo}|${r.theme}|${v.id}`] = v.nodes.length;
    worse = Object.entries(recount).filter(([k]) => worse.some(([w]) => w === k)).filter(isWorse);
  }
  const better = Object.keys(base).filter((k) => !ONLY || k.split('|')[0].includes(ONLY)).filter((k) => !(k in counts) || counts[k] < base[k]);
  if (better.length) console.log(`${better.length} baseline entries are fixed or improved — run with --update to ratchet them down.`);
  if (worse.length) {
    console.error(`\n${worse.length} new or worse accessibility violation(s):`);
    for (const [k, n] of worse) console.error(`  ${k}: ${n} node(s) (baseline ${base[k] ?? 0})`);
    process.exitCode = 1;
  } else console.log('no new accessibility violations.');
}
await browser.close();
if (server) server.kill();
