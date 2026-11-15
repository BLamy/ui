import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Pad } from '../stories/frame';

const meta: Meta<typeof AnimatedHeight> = {
  title: 'Atoms/AnimatedHeight',
  component: AnimatedHeight,
  args: { spring: 'tray' },
  argTypes: { spring: { control: 'inline-radio', options: ['tray', 'smooth', 'snappy', 'bouncy'] } },
  decorators: [(Story, { parameters }) => <Pad w={380} dark={!!parameters.dark}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof AnimatedHeight>;

const LINES = ['Wi-Fi', 'Bluetooth', 'Cellular', 'Personal Hotspot', 'VPN'];

function Demo({ className = 'rounded-card bg-card shadow-hairline', ...args }: Story['args'] & { className?: string }) {
  const [n, setN] = useState(2);
  return (
    <div className="grid gap-3">
      <AnimatedHeight {...args} className={className}>
        <ul className="m-0 list-none p-0">
          {LINES.slice(0, n).map((l) => <li key={l} className="flex h-row items-center px-4 text-body">{l}</li>)}
        </ul>
      </AnimatedHeight>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={n === 1} onClick={() => setN(n - 1)}>Fewer</Button>
        <Button variant="secondary" disabled={n === LINES.length} onClick={() => setN(n + 1)}>More</Button>
      </div>
    </div>
  );
}

/** Press More or Fewer: the card springs to its content's height instead of jumping. */
export const Default: Story = { render: (args) => <Demo {...args} /> };
export const Bouncy: Story = { args: { spring: 'bouncy' }, render: (args) => <Demo {...args} /> };
export const Dark: Story = { parameters: { dark: true }, render: (args) => <Demo {...args} /> };

/** Padding on the AnimatedHeight itself adds to the animated height (it is `box-content`): nothing is cut off. */
export const Padded: Story = { render: (args) => <Demo {...args} className="rounded-card bg-card p-4 shadow-hairline" /> };
