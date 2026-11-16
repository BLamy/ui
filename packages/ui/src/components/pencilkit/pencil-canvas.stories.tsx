import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Canvas } from '@/components/ui/canvas';
import { EmptyState } from '@/components/ui/empty-state';
import { pencilInks, type PencilPoint, type PencilStroke } from '@/components/ui/pencilkit/constants';
import { PencilCanvas, type PencilCanvasProps } from '@/components/ui/pencilkit/pencil-canvas';
import { ThemeScope } from '@/lib/theme';

/* Three strokes, one per drawing tool, sized for the 640×420 frame. */
function wave(x0: number, y0: number, len: number, amp: number, cycles: number, n = 48): PencilPoint[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [x0 + t * len, y0 + Math.sin(t * Math.PI * 2 * cycles) * amp, 0.5] as PencilPoint;
  });
}
function loop(cx: number, cy: number, rx: number, ry: number, n = 56): PencilPoint[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.5] as PencilPoint;
  });
}
const ink = (label: string) => pencilInks.find((i) => i.label === label)!.value;
const SEEDED: PencilStroke[] = [
  { tool: 'pen', ink: ink('Black'), widthScale: 1, pressure: false, complete: true, points: wave(70, 110, 300, 34, 1.5) },
  { tool: 'marker', ink: ink('Yellow'), widthScale: 1, pressure: false, complete: true, points: wave(90, 200, 320, 10, 0.5) },
  { tool: 'pencil', ink: ink('Pink'), widthScale: 1.7, pressure: false, complete: true, points: loop(460, 150, 90, 55) },
];

function Frame({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <ThemeScope appearance={dark ? 'dark' : 'light'} className="relative h-[420px] w-[640px] overflow-hidden rounded-xl bg-background font-sans text-foreground shadow-hairline">
      {children}
    </ThemeScope>
  );
}

const meta: Meta<PencilCanvasProps & { dark?: boolean }> = {
  title: 'Organisms/PencilCanvas',
  component: PencilCanvas,
  parameters: { layout: 'centered' },
  args: { tool: 'pen', ink: pencilInks[0].value, widthScale: 1, variant: 'freehand', disabled: false, dark: false },
  argTypes: {
    tool: { control: 'inline-radio', options: ['pen', 'marker', 'pencil', 'eraser'] },
    ink: { control: 'select', options: pencilInks.map((i) => i.value) },
    widthScale: { control: 'inline-radio', options: [0.6, 1, 1.7, 2.6] },
    variant: { control: 'inline-radio', options: ['freehand', 'plain'] },
    strokes: { control: false },
    defaultStrokes: { control: false },
    emptyState: { control: false },
  },
  render: ({ dark, ...args }) => (
    <Frame dark={dark}>
      <PencilCanvas {...args} />
    </Frame>
  ),
};
export default meta;
type Story = StoryObj<PencilCanvasProps & { dark?: boolean }>;

const empty = <EmptyState title="Draw anywhere" description="Apple Pencil pressure is real; mouse and touch are simulated." />;

/** A blank page with its empty state, which goes once the first stroke lands. */
export const Empty: Story = { args: { emptyState: empty } };

/** The same in dark: black ink follows the theme and draws white. */
export const Dark: Story = { args: { emptyState: empty, dark: true } };

/** One stroke per tool: pen, marker (wide, 50% opacity), pencil (tapered). Draw to add more. */
export const Seeded: Story = { args: { defaultStrokes: SEEDED } };

/** Seeded strokes in dark. */
export const SeededDark: Story = { args: { defaultStrokes: SEEDED, dark: true } };

/** The stroke eraser: drag across a stroke to remove it whole. */
export const Eraser: Story = { args: { tool: 'eraser', defaultStrokes: SEEDED } };

/** `variant="plain"`: the raw polylines instead of perfect-freehand's pressure outlines. */
export const Plain: Story = { args: { variant: 'plain', defaultStrokes: SEEDED } };

/** `disabled`: a read-only drawing (the cursor is the default one and presses draw nothing). */
export const Disabled: Story = { args: { disabled: true, defaultStrokes: SEEDED } };

/** Inside a Canvas, PencilCanvas is the board's drawing layer: ink in board units under the canvas's pan and zoom.
    Scroll to pan, ⌘-scroll to zoom, hold Space to drag the view; draw anywhere. */
export const OnACanvas: Story = {
  render: ({ dark, ...args }) => {
    const [strokes, setStrokes] = useState<PencilStroke[]>(SEEDED);
    return (
      <Frame dark={dark}>
        <Canvas aria-label="Sketch board" defaultViewport={{ x: 0, y: 0, zoom: 0.8 }} className="cursor-crosshair">
          <PencilCanvas {...args} strokes={strokes} onStrokesChange={setStrokes} />
        </Canvas>
      </Frame>
    );
  },
};
