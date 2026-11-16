/* BL UI — the diagram layout worker. https://blamy.github.io/ui/#/diagram
 *
 * Runs ELK off the main thread, so a layout of thousands of nodes doesn't stop the page. lib/diagram-layout starts it with
 * `new Worker(new URL('./layout-worker.js', import.meta.url), { type: 'module' })`, which your bundler turns into a chunk of
 * its own, ELK and all. One message in, one out, and to stop a layout you terminate the worker, as ELK can't be interrupted.
 * MIT licensed, like the rest of BL UI. ELK itself is EPL-2.0 OR GPL-3.0-or-later. */
import * as bundled from 'elkjs/lib/elk.bundled.js';

// ELK is a UMD file. A bundler gives it a default export. Served as it is, as Vite's dev server does when it hasn't
// pre-bundled it, it has no exports and sets a global instead, and a plain default import would fail to load.
const ELK = bundled.default ?? self.ELK;
const elk = new ELK();

self.onmessage = async ({ data: { id, graph } }) => {
  try {
    self.postMessage({ id, graph: await elk.layout(graph) });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
