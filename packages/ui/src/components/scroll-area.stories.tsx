import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ScrollArea, ScrollAreaContent, ScrollAreaCorner, ScrollAreaScrollbar, ScrollAreaScrollToEnd, ScrollAreaViewport,
} from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof ScrollArea> = {
  title: 'Atoms/ScrollArea',
  component: ScrollArea,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ScrollArea>;

const tags = Array.from({ length: 40 }, (_, i) => `v1.${40 - i}.0`);

const releases = (
  <>
    <div className="px-4 py-3 text-footnote font-semibold text-muted-foreground">Releases</div>
    {tags.map((t, i) => (
      <div key={t}>
        {i ? <Separator inset /> : null}
        <div className="px-4 py-2.5 text-subhead text-foreground">{t}</div>
      </div>
    ))}
  </>
);

export const Vertical: Story = {
  render: () => (
    <Card>
      <ScrollArea className="h-64">
        <ScrollAreaViewport aria-label="Releases">
          <ScrollAreaContent>{releases}</ScrollAreaContent>
        </ScrollAreaViewport>
      </ScrollArea>
    </Card>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea orientation="horizontal">
      <ScrollAreaViewport aria-label="Albums">
        <ScrollAreaContent className="flex w-max gap-3 pb-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="grid size-28 shrink-0 place-items-center rounded-xl bg-card text-subhead font-semibold text-muted-foreground">
              Album {i + 1}
            </div>
          ))}
        </ScrollAreaContent>
      </ScrollAreaViewport>
    </ScrollArea>
  ),
};

/** A `ScrollAreaScrollbar` replaces the browser's bar with one over the content's edge, shown while the area is
    hovered or scrolled. */
export const OverlayScrollbar: Story = {
  render: () => (
    <Card>
      <ScrollArea className="h-64">
        <ScrollAreaViewport aria-label="Releases">
          <ScrollAreaContent>{releases}</ScrollAreaContent>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar />
      </ScrollArea>
    </Card>
  ),
};

export const VerticalDark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: Vertical.render,
};

/* ── stickToEnd: a growing log that stays at its end until you scroll up ── */

const LEVELS = ['info', 'debug', 'warn'] as const;
function Log({ away }: { away?: boolean }) {
  const [lines, setLines] = useState(() => Array.from({ length: 24 }, (_, i) => i));
  useEffect(() => {
    const id = setInterval(() => setLines((l) => [...l, l.length]), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <ScrollArea stickToEnd className="h-64">
        <ScrollAreaViewport aria-label="Build log" ref={(el) => { if (el && away) el.scrollTop = 0; }}>
          <ScrollAreaContent className="py-2 font-mono text-caption">
            {lines.map((n) => (
              <div key={n} className="px-4 py-0.5 text-foreground">
                <span className="text-muted-foreground">{String(n).padStart(3, '0')}</span> {LEVELS[n % 3]} step {n} finished
              </div>
            ))}
          </ScrollAreaContent>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar />
        <ScrollAreaScrollToEnd>Jump to latest</ScrollAreaScrollToEnd>
      </ScrollArea>
    </Card>
  );
}

/** `stickToEnd`: new lines keep the view at the end; the "Jump to latest" button is hidden (inert) while it is there. */
export const StickToEnd: Story = { render: () => <Log /> };

/** Scrolled up, away from the end: the button fades in over the bottom edge. */
export const StickToEndAway: Story = {
  render: () => <Log away />,
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot=scroll-area-viewport]');
    if (!viewport) return;
    await new Promise((r) => setTimeout(r, 100));
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event('scroll'));
  },
};

/** Edge fades from UI SDK's state attributes: a 28px fade at an edge only while there is more content past it
    (`data-overflow-y` without `data-at-y-start` / `data-at-y-end`). */
export const EdgeFades: Story = {
  render: () => (
    <Card>
      <ScrollArea className="h-64">
        <ScrollAreaViewport
          aria-label="Releases"
          className={[
            'data-overflow-y:[mask-image:linear-gradient(to_bottom,transparent,black_var(--fade-top,0px),black_calc(100%-var(--fade-bottom,0px)),transparent)]',
            'data-overflow-y:not-data-at-y-start:[--fade-top:28px] data-overflow-y:not-data-at-y-end:[--fade-bottom:28px]',
          ].join(' ')}
        >
          <ScrollAreaContent>{releases}</ScrollAreaContent>
        </ScrollAreaViewport>
      </ScrollArea>
    </Card>
  ),
};

/** `orientation="both"` with overlay scrollbars on both edges and the corner where they meet. */
export const BothAxes: Story = {
  render: () => (
    <Card>
      <ScrollArea orientation="both" className="h-64">
        <ScrollAreaViewport aria-label="Grid">
          <ScrollAreaContent className="grid w-max grid-cols-[repeat(12,7rem)] gap-2 p-3">
            {Array.from({ length: 144 }, (_, i) => (
              <div key={i} className="grid h-16 place-items-center rounded-lg bg-secondary text-footnote text-muted-foreground">{i + 1}</div>
            ))}
          </ScrollAreaContent>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" />
        <ScrollAreaScrollbar orientation="horizontal" />
        <ScrollAreaCorner />
      </ScrollArea>
    </Card>
  ),
};
