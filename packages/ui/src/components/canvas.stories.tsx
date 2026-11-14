import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Canvas, CanvasFrame, CanvasGuides, CanvasHandles, CanvasMarquee, CanvasMiniMap, createCanvasController } from '@/components/ui/canvas';
import { frameHandles, type Frame, type Viewport } from '@/lib/canvas-math';
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
      <Canvas defaultViewport={{ x: 10, y: 0, zoom: 1 }}><Cards /></Canvas>
    </Phone>
  ),
};

export const Grid: Story = {
  render: () => (
    <Phone w={460} h={380}>
      <Canvas background="grid" defaultViewport={{ x: 10, y: 0, zoom: 1 }}><Cards /></Canvas>
    </Phone>
  ),
};

/** The selection outline, handles, marquee and guides keep their thickness on screen when zoomed out. */
export const ZoomedOutSelection: Story = {
  render: function ZoomedOut() {
    const [viewport, setViewport] = useState<Viewport>({ x: 70, y: 40, zoom: 0.55 });
    return (
      <Phone w={460} h={380}>
        <Canvas viewport={viewport} onViewportChange={setViewport}>
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

/** A minimap in the corner and zoom buttons outside the canvas, which drive it through its controller. */
export const MiniMapAndController: Story = {
  render: function WithController() {
    const [canvas] = useState(() => createCanvasController());
    const [viewport, setViewport] = useState<Viewport>({ x: 10, y: 0, zoom: 1 });
    const fit = { x: 40, y: 50, w: 340, h: 264 };
    return (
      <Phone w={460} h={420}>
        <div className="absolute inset-x-0 top-0 bottom-11">
          <Canvas
            controller={canvas}
            viewport={viewport}
            onViewportChange={setViewport}
            fit={fit}
            aria-label="Cards"
            overlay={<CanvasMiniMap width={150} height={96} items={CARDS.map((c) => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h }))} />}
          >
            <Cards selected="a" />
          </Canvas>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-11 items-center justify-center gap-2 border-t border-border bg-card text-footnote">
          <button type="button" className="rounded-ctl px-2 py-1 hover:bg-secondary" onClick={() => canvas.zoomBy(0.8)}>Zoom Out</button>
          <span className="w-12 text-center tabular-nums">{Math.round(viewport.zoom * 100)}%</span>
          <button type="button" className="rounded-ctl px-2 py-1 hover:bg-secondary" onClick={() => canvas.zoomBy(1.25)}>Zoom In</button>
          <button type="button" className="rounded-ctl px-2 py-1 hover:bg-secondary" onClick={() => canvas.fit()}>Fit</button>
        </div>
      </Phone>
    );
  },
};
