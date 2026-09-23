import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Haptics } from '../lib/haptics';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  decorators: [(Story) => <Pad w={420}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">Link</Button>
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
      <Button isDisabled>Disabled</Button>
    </div>
  ),
};

/** Each press counts once and ticks once — the haptics check taps this in iOS-Safari mode. */
export const PressCounter: Story = {
  render: function PressCounterStory() {
    const [n, setN] = useState(0);
    return (
      <div className="flex items-center gap-4">
        <Button data-testid="press" onPress={() => { Haptics.impact('light'); setN((v) => v + 1); }}>Press</Button>
        <span data-testid="count" className="text-[15px] text-foreground">Pressed {n}</span>
      </div>
    );
  },
};
