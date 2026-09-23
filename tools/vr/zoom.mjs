/* Zoom into a visual-regression failure: finds the changed region from the diff image and writes
   expected | actual crops, magnified, side by side.
   Usage: node tools/vr/zoom.mjs <story-id> [out.png]   (after a failing `pnpm vr`) */
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const id = process.argv[2];
const out = process.argv[3] || `/tmp/vr-zoom-${id}.png`;
const root = new URL('./.results/', import.meta.url).pathname;
const dir = readdirSync(root).filter((d) => d.includes(id.slice(0, 40)) || d.includes(id.slice(-30))).sort().at(-1);
if (!dir) throw new Error('no result dir for ' + id);
const files = readdirSync(join(root, dir));
const pick = (suffix) => 'data:image/png;base64,' + readFileSync(join(root, dir, files.find((f) => f.endsWith(suffix)))).toString('base64');
const [expected, actual, diff] = ['-expected.png', '-actual.png', '-diff.png'].map(pick);

const browser = await chromium.launch();
const page = await browser.newPage();
const size = await page.evaluate(async ([e, a, d]) => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const [ie, ia, id] = await Promise.all([load(e), load(a), load(d)]);
  const c = document.createElement('canvas'); c.width = id.width; c.height = id.height;
  const x = c.getContext('2d'); x.drawImage(id, 0, 0);
  const px = x.getImageData(0, 0, c.width, c.height).data;
  let [x0, y0, x1, y1] = [c.width, c.height, 0, 0];
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
    const i = (y * c.width + xx) * 4;
    if (px[i] > 200 && px[i + 1] < 120 && px[i + 2] < 120 || (px[i] > 200 && px[i + 1] > 200 && px[i + 2] < 80)) {
      x0 = Math.min(x0, xx); y0 = Math.min(y0, y); x1 = Math.max(x1, xx); y1 = Math.max(y1, y);
    }
  }
  const pad = 24; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width, x1 + pad); y1 = Math.min(c.height, y1 + pad);
  const w = x1 - x0, h = y1 - y0, s = Math.max(1, Math.min(4, Math.floor(600 / Math.max(w, 1))));
  const o = document.createElement('canvas'); o.width = w * s * 2 + 12; o.height = h * s; o.id = 'out';
  const ox = o.getContext('2d'); ox.imageSmoothingEnabled = false; ox.fillStyle = '#f0f'; ox.fillRect(0, 0, o.width, o.height);
  ox.drawImage(ie, x0, y0, w, h, 0, 0, w * s, h * s);
  ox.drawImage(ia, x0, y0, w, h, w * s + 12, 0, w * s, h * s);
  document.body.style.margin = '0'; document.body.appendChild(o);
  return { w: o.width, h: o.height, box: [x0, y0, w, h], scale: s };
}, [expected, actual, diff]);
await page.setViewportSize({ width: Math.max(size.w, 100), height: Math.max(size.h, 100) });
await page.locator('#out').screenshot({ path: out });
await browser.close();
console.log(out, 'region', size.box.join(','), 'scale', size.scale, '(left: expected, right: actual)');
