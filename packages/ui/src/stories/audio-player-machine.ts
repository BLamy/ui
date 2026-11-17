/* Story data: the "Audio Player" machine from XState's visualizer, written as real XState v5. It's source text, as
   StateDiagram's `source` and the xstate fence read it (types and all: `types.context` is what the Context section shows),
   and never run: its actions are named, with implementations in `setup` that an app would write. */
export const AUDIO_PLAYER_SOURCE = `import { setup } from 'xstate';

export const audioPlayer = setup({
  types: {
    context: {} as {
      audioRef: string;
      currentTime: number;
      trackSource: string;
      audioContext: string;
    },
    events: {} as
      | { type: 'loading' } | { type: 'init-error' } | { type: 'loaded' } | { type: 'error' }
      | { type: 'play' } | { type: 'pause' } | { type: 'restart' } | { type: 'end' }
      | { type: 'time'; currentTime: number },
  },
  actions: {
    onLoad: () => {},
    onError: () => {},
    onPause: () => {},
    onPlay: () => {},
    onRestart: () => {},
    onUpdateTime: () => {},
  },
}).createMachine({
  id: 'Audio Player',
  context: { audioRef: '', currentTime: 0, trackSource: '', audioContext: '' },
  initial: 'Init',
  states: {
    Init: {
      on: {
        loading: { target: 'Loading', actions: 'onLoad' },
        'init-error': { target: 'Error', actions: 'onError' },
      },
    },
    Loading: {
      on: {
        loaded: 'Active',
        error: { target: 'Error', actions: 'onError' },
      },
    },
    Active: {
      initial: 'Paused',
      states: {
        Paused: {
          entry: 'onPause',
          on: {
            play: 'Playing',
            restart: { target: 'Playing', actions: 'onRestart' },
          },
        },
        Playing: {
          entry: 'onPlay',
          on: {
            pause: 'Paused',
            end: 'Paused',
            restart: { target: 'Playing', reenter: true, actions: 'onRestart' },
            time: { actions: 'onUpdateTime' },
          },
        },
      },
    },
    Error: { type: 'final' },
  },
});`;
