import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
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

/** `size="pill"` — the full-width iOS action pill (was `PillButton`; its soft tone is `variant="secondary"`). */
export const Pill: Story = {
  render: () => (
    <div className="flex flex-col gap-2.5">
      <Button size="pill">Export Wei.vcf</Button>
      <Button size="pill" variant="secondary">Cancel</Button>
    </div>
  ),
};

/** `variant="quiet"` with `size="icon-sm"` — the toolbar tool: muted until hovered, filled while `active`. */
export const IconTools: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      {['pencil', 'copy', 'share'].map((name) => (
        <Button key={name} variant="quiet" size="icon-sm" aria-label={name} title={name}>
          <Icon name={name} size={18} sw={1.7} />
        </Button>
      ))}
      <Button variant="quiet" size="icon-sm" active aria-label="Bookmark" title="Bookmark">
        <Icon name="bookmark" size={18} sw={1.7} />
      </Button>
    </div>
  ),
};

/** Each press counts once. */
export const PressCounter: Story = {
  render: function PressCounterStory() {
    const [n, setN] = useState(0);
    return (
      <div className="flex items-center gap-4">
        <Button data-testid="press" onPress={() => setN((v) => v + 1)}>Press</Button>
        <span data-testid="count" className="text-[15px] text-foreground">Pressed {n}</span>
      </div>
    );
  },
};
