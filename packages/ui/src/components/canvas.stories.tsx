import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Canvas, CanvasFrame, CanvasGuides, CanvasHandles, CanvasMarquee } from '@/components/ui/canvas';
import { frameHandles, type Camera, type Frame } from '@/lib/canvas-math';
import { Phone } from '../stories/frame';

const meta: Meta<typeof Canvas> = {
  title: 'Organisms/Canvas',
  component: Canvas,
};
export default meta;
type Story = StoryObj<typeof Canvas>;

const CARDS: (Frame & { id: string; label: string })[] = [
  { id: 'a', label: 'Brief', x: 40, y: 50, w: 150, h: 96, rot: 0 },
  { id: 'b', label: 'Sketch', x: 250, y: 90, w: 130, h: 130, rot: 8 },
  { id: 'c', label: 'Review', x: 90, y: 230, w: 190, h: 84, rot: 0 },
];

function Cards({ selected }: { selected?: string }) {
  return (
    <>
      {CARDS.map((c) => (
        <div
          key={c.id}
          className="absolute grid place-items-center rounded-card bg-card text-body font-semibold text-foreground shadow-hairline"
          style={{ left: c.x, top: c.y, width: c.w, height: c.h, transform: c.rot ? `rotate(${c.rot}deg)` : undefined }}
        >
          {c.label}
        </div>
      ))}
      {CARDS.filter((c) => c.id === selected).map((c) => (
        <div key={c.id}>
          <CanvasFrame frame={c} />
          <CanvasHandles handles={frameHandles(c, 1)} />
        </div>
      ))}
    </>
  );
}

/** Dotted background, three cards. Scroll to pan, pinch or ⌘-scroll to zoom. */
export const Dots: Story = {
  render: () => (
    <Phone w={460} h={380}>
      <Canvas defaultCamera={{ x: 10, y: 0, z: 1 }}><Cards /></Canvas>
    </Phone>
  ),
};

export const Grid: Story = {
  render: () => (
    <Phone w={460} h={380}>
      <Canvas background="grid" defaultCamera={{ x: 10, y: 0, z: 1 }}><Cards /></Canvas>
    </Phone>
  ),
};

/** The selection outline, handles, marquee and guides keep their thickness on screen when zoomed out. */
export const ZoomedOutSelection: Story = {
  render: function ZoomedOut() {
    const [camera, setCamera] = useState<Camera>({ x: 70, y: 40, z: 0.55 });
    return (
      <Phone w={460} h={380}>
        <Canvas camera={camera} onCameraChange={setCamera}>
          <Cards selected="b" />
          <CanvasMarquee rect={{ x: 20, y: 200, w: 120, h: 80 }} />
          <CanvasGuides guides={[{ x1: 40, y1: 20, x2: 40, y2: 340 }]} />
        </Canvas>
      </Phone>
    );
  },
};

/** The empty state is an overlay: drawn in screen space, not scaled with the board. */
export const Empty: Story = {
  render: () => (
    <Phone w={460} h={300}>
      <Canvas overlay={<div className="pointer-events-none absolute inset-0 grid place-items-center text-footnote text-tertiary-foreground">Nothing here yet</div>} />
    </Phone>
  ),
};
