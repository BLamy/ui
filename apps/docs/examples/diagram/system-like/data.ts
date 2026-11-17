import type { DiagramDraft } from '@/lib/diagram-layout'

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
