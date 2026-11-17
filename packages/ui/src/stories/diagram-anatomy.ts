import type { DiagramDraft } from '@/lib/diagram-layout';

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
