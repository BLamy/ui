import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DebugToolbar, DebugToolbarButton, debugToolbarActions, type DebugToolbarAction } from '@/components/ui/debug-toolbar';
import { ToolbarButton, ToolbarSeparator, type ToolbarSize } from '@/components/ui/toolbar';
import { Panel } from '../stories/primitive-frame';

interface Args { variant: 'floating' | 'plain'; size: ToolbarSize; dark?: boolean; stopped?: boolean }
const meta: Meta<Args> = {
  title: 'Molecules/DebugToolbar',
  args: { variant: 'floating', size: 'default', dark: false, stopped: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['floating', 'plain'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
  },
};
export default meta;
type Story = StoryObj<Args>;

const STOPPED: DebugToolbarAction[] = ['continue', 'step-over', 'step-into', 'step-out', 'step-back', 'reverse-continue', 'stop'];

function Live({ variant, size, stopped }: Omit<Args, 'dark'>) {
  const [last, setLast] = useState<DebugToolbarAction | null>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <DebugToolbar variant={variant} size={size} onAction={setLast} disabledActions={stopped ? STOPPED : []} />
      <p className="min-h-5 text-caption text-muted-foreground" aria-live="polite">
        {last ? `Last action: ${debugToolbarActions[last].label}` : 'Choose a debugger action'}
      </p>
    </div>
  );
}

/** The floating card (default) with all eight actions. The controls change `variant`, `size` and the stopped state. */
export const Default: Story = {
  render: ({ dark, ...args }) => <Panel dark={dark} w={480} className="items-center bg-muted py-6"><Live {...args} /></Panel>,
};

export const Dark: Story = { ...Default, args: { dark: true } };

/** `variant="plain" size="sm"`: the strip in a pane's header (the Replay Debugger block). */
export const PlainSmall: Story = {
  args: { variant: 'plain', size: 'sm' },
  render: ({ dark, ...args }) => (
    <Panel dark={dark} w={420}>
      <div className="flex h-11 items-center gap-2 border-b border-border px-1">
        <span className="text-footnote font-semibold text-foreground">app.ts</span>
        <div className="ms-auto"><DebugToolbar variant={args.variant} size={args.size} onAction={() => {}} /></div>
      </div>
    </Panel>
  ),
};

/** The session ended: everything but Restart is unavailable (faded, still focusable). */
export const Stopped: Story = { ...Default, args: { stopped: true } };

/** All three sizes: 28, 36 and 44px tools. */
export const Sizes: Story = {
  render: ({ dark, variant }) => (
    <Panel dark={dark} w={480} className="items-center bg-muted py-6">
      {(['sm', 'default', 'lg'] as const).map((size) => <DebugToolbar key={size} variant={variant} size={size} onAction={() => {}} />)}
    </Panel>
  ),
};

/** Children instead of `actions`: a relabeled Continue, separators and a control of your own in the same arrow order. */
export const Composed: Story = {
  render: ({ dark }) => (
    <Panel dark={dark} w={480} className="items-center bg-muted py-6">
      <DebugToolbar aria-label="Debugger" onAction={() => {}} disabledActions={['step-out']}>
        <DebugToolbarButton action="continue" label="Resume" />
        <DebugToolbarButton action="step-over" />
        <DebugToolbarButton action="step-into" />
        <DebugToolbarButton action="step-out" />
        <ToolbarSeparator />
        <DebugToolbarButton action="stop" />
        <ToolbarSeparator />
        <ToolbarButton size="sm">DevTools</ToolbarButton>
      </DebugToolbar>
    </Panel>
  ),
};
