/* ══ The diagram family's layout invariants ══
   Every example the stories and docs draw (three Cloudflare systems, the studio's, a workerd config, a preset, the Audio
   Player, the 33-state machine, the forms and several-targets machines, hand-placed and laid-out anatomy), in every mode that
   changes the drawing (read-only and editable; the panel open and closed where it changes the board), at the four frames the
   critics use, put through exactly what the components run: ELK, `finishLayout` for the frame, `onLayout`, the Diagram's
   own sizing and `drawDiagram`, and its opening view. Each drawing is held to seven rules:

   1. attached: an edge starts and ends on (within 1.5 of) the border of what it claims (a port, a box's hairline under its
      sections for its own child, the label it forks from); the arrowhead is its last point; ends of different edges on one
      side of a card are at least 8 apart unless they share a port (no arrowhead on another edge's start);
   2. clear: no run goes through a card, an entry marker, a box's header strip and sections, or along a box's wall (within a
      lane, 10), its hairline (6) or a region's divider it doesn't cross; what's in a box keeps clear of its walls and header;
   3. its own lane and label: no two edges run within a lane of each other for longer than a crossing; each label is on its
      own route, which runs through it, and nothing else is: no other route, card, label, header or border;
   4. no U-turn: an edge that leaves (or enters) by a side not facing the other end, when a route between facing sides would
      take fewer bends, is going round;
   5. the frame is used: an editable drawing's places are its read-only ones; a drawing too big to read whole is shaped like
      its view (within 2×) or fills its width at the readable zoom;
   6. the first view shows the top-start corner (a root's header and sections), and what has the eye with it (with nothing
      selected or current, where it starts: its root's first card with an entry marker), or that alone when the two can't
      both be read at once;
   7. what's announced is what's drawn: a box "holding N things" holds N of them.

   After the matrix: edit sequences on every Cloudflare example and on a machine (see "Editing"), and the docstream fences in
   a document's column (see "In a document").

   The frames' chrome (a toolbar over the top, a frame's bar along the foot, the 288 px column panel) is the kit's, measured
   in a browser: see `CHROME`. Text is estimated, as on a server; a browser's measured text is checked by eye and in e2e. */
import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMachine } from 'xstate';
import { PLATFORM, PLATFORM_EDGES, SMALL, SMALL_EDGES, STUDIO_EXAMPLE, UPLOAD, UPLOAD_EDGES, WORKERD_CONFIG } from '../stories/cloudflare-systems';
import { EDGES as EDGE_KINDS, EDGE_NODES, KINDS, STATECHART_LIKE, SYSTEM_LIKE } from '../stories/diagram-anatomy';
import { AUDIO_PLAYER_SOURCE } from '../stories/audio-player-machine';
import { SEVERAL_TARGETS, TRANSITION_FORMS } from '../stories/state-machines';
import { uploadMachine } from '../stories/upload-machine';
import type { Pt, Rect, Viewport } from './canvas-math';
import { cloudflareAddService, cloudflareBoardData, cloudflareEdit, cloudflareKeptBoard, cloudflareNoun, cloudflarePlaces, CLOUDFLARE_SYSTEM_NODE, placeInLayers, type CloudflareDrawn } from './cloudflare-board';
import { cloudflareBoardProps } from '../components/cloudflare-diagram';
import { readWorkerdConfig } from './cloudflare-workerd';
import { removeServices, searchCatalog, validateSystem, type CloudflareSystem } from './cloudflare-system';
import { linkBetween, newEdge, servicePorts, type CloudflareEdge, type CloudflareService } from './cloudflare-services';
import { AVOID_UP_TO, diagramContentHeight, diagramEye, diagramStartEye, drawDiagram, drawingCorner, firstView, keepInView, type DiagramDrawing } from './diagram-drawing';
import { describeNode, edgesByNode } from './diagram-keyboard';
import { createDiagramLayoutEngine, finishLayout, runLayout, toElkGraph, type DiagramBoardSize, type DiagramDraft, type DiagramLayoutResult } from './diagram-layout';
import { onLayout } from './diagram-layout/react';
import { DIAGRAM_LEGIBLE_ZOOM, growNodesToText, holdsNodes, indexDiagram, isInside, nodeAnatomy, portPoint, sizeNodesToText, type DiagramEdge, type DiagramNode } from './diagram-model';
import { estimateText } from './diagram-text';
import { addState, addTransition, renameState } from './state-diagram-edit';
import { machineToDraft } from './state-diagram-model';
import { parseXState } from './state-diagram-source';

const text = estimateText;
/** Set to a path to have every finding written there too, one a line (the suite's report). */
const DUMP = process.env.DIAGRAM_INVARIANTS_OUT;

/* ── The frames, and the chrome over them ── */

const FRAMES = [
  { name: '800x1000', width: 800, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '1600x900', width: 1600, height: 900 },
] as const;
type Frame = (typeof FRAMES)[number];

/** What covers a board, px, as measured in the docs app: the floating toolbar at the top, a DiagramFrame's bar at the foot,
 *  air at the sides (the Diagram's `fitPadding`); a column panel's width; the size class a column needs. */
const CHROME = { top: 60, bottom: 72, side: 24, column: 288, columnFrom: 720 };

/** The board a frame leaves (a column panel narrows it), and what of it nothing covers. */
function boardOf(frame: Frame, panel: boolean) {
  const column = panel && frame.width >= CHROME.columnFrom;
  const size = { width: frame.width - (column ? CHROME.column : 0), height: frame.height };
  const pad = { top: CHROME.top, bottom: CHROME.bottom, left: CHROME.side, right: CHROME.side };
  return { size, pad, visible: { x: pad.left, y: pad.top, w: size.width - pad.left - pad.right, h: size.height - pad.top - pad.bottom } };
}
/** The board a layout wraps to, as the hooks measure it: in steps of 40 px. */
const step = (s: { width: number; height: number }): DiagramBoardSize => ({ width: Math.round(s.width / 40) * 40, height: Math.round(s.height / 40) * 40 });

/* ── The examples ── */

type Mode = 'read-only' | 'editable';
interface Case {
  name: string;
  /** Laid out by ELK (and wrapped for the board), or placed. */
  draft: (mode: Mode) => DiagramDraft | { placed: { nodes: DiagramNode[]; edges: DiagramEdge[] } };
  /** CloudflareDiagram wraps for its frame; StateDiagram for its board (which a column panel narrows); a plain Diagram
   *  laid out by the hook, for its host. */
  wrapsFor: 'frame' | 'board';
  autoSize: boolean;
  /** Whether a frame's panel can open beside it (a DiagramFrame around it). */
  panel: boolean;
  /** How a screen reader counts what a box holds, and the truth of it. */
  noun?: string | ((n: DiagramNode) => string);
  /** Which rules hold: all, or (past the routing passes' cap of 120 nodes and edges) attached and clear only. */
  rules?: 'all' | 'attached and clear';
  /** Frames it's whole in at a readable size (read-only and editable alike): what the critics have seen it do, kept. */
  whole?: readonly string[];
  /** What has the eye when it's run: a machine's current state and what it can send. */
  current?: (nodes: readonly DiagramNode[], edges: readonly DiagramEdge[]) => { nodes: string[]; edges: string[] };
}

const system = (services: CloudflareService[], edges: CloudflareEdge[], name: string, accountId?: string): CloudflareSystem => ({ services, edges, name, ...(accountId ? { accountId } : null) });
const cfNoun = (n: DiagramNode) => ((n.data as { service?: unknown } | undefined)?.service ? 'service' : n.id === CLOUDFLARE_SYSTEM_NODE ? 'system' : 'environment');
const laidCloudflare = (s: CloudflareSystem): Case['draft'] => (mode) => cloudflareBoardData(s, { editable: mode === 'editable' });
const placedCloudflare = (s: CloudflareSystem): Case['draft'] => (mode) => ({ placed: cloudflareBoardProps(s, { editable: mode === 'editable' }) });
const machine = (config: unknown): Case['draft'] => () => machineToDraft(createMachine(config as never) as never);
/** A machine's first state(s), and the transitions out of them it can take: what simulating starts on. */
const initial = (nodes: readonly DiagramNode[], edges: readonly DiagramEdge[]) => {
  const index = indexDiagram(nodes as DiagramNode[]);
  const root = nodes.find((n) => n.kind === 'root');
  const first = nodes.filter((n) => n.entry && n.kind !== 'marker' && index.parent.get(n.id) === root?.id).map((n) => n.id);
  return { nodes: first, edges: edges.filter((e) => first.includes(e.from)).map((e) => e.id) };
};
const workerd = readWorkerdConfig(WORKERD_CONFIG);
const WORKERD = workerd.ok ? placeInLayers({ ...workerd.system, name: 'config.capnp' }) : system([], [], 'none');
/** The docs' preset example: an API and what it binds, placed in layers, on a plain Diagram. */
const PRESET = system([
  { id: 'api', kind: 'workers', label: 'API' }, { id: 'files', kind: 'r2', label: 'Files' }, { id: 'jobs', kind: 'queues', label: 'Jobs' }, { id: 'db', kind: 'd1', label: 'Uploads' },
], [
  { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
  { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
  { id: 'api-db', from: 'api', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
], 'Cloudflare');

/** A generated machine (the round-8 critic's probe): a root of `states` states, a tree of transitions and `extra` more,
 *  or a chain; every fourth state with an entry action. */
function generated(states: number, extra: number, chain = false, seed = 7): DiagramDraft {
  let x = seed;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const nodes: DiagramDraft['nodes'][number][] = [{ id: 'root', kind: 'root', title: 'machine' }];
  for (let i = 0; i < states; i++) nodes.push({ id: `s${i}`, parent: 'root', title: `state${i}`, ...(i % 4 === 0 ? { sections: [{ title: 'Entry actions', items: [{ title: `act${i}`, icon: 'bolt' as const }] }] } : null) });
  const edges: DiagramEdge[] = [];
  for (let i = 1; i < states; i++) edges.push({ id: `t${i}`, from: `s${chain ? i - 1 : Math.floor(rnd() * i)}`, to: `s${i}`, title: `EV${i}` });
  for (let k = 0; k < extra; k++) { const a = Math.floor(rnd() * states), b = Math.floor(rnd() * states); if (a !== b) edges.push({ id: `x${k}`, from: `s${a}`, to: `s${b}`, title: `GO${k}` }); }
  return { nodes, edges };
}

const CASES: Case[] = [
  { name: 'Cloudflare: link shortener', draft: laidCloudflare(system(SMALL, SMALL_EDGES, 'Link shortener')), wrapsFor: 'frame', autoSize: true, panel: true, noun: cfNoun, whole: ['800x1000', '1280x800', '1600x900'] },
  { name: 'Cloudflare: file upload', draft: laidCloudflare(system(UPLOAD, UPLOAD_EDGES, 'File upload')), wrapsFor: 'frame', autoSize: true, panel: true, noun: cfNoun, whole: ['800x1000', '1280x800', '1600x900'] },
  { name: 'Cloudflare: docs search', draft: laidCloudflare(system(PLATFORM, PLATFORM_EDGES, 'Docs search', '4f1b9c2e7a')), wrapsFor: 'frame', autoSize: true, panel: true, noun: cfNoun },
  { name: 'Cloudflare: the studio’s example', draft: placedCloudflare(placeInLayers(STUDIO_EXAMPLE, { editable: true })), wrapsFor: 'frame', autoSize: true, panel: true, noun: cfNoun },
  { name: 'Cloudflare: a workerd config', draft: placedCloudflare(WORKERD), wrapsFor: 'frame', autoSize: true, panel: true, noun: cfNoun },
  { name: 'Cloudflare: the preset', draft: placedCloudflare(PRESET), wrapsFor: 'frame', autoSize: true, panel: false, noun: cfNoun },
  { name: 'State: Audio Player', draft: machine(parseXState(AUDIO_PLAYER_SOURCE)), wrapsFor: 'board', autoSize: false, panel: true, noun: 'state', current: initial },
  { name: 'State: 33 states', draft: machine((uploadMachine as unknown as { config: object }).config), wrapsFor: 'board', autoSize: false, panel: true, noun: 'state', current: initial },
  { name: 'State: each form of transition', draft: machine(TRANSITION_FORMS), wrapsFor: 'board', autoSize: false, panel: true, noun: 'state', current: initial },
  { name: 'State: several targets', draft: machine(SEVERAL_TARGETS), wrapsFor: 'board', autoSize: false, panel: true, noun: 'state', current: initial },
  { name: 'Diagram: statechart-like, laid out', draft: () => STATECHART_LIKE, wrapsFor: 'board', autoSize: false, panel: false },
  { name: 'Diagram: system-like, laid out', draft: () => SYSTEM_LIKE, wrapsFor: 'board', autoSize: false, panel: false },
  // Under the lane passes' cap (120 nodes and edges) and past the U-turn pass's (80): ELK's back edges stay as they are.
  { name: 'Generated: 45 states, 66 edges (past the U-turn pass)', draft: () => generated(45, 22), wrapsFor: 'board', autoSize: false, panel: false, rules: 'attached and clear' },
  { name: 'Generated: 20 states, 33 edges (under every cap)', draft: () => generated(20, 14), wrapsFor: 'board', autoSize: false, panel: false },
  { name: 'Generated: 52 states, 79 edges (past the cap)', draft: () => generated(52, 30), wrapsFor: 'board', autoSize: false, panel: false, rules: 'attached and clear' },
  { name: 'Generated: a chain of 62 (past the cap, wraps)', draft: () => generated(62, 4, true), wrapsFor: 'board', autoSize: false, panel: false, rules: 'attached and clear' },
  { name: 'Diagram: node kinds, hand-placed', draft: () => ({ placed: { nodes: KINDS, edges: [] } }), wrapsFor: 'board', autoSize: false, panel: false },
  { name: 'Diagram: edge kinds, hand-placed', draft: () => ({ placed: { nodes: EDGE_NODES, edges: EDGE_KINDS } }), wrapsFor: 'board', autoSize: false, panel: false },
];

/* ── Drawing one, as the components do ── */

const engine = createDiagramLayoutEngine();
const elkRuns = new Map<string, Promise<DiagramLayoutResult>>();
/** ELK's answer for a draft, once: what `useDiagramLayout` gets back from its worker, before it's wrapped. */
function elkOf(key: string, draft: DiagramDraft): Promise<DiagramLayoutResult> {
  let run = elkRuns.get(key);
  if (!run) {
    run = runLayout(draft, { text }, engine, toElkGraph(draft, { text }), false);
    elkRuns.set(key, run);
  }
  return run;
}

async function drawingOf(c: Case, mode: Mode, board: DiagramBoardSize): Promise<DiagramDrawing> {
  const made = c.draft(mode);
  let nodes: readonly DiagramNode[], edges: readonly DiagramEdge[];
  if ('placed' in made) ({ nodes, edges } = made.placed);
  else {
    const raw = await elkOf(`${c.name}\0${mode}`, made);
    ({ nodes, edges } = onLayout(made, finishLayout(raw, { board, text })));
  }
  // CloudflareDiagram sizes a placed board's cards to their words; a laid-out board's are sized by the layout.
  const sized = c.autoSize && 'placed' in made ? sizeNodesToText(nodes, text) : nodes.length <= AVOID_UP_TO ? growNodesToText(nodes, text) : nodes;
  return drawDiagram(sized, edges, text);
}

/* ── Geometry ── */

const ATTACH = 1.5;
/** A lane: what keeps a route from reading as part of a border, a card's side or another route; two routes closer than
 *  `EDGE_LANE` read as one (the critics' 8 to 12). */
const LANE = 6;
const EDGE_LANE = 10;
/** Longer than this, two lines that close are read as one (a crossing, or a stub out of a shared port, is shorter). */
const ALONG = 10;
const SHARED = 20;
/** What a box keeps between its walls (and its header and sections) and what it holds. */
const INSIDE_CLEAR = 8;
/** How far apart the ends of two different edges on one side of a card keep (round 9's F4). */
const END_APART = 8;

interface Seg { a: Pt; b: Pt; i: number }
const segs = (pts: readonly Pt[]): Seg[] => pts.slice(1).map((b, i) => ({ a: pts[i]!, b, i }));
const level = (s: Seg) => Math.abs(s.a.y - s.b.y) < 0.5;
const upright = (s: Seg) => Math.abs(s.a.x - s.b.x) < 0.5;
const len = (s: Seg) => Math.abs(s.a.x - s.b.x) + Math.abs(s.a.y - s.b.y);
const shrink = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });
const overlap1 = (a0: number, a1: number, b0: number, b1: number) => Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1));
/** Whether a square run goes into a rect's inside. */
const runIn = (s: Seg, r: Rect) => r.w > 0 && r.h > 0 && Math.max(s.a.x, s.b.x) > r.x && Math.min(s.a.x, s.b.x) < r.x + r.w && Math.max(s.a.y, s.b.y) > r.y && Math.min(s.a.y, s.b.y) < r.y + r.h;
const rectsMeet = (p: Rect, q: Rect) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
/** How far a point is from a rect's border (0 on it). */
const fromBorder = (p: Pt, r: Rect) => {
  const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  if (inside) return Math.min(p.x - r.x, r.x + r.w - p.x, p.y - r.y, r.y + r.h - p.y);
  const dx = Math.max(r.x - p.x, 0, p.x - r.x - r.w), dy = Math.max(r.y - p.y, 0, p.y - r.y - r.h);
  return Math.hypot(dx, dy);
};
const distToSeg = (p: Pt, s: Seg) => {
  const x = Math.min(Math.max(p.x, Math.min(s.a.x, s.b.x)), Math.max(s.a.x, s.b.x)), y = Math.min(Math.max(p.y, Math.min(s.a.y, s.b.y)), Math.max(s.a.y, s.b.y));
  return Math.hypot(p.x - x, p.y - y);
};
/** The four sides of a rect, and any other line a route mustn't run along (a box's hairline under its sections). */
const sidesOf = (r: Rect): Seg[] => [
  { a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y }, i: 0 }, { a: { x: r.x, y: r.y + r.h }, b: { x: r.x + r.w, y: r.y + r.h }, i: 1 },
  { a: { x: r.x, y: r.y }, b: { x: r.x, y: r.y + r.h }, i: 2 }, { a: { x: r.x + r.w, y: r.y }, b: { x: r.x + r.w, y: r.y + r.h }, i: 3 },
];
/** How long a run lies along a line, closer than `gap` to it. */
const alongBy = (s: Seg, line: Seg, gap: number) => {
  if (level(s) && level(line) && Math.abs(s.a.y - line.a.y) < gap) return overlap1(s.a.x, s.b.x, line.a.x, line.b.x);
  if (upright(s) && upright(line) && Math.abs(s.a.x - line.a.x) < gap) return overlap1(s.a.y, s.b.y, line.a.y, line.b.y);
  return 0;
};
const fmt = (p: Pt) => `${Math.round(p.x)},${Math.round(p.y)}`;
const fmtR = (r: Rect) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}`;

/** A box's header strip and sections: from its top to where what it holds starts. */
const headOf = (n: DiagramNode) => ({ x: n.x, y: n.y, w: n.w, h: Math.min(n.h, nodeAnatomy(n, text).top) });
const nameOf = (n: DiagramNode | undefined) => n?.title ?? n?.id ?? '?';

/* ── The rules ── */

function check(d: DiagramDrawing): string[] {
  const out: string[] = [];
  const { index } = d;
  const nodes = index.nodes;
  const cards = nodes.filter((n) => !holdsNodes(n) && n.kind !== 'marker');
  const boxes = nodes.filter((n) => holdsNodes(n));
  // An entry marker: a dot above the card's start corner and a curved arrow from it into the start side, beside the header.
  const markers = nodes.filter((n) => n.entry).map((n) => ({ n, r: { x: n.x - 22, y: n.y - 16, w: 22, h: 34 } }));
  const labelOf = new Map(d.labels.map((l) => [l.edge.id, l.box]));
  const routes = d.edges.map(({ edge, geometry }) => ({ edge, pts: geometry.pts }));
  const byEdge = new Map(routes.map((r) => [r.edge.id, r]));
  const lines = (n: DiagramNode): Seg[] => {
    const own = sidesOf(n);
    const head = headOf(n);
    // A box with sections ends them on a hairline.
    if (holdsNodes(n) && n.kind !== 'region' && head.h > 0 && head.h < n.h) own.push({ a: { x: n.x, y: n.y + head.h }, b: { x: n.x + n.w, y: n.y + head.h }, i: 4 });
    return n.kind === 'region' ? [] : own;
  };
  const dividers: Seg[] = d.dividers.map((v, i) => ({ a: { x: v.x1, y: v.y1 }, b: { x: v.x2, y: v.y2 }, i }));

  // 1. Attached: on what it claims, on a side clear of the corners, its end run square to that side and outside it.
  const CORNER = 6;
  for (const { edge, pts } of routes) {
    if (pts.length < 2) continue;
    const a = index.byId.get(edge.from), b = index.byId.get(edge.to);
    if (!a || !b) continue;
    const end = (n: DiagramNode, p: Pt, next: Pt, port: string | undefined, other: DiagramNode, which: 'start' | 'end') => {
      const say = (why: string) => out.push(`1 attached: ${edge.id} ${which}s at ${fmt(p)}, ${why}`);
      const pp = port ? n.ports?.find((q) => q.id === port) : undefined;
      if (pp) {
        // Edges that share a port leave it side by side, a few units apart along its side.
        const at = portPoint(n, pp).p;
        if (Math.hypot(at.x - p.x, at.y - p.y) > LANE || fromBorder(p, n) > ATTACH) say(`not at its port ${port} on ${nameOf(n)} (${fmt(at)})`);
        return;
      }
      if (which === 'start' && edge.forkOf) {
        const l = labelOf.get(edge.forkOf);
        if (!l || fromBorder(p, l) > ATTACH) say(`not on ${edge.forkOf}’s label${l ? ` (${fmtR(l)})` : ''}, which it forks from`);
        return;
      }
      if (n.kind === 'marker') {
        if (fromBorder(p, n) > ATTACH) say(`${Math.round(fromBorder(p, n))} off ${nameOf(n)}`);
        return;
      }
      // A box's own edge to what it holds starts (or ends) under its sections, on the hairline, and runs into the box.
      if (holdsNodes(n) && isInside(index, other.id, n.id)) {
        const top = n.y + headOf(n).h;
        if (Math.abs(p.y - top) > ATTACH || p.x <= n.x + CORNER || p.x >= n.x + n.w - CORNER) say(`not under ${nameOf(n)}’s sections (its hairline is at y ${Math.round(top)})`);
        else if (next.y < p.y - 0.5) say(`and runs up out of ${nameOf(n)}’s sections`);
        return;
      }
      const d = fromBorder(p, n);
      if (d > ATTACH) { say(`${Math.round(d)} off ${nameOf(n)} (${fmtR(n)})`); return; }
      const onX = Math.abs(p.x - n.x) <= ATTACH || Math.abs(p.x - n.x - n.w) <= ATTACH, onY = Math.abs(p.y - n.y) <= ATTACH || Math.abs(p.y - n.y - n.h) <= ATTACH;
      const cornerless = Math.min(n.w, n.h) >= 4 * CORNER;
      if (cornerless && onX && onY) { say(`on ${nameOf(n)}’s corner`); return; }
      if (cornerless && ((onX && (p.y < n.y + CORNER || p.y > n.y + n.h - CORNER)) || (onY && (p.x < n.x + CORNER || p.x > n.x + n.w - CORNER)))) say(`within ${CORNER} of ${nameOf(n)}’s corner`);
      // Square to its side, and from outside the card: an arrowhead into it, a line out of it. (A straight or a curved route
      // goes as it's asked to.)
      if (edge.route === 'straight' || edge.route === 'curve') return;
      const out0 = onX ? { x: Math.abs(p.x - n.x) <= ATTACH ? -1 : 1, y: 0 } : { x: 0, y: Math.abs(p.y - n.y) <= ATTACH ? -1 : 1 };
      const run = { x: next.x - p.x, y: next.y - p.y };
      if (run.x * out0.x + run.y * out0.y <= 0.5 || Math.abs(run.x * out0.y) + Math.abs(run.y * out0.x) > 0.5) say(`not square out of ${nameOf(n)}’s side (its run there goes ${fmt(p)}→${fmt(next)})`);
    };
    end(a, pts[0]!, pts[1]!, edge.fromPort, b, 'start');
    end(b, pts[pts.length - 1]!, pts[pts.length - 2]!, edge.toPort, a, 'end');
  }
  // Ends of different edges on one side of a card keep apart (unless they share a port, which spreads them by a few
  // units): an arrowhead that lands where another edge leaves reads as one line through the wall.
  const sideEnds = new Map<string, { edge: DiagramEdge; p: Pt; which: 'start' | 'end'; port?: string }[]>();
  for (const { edge, pts } of routes) {
    if (pts.length < 2 || edge.from === edge.to) continue;
    for (const [which, id, p, port] of [['start', edge.from, pts[0]!, edge.fromPort], ['end', edge.to, pts[pts.length - 1]!, edge.toPort]] as const) {
      if (which === 'start' && edge.forkOf) continue;
      const n = index.byId.get(id);
      if (!n || n.kind === 'marker' || fromBorder(p, n) > ATTACH) continue;
      // A box's own edge to what it holds starts under its sections, not on a side.
      const other = index.byId.get(which === 'start' ? edge.to : edge.from);
      if (holdsNodes(n) && other && isInside(index, other.id, n.id)) continue;
      const side = Math.abs(p.y - n.y) <= ATTACH ? 'top' : Math.abs(p.y - n.y - n.h) <= ATTACH ? 'foot' : Math.abs(p.x - n.x) <= ATTACH ? 'start' : 'end';
      const key = `${n.id}\0${side}`;
      sideEnds.set(key, [...(sideEnds.get(key) ?? []), { edge, p, which, port }]);
    }
  }
  for (const [key, list] of sideEnds) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const u = list[i]!, v = list[j]!;
      if (u.edge.id === v.edge.id || (u.port && u.port === v.port)) continue;
      const apart = Math.hypot(u.p.x - v.p.x, u.p.y - v.p.y);
      if (apart >= END_APART) continue;
      const [id, side] = key.split('\0') as [string, string];
      const what = u.which !== v.which ? `${(u.which === 'end' ? u : v).edge.id}’s arrowhead lands on ${(u.which === 'end' ? v : u).edge.id}’s start` : `${u.edge.id} and ${v.edge.id} ${u.which === 'end' ? 'arrive' : 'leave'} at one point`;
      out.push(`1 attached: ${what} on ${nameOf(index.byId.get(id))}’s ${side} (${Math.round(apart)} apart at ${fmt(u.p)})`);
    }
  }

  // 2. Clear: of cards, markers, heads, borders and dividers.
  for (const { edge, pts } of routes) {
    for (const s of segs(pts)) {
      for (const c of cards) if (runIn(s, shrink(c, ATTACH))) out.push(`2 clear: ${edge.id} runs through ${nameOf(c)} (${fmt(s.a)}→${fmt(s.b)})`);
      for (const { n, r } of markers) if (runIn(s, shrink(r, 2))) out.push(`2 clear: ${edge.id} runs over ${nameOf(n)}’s entry marker (${fmt(s.a)}→${fmt(s.b)})`);
      for (const box of boxes) {
        const head = headOf(box);
        if (box.kind !== 'region' && head.h > 0 && runIn(s, shrink(head, ATTACH))) out.push(`2 clear: ${edge.id} runs through ${nameOf(box)}’s header and sections (${fmt(s.a)}→${fmt(s.b)})`);
        for (const line of lines(box)) {
          // A lane off a wall (round 9's F8: a fork 9 px inside `playing`'s); a hairline, J4's 6.
          const by = alongBy(s, line, line.i === 4 ? LANE : EDGE_LANE);
          if (by > ALONG) out.push(`2 clear: ${edge.id} runs ${Math.round(by)} along ${nameOf(box)}’s ${['top', 'foot', 'start side', 'end side', 'hairline'][line.i]} (${fmt(s.a)}→${fmt(s.b)})`);
        }
      }
      for (const c of cards) for (const line of sidesOf(c)) {
        const by = alongBy(s, line, 4);
        if (by > ALONG) out.push(`2 clear: ${edge.id} runs ${Math.round(by)} along ${nameOf(c)}’s side (${fmt(s.a)}→${fmt(s.b)})`);
      }
      for (const v of dividers) { const by = alongBy(s, v, LANE); if (by > ALONG) out.push(`2 clear: ${edge.id} runs ${Math.round(by)} along a region divider (${fmt(s.a)}→${fmt(s.b)})`); }
    }
    // Nor does it start or end where a divider meets a box's border: it would read as the divider going on.
    for (const p of [pts[0]!, pts[pts.length - 1]!]) for (const v of dividers) {
      const meets = [v.a, v.b].some((q) => Math.hypot(q.x - p.x, q.y - p.y) < LANE + 2) || (upright(v) && Math.abs(v.a.x - p.x) < EDGE_LANE + 4 && (Math.abs(Math.min(v.a.y, v.b.y) - p.y) < 40 || Math.abs(Math.max(v.a.y, v.b.y) - p.y) < 40));
      if (meets) out.push(`2 clear: ${edge.id} ends at ${fmt(p)}, where a region divider meets the border`);
    }
  }
  for (const n of nodes) {
    const p = n.parent ? index.byId.get(n.parent) : undefined;
    if (!p || p.kind === 'region' || n.kind === 'region') continue;
    const head = headOf(p), r = n.kind === 'marker' ? n : n;
    const gaps = { top: r.y - (p.y + head.h), start: r.x - p.x, end: p.x + p.w - (r.x + r.w), foot: p.y + p.h - (r.y + r.h) };
    for (const [side, g] of Object.entries(gaps)) if (g < INSIDE_CLEAR - 0.5) out.push(`2 clear: ${nameOf(n)} is ${Math.round(g)} from ${nameOf(p)}’s ${side === 'top' ? 'header and sections' : `${side} wall`}`);
  }

  // 3. A lane and a label of its own.
  const forks = (e: DiagramEdge, f: DiagramEdge) => e.forkOf === f.id || f.forkOf === e.id || (!!e.forkOf && e.forkOf === f.forkOf);
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    const p = routes[i]!, q = routes[j]!;
    if (forks(p.edge, q.edge)) continue;
    let worst = 0, at: Seg | null = null;
    for (const s of segs(p.pts)) for (const t of segs(q.pts)) { const by = alongBy(s, t, EDGE_LANE); if (by > worst) { worst = by; at = s; } }
    if (worst > SHARED) out.push(`3 lanes: ${p.edge.id} and ${q.edge.id} share a lane for ${Math.round(worst)} (${fmt(at!.a)}→${fmt(at!.b)})`);
  }
  for (const { edge, box: l } of d.labels) {
    const own = byEdge.get(edge.id);
    const mid = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
    if (own && !segs(own.pts).some((s) => runIn(s, shrink(l, 1)) || distToSeg(mid, s) <= 3)) out.push(`3 labels: ${edge.id}’s label (${fmtR(l)}) isn’t on its route`);
    const inner = shrink(l, 1);
    for (const r of routes) if (r.edge.id !== edge.id && !forks(r.edge, edge) && segs(r.pts).some((s) => runIn(s, inner))) out.push(`3 labels: ${r.edge.id} runs through ${edge.id}’s label`);
    for (const c of cards) if (rectsMeet(inner, c)) out.push(`3 labels: ${edge.id}’s label is on ${nameOf(c)}`);
    for (const { n, r } of markers) if (rectsMeet(inner, r)) out.push(`3 labels: ${edge.id}’s label is on ${nameOf(n)}’s entry marker`);
    for (const o of d.labels) if (o.edge.id < edge.id && rectsMeet(inner, o.box)) out.push(`3 labels: ${edge.id}’s label is on ${o.edge.id}’s`);
    for (const box of boxes) {
      if (box.kind !== 'region' && rectsMeet(inner, headOf(box))) out.push(`3 labels: ${edge.id}’s label is on ${nameOf(box)}’s header and sections`);
      for (const line of lines(box)) if (runIn(line, inner)) out.push(`3 labels: ${edge.id}’s label straddles ${nameOf(box)}’s ${['top', 'foot', 'start side', 'end side', 'hairline'][line.i]}`);
    }
    for (const v of dividers) if (runIn(v, shrink(l, -LANE / 2))) out.push(`3 labels: ${edge.id}’s label is on a region divider`);
  }

  // 4. No U-turn.
  const facing = (from: Rect, to: Rect, n: Pt) => {
    const c = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    return n.x > 0 ? c.x > from.x + from.w : n.x < 0 ? c.x < from.x : n.y > 0 ? c.y > from.y + from.h : c.y < from.y;
  };
  const sideAt = (r: Rect, p: Pt): Pt => {
    const ds = [Math.abs(p.y - r.y), Math.abs(p.x - (r.x + r.w)), Math.abs(p.y - (r.y + r.h)), Math.abs(p.x - r.x)];
    const k = ds.indexOf(Math.min(...ds));
    return [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }][k]!;
  };
  /** The fewest bends between a side of `a` that faces `b` and a side of `b` that faces `a`, with nothing in the way. */
  const fewest = (a: Rect, b: Rect) => {
    const across = overlap1(a.x, a.x + a.w, b.x, b.x + b.w) > 16, down = overlap1(a.y, a.y + a.h, b.y, b.y + b.h) > 16;
    if (across || down) return 0;
    return 1;
  };
  for (const { edge, pts } of routes) {
    if (pts.length < 2 || edge.from === edge.to || edge.forkOf) continue;
    const a = index.byId.get(edge.from), b = index.byId.get(edge.to);
    if (!a || !b || isInside(index, a.id, b.id) || isInside(index, b.id, a.id) || a.kind === 'marker') continue;
    const bends = pts.length - 2;
    const least = fewest(a, b);
    const out0 = facing(a, b, sideAt(a, pts[0]!)), in0 = facing(b, a, sideAt(b, pts[pts.length - 1]!));
    if ((!out0 || !in0) && bends >= least + 3) out.push(`4 U-turn: ${edge.id} ${!out0 ? `leaves ${nameOf(a)} by a side away from ${nameOf(b)}` : `enters ${nameOf(b)} by its far side`} and takes ${bends} bends where ${least} would do`);
  }
  return out;
}

/** 6: the opening view (and the view that keeps what has the eye) shows the top-start corner, and what has the eye. The view
 *  is the component's (`firstView`, then `keepInView`); what's checked of it is plain geometry. */
function checkView(d: DiagramDrawing, frame: Frame, panel: boolean, eyeIds: { nodes: string[]; edges: string[] } | null): string[] {
  const out: string[] = [];
  const { size, pad } = boardOf(frame, panel);
  let view = firstView(d.bounds, size, pad);
  const corner = drawingCorner(d, text);
  let must: Rect | null = null, want: Rect | null = null;
  if (eyeIds) {
    const union = (rs: Rect[]) => (rs.length ? { x: Math.min(...rs.map((r) => r.x)), y: Math.min(...rs.map((r) => r.y)), w: Math.max(...rs.map((r) => r.x + r.w)) - Math.min(...rs.map((r) => r.x)), h: Math.max(...rs.map((r) => r.y + r.h)) - Math.min(...rs.map((r) => r.y)) } : null);
    must = union(eyeIds.nodes.flatMap((id) => { const n = d.index.byId.get(id); return n ? [n] : []; }));
    want = union(eyeIds.edges.flatMap((id) => { const l = d.labels.find((x) => x.edge.id === id)?.box; return l ? [l] : []; }));
    if (must) view = keepInView(view, { must, want }, corner, size, pad);
  } else {
    // Nothing selected or current: where it starts (a machine's first state) has the eye.
    const start = diagramStartEye(d);
    if (start) { must = start.must; view = keepInView(view, start, corner, size, pad); }
  }
  const free = { w: size.width - pad.left - pad.right, h: size.height - pad.top - pad.bottom };
  const shown = (r: Rect) => {
    const x0 = r.x * view.zoom + view.x, y0 = r.y * view.zoom + view.y;
    return x0 >= pad.left - 1 && y0 >= pad.top - 1 && x0 + r.w * view.zoom <= size.width - pad.right + 1 && y0 + r.h * view.zoom <= size.height - pad.bottom + 1;
  };
  const readable = (r: Rect) => r.w * DIAGRAM_LEGIBLE_ZOOM <= free.w && r.h * DIAGRAM_LEGIBLE_ZOOM <= free.h;
  const where = `${frame.name}${panel ? ', panel open' : ''} (zoom ${view.zoom.toFixed(2)}, at ${Math.round(view.x)},${Math.round(view.y)})`;
  const both = (p: Rect, q: Rect) => ({ x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.max(p.x + p.w, q.x + q.w) - Math.min(p.x, q.x), h: Math.max(p.y + p.h, q.y + q.h) - Math.min(p.y, q.y) });
  if (must && readable(must) && !shown(must)) out.push(`6 view: what has the eye (${fmtR(must)}) is out of view at ${where}`);
  if (must && want && readable(both(must, want)) && !shown(want)) out.push(`6 view: what it can do now (${fmtR(want)}) is out of view, though there’s room, at ${where}`);
  // The corner: always without an eye; with one, when the two can be read at once.
  const eyeAll = must && want && readable(both(must, want)) ? both(must, want) : must;
  if (corner && (!eyeAll || readable(both(corner, eyeAll))) && !shown(corner)) out.push(`6 view: the top-start corner (${fmtR(corner)}) is out of view at ${where}${must ? ', with what has the eye' : ''}`);
  const whole = d.bounds ? Math.min(1, free.w / d.bounds.w, free.h / d.bounds.h) : 1;
  if (view.zoom < Math.min(DIAGRAM_LEGIBLE_ZOOM, whole) - 0.001) out.push(`6 view: opens at ${view.zoom.toFixed(2)}, under the readable ${DIAGRAM_LEGIBLE_ZOOM}`);
  return out;
}

/** 5: the frame is used. */
function checkShape(d: DiagramDrawing, frame: Frame, panel: boolean): string[] {
  const { visible } = boardOf(frame, panel);
  const b = d.bounds;
  if (!b) return [];
  // Text here is estimated, a little wider than a browser's: 1% of slack on the readable floor.
  const fits = Math.min(visible.w / b.w, visible.h / b.h) >= DIAGRAM_LEGIBLE_ZOOM * 0.99;
  if (fits) return [];
  const aspect = (b.w / b.h) / (visible.w / visible.h);
  const fillsWidth = b.w * DIAGRAM_LEGIBLE_ZOOM >= visible.w * 0.6;
  return aspect <= 2 && aspect >= 0.5 || fillsWidth ? [] : [`5 frame: ${Math.round(b.w)}×${Math.round(b.h)} doesn’t fit ${visible.w}×${visible.h} at a readable size, isn’t its shape (${aspect.toFixed(2)}×) and doesn’t fill its width`];
}

/** 7: a box holding N things holds N of them. */
function checkAnnounced(d: DiagramDrawing, noun: Case['noun'], describe: (n: DiagramNode) => string): string[] {
  if (!noun) return [];
  const out: string[] = [];
  const nounOf = typeof noun === 'string' ? () => noun : noun;
  for (const n of d.index.nodes) {
    const kids = d.index.children.get(n.id) ?? [];
    if (!kids.length) continue;
    const said = describe(n);
    const m = /holding ([^.(]*)/.exec(said);
    if (!m) { out.push(`7 announced: ${nameOf(n)} doesn’t say what it holds: “${said.slice(0, 80)}”`); continue; }
    const counts = new Map<string, number>();
    for (const k of kids) counts.set(nounOf(k), (counts.get(nounOf(k)) ?? 0) + 1);
    for (const [what, count] of counts) {
      const re = new RegExp(`\\b${count} ${what}${count === 1 ? '' : 's'}\\b`);
      if (!re.test(m[1]!)) out.push(`7 announced: ${nameOf(n)} says “holding ${m[1]!.trim()}”, and holds ${count} ${what}${count === 1 ? '' : 's'}`);
    }
  }
  return out;
}

/* ── The matrix ── */

const MODES: Mode[] = ['read-only', 'editable'];

for (const c of CASES) {
  describe(c.name, () => {
    for (const frame of FRAMES) {
      for (const panel of c.panel ? [false, true] : [false]) {
        // A panel that only covers the board (a drawer, a pushed page) changes nothing drawn.
        if (panel && frame.width < CHROME.columnFrom) continue;
        it(`${frame.name}${panel ? ', panel open' : ''}`, async () => {
          const { size } = boardOf(frame, panel);
          const board = step(c.wrapsFor === 'frame' ? frame : size);
          const found: string[] = [];
          const drawn = new Map<Mode, DiagramDrawing>();
          for (const mode of MODES) {
            const d = await drawingOf(c, mode, board);
            drawn.set(mode, d);
            for (const v of check(d)) found.push(`${mode}: ${v}`);
            for (const v of checkShape(d, frame, panel)) found.push(`${mode}: ${v}`);
            if (c.whole?.includes(frame.name) && !panel && d.bounds) {
              const { visible } = boardOf(frame, false);
              const zoom = Math.min(visible.w / d.bounds.w, visible.h / d.bounds.h);
              if (zoom < DIAGRAM_LEGIBLE_ZOOM * 0.99) found.push(`${mode}: 5 frame: isn’t whole at a readable size (${Math.round(d.bounds.w)}×${Math.round(d.bounds.h)} at ${zoom.toFixed(2)} in ${visible.w}×${visible.h})`);
            }
            for (const v of checkView(d, frame, panel, null)) found.push(`${mode}: ${v}`);
            if (c.current) {
              const eye = c.current(d.index.nodes, d.edges.map((e) => e.edge));
              for (const v of checkView(d, frame, panel, eye)) found.push(`${mode}, simulating: ${v}`);
            }
            const at = edgesByNode(d.edges.map((e) => e.edge));
            // Said with what the component passes (CloudflareDiagram: `cloudflareNoun`), counted with this suite's own truth.
            const said = typeof c.noun === 'function' ? cloudflareNoun : c.noun;
            for (const v of checkAnnounced(d, c.noun, (n) => describeNode(n, d.index, at.get(n.id), said))) found.push(`${mode}: ${v}`);
          }
          // 5: being editable adds dots, never a different layout.
          const ro = drawn.get('read-only')!, ed = drawn.get('editable')!;
          for (const n of ro.index.nodes) {
            const m = ed.index.byId.get(n.id);
            if (!m) { found.push(`5 frame: ${nameOf(n)} isn’t on the editable board`); continue; }
            if (Math.abs(m.x - n.x) > 0.5 || Math.abs(m.y - n.y) > 0.5 || Math.abs(m.w - n.w) > 0.5 || Math.abs(m.h - n.h) > 0.5) found.push(`5 frame: editable, ${nameOf(n)} is at ${fmtR(m)}, read-only at ${fmtR(n)}`);
          }
          const kept = c.rules === 'attached and clear' ? found.filter((v) => /: [12] (attached|clear):/.test(v)) : found;
          if (DUMP && c.rules === 'attached and clear') appendFileSync(DUMP, found.filter((v) => !kept.includes(v)).map((v) => `(past the cap, recorded) ${c.name} | ${frame.name} | ${v}\n`).join(''));
          const unique = [...new Set(kept)];
          if (DUMP && unique.length) appendFileSync(DUMP, unique.map((v) => `${c.name} | ${frame.name}${panel ? ', panel open' : ''} | ${v}\n`).join(''));
          expect(unique).toEqual([]);
          // A generated machine's wrapping is the slow part: about a second a frame on its own, several in a busy workspace run.
        }, 30_000);
      }
    }
  });
}

/* ══ Editing ══
   What a person does with an editable board, step by step, through what the components run for each step: a Cloudflare
   board laid out once, then a service added from the catalog, two connected, a connected service deleted, each undone and
   redone, and Tidy up; a machine with a state added, connected and renamed. After every step the drawing is held to the
   rules above, and to what editing promises:
   - stable: no card the step didn't touch has moved (Tidy up and the first layout lay out; nothing else does);
   - placed: a new card is clear of every card, label, entry marker and box header, inside its box (rule 2 sees to that);
   - tidy: after Tidy up the board is the read-only layout of the same system;
   - in view: what the step made (the new card; a new connection's label, and its two ends when they can be read with it)
     is on the board the panel leaves, by the least pan from where the view was.
   A machine is laid out again on every edit (as XState's editor does); what was edited has to be in view after it. */

interface Step { name: string; system: CloudflareSystem; drawn: CloudflareDrawn; drawing: DiagramDrawing; select: { nodes: string[]; edges: string[] }; touched: ReadonlySet<string>; tidy?: boolean }

const laidCache = new Map<string, Promise<CloudflareDrawn>>();
/** What CloudflareDiagram draws for a system: with no places, its layout for the frame (the read-only pipeline); with places,
 *  what it drew last kept, and the change drawn into it. */
async function cloudflareStep(system: CloudflareSystem, was: CloudflareDrawn | null, board: DiagramBoardSize, mode: Mode = 'editable'): Promise<{ drawn: CloudflareDrawn; drawing: DiagramDrawing }> {
  if (!system.services.some((s) => s.at)) {
    const draft = cloudflareBoardData(system, { editable: mode === 'editable' });
    const key = JSON.stringify([mode, board, system.name, system.services.map((s) => s.id), system.edges.map((e) => [e.id, e.from, e.to])]);
    let run = laidCache.get(key);
    if (!run) {
      run = elkOf(key, draft as DiagramDraft).then((raw) => ({ ...onLayout(draft as DiagramDraft, finishLayout(raw, { board, text })), sized: true }) as CloudflareDrawn);
      laidCache.set(key, run);
    }
    const drawn = await run;
    return { drawn, drawing: drawDiagram(drawn.nodes.length <= AVOID_UP_TO ? growNodesToText(drawn.nodes, text) : drawn.nodes, drawn.edges, text) };
  }
  const kept = cloudflareKeptBoard(system, was, { editable: mode === 'editable', issues: validateSystem(system), text });
  const drawn = { nodes: kept.nodes, edges: kept.edges, sized: kept.sized };
  const sized = kept.sized ? growNodesToText(kept.nodes, text) : sizeNodesToText(kept.nodes, text);
  return { drawn, drawing: drawDiagram(sized, kept.edges, text) };
}

/** A connection the catalog allows from one service to another, by the first pair of ports it takes (as a drag between two
 *  cards does). */
function connection(system: CloudflareSystem, from: string, to: string): CloudflareEdge {
  const a = system.services.find((s) => s.id === from)!, b = system.services.find((s) => s.id === to)!;
  for (const p of servicePorts(a.kind).filter((x) => x.direction === 'out')) for (const q of servicePorts(b.kind).filter((x) => x.direction === 'in')) {
    if (!linkBetween(a.kind, p.id, b.kind, q.id).ok) continue;
    const edge = newEdge(system.services, system.edges, { from, fromPort: p.id, to, toPort: q.id });
    if (edge) return edge;
  }
  throw new Error(`The catalog has no way from ${from} to ${to}`);
}

const cardsOf = (d: DiagramDrawing) => d.index.nodes.filter((n) => !holdsNodes(n) && n.kind !== 'marker');

/** Stable: what the step didn't touch is where it was. */
function checkStable(before: DiagramDrawing, after: DiagramDrawing, touched: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const n of cardsOf(before)) {
    if (touched.has(n.id)) continue;
    const m = after.index.byId.get(n.id);
    if (!m) continue;
    if (Math.abs(m.x - n.x) > 0.5 || Math.abs(m.y - n.y) > 0.5) out.push(`stable: ${nameOf(n)} moved from ${fmt(n)} to ${fmt(m)}`);
  }
  return out;
}

/** Placed: a new card is clear of what's there (cards, labels, markers, the header and sections of every box it's in or
 *  near); inside its box is rule 2's. */
function checkPlaced(d: DiagramDrawing, id: string): string[] {
  const out: string[] = [];
  const n = d.index.byId.get(id);
  if (!n) return [`placed: ${id} isn’t drawn`];
  for (const c of cardsOf(d)) if (c.id !== id && rectsMeet(n, c)) out.push(`placed: ${nameOf(n)} is on ${nameOf(c)}`);
  for (const l of d.labels) if (rectsMeet(n, l.box)) out.push(`placed: ${nameOf(n)} is on ${l.edge.id}’s label`);
  for (const m of d.index.nodes) if (m.entry && m.id !== id && rectsMeet(n, { x: m.x - 22, y: m.y - 16, w: 22, h: 34 })) out.push(`placed: ${nameOf(n)} is on ${nameOf(m)}’s entry marker`);
  for (const b of d.index.nodes.filter((x) => holdsNodes(x) && x.kind !== 'region')) {
    if (rectsMeet(n, headOf(b))) out.push(`placed: ${nameOf(n)} is on ${nameOf(b)}’s header and sections`);
    // A box it isn't in: not on it at all.
    if (!isInside(d.index, id, b.id) && rectsMeet(n, b)) out.push(`placed: ${nameOf(n)} is on ${nameOf(b)}, which it isn’t in`);
  }
  return out;
}

/** In view: the view after a step is the least pan (`keepInView`) from the one before, on the board the panel leaves, and
 *  what the step made is in it (an edge's two ends with its label, when they can be read together). */
function checkInView(d: DiagramDrawing, frame: Frame, view: Viewport, select: { nodes: string[]; edges: string[] }, what: string): { found: string[]; view: Viewport } {
  const { size, pad } = boardOf(frame, true);
  const eye = diagramEye(d, select, null, { ends: true });
  if (!eye) return { found: [`in view: ${what} has nothing to keep in view`], view };
  const next = keepInView(view, eye, drawingCorner(d, text), size, pad);
  const free = { w: size.width - pad.left - pad.right, h: size.height - pad.top - pad.bottom };
  const shown = (r: Rect) => {
    const x0 = r.x * next.zoom + next.x, y0 = r.y * next.zoom + next.y;
    return x0 >= pad.left - 1 && y0 >= pad.top - 1 && x0 + r.w * next.zoom <= size.width - pad.right + 1 && y0 + r.h * next.zoom <= size.height - pad.bottom + 1;
  };
  const found: string[] = [];
  const where = `${frame.name}, panel open (zoom ${next.zoom.toFixed(2)})`;
  for (const id of select.nodes) { const n = d.index.byId.get(id); if (n && !shown(n)) found.push(`in view: ${what}, ${nameOf(n)} (${fmtR(n)}) isn’t on the board at ${where}`); }
  for (const id of select.edges) {
    const label = d.labels.find((l) => l.edge.id === id)?.box;
    const e = d.edges.find((x) => x.edge.id === id)?.edge;
    if (label && !shown(label)) found.push(`in view: ${what}, ${id}’s label isn’t on the board at ${where}`);
    const ends = e ? [d.index.byId.get(e.from), d.index.byId.get(e.to)].filter((n): n is DiagramNode => !!n) : [];
    const all = [...ends, ...(label ? [label] : [])];
    const box = { x: Math.min(...all.map((r) => r.x)), y: Math.min(...all.map((r) => r.y)), w: 0, h: 0 };
    box.w = Math.max(...all.map((r) => r.x + r.w)) - box.x; box.h = Math.max(...all.map((r) => r.y + r.h)) - box.y;
    if (all.length && box.w * DIAGRAM_LEGIBLE_ZOOM <= free.w && box.h * DIAGRAM_LEGIBLE_ZOOM <= free.h) {
      for (const n of ends) if (!shown(n)) found.push(`in view: ${what}, ${id}’s end ${nameOf(n)} is under the panel or off the board at ${where}`);
    }
  }
  return { found, view: next };
}

interface EditCase { name: string; system: CloudflareSystem; connect: [string, string]; addThenConnect: string; remove: string }
const EDIT_CASES: EditCase[] = [
  { name: 'link shortener', system: system(SMALL, SMALL_EDGES, 'Link shortener'), connect: ['shortener', 'links'], addThenConnect: 'shortener', remove: 'links' },
  { name: 'file upload', system: system(UPLOAD, UPLOAD_EDGES, 'File upload'), connect: ['api', 'db'], addThenConnect: 'api', remove: 'files' },
  { name: 'docs search', system: system(PLATFORM, PLATFORM_EDGES, 'Docs search', '4f1b9c2e7a'), connect: ['gateway', 'docs'], addThenConnect: 'indexer', remove: 'cache' },
];
/** What the catalog search offers first for "kv", which Enter adds (the round-9 critic's step). */
const KV = searchCatalog('kv', 6)[0]!.id;
const stripped = (s: CloudflareSystem): CloudflareSystem => ({ ...s, services: s.services.map(({ at: _, ...rest }) => rest) });

for (const c of EDIT_CASES) {
  describe(`Editing Cloudflare: ${c.name}`, () => {
    for (const frame of FRAMES) {
      it(frame.name, async () => {
        const board = step(frame);
        const found: string[] = [];
        const say = (at: string, list: string[]) => { for (const v of list) found.push(`${at}: ${v}`); };
        const { size, pad } = boardOf(frame, false);
        const first = await cloudflareStep(c.system, null, board);
        let view = firstView(first.drawing.bounds, size, pad);
        const steps: Step[] = [{ name: 'laid out', system: c.system, ...first, select: { nodes: [], edges: [] }, touched: new Set() }];
        const hold = (s: Step, before: Step, made: string) => {
          say(s.name, check(s.drawing));
          say(s.name, checkShape(s.drawing, frame, false));
          say(s.name, checkAnnounced(s.drawing, cfNoun, (n) => describeNode(n, s.drawing.index, edgesByNode(s.drawing.edges.map((e) => e.edge)).get(n.id), cloudflareNoun)));
          if (!s.tidy) say(s.name, checkStable(before.drawing, s.drawing, s.touched));
          if (s.select.nodes.length || s.select.edges.length) {
            const seen = checkInView(s.drawing, frame, view, s.select, made);
            say(s.name, seen.found);
            view = seen.view;
          }
        };
        const run = async (name: string, from: Step, next: CloudflareSystem, select: Step['select'], touched: string[], made: string, tidy = false) => {
          // As the component makes an edit: places written down, the board drawn from what it drew, its places written back.
          const edit = tidy ? null : cloudflareEdit(next, from.drawn, { editable: true, issues: validateSystem(next), text });
          const d = tidy ? await cloudflareStep(stripped(next), null, board) : await cloudflareStep(edit!.system, edit!.drawn ?? from.drawn, board);
          const s: Step = { name, system: tidy ? cloudflarePlaces(stripped(next), d.drawn) : edit!.system, ...d, select, touched: new Set(touched), tidy };
          hold(s, from, made);
          return s;
        };
        const s0 = steps[0]!;
        // A service from the catalog, with nothing selected: at the middle of the view.
        const center = { x: (size.width / 2 - view.x) / view.zoom, y: (size.height / 2 - view.y) / view.zoom };
        const added = cloudflareAddService(cloudflarePlaces(s0.system, s0.drawn), KV, s0.drawn, { center, text });
        const s1 = await run('add from the catalog', s0, added.system, { nodes: [added.id], edges: [] }, [added.id], `the new ${KV}`);
        say('add from the catalog', checkPlaced(s1.drawing, added.id));
        // Undo is what was there; redo, what was made.
        const u1 = await cloudflareStep(s0.system, s1.drawn, board);
        say('undo the add', checkStable(s0.drawing, u1.drawing, new Set()));
        const r1 = await cloudflareStep(s1.system, u1.drawn, board);
        say('redo the add', checkStable(s1.drawing, r1.drawing, new Set()));
        // Two services connected (the first edit on the board).
        const edge = connection(s0.system, c.connect[0], c.connect[1]);
        const placed0 = cloudflarePlaces(s0.system, s0.drawn);
        const s2 = await run('connect', s0, { ...placed0, edges: [...placed0.edges, edge] }, { nodes: [], edges: [edge.id] }, [], `${edge.id}`);
        const u2 = await cloudflareStep(s0.system, s2.drawn, board);
        say('undo the connection', checkStable(s0.drawing, u2.drawing, new Set()));
        // Added, then connected to.
        const edge2 = connection(s1.system, c.addThenConnect, added.id);
        const placed1 = cloudflarePlaces(s1.system, s1.drawn);
        const s3 = await run('add, then connect', s1, { ...placed1, edges: [...placed1.edges, edge2] }, { nodes: [], edges: [edge2.id] }, [], `${edge2.id}`);
        // A service renamed to something longer: its card grows where there's room, or goes to free room; nothing else moves.
        const renamed = await run('rename', s3, { ...s3.system, services: s3.system.services.map((x) => (x.id === c.remove ? { ...x, label: 'A much longer name than before' } : x)) }, { nodes: [c.remove], edges: [] }, [c.remove], `the renamed ${c.remove}`);
        say('rename', checkPlaced(renamed.drawing, c.remove));
        // A connected service deleted.
        const s4 = await run('delete a connected service', renamed, removeServices(renamed.system, [c.remove]), { nodes: [], edges: [] }, [c.remove], 'the deletion');
        const u4 = await cloudflareStep(renamed.system, s4.drawn, board);
        say('undo the deletion', checkStable(renamed.drawing, u4.drawing, new Set()));
        // Tidy up: the read-only layout of the same system.
        const s5 = await run('Tidy up', s4, s4.system, { nodes: [], edges: [] }, [], 'Tidy up', true);
        const ro = await cloudflareStep(stripped(s4.system), null, board, 'read-only');
        for (const n of cardsOf(ro.drawing)) {
          const m = s5.drawing.index.byId.get(n.id);
          if (!m || Math.abs(m.x - n.x) > 0.5 || Math.abs(m.y - n.y) > 0.5) found.push(`Tidy up: ${nameOf(n)} is at ${m ? fmtR(m) : 'nowhere'}, read-only at ${fmtR(n)}`);
        }
        if (!s5.system.services.every((s) => s.at)) found.push('Tidy up: the system doesn’t say where its services are');
        const unique = [...new Set(found)];
        if (DUMP && unique.length) appendFileSync(DUMP, unique.map((v) => `Editing ${c.name} | ${frame.name} | ${v}\n`).join(''));
        expect(unique).toEqual([]);
      }, 60_000);
    }
  });
}

/* A machine laid out again on each edit: a state added at the root, connected from the start, renamed. */
describe('Editing a machine: the Audio Player', () => {
  for (const frame of FRAMES) {
    it(frame.name, async () => {
      const found: string[] = [];
      const panel = frame.width >= CHROME.columnFrom;
      const { size, pad } = boardOf(frame, panel);
      const board = step(size);
      let config = parseXState(AUDIO_PLAYER_SOURCE) as Record<string, unknown>;
      const draw = async (cfg: Record<string, unknown>, key: string) => {
        const draft = machineToDraft(createMachine(cfg as never) as never);
        const raw = await elkOf(`machine edit\0${key}`, draft);
        const { nodes, edges } = onLayout(draft, finishLayout(raw, { board, text }));
        return drawDiagram(nodes.length <= AVOID_UP_TO ? growNodesToText(nodes, text) : nodes, edges, text);
      };
      let d = await draw(config, 'start');
      let view = firstView(d.bounds, size, pad);
      const idOf = (dd: DiagramDrawing, title: string) => dd.index.nodes.find((n) => n.title === title)?.id;
      const edit = async (name: string, next: Record<string, unknown>, select: (dd: DiagramDrawing) => { nodes: string[]; edges: string[] }) => {
        config = next;
        d = await draw(config, name);
        for (const v of check(d)) found.push(`${name}: ${v}`);
        const sel = select(d);
        if (!sel.nodes.length && !sel.edges.length) { found.push(`${name}: what was edited isn’t drawn`); return; }
        const eye = diagramEye(d, sel, null, { ends: true })!;
        view = keepInView(view, eye, drawingCorner(d, text), size, pad);
        const shownR = (r: Rect) => { const x0 = r.x * view.zoom + view.x, y0 = r.y * view.zoom + view.y; return x0 >= pad.left - 1 && y0 >= pad.top - 1 && x0 + r.w * view.zoom <= size.width - pad.right + 1 && y0 + r.h * view.zoom <= size.height - pad.bottom + 1; };
        if (!shownR(eye.must)) found.push(`${name}: what was edited (${fmtR(eye.must)}) isn’t in view at ${frame.name}`);
      };
      await edit('add a state', addState(config, [], 'state'), (dd) => ({ nodes: [idOf(dd, 'state') ?? ''].filter(Boolean), edges: [] }));
      await edit('connect', addTransition(config, ['Init'], 'EVENT', ['state']), (dd) => ({ nodes: [], edges: dd.edges.filter((e) => e.edge.title === 'EVENT').map((e) => e.edge.id) }));
      await edit('rename', renameState(config, ['state'], 'buffering'), (dd) => ({ nodes: [idOf(dd, 'buffering') ?? ''].filter(Boolean), edges: [] }));
      const unique = [...new Set(found)];
      if (DUMP && unique.length) appendFileSync(DUMP, unique.map((v) => `Editing a machine | ${frame.name} | ${v}\n`).join(''));
      expect(unique).toEqual([]);
    }, 60_000);
  }
});

/* ══ In a document ══
   docstream's fences draw a workerd config (```capnp) and a machine (```xstate) in an article's column: 630 px across in a
   680 px column, 342 in a 390 px phone's. The board is as tall as its drawing needs at the readable size, between a floor and
   a cap; under the cap the drawing is whole, past it the first view is its top-start corner at a readable size; and the
   frame's bar is never over the drawing at rest. */

const FENCE = { min: 200, max: 640, toolbar: 60, bar: 48, side: 24, foot: 24 } as const;
const COLUMNS = [{ name: 'article (680 px)', width: 630 }, { name: 'phone (390 px)', width: 342 }] as const;
/** The tree before this pass: fixed boards (capnp 420, xstate 520) with the bar floating over their foot. */
const OLD_FENCES = !!process.env.DIAGRAM_OLD_FENCES;
const EVENT_LOG = `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [ (name = "main", worker = .main), (name = "do-storage", disk = (path = "do-storage", writable = true)) ],
  sockets = [ (name = "http", address = "127.0.0.1:19610", http = (), service = "main") ],
);
const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ACCOUNTS", durableObjectNamespace = "ProofAccount") ],
  durableObjectNamespaces = [ (className = "ProofAccount", uniqueKey = "event-log", enableSql = true) ],
  durableObjectStorage = (localDisk = "do-storage"),
);`;
const REQUEST = { id: 'request', initial: 'idle', states: { idle: { on: { FETCH: 'loading' } }, loading: { on: { RESOLVE: 'success', REJECT: 'failure' } }, failure: { on: { RETRY: 'loading' } }, success: { type: 'final' } } };

const FENCES: { name: string; fence: 'capnp' | 'xstate'; draw: (board: DiagramBoardSize) => Promise<DiagramDrawing> }[] = [
  ...[['a chat app’s config.capnp', WORKERD_CONFIG], ['event-log.capnp', EVENT_LOG]].map(([name, code]) => ({
    name: name!, fence: 'capnp' as const,
    draw: async () => {
      const read = readWorkerdConfig(code!);
      if (!read.ok) throw new Error(read.reason);
      const props = cloudflareBoardProps(placeInLayers({ ...read.system, name: 'workerd config' }));
      return drawDiagram(sizeNodesToText(props.nodes, text), props.edges, text);
    },
  })),
  ...[['the Audio Player', parseXState(AUDIO_PLAYER_SOURCE)], ['the request machine', REQUEST]].map(([name, cfg]) => ({
    name: name as string, fence: 'xstate' as const,
    draw: async (board: DiagramBoardSize) => {
      const draft = machineToDraft(createMachine(cfg as never) as never);
      const raw = await elkOf(`fence\0${name as string}`, draft);
      const { nodes, edges } = onLayout(draft, finishLayout(raw, { board, text }));
      return drawDiagram(nodes.length <= AVOID_UP_TO ? growNodesToText(nodes, text) : nodes, edges, text);
    },
  })),
];

describe('In a document', () => {
  for (const f of FENCES) for (const col of COLUMNS) {
    it(`${f.name}, ${col.name}`, async () => {
      const found: string[] = [];
      // A machine's layout wraps for the board it may grow to; a placed config isn't laid out.
      const fixed = f.fence === 'capnp' ? 420 : 520;
      const d = await f.draw(step({ width: col.width, height: OLD_FENCES ? fixed : FENCE.max }));
      const insets = { top: FENCE.toolbar, left: FENCE.side, right: FENCE.side, bottom: OLD_FENCES ? 72 + 12 : FENCE.foot };
      // The frame's height: the drawing's, with the chrome over it and the bar docked under it.
      const height = OLD_FENCES ? fixed : diagramContentHeight(d.bounds, col.width, { ...insets, bottom: insets.bottom + FENCE.bar }, { min: FENCE.min, max: FENCE.max });
      // With the bar docked under the drawing, the board is what's over it; floating, it's the whole of it.
      const size = { width: col.width, height: OLD_FENCES ? height : height - FENCE.bar };
      const view = keepInView(firstView(d.bounds, size, insets), diagramStartEye(d) ?? { must: drawingCorner(d, text)! }, drawingCorner(d, text), size, insets);
      const b = d.bounds!;
      const free = { w: size.width - insets.left - insets.right, h: size.height - insets.top - insets.bottom };
      const at = (r: Rect) => ({ x0: r.x * view.zoom + view.x, y0: r.y * view.zoom + view.y, x1: (r.x + r.w) * view.zoom + view.x, y1: (r.y + r.h) * view.zoom + view.y });
      const shown = (r: Rect) => { const s = at(r); return s.x0 >= insets.left - 1 && s.y0 >= insets.top - 1 && s.x1 <= size.width - insets.right + 1 && s.y1 <= size.height - insets.bottom + 1; };
      const readable = Math.min(1, Math.max(DIAGRAM_LEGIBLE_ZOOM, free.w / b.w));
      const needs = b.h * readable + insets.top + insets.bottom + (OLD_FENCES ? 0 : FENCE.bar);
      if (!OLD_FENCES && (height < FENCE.min - 0.5 || height > FENCE.max + 0.5)) found.push(`fence: ${Math.round(height)} px tall, outside ${FENCE.min}–${FENCE.max}`);
      if (needs <= FENCE.max + 0.5 && b.w * DIAGRAM_LEGIBLE_ZOOM <= free.w && !shown(b)) found.push(`fence: ${Math.round(b.w)}×${Math.round(b.h)} needs ${Math.round(needs)} px and isn’t whole on a ${Math.round(height)} px board (zoom ${view.zoom.toFixed(2)})`);
      const corner = drawingCorner(d, text);
      if (corner && !shown(corner) && !shown(diagramStartEye(d)?.must ?? corner)) found.push('fence: neither the top-start corner nor where it starts is in the first view');
      if (view.zoom < Math.min(DIAGRAM_LEGIBLE_ZOOM, free.w / b.w, free.h / b.h) - 0.001) found.push(`fence: opens at ${view.zoom.toFixed(2)}, under the readable ${DIAGRAM_LEGIBLE_ZOOM}`);
      // The bar at the foot: floating over the board, it mustn't be over the drawing (docked under it, it can't be).
      const s = at(b);
      const barTop = height - 12 - FENCE.bar;
      if (OLD_FENCES && s.y1 > barTop + 0.5 && s.y0 < barTop) found.push(`fence: the bar covers the drawing at rest (it ends at ${Math.round(s.y1)}, the bar starts at ${Math.round(barTop)})`);
      const unique = [...new Set(found)];
      if (DUMP && unique.length) appendFileSync(DUMP, unique.map((v) => `In a document: ${f.name} | ${col.name} | ${v}\n`).join(''));
      expect(unique).toEqual([]);
    }, 30_000);
  }
});
