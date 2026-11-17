/* What the studio opens with when nothing's saved: a file upload. The API puts a file in R2 and queues a job, the consumer
   writes a row to D1 and tells the file's Room, a Durable Object with a machine, that it's ready. */
import { placeInLayers } from '@/lib/cloudflare-board';
import type { SavedStudio } from './studio-files';

export const EXAMPLE: SavedStudio = {
  name: 'File upload',
  // Placed top to bottom, as editing draws its cards, so it opens at once, the same every time.
  system: placeInLayers({
    services: [
      { id: 'api', kind: 'workers', label: 'API' },
      { id: 'files', kind: 'r2', label: 'Files' },
      { id: 'jobs', kind: 'queues', label: 'Jobs' },
      { id: 'consumer', kind: 'workers', label: 'Consumer' },
      { id: 'db', kind: 'd1', label: 'Uploads' },
      {
        id: 'room',
        kind: 'durable-objects',
        label: 'Room',
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
  }, { editable: true }),
};
