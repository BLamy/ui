import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PK_INKS } from '@/components/ui/pencilkit/constants';
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas';
import { ThemeScope } from '@/lib/theme';
import { demoStrokes } from './demo-strokes';

function Frame({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <ThemeScope appearance={dark ? 'dark' : 'light'} className="relative h-[420px] w-[640px] overflow-hidden rounded-xl bg-muted font-sans text-foreground">
      {children}
    </ThemeScope>
  );
}

const meta: Meta<typeof PencilCanvas> = {
  title: 'Organisms/PencilCanvas',
  component: PencilCanvas,
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof PencilCanvas>;

export const Light: Story = {
  args: {
    tool: 'pen',
    ink: PK_INKS[0],
    width: 1,
    hint: (
      <>
        <div className="text-[15.5px] font-semibold">Draw anywhere</div>
        <div className="mt-[3px] text-[12.5px]">Apple Pencil pressure is real — mouse and touch are simulated.</div>
      </>
    ),
    status: 'perfect-freehand@1.2.2',
  },
  render: (args) => (
    <Frame>
      <PencilCanvas {...args} />
    </Frame>
  ),
};

export const Dark: Story = {
  args: { ...Light.args, ink: PK_INKS[1] },
  render: (args) => (
    <Frame dark>
      <PencilCanvas {...args} />
    </Frame>
  ),
};

/** Pen tool over pre-seeded strokes (one per tool) — draw to add more pen strokes. */
export const PenSeeded: Story = {
  args: { tool: 'pen', ink: PK_INKS[0], width: 1, defaultStrokes: demoStrokes() },
  render: (args) => (
    <Frame>
      <PencilCanvas {...args} />
    </Frame>
  ),
};

/** Marker (wide, 50% alpha) over pre-seeded strokes. */
export const MarkerBlue: Story = {
  args: { tool: 'marker', ink: PK_INKS[2], width: 1.7, defaultStrokes: demoStrokes() },
  render: (args) => (
    <Frame>
      <PencilCanvas {...args} />
    </Frame>
  ),
};

/** Pencil (tapered, 92% alpha, thin width) over pre-seeded strokes. */
export const PencilRedThin: Story = {
  args: { tool: 'pencil', ink: PK_INKS[5], width: 0.6, defaultStrokes: demoStrokes() },
  render: (args) => (
    <Frame>
      <PencilCanvas {...args} />
    </Frame>
  ),
};

/** Stroke eraser over pre-seeded strokes — drag across a stroke to delete it whole (hit-test). */
export const Eraser: Story = {
  args: { tool: 'eraser', defaultStrokes: demoStrokes() },
  parameters: {
    docs: {
      description: {
        story:
          'Whole-stroke eraser: press/drag over any pre-seeded stroke to remove it (radius 12 + half the stroke size; every other sample point is tested).',
      },
    },
  },
  render: (args) => (
    <Frame>
      <PencilCanvas {...args} />
    </Frame>
  ),
};

/** Plain (non perfect-freehand) fallback rendering of the same seeded strokes. */
export const PlainFallback: Story = {
  args: { tool: 'pen', ink: PK_INKS[0], width: 1, plain: true, defaultStrokes: demoStrokes() },
  render: (args) => (
    <Frame>
      <PencilCanvas {...args} />
    </Frame>
  ),
};
