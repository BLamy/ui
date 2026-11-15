import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Canvas, CanvasFrame, CanvasGuides, CanvasHandles, CanvasMarquee, CanvasMiniMap, createCanvasController } from '@/components/ui/canvas';
import { EmptyState } from '@/components/ui/empty-state';
import { Toolbar, ToolbarButton, ToolbarText } from '@/components/ui/toolbar';
import { frameHandles, type Frame, type Viewport } from '@/lib/canvas-math';
import { Icon } from '@/lib/icon';
import { Phone } from '../stories/frame';

type Args = React.ComponentProps<typeof Canvas> & { dark?: boolean };

const meta: Meta<Args> = {
  title: 'Organisms/Canvas',
  component: Canvas,
  args: { background: 'dots', panning: false, minZoom: 0.1, maxZoom: 8, dark: false },
  argTypes: {
    background: { control: 'inline-radio', options: ['dots', 'grid', 'none'] },
    panning: { control: 'boolean' },
    minZoom: { control: { type: 'range', min: 0.05, max: 1, step: 0.05 } },
    maxZoom: { control: { type: 'range', min: 1, max: 16, step: 0.5 } },
    viewport: { control: false },
    defaultViewport: { control: false },
    overlay: { control: false },
    children: { control: false },
  },
};
export default meta;
type Story = StoryObj<Args>;

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

/** Dotted background, three cards. Scroll to pan, pinch or ⌘-scroll to zoom; Tab to it to see its focus ring. */
export const Dots: Story = {
  render: ({ dark, ...args }) => (
    <Phone w={460} h={380} appearance={dark ? 'dark' : 'light'}>
      <Canvas {...args} defaultViewport={{ x: 10, y: 0, zoom: 1 }}><Cards /></Canvas>
    </Phone>
  ),
};

export const Grid: Story = {
  args: { background: 'grid' },
  render: Dots.render,
};

/** Dark: the dots, the cards and the selection on the dark background. */
export const Dark: Story = {
  args: { dark: true },
  render: ({ dark, ...args }) => (
    <Phone w={460} h={380} appearance={dark ? 'dark' : 'light'}>
      <Canvas {...args} defaultViewport={{ x: 10, y: 0, zoom: 1 }}><Cards selected="b" /></Canvas>
    </Phone>
  ),
};

/** `panning`: the hand tool, where a plain drag moves the view (the cursor is the open hand). */
export const HandTool: Story = { args: { panning: true }, render: Dots.render };

/** The selection outline, handles, marquee and guides keep their thickness on screen when zoomed out. */
export const ZoomedOutSelection: Story = {
  render: function ZoomedOut({ dark, ...args }) {
    const [viewport, setViewport] = useState<Viewport>({ x: 70, y: 40, zoom: 0.55 });
    return (
      <Phone w={460} h={380} appearance={dark ? 'dark' : 'light'}>
        <Canvas {...args} viewport={viewport} onViewportChange={setViewport}>
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
  render: ({ dark, ...args }) => (
    <Phone w={460} h={300} appearance={dark ? 'dark' : 'light'}>
      <Canvas {...args} overlay={<EmptyState className="pointer-events-none absolute inset-0" title="A blank board" description="Add a card to start." />} />
    </Phone>
  ),
};

/** A minimap in the corner and zoom buttons outside the canvas, which drive it through its controller. */
export const MiniMapAndController: Story = {
  render: function WithController({ dark, ...args }) {
    const [canvas] = useState(() => createCanvasController());
    const [viewport, setViewport] = useState<Viewport>({ x: 10, y: 0, zoom: 1 });
    const fit = { x: 40, y: 50, w: 340, h: 264 };
    return (
      <Phone w={460} h={420} appearance={dark ? 'dark' : 'light'}>
        <div className="absolute inset-x-0 top-0 bottom-11">
          <Canvas
            {...args}
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
        <Toolbar aria-label="Zoom" size="sm" className="absolute inset-x-0 bottom-0 h-11 justify-center border-t border-border bg-card">
          <ToolbarButton size="icon-sm" aria-label="Zoom out" onClick={() => canvas.zoomBy(0.8)}><Icon name="minus" size={16} /></ToolbarButton>
          <ToolbarText className="w-12 text-center">{Math.round(viewport.zoom * 100)}%</ToolbarText>
          <ToolbarButton size="icon-sm" aria-label="Zoom in" onClick={() => canvas.zoomBy(1.25)}><Icon name="plus" size={16} /></ToolbarButton>
          <ToolbarButton size="sm" onClick={() => canvas.fit()}>Fit</ToolbarButton>
        </Toolbar>
      </Phone>
    );
  },
};
