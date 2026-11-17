import type { DiagramDraft } from '@/lib/diagram-layout'

const bolt = (title: string) => ({ title, icon: 'bolt' as const });

/** The Audio Player machine: a root with its context, Init, Loading, Active { Paused, Playing }, Error. */
export const STATECHART_LIKE: DiagramDraft = {
  nodes: [
    {
      id: 'player', kind: 'root', title: 'Audio Player',
      sections: [{ title: 'Context', variant: 'code', items: [
        { title: 'audioRef', description: 'string' }, { title: 'currentTime', description: 'number' },
        { title: 'trackSource', description: 'string' }, { title: 'audioContext', description: 'string' },
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
