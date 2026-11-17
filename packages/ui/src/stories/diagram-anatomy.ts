import type { DiagramDraft } from '@/lib/diagram-layout';
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model';

/* Story data: two diagrams drawn with nothing but Diagram's generic parts (header strips, sections of items, containers,
   the entry marker, glyphs, edge labels that are pills or cards, self-loops). The first is the XState visualizer's
   "Audio Player" machine as a statechart would map it; the second a small system of services as a Cloudflare diagram
   would. Neither uses StateDiagram or CloudflareDiagram: they show the core is enough. */

const bolt = (title: string) => ({ title, icon: 'bolt' as const });

/** The Audio Player machine: a root with its context, Init, Loading, Active { Paused, Playing }, Error. */
export const STATECHART_LIKE: DiagramDraft = {
  nodes: [
    {
      id: 'player', kind: 'root', title: 'Audio Player',
      sections: [{ title: 'Context', variant: 'code', items: [
        { title: 'audioRef:', description: 'string' }, { title: 'currentTime:', description: 'number' },
        { title: 'trackSource:', description: 'string' }, { title: 'audioContext:', description: 'string' },
      ] }],
    },
    { id: 'init', parent: 'player', title: 'Init', entry: true },
    { id: 'loading', parent: 'player', title: 'Loading' },
    { id: 'active', kind: 'group', parent: 'player', title: 'Active' },
    { id: 'paused', parent: 'active', title: 'Paused', entry: true, sections: [{ title: 'Entry actions', items: [bolt('onPause')] }] },
    { id: 'playing', parent: 'active', title: 'Playing', sections: [{ title: 'Entry actions', items: [bolt('onPlay')] }] },
    { id: 'error', parent: 'player', title: 'Error', icon: 'stop' },
  ],
  edges: [
    { id: 'init-loading', from: 'init', to: 'loading', title: 'loading', sections: [{ items: [bolt('onLoad')] }] },
    { id: 'init-error', from: 'init', to: 'error', title: 'init-error', sections: [{ items: [bolt('onError')] }] },
    { id: 'loading-active', from: 'loading', to: 'active', title: 'loaded' },
    { id: 'loading-error', from: 'loading', to: 'error', title: 'error', sections: [{ items: [bolt('onError')] }] },
    { id: 'paused-playing', from: 'paused', to: 'playing', title: 'play' },
    { id: 'playing-paused', from: 'playing', to: 'paused', title: 'pause' },
    { id: 'playing-restart', from: 'playing', to: 'paused', title: 'restart', sections: [{ items: [bolt('onRestart')] }] },
    { id: 'playing-end', from: 'playing', to: 'paused', title: 'end' },
    { id: 'playing-self-restart', from: 'playing', to: 'playing', title: 'restart', sections: [{ items: [bolt('onRestart')] }] },
    { id: 'playing-time', from: 'playing', to: 'playing', title: 'time', sections: [{ items: [bolt('onUpdateTime')] }] },
  ],
};

/** A small system: a Worker that takes requests and a schedule, a bucket, a queue, a consumer with a Durable Object
 *  class inside it, and a database. */
export const SYSTEM_LIKE: DiagramDraft = {
  nodes: [
    {
      id: 'system', kind: 'root', title: 'Uploads', icon: 'cloud',
      sections: [{ title: 'Account', variant: 'list', items: [
        { title: 'Compatibility date', description: '2026-11-01' }, { title: 'Placement', description: 'smart' },
      ] }],
    },
    {
      id: 'api', parent: 'system', title: 'api', icon: 'cube', trailing: 'Worker', entry: true,
      sections: [
        { title: 'Exposes', items: [{ title: 'fetch', icon: 'globe' }, { title: 'scheduled', icon: 'clock' }] },
        { title: 'Triggers', variant: 'list', items: [{ title: 'uploads.example.com/*', icon: 'link' }, { title: '*/5 * * * *', icon: 'clock' }] },
      ],
    },
    { id: 'files', parent: 'system', title: 'files', icon: 'archivebox', trailing: 'R2 bucket', sections: [{ title: 'Event notifications', items: [{ title: 'object-create' }] }] },
    { id: 'jobs', parent: 'system', title: 'jobs', icon: 'tray', trailing: 'Queue', description: 'Batches of 10, or every 5 s.' },
    { id: 'consumer', kind: 'group', parent: 'system', title: 'consumer', icon: 'cube', trailing: 'Worker', sections: [{ title: 'Exposes', items: [{ title: 'queue', icon: 'tray' }] }] },
    { id: 'room', parent: 'consumer', title: 'Room', icon: 'layers', trailing: 'Durable Object', sections: [{ title: 'Handlers', items: [{ title: 'alarm', icon: 'clock' }, { title: 'webSocketMessage' }] }] },
    { id: 'db', parent: 'system', title: 'uploads', icon: 'table', trailing: 'D1', tone: 'warning', description: 'Not migrated yet.' },
  ],
  edges: [
    { id: 'api-files', from: 'api', to: 'files', title: 'FILES', sections: [{ items: [{ title: 'put' }, { title: 'get' }] }] },
    { id: 'api-jobs', from: 'api', to: 'jobs', title: 'JOBS', sections: [{ items: [{ title: 'send' }] }] },
    { id: 'files-jobs', from: 'files', to: 'jobs', title: 'object-create', variant: 'dashed' },
    { id: 'jobs-consumer', from: 'jobs', to: 'consumer', title: 'queue' },
    { id: 'consumer-db', from: 'room', to: 'db', title: 'DB', sections: [{ items: [{ title: 'prepare' }, { title: 'batch', tone: 'warning' }] }] },
  ],
};

/** Every kind of node, hand-placed (the NodeKinds story). */
export const KINDS: DiagramNode[] = [
  { id: 'root', kind: 'root', title: 'A root, which holds everything', x: 0, y: 0, w: 900, h: 420 },
  { id: 'plain', kind: 'node', parent: 'root', title: 'A node', x: 40, y: 56, w: 120, h: 36 },
  { id: 'detail', kind: 'node', parent: 'root', title: 'With a detail', description: 'invoke fetchUser', x: 200, y: 50, w: 150, h: 50 },
  { id: 'final', variant: 'double', parent: 'root', title: 'Double', x: 400, y: 56, w: 110, h: 36 },
  { id: 'initial', kind: 'marker', parent: 'root', title: 'Start', x: 560, y: 66, w: 12, h: 12 },
  { id: 'compound', kind: 'group', parent: 'root', title: 'A group', x: 40, y: 140, w: 320, h: 240 },
  { id: 'inner', kind: 'node', parent: 'compound', title: 'Inside', x: 90, y: 200, w: 110, h: 36 },
  { id: 'parallel', kind: 'group', variant: 'dashed', parent: 'root', title: 'A dashed group', description: 'of regions', x: 400, y: 140, w: 460, h: 240 },
  { id: 'r1', kind: 'region', parent: 'parallel', title: 'A region', x: 412, y: 204, w: 436, h: 80 },
  { id: 'r2', kind: 'region', parent: 'parallel', title: 'Another', x: 412, y: 292, w: 436, h: 80 },
  { id: 'r1a', kind: 'node', parent: 'r1', title: 'One', x: 560, y: 228, w: 100, h: 36 },
  { id: 'r2a', kind: 'node', parent: 'r2', title: 'Two', x: 560, y: 316, w: 100, h: 36 },
];

/** Every kind of edge between hand-placed nodes (the EdgeKinds story). */
export const EDGE_NODES: DiagramNode[] = [
  { id: 'a', title: 'default', x: 0, y: 0, w: 110, h: 36 },
  { id: 'a2', title: 'target', x: 300, y: 0, w: 110, h: 36 },
  { id: 'b', title: 'dashed', x: 0, y: 70, w: 110, h: 36 },
  { id: 'b2', title: 'target', x: 300, y: 70, w: 110, h: 36 },
  { id: 'c', title: 'dotted', x: 0, y: 140, w: 110, h: 36 },
  { id: 'c2', title: 'target', x: 300, y: 140, w: 110, h: 36 },
  { id: 'd', title: 'strong', x: 0, y: 210, w: 110, h: 36 },
  { id: 'd2', title: 'target', x: 300, y: 210, w: 110, h: 36 },
  { id: 'e', title: 'destructive', x: 0, y: 280, w: 110, h: 36 },
  { id: 'e2', title: 'target', x: 300, y: 280, w: 110, h: 36 },
  { id: 'dot', kind: 'marker', x: 49, y: 350, w: 12, h: 12 },
  { id: 'f2', title: 'from a marker', x: 300, y: 338, w: 110, h: 36 },
  { id: 's', title: 'straight', x: 520, y: 0, w: 110, h: 36 },
  { id: 's2', title: 'target', x: 800, y: 90, w: 110, h: 36 },
  { id: 'el', title: 'elbow', x: 520, y: 100, w: 110, h: 36 },
  { id: 'el2', title: 'target', x: 800, y: 190, w: 110, h: 36 },
  { id: 'cu', title: 'curve', x: 520, y: 200, w: 110, h: 36 },
  { id: 'cu2', title: 'target', x: 800, y: 290, w: 110, h: 36 },
  { id: 'loop', title: 'self-loops', x: 600, y: 470, w: 130, h: 36 },
  { id: 'p', title: 'parallel', x: 560, y: 340, w: 110, h: 90 },
  { id: 'p2', title: 'edges', x: 850, y: 340, w: 110, h: 90 },
  { id: 'box', kind: 'group', title: 'to and from its own child', x: 0, y: 420, w: 420, h: 120 },
  { id: 'kid', parent: 'box', title: 'child', x: 120, y: 490, w: 110, h: 36 },
];
export const EDGES: DiagramEdge[] = [
  { id: 'ev', from: 'a', to: 'a2', title: 'SUBMIT' },
  { id: 'al', from: 'b', to: 'b2', variant: 'dashed', title: 'always [isValid]' },
  { id: 'af', from: 'c', to: 'c2', variant: 'dotted', title: 'after 5000' },
  { id: 'do', from: 'd', to: 'd2', variant: 'strong', title: 'strong' },
  { id: 'in', from: 'e', to: 'e2', tone: 'destructive', title: 'can’t' },
  { id: 'it', from: 'dot', to: 'f2', variant: 'strong' },
  { id: 'r1', from: 's', to: 's2', route: 'straight', title: 'a straight route' },
  { id: 'r2', from: 'el', to: 'el2', route: 'elbow', title: 'an elbow route' },
  { id: 'r3', from: 'cu', to: 'cu2', route: 'curve', title: 'a curved route' },
  { id: 'l1', from: 'loop', to: 'loop', title: 'RETRY' },
  { id: 'l2', from: 'loop', to: 'loop', title: 'PING', variant: 'dotted' },
  { id: 'p1', from: 'p', to: 'p2', title: 'one' },
  { id: 'p2', from: 'p', to: 'p2', title: 'two' },
  { id: 'p3', from: 'p', to: 'p2', title: 'three' },
  { id: 'wall', from: 'box', to: 'kid', title: 'enter' },
  { id: 'wall2', from: 'kid', to: 'box', route: 'curve' },
];
