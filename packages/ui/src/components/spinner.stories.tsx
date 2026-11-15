import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Spinner, spinnerAnimations, type SpinnerProps } from '@/components/ui/spinner';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Spinner> = {
  title: 'Atoms/Spinner',
  component: Spinner,
  // One frame per story: `parameters.pad` sets its width, `dark` and the text color.
  decorators: [(Story, { parameters }) => {
    const pad = (parameters.pad ?? {}) as { w?: number; dark?: boolean; tone?: string };
    return <Pad w={pad.w} dark={pad.dark}><div className={pad.tone ?? 'text-muted-foreground'}><Story /></div></Pad>;
  }],
};
export default meta;
type Story = StoryObj<typeof Spinner>;

/** The iOS activity indicator: it turns by default. */
export const Default: Story = { args: {} };
/** `paused` holds any animation still. */
export const Paused: Story = { args: { paused: true } };
/** With a `label` it is a `role="status"` whose text is the label; without one it is decorative. */
export const Labelled: Story = { args: { label: 'Loading messages' } };
export const Large: Story = { args: { size: 36 } };

/** Every animation with every pattern, in the text color. Reduced motion (as in the screenshots) holds a still frame. */
export const Gallery: Story = {
  parameters: { pad: { w: 440, tone: 'text-foreground' } },
  render: () => (
    <div className="grid gap-3 p-3">
      {spinnerAnimations.map((a) => (
        <div key={a.id} className="grid grid-cols-[72px_1fr] items-center gap-2">
          <span className="text-footnote font-semibold">{a.label}</span>
          <div className="flex flex-wrap gap-5">
            {a.patterns.length === 0
              ? <Spinner size={28} />
              : a.patterns.map((p) => <Spinner key={p} {...({ animation: a.id, pattern: p } as SpinnerProps)} size={28} />)}
          </div>
        </div>
      ))}
    </div>
  ),
};

/** BL UI's own loaders at a larger size, first pattern of each. */
export const Originals: Story = {
  parameters: { pad: { w: 480, tone: 'text-foreground' } },
  render: () => (
    <div className="grid grid-cols-4 gap-4 p-1">
      {spinnerAnimations.slice(8).map((a) => (
        <div key={a.id} className="grid justify-items-center gap-1.5">
          <Spinner {...({ animation: a.id } as SpinnerProps)} size={56} />
          <span className="text-caption2">{a.label}</span>
        </div>
      ))}
    </div>
  ),
};

export const Orbit: Story = { args: { animation: 'orbit', pattern: 'oppose', size: 64 } };
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4 p-3">
      {[12, 20, 32, 64, 96].map((size) => <Spinner key={size} animation="bars" size={size} />)}
    </div>
  ),
};
export const Tinted: Story = {
  render: () => (
    <div className="flex items-center gap-5 p-3">
      <span className="text-primary"><Spinner animation="matrix" size={40} /></span>
      <span className="text-destructive"><Spinner animation="lift" size={40} /></span>
      <span className="text-success"><Spinner animation="merge" size={40} /></span>
    </div>
  ),
};

/** A pending action: `onClick` returns a Promise, so the Button is pending (busy, ignoring presses, keeping focus,
    at full strength) and the spinner sits beside the label in its text color. These two never settle. */
export const InButton: Story = {
  render: () => {
    const forever = () => new Promise<void>(() => {});
    return (
      <div className="flex items-center gap-3">
        <PendingButton onPress={forever}>Saving…</PendingButton>
        <PendingButton variant="secondary" onPress={forever}>Loading</PendingButton>
      </div>
    );
  },
};

function PendingButton({ onPress, children, variant }: { onPress: () => Promise<void>; children: string; variant?: 'secondary' }) {
  const [pending, setPending] = useState(false);
  // Pressed once on mount, so the story opens in the pending state.
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.click(); }, []);
  return (
    <Button ref={ref} variant={variant} onClick={() => { setPending(true); return onPress(); }}>
      {pending ? <Spinner size={16} /> : null}{children}
    </Button>
  );
}

export const Dark: Story = {
  parameters: { pad: { dark: true, tone: 'text-foreground' } },
  render: () => (
    <div className="flex items-center gap-5">
      <Spinner size={28} />
      <Spinner animation="orbit" size={32} />
      <Spinner animation="hourglass" size={32} />
      <Spinner animation="scan" size={32} />
    </div>
  ),
};
