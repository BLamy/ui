import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StateDiagram } from '@/components/ui/state-diagram';
import { BLProvider, type AppearancePreference } from '@/lib/theme';
import { uploadMachine } from '../stories/upload-machine';

const meta: Meta<typeof StateDiagram> = {
  title: 'Organisms/StateDiagram',
  component: StateDiagram,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof StateDiagram>;

/** The story's whole canvas, as an app's page would have it (`layout: 'fullscreen'`), or a phone's or a tablet's width of it. */
function Page({ children, appearance, w }: { children?: ReactNode; appearance?: AppearancePreference; w?: number }) {
  return (
    <div style={{ position: 'relative', width: w ?? '100%', height: '100dvh', overflow: 'hidden' }}>
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

/** History states say which kind they are. */
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
