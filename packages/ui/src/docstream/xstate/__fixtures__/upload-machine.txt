/* Story data: a file upload moving through a Worker, R2, a Queue, a consumer, D1 and a Durable Object. The machine from the
   Cloudflare diagrams spike, unchanged. */
import { assign, fromPromise, setup } from 'xstate';

export const uploadMachine = setup({
  types: {} as {
    context: { retries: number; bytes: number; viewers: number };
    events:
      | { type: 'CHUNK'; size: number } | { type: 'EOF' } | { type: 'CANCEL' } | { type: 'HEARTBEAT' }
      | { type: 'R2_EVENT' } | { type: 'VIEWER_JOINED' } | { type: 'RETRY' } | { type: 'ALARM' };
  },
  actions: {
    countBytes: assign({ bytes: ({ context, event }) => context.bytes + ((event as { size?: number }).size ?? 0) }),
    bumpRetry: assign({ retries: ({ context }) => context.retries + 1 }),
    addViewer: assign({ viewers: ({ context }) => context.viewers + 1 }),
    logFailure: () => {},
    ackMessage: () => {},
  },
  guards: {
    withinQuota: () => true,
    retriesLeft: ({ context }) => context.retries < 3,
    isImage: () => true,
    isClean: () => true,
    hasViewers: ({ context }) => context.viewers > 0,
  },
  actors: {
    verifyToken: fromPromise(async () => ({ ok: true })),
    putObject: fromPromise(async () => ({ etag: 'x' })),
    pullMessage: fromPromise(async () => ({ key: 'x' })),
    scanObject: fromPromise(async () => ({ clean: true })),
    makeThumbnails: fromPromise(async () => ({})),
    insertRow: fromPromise(async () => ({})),
    broadcast: fromPromise(async () => ({})),
  },
  delays: { IDLE_TIMEOUT: 30000, QUEUE_VISIBILITY: 60000, BACKOFF: ({ context }) => 2 ** context.retries * 1000 },
}).createMachine({
  id: 'upload',
  initial: 'worker',
  context: { retries: 0, bytes: 0, viewers: 0 },
  on: { CANCEL: { target: '.cancelled' } },
  states: {
    worker: {
      description: 'The Worker takes the request',
      initial: 'authenticating',
      states: {
        authenticating: {
          invoke: { src: 'verifyToken', onDone: { target: 'checkingQuota' }, onError: { target: '#upload.rejected' } },
        },
        checkingQuota: { always: [{ guard: 'withinQuota', target: 'streaming' }, { target: '#upload.rejected' }] },
        streaming: {
          on: {
            CHUNK: { actions: 'countBytes' },
            HEARTBEAT: { target: 'streaming', reenter: true },
            EOF: { target: 'committing' },
          },
          after: { IDLE_TIMEOUT: { target: '#upload.rejected' } },
        },
        committing: {
          invoke: {
            src: 'putObject',
            onDone: { target: '#upload.queue' },
            onError: { target: 'backingOff' },
          },
        },
        backingOff: {
          after: { BACKOFF: [{ guard: 'retriesLeft', target: 'committing', actions: 'bumpRetry' }, { target: '#upload.failed', actions: 'logFailure' }] },
        },
      },
    },
    queue: {
      description: 'R2 notifies a Queue; a consumer picks it up',
      initial: 'waiting',
      states: {
        waiting: {
          on: { R2_EVENT: { target: 'delivered' } },
          after: { QUEUE_VISIBILITY: { target: 'waiting', reenter: true } },
        },
        delivered: {
          invoke: { src: 'pullMessage', onDone: { target: '#upload.processing', actions: 'ackMessage' }, onError: { target: 'waiting' } },
        },
      },
    },
    processing: {
      type: 'parallel',
      states: {
        scan: {
          initial: 'scanning',
          states: {
            scanning: { invoke: { src: 'scanObject', onDone: { target: 'verdict' }, onError: { target: 'quarantined' } } },
            verdict: { always: [{ guard: 'isClean', target: 'clean' }, { target: 'quarantined' }] },
            clean: { type: 'final' },
            quarantined: { type: 'final' },
          },
        },
        thumbnails: {
          initial: 'deciding',
          states: {
            deciding: { always: [{ guard: 'isImage', target: 'resizing' }, { target: 'skipped' }] },
            resizing: { invoke: { src: 'makeThumbnails', onDone: { target: 'stored' }, onError: { target: 'skipped' } } },
            stored: { type: 'final' },
            skipped: { type: 'final' },
          },
        },
        metadata: {
          initial: 'inserting',
          states: {
            inserting: {
              invoke: { src: 'insertRow', onDone: { target: 'written' }, onError: { target: 'waitingToRetry' } },
            },
            waitingToRetry: {
              on: { RETRY: { target: 'inserting' } },
              after: { 5000: { target: 'inserting' } },
            },
            written: { type: 'final' },
          },
        },
      },
      onDone: { target: 'room' },
    },
    room: {
      description: 'A Durable Object tells whoever is watching',
      initial: 'idle',
      on: { VIEWER_JOINED: { actions: 'addViewer' } },
      states: {
        idle: {
          always: { guard: 'hasViewers', target: 'broadcasting' },
          on: { ALARM: { target: 'closing' } },
        },
        broadcasting: { invoke: { src: 'broadcast', onDone: { target: 'closing' }, onError: { target: 'idle' } } },
        closing: { type: 'final' },
      },
      onDone: { target: 'done' },
    },
    done: { type: 'final' },
    rejected: { type: 'final' },
    failed: { type: 'final' },
    cancelled: { type: 'final' },
  },
});
