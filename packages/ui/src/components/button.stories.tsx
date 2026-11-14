import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Icon } from '@/lib/icon';
import { Pad } from '../stories/frame';

const VARIANTS = ['default', 'secondary', 'outline', 'contrast', 'ghost', 'quiet', 'destructive', 'link'] as const;

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  args: { children: 'Continue', variant: 'default', size: 'default' },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: ['sm', 'default', 'lg', 'pill', 'icon-sm', 'icon', 'icon-lg'] },
    disabled: { control: 'boolean' },
  },
  decorators: [(Story) => <Pad w={460}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Button>;

/** One button; the controls change its variant and size. */
export const Default: Story = {};

const variants = (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="contrast">Contrast</Button>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="ghost">Ghost</Button>
      <Button variant="quiet">Quiet</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">Link</Button>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Disabled</Button>
      <Button variant="secondary" disabled>Disabled</Button>
      <Button variant="outline" disabled>Disabled</Button>
    </div>
  </div>
);

/** Every variant at the default size, and the disabled look. */
export const Variants: Story = { render: () => variants };

/** The variants on a dark surface. */
export const Dark: Story = {
  decorators: [(Story) => <Pad w={460} dark><Story /></Pad>],
  render: () => variants,
};

/** Text sizes are 32, 36 and 44px tall; icon sizes are a 28px toolbar square and 36 and 44px circles. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="quiet" size="icon-sm" aria-label="Edit"><Icon name="pencil" size={18} sw={1.7} /></Button>
        <Button variant="secondary" size="icon" aria-label="Share"><Icon name="share" size={18} /></Button>
        <Button variant="secondary" size="icon-lg" aria-label="More"><Icon name="ellipsis" size={20} /></Button>
      </div>
    </div>
  ),
};

/** `size="pill"`: the full-width iOS action pill; its soft tone is `variant="secondary"`. */
export const Pill: Story = {
  render: () => (
    <div className="flex flex-col gap-2.5">
      <Button size="pill">Export Wei.vcf</Button>
      <Button size="pill" variant="secondary">Cancel</Button>
    </div>
  ),
};

/** The toolbar: actions are quiet icon Buttons, the tools that stay on are quiet Toggles (`aria-pressed`). */
export const IconTools: Story = {
  render: () => (
    <div role="toolbar" aria-label="Note" className="flex items-center gap-1">
      {([['pencil', 'Edit'], ['copy', 'Copy'], ['share', 'Share']] as const).map(([name, label]) => (
        <Button key={name} variant="quiet" size="icon-sm" aria-label={label} title={label}>
          <Icon name={name} size={18} sw={1.7} />
        </Button>
      ))}
      <Toggle variant="quiet" size="icon-sm" defaultPressed aria-label="Bookmark" title="Bookmark">
        <Icon name="bookmark" size={18} sw={1.7} />
      </Toggle>
    </div>
  ),
};

/** Each press counts once. */
export const PressCounter: Story = {
  render: function PressCounterStory() {
    const [n, setN] = useState(0);
    return (
      <div className="flex items-center gap-4">
        <Button data-testid="press" onClick={() => setN((v) => v + 1)}>Press</Button>
        <span data-testid="count" className="text-subhead text-foreground">Pressed {n}</span>
      </div>
    );
  },
};

/** Return a Promise from `onClick` and the button is pending until it settles: it keeps focus, ignores presses and
    carries `data-pending`. */
export const Pending: Story = {
  render: () => (
    <Button onClick={() => new Promise((resolve) => setTimeout(resolve, 1500))} pendingAnnouncement="Saving">
      Save
    </Button>
  ),
};

/** `render` makes it a link with the button's look. */
export const AsLink: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button render={<a href="#docs" />}>Get started</Button>
      <Button variant="link" render={<a href="#changelog" />}>Changelog</Button>
    </div>
  ),
};

/** UI SDK's own Button and Toggle with no classes: the behavior only. Left, as they come (no focus ring, no hover);
    right, the same parts styled by the caller. */
export const Unstyled: Story = {
  render: function UnstyledStory() {
    const [on, setOn] = useState(true);
    return (
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <SdkButton>Plain button</SdkButton>
          <SdkToggle>Plain toggle</SdkToggle>
        </div>
        <div className="flex items-center gap-2">
          <SdkToggle
            pressed={on}
            onPressedChange={setOn}
            className="h-8 cursor-pointer rounded-full border-0 bg-secondary px-3.5 text-subhead font-medium text-secondary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-pressed:bg-primary data-pressed:text-primary-foreground"
          >
            Unread
          </SdkToggle>
          <SdkButton className="h-8 cursor-pointer rounded-full border-0 bg-card px-3.5 text-subhead text-foreground shadow-hairline outline-none active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
            Open thread
          </SdkButton>
        </div>
      </div>
    );
  },
};
