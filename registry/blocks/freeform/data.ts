/* Freeform's sample boards — every name and plan here is invented. Ids are fixed so a frame repeats. */
import type { PencilPoint } from '@/components/ui/pencilkit/constants';
import { strokeFrame } from './geometry';
import {
  makeConnector, makeImage, makeLink, makeShape, makeSticky, makeText,
  type Board, type ConnectorItem, type ImageItem, type Item, type LinkItem, type ShapeItem, type ShapeKind, type StickyItem, type StrokeItem, type TextItem,
} from './model';
import { AUTO_INK, STICKY_COLORS } from './palette';

const [YELLOW, PINK, BLUE, GREEN, PURPLE, ORANGE] = STICKY_COLORS;

const sticky = (id: string, x: number, y: number, color: string, text: string, rot = 0): StickyItem => ({ ...makeSticky(x, y, color, text), id, rot });
const shape = (id: string, kind: ShapeKind, x: number, y: number, w: number, h: number, fill: string | null, text = '', rot = 0): ShapeItem =>
  ({ ...makeShape(x, y, kind, fill, text), id, w, h, rot });
const text = (id: string, x: number, y: number, t: string, size = 28, patch: Partial<TextItem> = {}): TextItem => ({ ...makeText(x, y, t, size), id, ...patch });
const image = (id: string, x: number, y: number, art: number, caption: string, rot = 0): ImageItem => ({ ...makeImage(x, y, art, caption), id, rot });
const link = (id: string, x: number, y: number, url: string, title: string): LinkItem => ({ ...makeLink(x, y, url, title), id });
const conn = (id: string, patch: Partial<ConnectorItem> & Pick<ConnectorItem, 'from' | 'to'>): ConnectorItem => {
  const { from, to, ...rest } = patch;
  return { ...makeConnector(from, to, rest), id };
};

function stroke(id: string, color: string, points: PencilPoint[], tool: StrokeItem['tool'] = 'pen', width = 1): StrokeItem {
  const f = strokeFrame(points, tool, width);
  return { id, kind: 'stroke', tool, color, width, pen: false, points, ...f, rot: 0 };
}

/** A hand-drawn ellipse: a little wobble and overshoot, so it reads as drawn. */
function loop(cx: number, cy: number, rx: number, ry: number, turns = 1.08): PencilPoint[] {
  const pts: PencilPoint[] = [];
  const n = 72;
  for (let i = 0; i <= n * turns; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const wob = 1 + Math.sin(i * 0.37) * 0.025 + (i / (n * turns)) * 0.03;
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob, 0.5]);
  }
  return pts;
}

/** A wavy line from (x, y) `len` long. */
function wave(x: number, y: number, len: number, amp: number, cycles: number): PencilPoint[] {
  const pts: PencilPoint[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    pts.push([x + t * len, y + Math.sin(t * Math.PI * 2 * cycles) * amp, 0.5]);
  }
  return pts;
}

/** A path through `points` with a soft curve between them. */
function route(points: [number, number][]): PencilPoint[] {
  const out: PencilPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    for (let k = 0; k < 14; k++) {
      const t = k / 14;
      const e = t * t * (3 - 2 * t);
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * e + Math.sin(t * Math.PI) * 6, 0.5]);
    }
  }
  const last = points[points.length - 1];
  out.push([last[0], last[1], 0.5]);
  return out;
}

const launch: Item[] = [
  text('l-title', 80, 40, 'Q4 launch plan', 52, { bold: true, w: 720 }),
  stroke('l-under', '#FF375F', wave(84, 116, 330, 4, 4), 'marker', 0.5),
  text('l-sub', 80, 136, 'Ship the new onboarding before the November 14 freeze.', 22, { color: '#8E8E93', w: 760 }),
  shape('l-research', 'round', 80, 260, 200, 92, '#A8DCFF', 'Research'),
  shape('l-design', 'round', 380, 260, 200, 92, '#D7C3FF', 'Design'),
  shape('l-build', 'round', 680, 260, 200, 92, '#B5EBB0', 'Build'),
  shape('l-ship', 'round', 980, 260, 200, 92, '#FFE27A', 'Ship'),
  conn('l-c1', { from: { id: 'l-research', side: 'r' }, to: { id: 'l-design', side: 'l' }, route: 'straight' }),
  conn('l-c2', { from: { id: 'l-design', side: 'r' }, to: { id: 'l-build', side: 'l' }, route: 'straight' }),
  conn('l-c3', { from: { id: 'l-build', side: 'r' }, to: { id: 'l-ship', side: 'l' }, route: 'straight' }),
  stroke('l-ring', '#FF375F', loop(1080, 306, 150, 76), 'pen', 1.1),
  shape('l-star', 'star', 1250, 226, 120, 120, '#FFD60A'),
  conn('l-c4', { from: { id: 'l-ship', side: 'r' }, to: { id: 'l-star', side: 'l' }, route: 'curve', heads: 'end' }),
  text('l-risks', 80, 440, 'Risks', 30, { bold: true, w: 240 }),
  sticky('l-s1', 80, 500, ORANGE, 'Legacy sign-in API is still in use', -3),
  sticky('l-s2', 290, 512, PINK, 'Design review could slip a week', 2),
  sticky('l-s3', 500, 496, BLUE, 'Need an accessibility audit', -1.5),
  shape('l-bubble', 'bubble', 820, 470, 230, 150, '#FFB7C5', 'Demo for the whole team on Friday!', 3),
  shape('l-heart', 'heart', 1120, 500, 110, 100, '#FF6B81'),
  conn('l-c5', { from: { id: 'l-s3', side: 'r' }, to: { id: 'l-bubble', side: 'l' }, route: 'elbow', heads: 'end', dashed: true }),
];

const tokyo: Item[] = [
  text('t-title', 80, 40, 'Tokyo — October', 52, { bold: true, w: 720 }),
  image('t-i1', 80, 140, 0, 'Shibuya at dusk', -2),
  image('t-i2', 400, 120, 1, 'Meiji Shrine'),
  image('t-i3', 720, 150, 2, 'Sunrise over Yoyogi', 2),
  link('t-link', 80, 410, 'united.example.com/trips/48F22917', 'Flight confirmation — UA 837 to NRT'),
  sticky('t-s1', 440, 380, YELLOW, 'Book teamLab tickets before they sell out!', 2),
  sticky('t-s2', 650, 400, GREEN, 'Ramen near the hotel: open until 2 AM', -2),
  text('t-pack', 900, 380, 'Packing\n• Passport\n• Suica card\n• Adapter (Type A)\n• Rain jacket', 22, { w: 280, h: 150 }),
  stroke('t-route', '#0A84FF', route([[90, 620], [260, 560], [430, 640], [620, 570], [800, 650], [980, 600]]), 'marker', 0.8),
  text('t-note', 90, 664, 'Narita → Shibuya → Harajuku → Asakusa', 20, { color: '#8E8E93', w: 620 }),
];

const brainstorm: Item[] = [
  text('b-title', 80, 40, 'Onboarding ideas', 48, { bold: true, w: 720 }),
  shape('b-rect-a', 'rect', 70, 140, 560, 400, null, ''),
  text('b-a', 90, 150, 'Show, don’t tell', 26, { bold: true, w: 400 }),
  sticky('b-1', 100, 210, YELLOW, 'Interactive product tour', -2),
  sticky('b-2', 290, 220, PINK, 'Sample data on first launch', 1.5),
  sticky('b-3', 470, 204, BLUE, 'Checklist with progress', -1),
  shape('b-rect-b', 'rect', 680, 140, 560, 400, null, ''),
  text('b-b', 700, 150, 'Open questions', 26, { bold: true, w: 400 }),
  sticky('b-4', 710, 210, PURPLE, 'Skip or finish later?', 2),
  sticky('b-5', 900, 220, ORANGE, 'How long is too long?', -2),
  sticky('b-6', 1070, 204, GREEN, 'Who owns the copy?', 1),
  shape('b-q', 'plus', 600, 580, 70, 70, '#0A84FF'),
  stroke('b-arrow', AUTO_INK, route([[420, 560], [520, 600], [590, 610]]), 'pen', 1),
];

const at = (itemsList: Item[]) => itemsList;

export const SAMPLE_BOARDS: Board[] = [
  { id: 'board-launch', title: 'Q4 launch plan', items: at(launch), favorite: true, edited: 'Today, 9:12 AM', background: 'dots' },
  { id: 'board-tokyo', title: 'Tokyo trip', items: at(tokyo), favorite: false, edited: 'Yesterday', background: 'dots' },
  { id: 'board-ideas', title: 'Onboarding ideas', items: at(brainstorm), favorite: false, edited: 'Sep 24', background: 'grid' },
];
