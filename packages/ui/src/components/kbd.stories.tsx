import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
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
  <div className="flex flex-col gap-3 text-subhead text-foreground">
    <div className="flex items-center justify-between">Search <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup></div>
    <div className="flex items-center justify-between">New tab <KbdGroup><Kbd>⌘</Kbd><Kbd>T</Kbd></KbdGroup></div>
    <div className="flex items-center justify-between">Command palette <KbdGroup><Kbd>⇧</Kbd><Kbd>⌘</Kbd><Kbd>P</Kbd></KbdGroup></div>
    <div className="flex items-center justify-between">Dismiss <Kbd>esc</Kbd></div>
  </div>
);

export const Group: Story = { render: () => combos };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => combos };

/** `keys` takes a shortcut and shows it for the reader's platform: ⌘K on Apple, Ctrl+K elsewhere. */
export const Shortcut: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-subhead text-foreground">
      <div className="flex items-center justify-between">Search <Kbd keys="mod+k" /></div>
      <div className="flex items-center justify-between">Command palette <Kbd keys="mod+shift+p" /></div>
      <div className="flex items-center justify-between">Send <Kbd keys="mod+enter" /></div>
    </div>
  ),
};
