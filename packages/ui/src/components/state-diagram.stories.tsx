import type { Meta, StoryObj } from '@storybook/react-vite';
import { StateDiagram } from '@/components/ui/state-diagram';
import { uploadMachine } from '../stories/upload-machine';
import { Phone } from '../stories/frame';

const meta: Meta<typeof StateDiagram> = {
  title: 'Organisms/StateDiagram',
  component: StateDiagram,
};
export default meta;
type Story = StoryObj<typeof StateDiagram>;

/** A machine as it is, with nothing of it run: 33 states and all 36 ways out, compound and parallel, in a worker. */
export const Machine: Story = {
  render: () => <Phone w={1360} h={560}><StateDiagram machine={uploadMachine as never} aria-label="File upload" /></Phone>,
};

export const MachineDark: Story = {
  render: () => <Phone w={1360} h={560} appearance="dark"><StateDiagram machine={uploadMachine as never} aria-label="File upload" /></Phone>,
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
  render: () => <Phone w={900} h={360}><StateDiagram config={DOOR} /></Phone>,
};

export const FromConfigDark: Story = {
  render: () => <Phone w={900} h={360} appearance="dark"><StateDiagram config={DOOR} /></Phone>,
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

/** History states say which kind they are. */
export const History: Story = {
  render: () => <Phone w={900} h={360}><StateDiagram config={HISTORY} /></Phone>,
};

/** A config XState won't have shows what XState said. */
export const Invalid: Story = {
  render: () => <Phone w={700} h={240}><StateDiagram config={{ id: 'door', initial: 'closed', states: { closed: { on: { OPEN: 'nowhere' } } } }} /></Phone>,
};

/** Running, with stand-ins for all it names: where it is is lit, and the panel has what it can do next. */
export const Simulating: Story = {
  render: () => <Phone w={1360} h={560}><StateDiagram machine={uploadMachine as never} simulate aria-label="File upload" /></Phone>,
};

export const SimulatingDark: Story = {
  render: () => <Phone w={1360} h={560} appearance="dark"><StateDiagram machine={uploadMachine as never} simulate aria-label="File upload" /></Phone>,
};

const IN_PROCESSING = { ...(uploadMachine as unknown as { config: object }).config, initial: 'processing' };

/** In a parallel state, it's in one state of each region, all lit at once. */
export const SimulatingRegions: Story = {
  render: () => <Phone w={1360} h={560}><StateDiagram config={IN_PROCESSING} simulate aria-label="File upload" /></Phone>,
};

/** At a phone's size, the panel's out of the way until it's asked for: a bar says where the machine is, and opens it. */
export const SimulatingPhone: Story = {
  render: () => <Phone w={390} h={700}><StateDiagram config={DOOR} direction="down" simulate /></Phone>,
};

/** Open on a phone, the panel is a page pushed over the board, with a back button to it. */
export const SimulatingPhonePanel: Story = {
  render: () => <Phone w={390} h={700}><StateDiagram config={DOOR} direction="down" simulate defaultPanelOpen /></Phone>,
};

export const SimulatingPhonePanelDark: Story = {
  render: () => <Phone w={390} h={700} appearance="dark"><StateDiagram config={DOOR} direction="down" simulate defaultPanelOpen /></Phone>,
};

/** At a tablet's size, a drawer over the board that doesn't dim it, so the machine stays in sight. */
export const SimulatingTablet: Story = {
  render: () => <Phone w={640} h={560}><StateDiagram config={DOOR} direction="down" simulate defaultPanelOpen /></Phone>,
};

/** While ELK lays it out: a status says so, and there's no empty state. */
export const LayingOut: Story = {
  render: () => <Phone w={700} h={300}><StateDiagram config={DOOR} layout={undefined} /></Phone>,
};

const SPIN = { id: 'spin', initial: 'tick', states: { tick: { always: 'tock' }, tock: { always: 'tick' } } };

/** A machine that would hang the page is stopped, and says why. */
export const NeverSettles: Story = {
  render: () => <Phone w={900} h={360}><StateDiagram config={SPIN} simulate /></Phone>,
};

/** Editing: what's selected can be changed in the panel, and it writes to the config. */
export const Editing: Story = {
  render: () => <Phone w={1100} h={520}><StateDiagram config={DOOR} editable /></Phone>,
};

export const EditingDark: Story = {
  render: () => <Phone w={1100} h={520} appearance="dark"><StateDiagram config={DOOR} editable /></Phone>,
};

export const EditingAState: Story = {
  render: () => <Phone w={1100} h={520}><StateDiagram config={DOOR} editable defaultSelection={{ nodes: ['door.open'], edges: [] }} /></Phone>,
};

export const EditingATransition: Story = {
  render: () => <Phone w={1100} h={520}><StateDiagram config={DOOR} editable defaultSelection={{ nodes: [], edges: ['door.closed:LOCK->door.locked'] }} /></Phone>,
};

/** Editing and running at once, with the panel on Edit. An edit starts the run over. */
export const EditingAndRunning: Story = {
  render: () => <Phone w={1100} h={520}><StateDiagram config={DOOR} editable simulate /></Phone>,
};

export const EditingPhone: Story = {
  render: () => <Phone w={390} h={700}><StateDiagram config={DOOR} direction="down" editable defaultPanelOpen defaultSelection={{ nodes: ['door.open'], edges: [] }} /></Phone>,
};
