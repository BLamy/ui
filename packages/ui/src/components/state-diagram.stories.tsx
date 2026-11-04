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
  render: () => <Phone w={1360} h={560} dark><StateDiagram machine={uploadMachine as never} aria-label="File upload" /></Phone>,
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
  render: () => <Phone w={900} h={360} dark><StateDiagram config={DOOR} /></Phone>,
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
