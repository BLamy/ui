#!/usr/bin/env node
/* What a large Diagram costs, and a gate on it. It prints first paint, frame times while panning and zooming, heap and how much
   is in the DOM, with and without drawing only what's in view, 3 runs each, in headless Chromium. Each run is a new page.

     node tools/e2e/diagram-perf.mjs                     serves apps/docs/dist, which `pnpm nx build @brett_lamy/docs-app` makes
     node tools/e2e/diagram-perf.mjs --base <url>        or uses a server you have
     node tools/e2e/diagram-perf.mjs --sizes 2000,10000 --runs 3 --no-gate

   A busy machine can't be held to fixed numbers, so the gate compares with a baseline taken in the same run: the same page,
   drawing everything. The Cloudflare diagrams spike's numbers, for that same thing, are printed beside them. */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const sizes = opt('sizes', '2000').split(',').map(Number);
const runs = Number(opt('runs', 3));
const gate = !args.includes('--no-gate');
let base = opt('base', '');

/** The spike's numbers at 2,000 nodes, on `Canvas` with everything rendered, in a page of its own. */
const SPIKE = { first: 144, pan: 15.7, zoom: 17.4, heap: 11.5 };

let server = null;
if (!base) {
  const root = new URL('../../apps/docs/dist/', import.meta.url).pathname;
  if (!existsSync(join(root, 'index.html'))) { console.error('no apps/docs/dist: run pnpm nx build @brett_lamy/docs-app, or pass --base'); process.exit(2); }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
  server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(root, p);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

const browser = await chromium.launch({ headless: true });
const metric = (ms, k) => ms.metrics.find((m) => m.name === k)?.value ?? 0;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };

/** One page: lay it out once, then draw it, and move the camera about. */
async function run({ n, cull, zoom, minimap, editable }) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  await page.goto(`${base}/?demo=diagram/large&theme=light&n=${n}&hidden${cull ? '' : '&cull=off'}${minimap ? '&minimap' : ''}${editable ? '&editable' : ''}`, { timeout: 120_000 });
  await page.waitForFunction(() => window.__diagramLarge?.status() === 'ready', null, { timeout: 600_000 });
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    return (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
  };
  const before = await heap();
  const first = await page.evaluate(async ({ zoom }) => {
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const large = window.__diagramLarge;
    const b = large.bounds();
    const w = innerWidth, h = innerHeight;
    const fit = Math.max(0.02, Math.min(1, (w - 48) / b.w, (h - 48) / b.h));
    const z = zoom === 'fit' ? fit : zoom;
    // At fit, the middle of the graph. Closer than that, a node in the middle of the list, as a place on the board might have
    // nothing there, and then there's nothing to draw.
    const middle = large.nodes().filter((n) => !n.kind)[large.nodes().filter((n) => !n.kind).length >> 1];
    const on = zoom === 'fit' ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: middle.x, y: middle.y };
    large.setViewport({ zoom: z, x: w / 2 - on.x * z, y: h / 2 - on.y * z });
    await raf();
    const t0 = performance.now();
    large.show(true);
    while (!document.querySelector('[data-slot=diagram-node]')) {
      await raf();
      if (performance.now() - t0 > 180_000) throw new Error('not drawn in 180 s');
    }
    await raf();
    await raf();
    return performance.now() - t0;
  }, { zoom });
  await page.waitForTimeout(300);
  const cadence = (kind) => page.evaluate(async ({ kind }) => {
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const large = window.__diagramLarge;
    const c0 = large.viewport();
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const frames = 120, gaps = [];
    let last = performance.now();
    const started = last;
    for (let i = 0; i < frames; i++) {
      if (performance.now() - started > 25_000) break;
      await raf();
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      const t = i / frames;
      if (kind === 'pan') large.setViewport({ ...c0, x: c0.x + 200 * Math.sin(2 * Math.PI * t), y: c0.y + 120 * Math.sin(4 * Math.PI * t) });
      else { const k = 1 + 0.6 * Math.sin(2 * Math.PI * t); large.setViewport({ zoom: c0.zoom * k, x: cx - (cx - c0.x) * k, y: cy - (cy - c0.y) * k }); }
    }
    await raf();
    large.setViewport(c0);
    await raf();
    const s = gaps.slice(1).sort((a, b) => a - b);
    return { median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], over33: s.filter((d) => d > 33.4).length, frames: s.length };
  }, { kind });
  const pan = await cadence('pan');
  const zoomed = await cadence('zoom');
  // A real drag of the node nearest the middle: the frame gaps while it follows the pointer, with its edges.
  let drag = null;
  if (editable) {
    const at = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-slot=diagram-node][data-kind=node]')].map((el) => el.getBoundingClientRect());
      const r = nodes.sort((a, b) => Math.hypot(a.x - innerWidth / 2, a.y - innerHeight / 2) - Math.hypot(b.x - innerWidth / 2, b.y - innerHeight / 2))[0];
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.evaluate(() => {
      window.__gaps = [];
      let last = performance.now();
      window.__recording = true;
      const tick = () => { const now = performance.now(); window.__gaps.push(now - last); last = now; if (window.__recording) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    for (let i = 1; i <= 60; i++) await page.mouse.move(at.x + i * 3, at.y + Math.sin(i / 8) * 40);
    await page.mouse.up();
    drag = await page.evaluate(() => {
      window.__recording = false;
      const s = window.__gaps.slice(1).sort((a, b) => a - b);
      return { median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], frames: s.length };
    });
  }
  const after = await heap();
  const dom = metric(await cdp.send('Performance.getMetrics'), 'Nodes');
  const drawn = await page.evaluate(() => ({ nodes: document.querySelectorAll('[data-slot=diagram-node]').length, edges: document.querySelectorAll('[data-slot=diagram-edge]').length }));
  await context.close();
  return { first, pan, zoomed, drag, heap: after, heapOfDiagram: after - before, dom, drawn };
}

const row = (name, list) => {
  const one = (f) => { const xs = list.map(f); return `${median(xs).toFixed(1)} [${Math.min(...xs).toFixed(1)}-${Math.max(...xs).toFixed(1)}]`; };
  return `${name.padEnd(30)} first ${one((r) => r.first).padEnd(22)} pan ${one((r) => r.pan.median).padEnd(20)} p95 ${one((r) => r.pan.p95).padEnd(20)} zoom ${one((r) => r.zoomed.median).padEnd(20)} heap ${one((r) => r.heap).padEnd(20)} of it, diagram ${one((r) => r.heapOfDiagram).padEnd(18)} DOM ${median(list.map((r) => r.dom))} (${median(list.map((r) => r.drawn.nodes))} nodes, ${median(list.map((r) => r.drawn.edges))} edges)${list[0].drag ? ` drag ${one((r) => r.drag.median)}, p95 ${one((r) => r.drag.p95)}, longest ${one((r) => r.drag.max)}` : ''}`;
};

const failures = [];
for (const n of sizes) {
  console.log(`\n${n} nodes, ${runs} run${runs === 1 ? '' : 's'} each, median [min-max], ms and MB. The frame floor here is 8.3 ms.`);
  const results = {};
  for (const [name, cfg] of Object.entries({
    'fit, everything drawn': { n, cull: false, zoom: 'fit' },
    'fit, culling': { n, cull: true, zoom: 'fit' },
    '100%, everything drawn': { n, cull: false, zoom: 1 },
    '100%, culling': { n, cull: true, zoom: 1 },
    '100%, culling, minimap': { n, cull: true, zoom: 1, minimap: true },
    '100%, culling, dragging': { n, cull: true, zoom: 1, editable: true },
    'fit, culling, dragging': { n, cull: true, zoom: 'fit', editable: true },
  })) {
    const list = [];
    for (let i = 0; i < runs; i++) list.push(await run(cfg));
    results[name] = list;
    console.log(row(name, list));
  }
  if (n === 2000) console.log(`The spike at 2,000, fit, everything drawn, at a load of about 20: first ${SPIKE.first}, pan ${SPIKE.pan}, zoom ${SPIKE.zoom}, heap ${SPIKE.heap}.`);
  const m = (name, f) => median(results[name].map(f));
  const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`); if (!ok) failures.push(`${n}: ${what}`); };
  // Drawing less can't be meaningfully worse than drawing it all. Under about 25% at these levels is noise on this machine.
  check(m('fit, culling', (r) => r.pan.median) <= m('fit, everything drawn', (r) => r.pan.median) * 1.25 + 2, `at fit, panning isn't worse than with everything drawn: ${m('fit, culling', (r) => r.pan.median).toFixed(1)} against ${m('fit, everything drawn', (r) => r.pan.median).toFixed(1)}`);
  check(m('fit, culling', (r) => r.first) <= m('fit, everything drawn', (r) => r.first) * 1.25 + 20, `at fit, first paint isn't worse: ${m('fit, culling', (r) => r.first).toFixed(0)} against ${m('fit, everything drawn', (r) => r.first).toFixed(0)}`);
  check(m('100%, culling', (r) => r.first) < m('100%, everything drawn', (r) => r.first), `at 100%, first paint's better: ${m('100%, culling', (r) => r.first).toFixed(0)} against ${m('100%, everything drawn', (r) => r.first).toFixed(0)}`);
  check(m('100%, culling', (r) => r.pan.median) <= m('100%, everything drawn', (r) => r.pan.median) * 1.25 + 2, `at 100%, panning isn't worse: ${m('100%, culling', (r) => r.pan.median).toFixed(1)} against ${m('100%, everything drawn', (r) => r.pan.median).toFixed(1)}`);
  check(m('100%, culling', (r) => r.dom) < m('100%, everything drawn', (r) => r.dom) / 3, `at 100%, the DOM's a good deal smaller: ${m('100%, culling', (r) => r.dom)} against ${m('100%, everything drawn', (r) => r.dom)}`);
  check(m('100%, culling', (r) => r.heapOfDiagram) < m('100%, everything drawn', (r) => r.heapOfDiagram), `at 100%, the heap's smaller: ${m('100%, culling', (r) => r.heapOfDiagram).toFixed(1)} against ${m('100%, everything drawn', (r) => r.heapOfDiagram).toFixed(1)}`);
  check(m('100%, culling, minimap', (r) => r.pan.median) <= m('100%, culling', (r) => r.pan.median) * 1.25 + 2, `a minimap with all those marks costs a pan little: ${m('100%, culling, minimap', (r) => r.pan.median).toFixed(1)} against ${m('100%, culling', (r) => r.pan.median).toFixed(1)}`);
  if (n === 2000) {
    // The spike ran on a page with little else in it and a load of about 20, so these only warn: it's the baseline above that holds.
    const warn = (ok, what) => console.log(`${ok ? 'ok  ' : 'warn'}  ${what}`);
    warn(m('fit, culling', (r) => r.pan.median) <= SPIKE.pan * 1.25, `pan at fit against the spike's: ${m('fit, culling', (r) => r.pan.median).toFixed(1)} against ${SPIKE.pan}`);
    warn(m('fit, culling', (r) => r.first) <= SPIKE.first * 1.25, `first paint at fit against the spike's: ${m('fit, culling', (r) => r.first).toFixed(0)} against ${SPIKE.first}`);
    warn(m('fit, culling', (r) => r.heapOfDiagram) <= SPIKE.heap, `the diagram's heap at fit against the spike's whole page: ${m('fit, culling', (r) => r.heapOfDiagram).toFixed(1)} against ${SPIKE.heap}`);
  }
}

await browser.close();
server?.close();
if (gate && failures.length) {
  console.error(`\n${failures.length} failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(gate ? '\nAll of it passed.' : '\nDone, with no gate.');
