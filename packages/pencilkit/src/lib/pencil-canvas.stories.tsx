import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PFONT, PK_DARK, PK_INKS, PK_LIGHT } from './constants';
import { PencilCanvas } from './pencil-canvas';
import { demoStrokes } from '../demos/demo-strokes';

function Frame({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        ...((dark ? PK_DARK : PK_LIGHT) as React.CSSProperties),
        position: 'relative',
        width: 640,
        height: 420,
        overflow: 'hidden',
        borderRadius: 12,
        background: 'var(--tk-bg2)',
        color: 'var(--tk-label)',
        fontFamily: PFONT,
        colorScheme: dark ? 'dark' : 'light',
      }}
    >
      {children}
    </div>
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
        <div style={{ fontSize: 15.5, fontWeight: 600 }}>Draw anywhere</div>
        <div style={{ fontSize: 12.5, marginTop: 3 }}>Apple Pencil pressure is real — mouse and touch are simulated.</div>
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

/** Stroke eraser over pre-seeded strokes — drag across a stroke to delete it whole (hit-test + haptic tick). */
export const Eraser: Story = {
  args: { tool: 'eraser', defaultStrokes: demoStrokes() },
  parameters: {
    docs: {
      description: {
        story:
          'Whole-stroke eraser: press/drag over any pre-seeded stroke to remove it (radius 12 + half the stroke size; every other sample point is tested). Each erased stroke fires Haptics.selection().',
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
