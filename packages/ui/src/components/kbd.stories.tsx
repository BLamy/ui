import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd, KbdGroup } from './kbd';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Kbd> = {
  title: 'Atoms/Kbd',
  component: Kbd,
  args: { children: '⌘K' },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Kbd>;

export const Default: Story = {};

const combos = (
  <div className="flex flex-col gap-3 text-[15px] text-foreground">
    <div className="flex items-center justify-between">Search <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup></div>
    <div className="flex items-center justify-between">New tab <KbdGroup><Kbd>⌘</Kbd><Kbd>T</Kbd></KbdGroup></div>
    <div className="flex items-center justify-between">Command palette <KbdGroup><Kbd>⇧</Kbd><Kbd>⌘</Kbd><Kbd>P</Kbd></KbdGroup></div>
    <div className="flex items-center justify-between">Dismiss <Kbd>esc</Kbd></div>
  </div>
);

export const Group: Story = { render: () => combos };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => combos };
