/* Outlines for Freeform's shapes, each a path in a w × h box. */
import type { ShapeKind } from './model';

export const SHAPE_KINDS: { kind: ShapeKind; label: string }[] = [
  { kind: 'rect', label: 'Rectangle' },
  { kind: 'round', label: 'Rounded rectangle' },
  { kind: 'ellipse', label: 'Ellipse' },
  { kind: 'triangle', label: 'Triangle' },
  { kind: 'diamond', label: 'Diamond' },
  { kind: 'pentagon', label: 'Pentagon' },
  { kind: 'hexagon', label: 'Hexagon' },
  { kind: 'star', label: 'Star' },
  { kind: 'plus', label: 'Plus' },
  { kind: 'arrow', label: 'Arrow' },
  { kind: 'bubble', label: 'Speech bubble' },
  { kind: 'heart', label: 'Heart' },
];

const n = (v: number) => +v.toFixed(2);
const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'Z';

/** `count` points around the box's ellipse, starting at the top; `inner` alternates a second radius (stars). */
function around(w: number, h: number, count: number, inner?: number): [number, number][] {
  const pts: [number, number][] = [];
  const steps = inner ? count * 2 : count;
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / steps;
    const r = inner && i % 2 ? inner : 1;
    pts.push([w / 2 + (Math.cos(a) * w * r) / 2, h / 2 + (Math.sin(a) * h * r) / 2]);
  }
  return pts;
}

export function shapePath(kind: ShapeKind, w: number, h: number): string {
  switch (kind) {
    case 'rect': return `M0 0H${n(w)}V${n(h)}H0Z`;
    case 'round': {
      const r = n(Math.min(w, h) * 0.24);
      return `M${r} 0H${n(w - +r)}A${r} ${r} 0 0 1 ${n(w)} ${r}V${n(h - +r)}A${r} ${r} 0 0 1 ${n(w - +r)} ${n(h)}H${r}A${r} ${r} 0 0 1 0 ${n(h - +r)}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
    }
    case 'ellipse': return `M${n(w / 2)} 0A${n(w / 2)} ${n(h / 2)} 0 1 1 ${n(w / 2)} ${n(h)}A${n(w / 2)} ${n(h / 2)} 0 1 1 ${n(w / 2)} 0Z`;
    case 'triangle': return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'diamond': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'pentagon': return poly(around(w, h, 5));
    case 'hexagon': return poly([[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]]);
    case 'star': return poly(around(w, h, 5, 0.42));
    case 'plus': {
      const a = w / 3, b = h / 3;
      return poly([[a, 0], [2 * a, 0], [2 * a, b], [w, b], [w, 2 * b], [2 * a, 2 * b], [2 * a, h], [a, h], [a, 2 * b], [0, 2 * b], [0, b], [a, b]]);
    }
    case 'arrow': return poly([[0, h * 0.27], [w * 0.58, h * 0.27], [w * 0.58, 0], [w, h / 2], [w * 0.58, h], [w * 0.58, h * 0.73], [0, h * 0.73]]);
    case 'bubble': return poly([[0, 0], [w, 0], [w, h * 0.76], [w * 0.46, h * 0.76], [w * 0.24, h], [w * 0.28, h * 0.76], [0, h * 0.76]]);
    case 'heart': {
      const x = (v: number) => n(v * w), y = (v: number) => n(v * h);
      return `M${x(0.5)} ${y(1)}C${x(0.06)} ${y(0.66)} ${x(-0.04)} ${y(0.3)} ${x(0.2)} ${y(0.1)}C${x(0.36)} ${y(-0.02)} ${x(0.5)} ${y(0.14)} ${x(0.5)} ${y(0.26)}C${x(0.5)} ${y(0.14)} ${x(0.64)} ${y(-0.02)} ${x(0.8)} ${y(0.1)}C${x(1.04)} ${y(0.3)} ${x(0.94)} ${y(0.66)} ${x(0.5)} ${y(1)}Z`;
    }
  }
}
