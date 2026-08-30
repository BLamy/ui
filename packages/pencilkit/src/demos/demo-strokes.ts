/* Small pre-seeded stroke fixture so stories can demonstrate each tool and the
   stroke eraser without drawing first. Generated point paths (pressure 0.5,
   simulatePressure kicks in since pen:false). */
import { PK_INKS, type PencilPoint, type PencilStroke } from '../lib/constants';

function wave(x0: number, y0: number, len: number, amp: number, cycles: number, n = 48): PencilPoint[] {
  const pts: PencilPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + t * len, y0 + Math.sin(t * Math.PI * 2 * cycles) * amp, 0.5]);
  }
  return pts;
}

function loop(cx: number, cy: number, rx: number, ry: number, n = 56): PencilPoint[] {
  const pts: PencilPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.5]);
  }
  return pts;
}

/** Three strokes — one per drawing tool — sized for a ~640×420 canvas. */
export function demoStrokes(): PencilStroke[] {
  return [
    { tool: 'pen', color: PK_INKS[2], w: 1, pen: false, done: true, points: wave(70, 110, 300, 34, 1.5) },
    { tool: 'marker', color: PK_INKS[4], w: 1, pen: false, done: true, points: wave(90, 200, 320, 10, 0.5) },
    { tool: 'pencil', color: PK_INKS[5], w: 1.7, pen: false, done: true, points: loop(460, 150, 90, 55) },
  ];
}
