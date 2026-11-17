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
import { boardOf, cardsOf, check, checkAnnounced, checkCrossings, checkInView, checkPlaced, checkPushed, checkShape, checkStable, checkView, CHROME, fmtR, FRAMES, nameOf, step, type Frame } from '../stories/diagram-rules';
import { addState, addTransition, renameState } from './state-diagram-edit';
import { machineToDraft } from './state-diagram-model';
import { parseXState } from './state-diagram-source';

const text = estimateText;
/** Set to a path to have every finding written there too, one a line (the suite's report). */
const DUMP = process.env.DIAGRAM_INVARIANTS_OUT;

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
            for (const v of [...check(d), ...checkCrossings(d)]) found.push(`${mode}: ${v}`);
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
          say(s.name, [...check(s.drawing), ...checkCrossings(s.drawing)]);
          say(s.name, checkShape(s.drawing, frame, false));
          say(s.name, checkAnnounced(s.drawing, cfNoun, (n) => describeNode(n, s.drawing.index, edgesByNode(s.drawing.edges.map((e) => e.edge)).get(n.id), cloudflareNoun)));
          // An edit keeps every card but what it's about where it was, unless it makes room (a push: J6).
          if (!s.tidy) say(s.name, checkPushed(before.drawing, s.drawing, new Set([...s.touched, ...cardsOf(before.drawing).filter((n) => { const m = s.drawing.index.byId.get(n.id); return m && (Math.abs(m.w - n.w) > 0.5 || Math.abs(m.h - n.h) > 0.5); }).map((n) => n.id)])));
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
        for (const v of [...check(d), ...checkCrossings(d)]) found.push(`${name}: ${v}`);
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
