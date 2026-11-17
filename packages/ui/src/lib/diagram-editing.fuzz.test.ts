/* ══ Editing, fuzzed: seeded walks of every edit, held to the drawing rules after every step ══
   Five rounds of critics each found a new editing path that broke the drawing. This walks them all: for each example system,
   laid out (the read-only pipeline) and placed from the start (as the studio places one), several seeds pick steps from every
   change a person can make (`stories/cloudflare-walk`: add, delete, rename, connect, disconnect, a binding's name, operations,
   events, a machine, an environment, a move by hand, Tidy up, undo, redo), and after every step the drawing is held to:
   - rules 1 to 4 and 7 (`check`, `checkAnnounced`): attached, clear, a lane and a label of its own, no U-turn, said as drawn;
   - its labels on straight runs of their own routes, drawn into and out of, the arrowhead whole (`checkLabelRuns`);
   - nothing over anything (`checkOverlaps`), everything inside its box and no label outside the system (`checkContained`);
   - the root's box the same function of what it holds as the last layout's (`checkRootBox`);
   - no card moved but by making room (`checkPushed`): one monotone push, order, rows and columns kept;
   - a new card in free room (`checkPlaced`); what was just edited in view, on the board the panel leaves (`checkInView`);
   - undo and redo put back exactly what was drawn; Tidy up is the read-only layout, and its result is in view.
   A machine is laid out again on each edit, as XState's editor does: its walks hold rules 1 to 4, the labels' runs, overlaps
   and containment, and what was edited in view.

   After every walk, one Tidy up: the result held to every rule (none relaxed for a knot) and the read-only layout of the
   same system. Each step and that Tidy up are held to the tangle rule too (`checkCrossings`): no edge crosses more than two
   others where a plain way crosses two fewer at a similar length.

   The walks: each Cloudflare system laid out and placed from the start, and the studio's example, and two machines, every
   change a person can make (connections between environments, a class to its own Worker, one that's there already; a
   transition into a parallel state's region). The workspace's test run walks seeds 1 to 3; `pnpm fuzz:diagrams` (a check
   before a release) walks 1 to 8; `DIAGRAM_FUZZ_SEEDS=9,10,…` walks fresh ones.

   A failing walk prints its seed and its steps (JSON), which replay it (and in the `Organisms/CloudflareDiagram/Replay`
   story): put them in `REGRESSIONS` with a name. Set `DIAGRAM_FUZZ_OUT` to a path to have every failure written there too;
   `DIAGRAM_FUZZ_STEPS` / `DIAGRAM_FUZZ_SEEDS` to walk further. */
import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMachine } from 'xstate';
import { cloudflareWalkDraft, seeded, type CloudflareWalkStep } from '../stories/cloudflare-walk';
import { checkWalk, CLOUDFLARE_WALKS, type Walked } from '../stories/cloudflare-walk-check';
import { boardOf, check, checkContained, checkCrossings, checkDetours, checkLabelRuns, checkOverlaps, fmtR, FRAMES, step as stepOf, type Frame } from '../stories/diagram-rules';
import { AUDIO_PLAYER_SOURCE } from '../stories/audio-player-machine';
import { SEVERAL_TARGETS } from '../stories/state-machines';
import type { CloudflareDrawn } from './cloudflare-board';
import type { CloudflareSystem } from './cloudflare-system';
import { AVOID_UP_TO, diagramEye, drawDiagram, drawingCorner, firstView, keepInView } from './diagram-drawing';
import { createDiagramLayoutEngine, finishLayout, runLayout, toElkGraph, type DiagramBoardSize, type DiagramDraft, type DiagramLayoutResult } from './diagram-layout';
import { onLayout } from './diagram-layout/react';
import { growNodesToText, type DiagramNode } from './diagram-model';
import { estimateText } from './diagram-text';
import { addAction, addContextKey, addState, addTransition, removeAction, removeContextKey, removeState, removeTransition, renameState, setTransitionGuard, setTransitionTarget, stateAt, type StateMachineConfig, type StatePath } from './state-diagram-edit';
import { machineToDraft } from './state-diagram-model';
import { parseXState } from './state-diagram-source';

const text = estimateText;
const OUT = process.env.DIAGRAM_FUZZ_OUT;
const STEPS = Number(process.env.DIAGRAM_FUZZ_STEPS ?? 30);
const SEEDS = (process.env.DIAGRAM_FUZZ_SEEDS ?? '1,2,3').split(',').map(Number);
/** Rules to leave out, by how their findings start ("root box", "labels"), to see what else a walk finds past them. */
const SKIP = (process.env.DIAGRAM_FUZZ_SKIP ?? '').split(',').filter(Boolean);

/* ── Laying out, as the components do (ELK once per graph) ── */

const engine = createDiagramLayoutEngine();
const elkRuns = new Map<string, Promise<DiagramLayoutResult>>();
function elkOf(draft: DiagramDraft): Promise<DiagramLayoutResult> {
  const key = JSON.stringify([draft.nodes, draft.edges]);
  let run = elkRuns.get(key);
  if (!run) { run = runLayout(draft, { text }, engine, toElkGraph(draft, { text }), false); elkRuns.set(key, run); }
  return run;
}
/** The read-only pipeline for a frame: what a system with no places is drawn as, and what Tidy up lays out. */
const layoutOf = (board: DiagramBoardSize) => (system: CloudflareSystem): Promise<CloudflareDrawn> => {
  const draft = cloudflareWalkDraft(system) as DiagramDraft;
  const key = JSON.stringify([board, draft.nodes, draft.edges]);
  let run = laidRuns.get(key);
  if (!run) {
    run = elkOf(draft).then((raw) => ({ ...(onLayout(draft, finishLayout(structuredClone(raw), { board, text })) as Pick<CloudflareDrawn, 'nodes' | 'edges'>), sized: true }));
    laidRuns.set(key, run);
  }
  return run;
};
const laidRuns = new Map<string, Promise<CloudflareDrawn>>();

/* ── The walks ── */

interface WalkCase { name: string; system: CloudflareSystem; frame: Frame }
const WALKS: WalkCase[] = CLOUDFLARE_WALKS;

const layoutFor = (board: DiagramBoardSize) => layoutOf(board);
/** A walk of a case: the steps given, or `count` picked from `seed`. */
const walk = (c: WalkCase, plan: { seed: number; count: number } | { steps: readonly CloudflareWalkStep[] }) => checkWalk(c.system, c.frame, plan, { layoutFor, text, skip: SKIP });

const report = (name: string, seed: number | string, r: Walked) => `${name}, ${typeof seed === 'number' ? `seed ${seed}` : seed}: ${r.found.length} finding(s)\n  ${r.found.slice(0, 12).join('\n  ')}\n  steps: ${JSON.stringify(r.steps)}\n`;

/* Named regression cases: what the fuzz and the round-10 critic found broken on the tree before J6, as fixed step lists. */
const ops = (edge: string, operations: string[]): CloudflareWalkStep => ({ op: 'operations', edge, operations });
const REGRESSIONS: { name: string; walk: string; steps: CloudflareWalkStep[] }[] = [
  // Round 10's F1, the critic's journey: FILES, two operations more (it ended 9 px over Files, the arrowhead a stub), three
  // more (moved across the board, its line round it and over JOBS twice), renamed with one more (through Consumer).
  { name: 'F1: ticking operations on FILES makes room for its label on its own line', walk: 'File upload, laid out', steps: [ops('api-files', ['delete', 'get', 'list', 'put']), ops('api-files', ['delete', 'get', 'head', 'list', 'put'])] },
  { name: 'F1: renaming FILES and ticking one more keeps its label on its line', walk: 'File upload, laid out', steps: [{ op: 'binding', edge: 'api-files', name: 'UPLOADED_FILES_BUCKET' }, ops('api-files', ['createMultipartUpload', 'delete', 'get', 'list', 'put'])] },
  // Seed 2 on the old tree: the label grew with the events it carries, went over the system's header, its line through it.
  { name: 'F1: a label that grows with its events stays in the system, on its line', walk: 'Link shortener, laid out', steps: [{ op: 'events', edge: 'shortener-links', events: ['FILE_READY', 'VIEWER_JOINED'] }] },
  // Round 10's F2, the critic's journey on the studio: three adds, then a connection (JOBS left the system; KV_NAMESPACE squeezed).
  { name: 'F2: the studio keeps every label on its line through three adds and a connection', walk: 'the studio’s example', steps: [{ op: 'add', kind: 'kv', near: null }, { op: 'add', kind: 'd1', near: null }, { op: 'add', kind: 'workers', near: null }, { op: 'connect', from: 'api', fromPort: 'env', to: 'kv', toPort: 'binding:kv_namespaces' }] },
  // Seed 1 on the old tree: a second binding API → Files on the studio left JOBS's label off its line.
  { name: 'F2: a connection on the studio leaves the other routes and labels as they were', walk: 'the studio’s example', steps: [{ op: 'connect', from: 'api', fromPort: 'env', to: 'files', toPort: 'binding:r2_buckets' }] },
  // Every seed on the old tree: the root's box 7 px wider and 14 taller after the first edit (round 10's F3).
  { name: 'F3: the root’s box after an edit is drawn round what it holds as the layout drew it', walk: 'Link shortener, laid out', steps: [{ op: 'connect', from: 'shortener', fromPort: 'env', to: 'links', toPort: 'binding:kv_namespaces' }] },
  // Round 10's F3 (d-sm-6-tidy): two adds, then Tidy up ended under the bar.
  { name: 'F3: Tidy up’s result is in view and is the read-only layout', walk: 'Link shortener, placed from the start', steps: [{ op: 'add', kind: 'kv', near: null }, { op: 'add', kind: 'd1', near: null }, { op: 'tidy' }] },
  // Seeds 2 and 3 on the old tree: Consumer's sections changed (a handler gone, a machine come) and ROOM's line stayed where
  // its hairline was.
  { name: 'a box’s own edge stays under its sections when they change', walk: 'File upload, laid out', steps: [{ op: 'events', edge: 'api-jobs', events: ['FILE_READY', 'VIEWER_JOINED'] }, { op: 'connect', from: 'room', fromPort: 'env', to: 'jobs', toPort: 'binding:queues' }, { op: 'disconnect', edge: 'jobs-consumer' }] },
  { name: 'a Worker given a machine keeps its own edge under its sections', walk: 'File upload, laid out', steps: [{ op: 'disconnect', edge: 'api-files' }, { op: 'delete', id: 'api' }, { op: 'machine', id: 'consumer', on: true }] },
  // Every placed board on the old tree: labels at a bend, over a wall, off their lines, before any edit.
  { name: 'a board placed from the start opens with every label on a line of its own', walk: 'File upload, placed from the start', steps: [] },
  { name: 'the docs search placed from the start opens legibly', walk: 'Docs search, placed from the start', steps: [] },
  // Seed 3 on the old tree: a service moved into an environment drew the box over five cards.
  { name: 'a service moved into an environment goes to free room in it', walk: 'Docs search, laid out', steps: [{ op: 'disconnect', edge: 'gateway-search' }, { op: 'delete', id: 'gateway' }, { op: 'machine', id: 'indexer', on: true }, { op: 'delete', id: 'indexer' }, { op: 'rename', id: 'crawl', label: 'Uploads API v2' }, ops('search-docs', ['dump', 'prepare', 'withSession']), { op: 'rename', id: 'crawl-dlq', label: 'X' }, { op: 'environment', id: 'crawl', environment: 'staging' }] },
  // J6's seeds 4 to 8, the walks that failed then (J7 fixed their causes: see the J7 handoff).
  { name: "a Worker moved into a new environment keeps its labels off each other (J6 seed 8)", walk: "Link shortener, laid out", steps: [{"op": "operations", "edge": "shortener-clicks", "operations": ["batch", "exec", "prepare", "withSession"]}, {"op": "binding", "edge": "shortener-clicks", "name": "UPLOADED_FILES_BUCKET"}, {"op": "operations", "edge": "shortener-clicks", "operations": ["batch", "exec", "prepare", "withSession"]}, {"op": "events", "edge": "shortener-links", "events": ["FILE_READY"]}, {"op": "operations", "edge": "shortener-clicks", "operations": ["batch", "exec", "prepare", "withSession"]}, {"op": "add", "kind": "k2", "near": "links"}, {"op": "operations", "edge": "shortener-clicks", "operations": ["batch", "exec", "prepare", "withSession"]}, {"op": "machine", "id": "shortener", "on": true}, {"op": "rename", "id": "links", "label": "Uploads API v2"}, {"op": "rename", "id": "k2", "label": "X"}, {"op": "add", "kind": "ai-controls", "near": "k2"}, {"op": "undo"}, {"op": "rename", "id": "k2", "label": "Uploads API v2"}, {"op": "connect", "from": "shortener", "fromPort": "env", "to": "k2", "toPort": "binding:k2"}, {"op": "operations", "edge": "shortener-clicks", "operations": ["batch", "exec", "prepare", "withSession"]}, {"op": "environment", "id": "shortener", "environment": "staging"}] as CloudflareWalkStep[] },
  { name: "a push for a new label doesn't stretch a loop into a detour (J6 seed 6)", walk: "Docs search, laid out", steps: [{"op": "delete", "id": "gateway"}, {"op": "disconnect", "edge": "search-index"}, {"op": "connect", "from": "search", "fromPort": "sends:tail", "to": "indexer", "toPort": "on:tail"}, {"op": "operations", "edge": "staging-cache", "operations": ["put"]}, {"op": "add", "kind": "agent-memory", "near": "docs-index"}, {"op": "machine", "id": "indexer", "on": true}, {"op": "delete", "id": "docs-index"}, {"op": "binding", "edge": "staging-cache", "name": "A_VERY_LONG_BINDING_NAME_FOR_THIS"}, {"op": "rename", "id": "agent-memory", "label": "Thumbnails"}, {"op": "undo"}, {"op": "events", "edge": "search-tail", "events": []}, {"op": "undo"}, {"op": "binding", "edge": "indexer-crawl", "name": "UPLOADED_FILES_BUCKET"}, {"op": "rename", "id": "cache", "label": "Thumbnails"}, {"op": "add", "kind": "magic-transit", "near": null}, {"op": "move", "id": "crawl-dlq", "by": {"x": 180, "y": 77}}, {"op": "connect", "from": "search", "fromPort": "env", "to": "crawl-dlq", "toPort": "binding:queues"}, {"op": "move", "id": "cache-staging", "by": {"x": -142, "y": -29}}, {"op": "add", "kind": "pages", "near": "requests"}, {"op": "rename", "id": "requests", "label": "A much longer name than before"}, {"op": "rename", "id": "docs", "label": "Uploads API v2"}, {"op": "add", "kind": "analytics", "near": null}, {"op": "connect", "from": "search", "fromPort": "env", "to": "requests", "toPort": "binding:analytics_engine_datasets"}, {"op": "delete", "id": "crawl-dlq"}, {"op": "operations", "edge": "indexer-crawl", "operations": ["metrics", "send"]}, {"op": "tidy"}, {"op": "operations", "edge": "search-ai", "operations": ["autorag", "run", "toMarkdown", "websearch"]}, {"op": "connect", "from": "indexer", "fromPort": "env", "to": "cache", "toPort": "binding:kv_namespaces"}] as CloudflareWalkStep[] },
  { name: "Tidy up of connections across environments keeps lanes and labels (J6 seed 7)", walk: "Docs search, laid out", steps: [{"op": "operations", "edge": "gateway-search", "operations": ["fetch"]}, {"op": "connect", "from": "search", "fromPort": "env", "to": "requests", "toPort": "binding:analytics_engine_datasets"}, {"op": "delete", "id": "indexer"}, {"op": "connect", "from": "docs-index", "fromPort": "out:events", "to": "crawl-dlq", "toPort": "events"}, {"op": "rename", "id": "search", "label": "Edge cache"}, {"op": "connect", "from": "gateway", "fromPort": "env", "to": "crawl", "toPort": "binding:queues"}, {"op": "add", "kind": "cloudflare-one-client", "near": null}, {"op": "rename", "id": "cloudflare-one-client", "label": "A much longer name than before"}, {"op": "move", "id": "cache", "by": {"x": -171, "y": -124}}, {"op": "rename", "id": "crawl", "label": "Edge cache"}, {"op": "operations", "edge": "gateway-queues", "operations": ["sendBatch"]}, {"op": "connect", "from": "crawl-dlq", "fromPort": "sends:queue-consumer", "to": "gateway", "toPort": "on:queue"}, {"op": "environment", "id": "gateway", "environment": "staging"}, {"op": "add", "kind": "email-service", "near": "search"}, {"op": "machine", "id": "search", "on": true}, {"op": "add", "kind": "hyperdrive", "near": null}, {"op": "events", "edge": "search-analytics_engine_datasets", "events": ["FILE_READY", "VIEWER_JOINED"]}, {"op": "add", "kind": "basin-sql", "near": "email-service"}, {"op": "add", "kind": "cache-reserve", "near": null}, {"op": "add", "kind": "ai-controls", "near": null}, {"op": "tidy"}] as CloudflareWalkStep[] },
  { name: "a Worker moved into an environment, placed board (J6 seed 7)", walk: "Link shortener, placed from the start", steps: [{"op": "operations", "edge": "shortener-links", "operations": ["get", "put"]}, {"op": "add", "kind": "hyperdrive", "near": "links"}, {"op": "events", "edge": "shortener-links", "events": ["FILE_READY"]}, {"op": "machine", "id": "shortener", "on": true}, {"op": "binding", "edge": "shortener-links", "name": "F"}, {"op": "connect", "from": "shortener", "fromPort": "env", "to": "hyperdrive", "toPort": "binding:hyperdrive"}, {"op": "undo"}, {"op": "rename", "id": "hyperdrive", "label": "Uploads API v2"}, {"op": "operations", "edge": "shortener-links", "operations": ["delete", "get", "list", "put"]}, {"op": "tidy"}, {"op": "connect", "from": "shortener", "fromPort": "env", "to": "hyperdrive", "toPort": "binding:hyperdrive"}, {"op": "disconnect", "edge": "shortener-hyperdrive"}, {"op": "connect", "from": "shortener", "fromPort": "env", "to": "hyperdrive", "toPort": "binding:hyperdrive"}, {"op": "environment", "id": "shortener", "environment": "staging"}] as CloudflareWalkStep[] },
  { name: "a service with a long binding moved into an environment (J6 seed 8)", walk: "File upload, placed from the start", steps: [{"op": "operations", "edge": "consumer-db", "operations": ["exec", "prepare", "withSession"]}, {"op": "binding", "edge": "consumer-db", "name": "UPLOADED_FILES_BUCKET"}, {"op": "connect", "from": "api", "fromPort": "sends:tail", "to": "consumer", "toPort": "on:tail"}, {"op": "connect", "from": "api", "fromPort": "sends:do-connect", "to": "room", "toPort": "on:connect"}, {"op": "operations", "edge": "consumer-room", "operations": ["get", "idFromName"]}, {"op": "operations", "edge": "files-jobs", "operations": ["object-create", "cf.superSlurper.job.started", "cf.superSlurper.job.completed"]}, {"op": "add", "kind": "k2", "near": "consumer"}, {"op": "operations", "edge": "consumer-room", "operations": ["get", "idFromName", "idFromString", "jurisdiction", "newUniqueId"]}, {"op": "machine", "id": "consumer", "on": true}, {"op": "rename", "id": "files", "label": "Uploads API v2"}, {"op": "rename", "id": "k2", "label": "X"}, {"op": "add", "kind": "ai-controls", "near": "db"}, {"op": "undo"}, {"op": "rename", "id": "k2", "label": "Uploads API v2"}, {"op": "connect", "from": "consumer", "fromPort": "env", "to": "jobs", "toPort": "binding:queues"}, {"op": "operations", "edge": "files-jobs", "operations": ["object-create", "cf.superSlurper.job.started", "cf.superSlurper.job.completed", "cf.superSlurper.job.object.migrated"]}, {"op": "environment", "id": "files", "environment": "staging"}] as CloudflareWalkStep[] },
  { name: "a second arrival on a short side doesn't land on the first (J6 seed 5)", walk: "Docs search, placed from the start", steps: [{"op": "disconnect", "edge": "indexer-ai"}, {"op": "binding", "edge": "search-docs", "name": "UPLOADED_FILES_BUCKET"}, {"op": "connect", "from": "cache", "fromPort": "out:events", "to": "crawl", "toPort": "events"}] as CloudflareWalkStep[] },
  { name: "a rename doesn't leave a route along a card's side (J6 seed 8)", walk: "Docs search, placed from the start", steps: [{"op": "operations", "edge": "indexer-crawl", "operations": ["send", "sendBatch"]}, {"op": "binding", "edge": "search-docs", "name": "UPLOADED_FILES_BUCKET"}, {"op": "connect", "from": "gateway", "fromPort": "sends:tail", "to": "indexer", "toPort": "on:tail"}, {"op": "connect", "from": "search", "fromPort": "env", "to": "gateway", "toPort": "binding:services"}, {"op": "operations", "edge": "search-services", "operations": ["connect"]}, {"op": "operations", "edge": "indexer-crawl", "operations": ["metrics", "send", "sendBatch"]}, {"op": "add", "kind": "k2", "near": "docs"}, {"op": "operations", "edge": "staging-cache", "operations": ["get", "getWithMetadata", "list", "put"]}, {"op": "machine", "id": "indexer", "on": true}, {"op": "rename", "id": "cache", "label": "Uploads API v2"}] as CloudflareWalkStep[] },
  { name: "Tidy up of the studio after environment moves (J6 seed 7)", walk: "the studio’s example", steps: [{"op": "operations", "edge": "api-files", "operations": ["put"]}, {"op": "connect", "from": "jobs", "fromPort": "sends:queue-consumer", "to": "api", "toPort": "on:queue"}, {"op": "delete", "id": "files"}, {"op": "connect", "from": "room", "fromPort": "env", "to": "api", "toPort": "binding:services"}, {"op": "rename", "id": "api", "label": "Edge cache"}, {"op": "connect", "from": "api", "fromPort": "env", "to": "db", "toPort": "binding:d1_databases"}, {"op": "add", "kind": "cloudflare-one-client", "near": null}, {"op": "rename", "id": "cloudflare-one-client", "label": "A much longer name than before"}, {"op": "move", "id": "jobs", "by": {"x": -171, "y": -124}}, {"op": "rename", "id": "db", "label": "Edge cache"}, {"op": "operations", "edge": "api-d1_databases", "operations": ["prepare", "withSession"]}, {"op": "connect", "from": "room", "fromPort": "env", "to": "db", "toPort": "binding:d1_databases"}, {"op": "environment", "id": "api", "environment": "staging"}, {"op": "add", "kind": "email-service", "near": "api"}, {"op": "machine", "id": "consumer", "on": true}, {"op": "add", "kind": "hyperdrive", "near": null}, {"op": "events", "edge": "room-services", "events": ["FILE_READY", "VIEWER_JOINED"]}, {"op": "add", "kind": "basin-sql", "near": "hyperdrive"}, {"op": "add", "kind": "cache-reserve", "near": null}, {"op": "add", "kind": "ai-controls", "near": null}, {"op": "tidy"}] as CloudflareWalkStep[] },
];

describe('Editing Cloudflare, fuzzed', () => {
  for (const c of WALKS) for (const seed of SEEDS) {
    it(`${c.name}, seed ${seed}`, async () => {
      const r = await walk(c, { seed, count: STEPS });
      if (r.found.length) {
        const text = report(c.name, seed, r);
        if (OUT) appendFileSync(OUT, `${text}\n`);
        console.log(text);
      }
      expect(r.found).toEqual([]);
    }, 120_000);
  }
});

if (REGRESSIONS.length) describe('Editing Cloudflare, regressions', () => {
  for (const reg of REGRESSIONS) {
    it(reg.name, async () => {
      const c = WALKS.find((w) => w.name === reg.walk)!;
      const r = await walk(c, { steps: reg.steps });
      if (r.found.length && OUT) appendFileSync(OUT, report(c.name, reg.name, r));
      expect(r.found).toEqual([]);
    }, 120_000);
  }
});

/* ══ Machines: laid out again on each edit ══ */

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Every state's path in a config, the root's first. */
function pathsOf(config: StateMachineConfig): StatePath[] {
  const out: StatePath[] = [[]];
  const walkIn = (s: StateMachineConfig, path: StatePath) => { if (isPlain(s.states)) for (const [k, kid] of Object.entries(s.states)) if (isPlain(kid)) { out.push([...path, k]); walkIn(kid, [...path, k]); } };
  walkIn(config, []);
  return out;
}
/** Every `on` transition's place. */
function onPlaces(config: StateMachineConfig) {
  return pathsOf(config).flatMap((path) => {
    const s = stateAt(config, path);
    if (!s || !isPlain(s.on)) return [];
    return Object.entries(s.on).flatMap(([event, v]) => (Array.isArray(v) ? v : [v]).map((_, index) => ({ state: path, stateId: '', event, index, target: 0 })));
  });
}

type MachineStep = { op: string; edit: (c: StateMachineConfig) => StateMachineConfig; select: (d: DiagramDrawing) => { nodes: string[]; edges: string[] } };

function pickMachineStep(rng: () => number, config: StateMachineConfig, n: number): MachineStep | null {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
  const paths = pathsOf(config), states = paths.filter((p) => p.length);
  const places = onPlaces(config);
  const byTitle = (title: string) => (d: DiagramDrawing) => ({ nodes: d.index.nodes.filter((x) => x.title === title).map((x) => x.id).slice(0, 1), edges: [] });
  const byEvent = (event: string) => (d: DiagramDrawing) => ({ nodes: [], edges: d.edges.filter((e) => e.edge.title === event || (e.edge.data as { event?: string } | undefined)?.event === event).map((e) => e.edge.id).slice(0, 1) });
  const nothing = () => ({ nodes: [], edges: [] });
  const choices: (() => MachineStep | null)[] = [
    () => { const parent = rng() < 0.7 ? [] : pick(paths); const key = `s${n}`; return { op: `add state ${key} in ${parent.join('.') || 'the root'}`, edit: (c) => addState(c, parent, key), select: byTitle(key) }; },
    () => { if (!states.length) return null; const p = pick(states); const key = `${p[p.length - 1]}x`; return { op: `rename ${p.join('.')} to ${key}`, edit: (c) => renameState(c, p, key), select: byTitle(key) }; },
    () => { if (states.length < 3) return null; const p = pick(states); return { op: `delete ${p.join('.')}`, edit: (c) => removeState(c, p), select: nothing }; },
    () => {
      // Into any state, a parallel state's region itself too.
      if (!states.length) return null;
      const a = pick(states), b = pick(states);
      const ev = `EV${n}`;
      return { op: `${ev}: ${a.join('.')} → ${b.join('.')}`, edit: (c) => addTransition(c, a, ev, b), select: byEvent(ev) };
    },
    () => { if (!places.length || !states.length) return null; const p = pick(places), to = pick(states); return { op: `retarget ${p.event} from ${p.state.join('.')} to ${to.join('.')}`, edit: (c) => setTransitionTarget(c, p, to), select: byEvent(p.event) }; },
    () => { if (!places.length) return null; const p = pick(places); return { op: `delete ${p.event} from ${p.state.join('.')}`, edit: (c) => removeTransition(c, p), select: nothing }; },
    () => { if (!states.length) return null; const p = pick(states), slot = pick(['entry', 'exit'] as const), name = `${slot}Action${n}`; return { op: `${slot} ${name} on ${p.join('.')}`, edit: (c) => addAction(c, { state: p, slot }, name), select: byTitle(p[p.length - 1]!) }; },
    () => { if (!states.length) return null; const p = pick(states), slot = pick(['entry', 'exit'] as const); return { op: `take ${slot} action off ${p.join('.')}`, edit: (c) => removeAction(c, { state: p, slot }, 0), select: byTitle(p[p.length - 1]!) }; },
    () => { if (!places.length) return null; const p = pick(places), guard = rng() < 0.7 ? `can${n}` : null; return { op: `guard ${p.event} ${guard ?? 'none'}`, edit: (c) => setTransitionGuard(c, p, guard), select: byEvent(p.event) }; },
    () => { if (!places.length) return null; const p = pick(places), name = `do${n}`; return { op: `action ${name} on ${p.event}`, edit: (c) => addAction(c, { transition: p }, name), select: byEvent(p.event) }; },
    () => ({ op: `context key k${n}`, edit: (c) => addContextKey(c, `k${n}`, n), select: nothing }),
    () => { const keys = isPlain(config.context) ? Object.keys(config.context) : []; if (!keys.length) return null; const k = pick(keys); return { op: `take context key ${k}`, edit: (c) => removeContextKey(c, k), select: nothing }; },
  ];
  for (let t = 0; t < 12; t++) { const s = pick(choices)(); if (s) return s; }
  return null;
}

const MACHINES = [{ name: 'the Audio Player', config: parseXState(AUDIO_PLAYER_SOURCE) as StateMachineConfig }, { name: 'several targets', config: SEVERAL_TARGETS as StateMachineConfig }];

describe('Editing a machine, fuzzed', () => {
  for (const m of MACHINES) for (const seed of SEEDS) {
    it(`${m.name}, seed ${seed}`, async () => {
      const frame = FRAMES.find((f) => f.name === '1280x800')!;
      const { size, pad } = boardOf(frame, true);
      const board = stepOf(size);
      const rng = seeded(seed);
      let config = m.config;
      const draftOf = (c: StateMachineConfig) => machineToDraft(createMachine(c as never) as never);
      const draw = async (c: StateMachineConfig) => {
        const draft = draftOf(c);
        const raw = await elkOf(draft as DiagramDraft);
        const { nodes, edges } = onLayout(draft as DiagramDraft, finishLayout(raw, { board, text }));
        return drawDiagram(nodes.length <= AVOID_UP_TO ? growNodesToText(nodes as DiagramNode[], text) : nodes, edges, text);
      };
      let d = await draw(config);
      let view = firstView(d.bounds, size, pad);
      const done: string[] = [];
      const found: string[] = [];
      for (let i = 0; i < Math.round(STEPS / 2) && !found.length; i++) {
        const s = pickMachineStep(rng, config, i);
        if (!s) continue;
        let next: StateMachineConfig;
        try { next = s.edit(config); draftOf(next); } catch { continue; }
        done.push(s.op);
        config = next;
        d = await draw(config);
        const say = (v: string) => found.push(`step ${done.length} (${s.op}): ${v}`);
        for (const v of [...check(d), ...checkLabelRuns(d), ...checkOverlaps(d), ...checkContained(d), ...checkDetours(d), ...checkCrossings(d)]) say(v);
        const sel = s.select(d);
        if (sel.nodes.length || sel.edges.length) {
          const eye = diagramEye(d, sel, null, { ends: true });
          if (eye) {
            view = keepInView(view, eye, drawingCorner(d, text), size, pad);
            const r = eye.must;
            const shown = r.x * view.zoom + view.x >= pad.left - 1 && r.y * view.zoom + view.y >= pad.top - 1 && (r.x + r.w) * view.zoom + view.x <= size.width - pad.right + 1 && (r.y + r.h) * view.zoom + view.y <= size.height - pad.bottom + 1;
            if (!shown && r.w * 0.875 <= size.width - pad.left - pad.right && r.h * 0.875 <= size.height - pad.top - pad.bottom) say(`what was edited (${fmtR(r)}) isn’t in view`);
          }
        }
      }
      if (found.length) {
        const textOut = `${m.name}, seed ${seed}:\n  ${found.slice(0, 12).join('\n  ')}\n  steps: ${JSON.stringify(done)}\n`;
        if (OUT) appendFileSync(OUT, `${textOut}\n`);
        console.log(textOut);
      }
      expect(found).toEqual([]);
    }, 120_000);
  }
});

