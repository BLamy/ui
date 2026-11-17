/* ══ A walk of edits, held to the rules after every step ══
   What the editing fuzz (`lib/diagram-editing.fuzz.test.ts`) runs for each seed, and the Replay story shows: a `CloudflareWalk`
   made step by step, each drawing held to the drawing rules (`diagram-rules`) and to what editing promises. */
import type { Viewport } from '@/lib/canvas-math';
import { cloudflareNoun, type CloudflareDrawn } from '@/lib/cloudflare-board';
import type { CloudflareSystem } from '@/lib/cloudflare-system';
import { AVOID_UP_TO, diagramStartEye, drawDiagram, drawingCorner, firstView, keepInView, type DiagramDrawing } from '@/lib/diagram-drawing';
import { describeNode, edgesByNode } from '@/lib/diagram-keyboard';
import type { DiagramBoardSize } from '@/lib/diagram-layout';
import { growNodesToText, sizeNodesToText } from '@/lib/diagram-model';
import type { TextMeasurer } from '@/lib/diagram-text';
import { CloudflareWalk, describeStep, pickStep, seeded, type CloudflareWalkMade, type CloudflareWalkStep } from './cloudflare-walk';
import { PLATFORM, PLATFORM_EDGES, SMALL, SMALL_EDGES, STUDIO_EXAMPLE, UPLOAD, UPLOAD_EDGES } from './cloudflare-systems';
import { placeInLayers } from '@/lib/cloudflare-board';
import { boardOf, cardsOf, check, checkAnnounced, checkContained, checkDetours, checkInView, checkLabelRuns, checkOverlaps, checkPlaced, checkPushed, checkRootBox, fmtR, FRAMES, nameOf, rootMargins, step as stepOf, type Frame } from './diagram-rules';

/* ── The walks: each example system, laid out and placed from the start, and the studio's ── */

const sys = (services: CloudflareSystem['services'], edges: CloudflareSystem['edges'], name: string, accountId?: string): CloudflareSystem => ({ services, edges, name, ...(accountId ? { accountId } : null) });
const frameNamed = (name: string) => FRAMES.find((f) => f.name === name)!;
const placed = (s: CloudflareSystem) => placeInLayers(s, { editable: true });
const SYSTEMS = [sys(SMALL, SMALL_EDGES, 'Link shortener'), sys(UPLOAD, UPLOAD_EDGES, 'File upload'), sys(PLATFORM, PLATFORM_EDGES, 'Docs search', '4f1b9c2e7a')];
/** What the editing fuzz walks: a system, and the frame it's walked in. */
export const CLOUDFLARE_WALKS: { name: string; system: CloudflareSystem; frame: Frame }[] = [
  ...SYSTEMS.map((s, i) => ({ name: `${s.name}, laid out`, system: s, frame: frameNamed(['1280x800', '1280x800', '1600x900'][i]!) })),
  ...SYSTEMS.map((s, i) => ({ name: `${s.name}, placed from the start`, system: placed(s), frame: frameNamed(['800x1000', '1280x800', '1600x900'][i]!) })),
  { name: 'the studio’s example', system: placed({ ...STUDIO_EXAMPLE, name: 'File upload' }), frame: frameNamed('1280x800') },
];

export interface Walked { found: string[]; steps: CloudflareWalkStep[]; at: number; length: number; knots?: number }

/** One step of a walk as it was drawn, for the Replay story: what it was, the drawing, and what it broke. */
export interface WalkedStep { step: CloudflareWalkStep | null; said: string; drawn: CloudflareDrawn; drawing: DiagramDrawing; found: string[]; view: Viewport; select: { nodes: string[]; edges: string[] }; pushed: number; knot: boolean }

export interface WalkCheckOptions {
  /** The read-only pipeline for a board (ELK once per graph, wrapped and routed), as a system with no places is drawn. */
  layoutFor: (board: DiagramBoardSize) => (system: CloudflareSystem) => Promise<CloudflareDrawn>;
  text: TextMeasurer;
  /** Rules to leave out, by how their findings start ("root box", "labels"). */
  skip?: readonly string[];
  /** Every step, as drawn: the Replay story shows them. */
  onStep?: (s: WalkedStep) => void;
  /** Go on past a step that breaks a rule (the story does; the fuzz stops at the first). */
  keepGoing?: boolean;
}

/** What the Diagram draws of what the board hands it: a placed board's cards sized to their words, a laid-out one's kept. */
export const walkDrawing = (drawn: CloudflareDrawn, text: TextMeasurer): DiagramDrawing => drawDiagram(drawn.sized ? (drawn.nodes.length <= AVOID_UP_TO ? growNodesToText(drawn.nodes, text) : drawn.nodes) : sizeNodesToText(drawn.nodes, text), drawn.edges, text);

/**
 * A walk on a system, at a frame: the steps given, or `count` picked from `seed`, each made as CloudflareDiagram makes it and
 * held to the drawing rules and to what editing promises (see `lib/diagram-editing.fuzz.test.ts`); the findings of the first
 * step that breaks one.
 */
export async function checkWalk(system: CloudflareSystem, frame: Frame, plan: { seed: number; count: number } | { steps: readonly CloudflareWalkStep[] }, { layoutFor, text, skip = [], onStep, keepGoing = false }: WalkCheckOptions): Promise<Walked> {
  const kept = (found: string[]) => found.filter((v) => !skip.some((k) => v.startsWith(k)));
  const drawingOf = (drawn: CloudflareDrawn) => walkDrawing(drawn, text);
  const board = stepOf(frame);
  const layout = layoutFor(board);
  // Tidy up lays out for the board in view: with the panel open (it is, with anything selected), what it leaves.
  const panelBoard = boardOf(frame, true);
  const tidyLayout = layoutFor(stepOf(panelBoard.size));
  const { size, pad } = boardOf(frame, false);
  let view: Viewport | null = null;
  const w = await CloudflareWalk.start(system, { layout, tidyLayout, text, center: () => (view ? { x: (size.width / 2 - view.x) / view.zoom, y: (size.height / 2 - view.y) / view.zoom } : null) });
  let d = drawingOf(w.drawn);
  view = firstView(d.bounds, size, pad);
  const start = diagramStartEye(d);
  if (start) view = keepInView(view, start, drawingCorner(d, text), size, pad);
  let margins = rootMargins(d);
  // What was drawn for each system the history can come back to.
  const seen = new WeakMap<CloudflareSystem, DiagramDrawing>([[w.system, d]]);
  const rng = 'seed' in plan ? seeded(plan.seed) : null;
  const count = 'seed' in plan ? plan.count : plan.steps.length;
  const steps: CloudflareWalkStep[] = [];
  const initial = kept([...check(d), ...checkLabelRuns(d), ...checkOverlaps(d), ...checkContained(d)]);
  onStep?.({ step: null, said: 'as it opens', drawn: w.drawn, drawing: d, found: initial, view, select: { nodes: [], edges: [] }, pushed: 0, knot: false });
  let first: Walked | null = null;
  let knots = 0;
  let knotted = false;
  if (initial.length && !keepGoing) return { found: initial.map((v) => `before any step: ${v}`), steps, at: -1, length: 0 };
  for (let i = 0; i < count; i++) {
    const step = rng ? pickStep(rng, w) : (plan as { steps: readonly CloudflareWalkStep[] }).steps[i]!;
    steps.push(step);
    const before = d;
    const said = describeStep(step, w.system);
    const made: CloudflareWalkMade = await w.apply(step);
    if (made.kind === 'nothing') continue;
    d = drawingOf(made.drawn);
    const found: string[] = [];
    found.push(...check(d), ...checkLabelRuns(d), ...checkOverlaps(d), ...checkContained(d), ...checkDetours(d));
    found.push(...checkAnnounced(d, (n) => cloudflareNoun(n), (n) => describeNode(n, d.index, edgesByNode(d.edges.map((e) => e.edge)).get(n.id), cloudflareNoun)));
    if (made.kind === 'tidy') {
      // The read-only layout of the same system, and in view: whole when it can be read whole, else from its corner.
      const ro = drawingOf(await tidyLayout(made.system));
      for (const n of cardsOf(ro)) {
        const m = d.index.byId.get(n.id);
        if (!m || Math.abs(m.x - n.x) > 0.5 || Math.abs(m.y - n.y) > 0.5) found.push(`tidy: ${nameOf(n)} is at ${m ? fmtR(m) : 'nowhere'}, read-only at ${fmtR(n)}`);
      }
      margins = rootMargins(d);
      const panel = boardOf(frame, true);
      view = tidyView(view, d, panel.size, panel.pad);
      found.push(...tidyInView(d, view, panel.size, panel.pad, text));
    } else if (made.kind === 'undo' || made.kind === 'redo') {
      const was = seen.get(made.system);
      if (was) for (const n of [...was.index.nodes]) {
        const m = d.index.byId.get(n.id);
        if (!m || Math.abs(m.x - n.x) > 0.5 || Math.abs(m.y - n.y) > 0.5 || Math.abs(m.w - n.w) > 0.5 || Math.abs(m.h - n.h) > 0.5) found.push(`${made.kind}: ${nameOf(n)} is at ${m ? fmtR(m) : 'nowhere'}, and was drawn at ${fmtR(n)}`);
      }
    } else {
      found.push(...checkRootBox(d, margins));
      // What the step is about may move (a card that grew, one moved by hand); what it isn't about only by making room.
      const resized = cardsOf(before).filter((n) => { const m = d.index.byId.get(n.id); return m && (Math.abs(m.w - n.w) > 0.5 || Math.abs(m.h - n.h) > 0.5); }).map((n) => n.id);
      found.push(...checkPushed(before, d, new Set([...made.touched, ...resized])));
      if (step.op === 'add') found.push(...checkPlaced(d, made.select.nodes[0]!));
      if (made.select.nodes.length || made.select.edges.length) {
        const seenIn = checkInView(d, frame, view!, made.select, said);
        found.push(...seenIn.found);
        view = seenIn.view;
      }
    }
    seen.set(made.system, d);
    // Left in a knot (no room to be made, as on a board placed by hand into one): the board suggests Tidy up, and holds
    // rules 1 to 3 still.
    // A board left in a knot stays one until Tidy up: the steps after it are held to rules 1 to 3 too.
    if (made.knot) knotted = true;
    if (made.kind === 'tidy') knotted = false;
    if (made.knot || knotted) { if (made.knot) knots++; found.splice(0, found.length, ...found.filter((v) => /^[123] /.test(v))); }
    found.splice(0, found.length, ...kept(found));
    onStep?.({ step, said, drawn: made.drawn, drawing: d, found: [...new Set(found)], view: view!, select: made.select, pushed: made.pushed, knot: made.knot });
    if (found.length && !first) first = { found: [...new Set(found)].map((v) => `step ${i + 1} (${said}): ${v}`), steps: [...steps], at: i, length: count };
    if (first && !keepGoing) return first;
  }
  return first ?? { found: [], steps, at: count, length: count, knots };
}

/** Where the view goes after Tidy up: CloudflareDiagram opens on the new layout again (the Diagram's `reframe`), on the board
 *  the panel leaves: whole when it can be read whole, else from its top-start corner. */
export function tidyView(_view: Viewport, d: DiagramDrawing, size: { width: number; height: number }, pad: { top: number; right: number; bottom: number; left: number }): Viewport {
  return firstView(d.bounds, size, pad);
}
/** After Tidy up the system is in view: whole when it can be read whole on the board the panel leaves, else its top-start
 *  corner at a readable size. */
export function tidyInView(d: DiagramDrawing, view: Viewport, size: { width: number; height: number }, pad: { top: number; right: number; bottom: number; left: number }, text: TextMeasurer): string[] {
  const b = d.bounds;
  if (!b) return [];
  const free = { w: size.width - pad.left - pad.right, h: size.height - pad.top - pad.bottom };
  const shown = (r: { x: number; y: number; w: number; h: number }) => r.x * view.zoom + view.x >= pad.left - 1 && r.y * view.zoom + view.y >= pad.top - 1 && (r.x + r.w) * view.zoom + view.x <= size.width - pad.right + 1 && (r.y + r.h) * view.zoom + view.y <= size.height - pad.bottom + 1;
  const whole = Math.min(free.w / b.w, free.h / b.h) >= 0.875;
  if (whole && !shown(b)) return [`tidy: the system (${fmtR(b)}) can be read whole, and isn’t in view (zoom ${view.zoom.toFixed(2)} at ${Math.round(view.x)},${Math.round(view.y)})`];
  const corner = drawingCorner(d, text);
  if (!whole && corner && !shown(corner)) return [`tidy: neither the system nor its top-start corner is in view`];
  return [];
}

