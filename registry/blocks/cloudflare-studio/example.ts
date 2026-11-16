/* What the studio opens with when nothing's saved: a file upload. The API puts a file in R2 and queues a job, the consumer
   writes a row to D1 and tells the file's Room, a Durable Object with a machine, that it's ready. */
import type { SavedStudio } from './studio-files';

export const EXAMPLE: SavedStudio = {
  name: 'File upload',
  system: {
    services: [
      { id: 'api', kind: 'workers', label: 'API', at: { x: 0, y: 60 } },
      { id: 'files', kind: 'r2', label: 'Files', at: { x: 340, y: 0 } },
      { id: 'jobs', kind: 'queues', label: 'Jobs', at: { x: 340, y: 140 } },
      { id: 'consumer', kind: 'workers', label: 'Consumer', at: { x: 680, y: 60 } },
      { id: 'db', kind: 'd1', label: 'Uploads', at: { x: 1020, y: 0 } },
      {
        id: 'room',
        kind: 'durable-objects',
        label: 'Room',
        at: { x: 1020, y: 160 },
        machine: {
          id: 'room',
          initial: 'empty',
          states: {
            empty: { on: { VIEWER_JOINED: 'watched' } },
            watched: { on: { VIEWER_LEFT: 'empty', FILE_READY: 'watched' } },
          },
        },
      },
    ],
    edges: [
      { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put'] },
      { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
      { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer' },
      { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
      { id: 'consumer-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['FILE_READY'] },
    ],
  },
};
