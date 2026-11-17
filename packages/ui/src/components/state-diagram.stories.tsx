import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { and, not } from 'xstate';
import { StateDiagram } from '@/components/ui/state-diagram';
import { BLProvider, type AppearancePreference } from '@/lib/theme';
import { AUDIO_PLAYER_SOURCE } from '../stories/audio-player-machine';
import { uploadMachine } from '../stories/upload-machine';

const meta: Meta<typeof StateDiagram> = {
  title: 'Organisms/StateDiagram',
  component: StateDiagram,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof StateDiagram>;

/** The story's whole canvas, as an app's page would have it (`layout: 'fullscreen'`), or a phone's or a tablet's width of it. */
function Page({ children, appearance, w, h }: { children?: ReactNode; appearance?: AppearancePreference; w?: number; h?: number }) {
  return (
    <div style={{ position: 'relative', width: w ?? '100%', height: h ?? '100dvh', overflow: 'hidden' }}>
      <BLProvider appearance={appearance}>{children}</BLProvider>
    </div>
  );
}

/** A machine as it is, with nothing of it run: 33 states and all 36 ways out, compound and parallel, in a worker. */
export const Machine: Story = {
  render: () => <Page><StateDiagram machine={uploadMachine as never} aria-label="File upload" /></Page>,
};

export const MachineDark: Story = {
  render: () => <Page appearance="dark"><StateDiagram machine={uploadMachine as never} aria-label="File upload" /></Page>,
};

const DOOR = {
  id: 'door',
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open', LOCK: { guard: 'hasKey', target: 'locked' } } },
    open: { on: { CLOSE: 'closed', AGAIN: { target: 'open', reenter: true } }, after: { 5000: 'closed' } },
    locked: { on: { UNLOCK: 'closed' }, invoke: { src: 'alarm', onDone: 'closed', onError: 'jammed' } },
    jammed: { type: 'final' },
  },
};

/** A config, as JSON: guards, delays and actors named, with no code. */
export const FromConfig: Story = {
  render: () => <Page><StateDiagram config={DOOR} /></Page>,
};

export const FromConfigDark: Story = {
  render: () => <Page appearance="dark"><StateDiagram config={DOOR} /></Page>,
};

const HISTORY = {
  id: 'player',
  initial: 'playing',
  states: {
    playing: {
      initial: 'track',
      states: { track: { initial: 'one', states: { one: { on: { NEXT: 'two' } }, two: {} } }, ad: {}, shallow: { type: 'history' }, deep: { type: 'history', history: 'deep' } },
      on: { PAUSE: 'paused' },
    },
    paused: { on: { RESUME: 'playing.deep', RESTART: 'playing.shallow' } },
  },
};

/** Read-only, a state selected: a picture you can select in and read, where nothing moves, connects or is deleted. */
export const ReadOnlySelected: Story = {
  render: () => <Page><StateDiagram config={DOOR} defaultSelection={{ nodes: ['door.locked'], edges: [] }} /></Page>,
};

const SOURCE = `import { setup } from 'xstate';

export const door = setup({ guards: { hasKey: () => true } }).createMachine({
  id: 'door',
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open', LOCK: { guard: 'hasKey', target: 'locked' } } },
    open: { on: { CLOSE: 'closed' }, after: { 5000: 'closed' } },
    locked: { on: { UNLOCK: 'closed' } },
  },
});`;

/** From a machine's source, read without running it, as docstream's xstate fence reads it. */
export const FromSource: Story = {
  render: () => <Page><StateDiagram source={SOURCE} simulate /></Page>,
};

/** History states carry their glyph: H for shallow, H* for deep. */
export const History: Story = {
  render: () => <Page><StateDiagram config={HISTORY} /></Page>,
};

/** A config XState won't have shows what XState said. */
export const Invalid: Story = {
  render: () => <Page><StateDiagram config={{ id: 'door', initial: 'closed', states: { closed: { on: { OPEN: 'nowhere' } } } }} /></Page>,
};

/** Running, with stand-ins for all it names: where it is is lit, and the panel has what it can do next. */
export const Simulating: Story = {
  render: () => <Page><StateDiagram machine={uploadMachine as never} simulate aria-label="File upload" /></Page>,
};

export const SimulatingDark: Story = {
  render: () => <Page appearance="dark"><StateDiagram machine={uploadMachine as never} simulate aria-label="File upload" /></Page>,
};

const IN_PROCESSING = { ...(uploadMachine as unknown as { config: object }).config, initial: 'processing' };

/** In a parallel state, it's in one state of each region, all lit at once. */
export const SimulatingRegions: Story = {
  render: () => <Page><StateDiagram config={IN_PROCESSING} simulate aria-label="File upload" /></Page>,
};

/** At a phone's size, the panel's out of the way until it's asked for: a bar says where the machine is, and opens it. */
export const SimulatingPhone: Story = {
  render: () => <Page w={390}><StateDiagram config={DOOR} direction="down" simulate /></Page>,
};

/** Open on a phone, the panel is a page pushed over the board, with a back button to it. */
export const SimulatingPhonePanel: Story = {
  render: () => <Page w={390}><StateDiagram config={DOOR} direction="down" simulate defaultPanelOpen /></Page>,
};

export const SimulatingPhonePanelDark: Story = {
  render: () => <Page w={390} appearance="dark"><StateDiagram config={DOOR} direction="down" simulate defaultPanelOpen /></Page>,
};

/** At a tablet's size, a drawer over the board that doesn't dim it, so the machine stays in sight. */
export const SimulatingTablet: Story = {
  render: () => <Page w={640}><StateDiagram config={DOOR} direction="down" simulate defaultPanelOpen /></Page>,
};

/** While ELK lays it out: a status says so, and there's no empty state. */
export const LayingOut: Story = {
  render: () => <Page><StateDiagram config={DOOR} layout={undefined} /></Page>,
};

const SPIN = { id: 'spin', initial: 'tick', states: { tick: { always: 'tock' }, tock: { always: 'tick' } } };

/** A machine that would hang the page is stopped, and says why. */
export const NeverSettles: Story = {
  render: () => <Page><StateDiagram config={SPIN} simulate /></Page>,
};

/** Editing: what's selected can be changed in the panel, and it writes to the config. */
export const Editing: Story = {
  render: () => <Page><StateDiagram defaultConfig={DOOR} editable /></Page>,
};

export const EditingDark: Story = {
  render: () => <Page appearance="dark"><StateDiagram defaultConfig={DOOR} editable /></Page>,
};

export const EditingAState: Story = {
  render: () => <Page><StateDiagram defaultConfig={DOOR} editable defaultSelection={{ nodes: ['door.open'], edges: [] }} /></Page>,
};

export const EditingATransition: Story = {
  render: () => <Page><StateDiagram defaultConfig={DOOR} editable defaultSelection={{ nodes: [], edges: ['door.closed:LOCK->door.locked'] }} /></Page>,
};

/** Editing and running at once, with the panel on Edit. An edit starts the run over. */
export const EditingAndRunning: Story = {
  render: () => <Page><StateDiagram defaultConfig={DOOR} editable simulate /></Page>,
};

export const EditingPhone: Story = {
  render: () => <Page w={390}><StateDiagram defaultConfig={DOOR} direction="down" editable defaultPanelOpen defaultSelection={{ nodes: ['door.open'], edges: [] }} /></Page>,
};

/* ── What's drawn: the anatomy, piece by piece ── */

/** The "Audio Player" from XState's visualizer, from its source, in the reference's 800 x 1000 frame: the machine's
 *  context under its name, entry actions as chips, transitions as pills or, with actions, cards, and Playing's loops. */
export const AudioPlayer: Story = {
  render: () => <Page w={800} h={1000}><StateDiagram source={AUDIO_PLAYER_SOURCE} aria-label="Audio Player" /></Page>,
};

export const AudioPlayerDark: Story = {
  render: () => <Page w={800} h={1000} appearance="dark"><StateDiagram source={AUDIO_PLAYER_SOURCE} aria-label="Audio Player" /></Page>,
};

/** Running it: where it is is marked, and each transition it can take now is a button on its label (a play glyph and a
 *  primary outline), which sends its event. */
export const AudioPlayerSimulating: Story = {
  render: () => <Page w={800} h={1000} appearance="dark"><StateDiagram source={AUDIO_PLAYER_SOURCE} simulate defaultPanelOpen={false} aria-label="Audio Player" /></Page>,
};

export const AudioPlayerPhone: Story = {
  render: () => <Page w={390} h={844}><StateDiagram source={AUDIO_PLAYER_SOURCE} aria-label="Audio Player" /></Page>,
};

/** Each kind of state: atomic (a header and nothing more), one with entry and exit actions, one that invokes an actor (with
 *  its done and error), tags, a description and meta, a compound state with its start marked, a final state's square. */
const STATE_KINDS = {
  id: 'kinds',
  initial: 'atomic',
  states: {
    atomic: { on: { NEXT: 'acting' } },
    acting: { entry: ['startTimer', { type: 'track', params: { screen: 'acting' } }], exit: 'stopTimer', on: { NEXT: 'fetching' } },
    fetching: {
      description: 'Loads the profile',
      tags: ['busy', 'network'],
      meta: { owner: 'profile', retries: 3 },
      invoke: { id: 'profile', src: 'fetchProfile', input: { user: 'me' }, onDone: 'compound', onError: 'failed' },
    },
    compound: { initial: 'first', states: { first: { on: { NEXT: 'second' } }, second: { on: { NEXT: '#kinds.done' } } } },
    failed: { on: { RETRY: 'fetching' } },
    done: { type: 'final' },
  },
};

export const StateKinds: Story = {
  render: () => <Page><StateDiagram config={STATE_KINDS} aria-label="Each kind of state" /></Page>,
};

/** Each form of transition: an event alone (a pill); with a guard (with params, and composed), actions, both; `after` a
 *  number and a named delay (a clock); `always`; `reenter`; a targetless one that only runs actions; the wildcard; several
 *  targets; and `on` at the machine's root. */
const TRANSITION_FORMS = {
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

export const TransitionForms: Story = {
  render: () => <Page><StateDiagram config={TRANSITION_FORMS} aria-label="Each form of transition" /></Page>,
};

export const TransitionFormsDark: Story = {
  render: () => <Page appearance="dark"><StateDiagram config={TRANSITION_FORMS} aria-label="Each form of transition" /></Page>,
};

/** A transition to several targets at once (one in each region of a parallel state): one label, and the line out of it
 *  splits to each, entering the parallel state through its side, under its header. */
const SEVERAL_TARGETS = {
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

export const SeveralTargets: Story = {
  render: () => <Page><StateDiagram config={SEVERAL_TARGETS} aria-label="A transition to several targets" /></Page>,
};

export const SeveralTargetsDark: Story = {
  render: () => <Page appearance="dark"><StateDiagram config={SEVERAL_TARGETS} aria-label="A transition to several targets" /></Page>,
};

/** A parallel machine: its regions side by side in a dashed container, each with its own start. */
const PARALLEL = {
  id: 'editor',
  type: 'parallel',
  states: {
    bold: { initial: 'off', states: { off: { on: { TOGGLE_BOLD: 'on' } }, on: { on: { TOGGLE_BOLD: 'off' } } } },
    italic: { initial: 'off', states: { off: { on: { TOGGLE_ITALIC: 'on' } }, on: { on: { TOGGLE_ITALIC: 'off' } } } },
    list: { initial: 'none', states: { none: { on: { BULLETS: 'bullets', NUMBERS: 'numbers' } }, bullets: { on: { NONE: 'none', NUMBERS: 'numbers' } }, numbers: { on: { NONE: 'none', BULLETS: 'bullets' } } } },
  },
};

export const Parallel: Story = {
  render: () => <Page><StateDiagram config={PARALLEL} aria-label="A text editor's toolbar" /></Page>,
};

/** A long list of actions: the card grows to hold them, and its edges still leave from its sides. */
const LONG_ACTIONS = {
  id: 'checkout',
  initial: 'cart',
  context: { items: [], total: 0, coupon: null, address: '', paid: false },
  states: {
    cart: { on: { CHECKOUT: { target: 'paying', actions: ['validateCart', 'reserveStock', 'applyCoupon', 'computeTax', 'computeShipping', 'logCheckout'] } } },
    paying: {
      entry: ['showSpinner', 'lockForm', { type: 'track', params: { step: 'pay' } }, { type: 'xstate.assign', params: { keys: ['paid'], values: { paid: false } } }, 'startPaymentTimeout'],
      exit: ['hideSpinner', 'unlockForm', 'clearPaymentTimeout'],
      on: { PAID: 'done', DECLINED: 'cart' },
    },
    done: { type: 'final' },
  },
};

export const LongActionList: Story = {
  render: () => <Page><StateDiagram config={LONG_ACTIONS} aria-label="Checkout" /></Page>,
};

/** A machine with only names: states are their headers, transitions are pills, and that's all there is to draw. */
const ONLY_NAMES = { id: 'light', initial: 'green', states: { green: { on: { TIMER: 'yellow' } }, yellow: { on: { TIMER: 'red' } }, red: { on: { TIMER: 'green' } } } };

export const OnlyNames: Story = {
  render: () => <Page><StateDiagram config={ONLY_NAMES} aria-label="A traffic light" /></Page>,
};

/** Editing on the new anatomy: a state's entry and exit actions, a transition's guard and actions, and with nothing selected,
 *  the machine's context. Pressing a chip opens it in the panel. */
export const EditingActions: Story = {
  render: () => <Page><StateDiagram source={AUDIO_PLAYER_SOURCE} editable defaultSelection={{ nodes: ['Audio Player.Active.Playing'], edges: [] }} aria-label="Audio Player" /></Page>,
};

export const EditingContext: Story = {
  render: () => <Page appearance="dark"><StateDiagram source={AUDIO_PLAYER_SOURCE} editable aria-label="Audio Player" /></Page>,
};
