/* Story data: XState configs the StateDiagram stories draw and the diagram family's layout invariants check. */
import { and, not } from 'xstate';

/** Each form of transition: an event alone, a guard (with params, and composed), actions, both; `after`; `always`; `reenter`;
 *  a targetless one; the wildcard; several targets; and `on` at the machine's root. */
export const TRANSITION_FORMS = {
  id: 'forms',
  initial: 'idle',
  on: { RESET: { target: '.idle', actions: 'clearAll' } },
  states: {
    idle: {
      on: {
        GO: 'busy',
        TRY: { target: 'busy', guard: 'canTry' },
        SAVE: { target: 'busy', guard: { type: 'isAbove', params: { min: 3 } }, actions: ['save', 'notify'] },
        PING: { actions: 'pong' },
        '*': 'unknown',
      },
      after: { 500: 'busy', IDLE_TIMEOUT: 'away' },
    },
    busy: {
      on: { AGAIN: { target: 'busy', reenter: true, actions: 'restart' }, SPLIT: { target: ['#forms.both.left.on', '#forms.both.right.on'] } },
      always: { guard: and(['isDone', not('isLocked')]), target: 'idle' },
    },
    both: {
      type: 'parallel',
      states: { left: { initial: 'off', states: { off: {}, on: {} } }, right: { initial: 'off', states: { off: {}, on: {} } } },
    },
    away: {},
    unknown: {},
  },
};

/** A transition to several targets at once, one in each region of a parallel state. */
export const SEVERAL_TARGETS = {
  id: 'player',
  initial: 'stopped',
  states: {
    stopped: { on: { PLAY: { target: ['#player.playing.audio.on', '#player.playing.video.on'], actions: 'startClock' } } },
    playing: {
      type: 'parallel',
      on: { STOP: 'stopped' },
      states: {
        audio: { initial: 'off', states: { off: { on: { UNMUTE: 'on' } }, on: { on: { MUTE: 'off' } } } },
        video: { initial: 'off', states: { off: { on: { SHOW: 'on' } }, on: { on: { HIDE: 'off' } } } },
      },
    },
  },
};
