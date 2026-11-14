import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import {
  AdaptivePane, AdaptivePaneClose, AdaptivePaneHeader, AdaptivePaneTitle, adaptivePanePageClass, type AdaptivePanePresentation,
} from '@/components/ui/adaptive-pane';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import { BLProvider } from '@/lib/theme';
import { cn } from '@/lib/utils';

const meta: Meta<typeof AdaptivePane> = {
  title: 'Organisms/AdaptivePane',
  component: AdaptivePane,
};
export default meta;
type Story = StoryObj<typeof AdaptivePane>;

/** A framed app: as wide as `w` at most (it narrows with the viewport), `h` tall. */
function Frame({ w, h, dark, children }: { w: number; h: number; dark?: boolean; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] shadow-hairline" style={{ width: '100%', maxWidth: w, height: h }}>
      <BLProvider dark={dark}>{children}</BLProvider>
    </div>
  );
}

const activity = ['Outgoing call · 2 min', 'iMessage · “see you at 6”', 'FaceTime · 12 min', 'Mail · Re: schedule', 'Shared “Q3 plan”'];

function Activity() {
  return (
    <div className="bl-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
      {activity.map((t) => (
        <div key={t} className="border-b border-border py-2.5 text-subhead last:border-0">{t}</div>
      ))}
    </div>
  );
}

/** The page beside or under the pane, with the button that shows it. */
function Page({ open, setOpen, note }: { open: boolean; setOpen: (open: boolean) => void; note?: ReactNode }) {
  return (
    <main className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-muted p-6 text-center', adaptivePanePageClass)}>
      <div className="text-title font-semibold">Maya Lindqvist</div>
      <Button variant="secondary" aria-pressed={open} onClick={() => setOpen(!open)}>Activity</Button>
      {note ? <div className="text-footnote text-muted-foreground">{note}</div> : null}
    </main>
  );
}

function Inspector({ presentation, dark, w, h, defaultOpen = true }: {
  presentation: AdaptivePanePresentation; dark?: boolean; w: number; h: number; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Frame w={w} h={h} dark={dark}>
      <div className="absolute inset-0 flex">
        <Page open={open} setOpen={setOpen} note={`presentation="${presentation}"`} />
        <AdaptivePane side="end" presentation={presentation} open={open} onOpenChange={setOpen} columnWidth={300} drawerWidth={300}
          className={({ presentation: shown }) => (shown === 'column' ? 'border-s border-border bg-background' : undefined)}>
          <AdaptivePaneHeader>
            <AdaptivePaneTitle>Activity</AdaptivePaneTitle>
            <AdaptivePaneClose backLabel="Profile" />
          </AdaptivePaneHeader>
          <Activity />
        </AdaptivePane>
      </div>
    </Frame>
  );
}

/** Docked beside the page: part of the layout, no scrim. Its × closes it (`open` → false). */
export const Column: Story = { render: () => <Inspector presentation="column" w={820} h={560} /> };
export const ColumnDark: Story = { render: () => <Inspector presentation="column" w={820} h={560} dark /> };
/** A drawer over the page from the pane's side: Escape, the scrim, the × and a swipe toward the edge close it. */
export const Drawer: Story = { render: () => <Inspector presentation="drawer" w={390} h={844} /> };
export const DrawerDark: Story = { render: () => <Inspector presentation="drawer" w={390} h={844} dark /> };
/** Pushed over the page like a NavigationStack screen: the header is the bar, its back button pops it, and so do
 *  Escape, the platform back and a swipe from the leading edge. The page under parallaxes, dims and is inert. */
export const Push: Story = { render: () => <Inspector presentation="push" w={390} h={844} /> };
export const PushDark: Story = { render: () => <Inspector presentation="push" w={390} h={844} dark /> };
export const Closed: Story = { render: () => <Inspector presentation="drawer" w={390} h={844} defaultOpen={false} /> };

/** `presentation="auto"` (the default): the host is a size-class scope, and the pane follows it. Pick a width. */
function AutoDemo() {
  const [width, setWidth] = useState(820);
  const [ref, sizeClass] = useSizeClass({ breakpoints: { medium: 440, regular: 640 } });
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col items-start gap-3 font-sans">
      <Segmented aria-label="Host width" value={String(width)} onValueChange={(v) => setWidth(Number(v))}>
        {[390, 560, 820].map((w) => <SegmentedItem key={w} value={String(w)}>{w}px</SegmentedItem>)}
      </Segmented>
      <Frame w={width} h={560}>
        <div ref={ref} className="absolute inset-0 flex">
          <SizeClassProvider value={sizeClass}>
            <Page open={open} setOpen={setOpen} note={`size class: ${sizeClass}`} />
            <AdaptivePane side="end" open={open} onOpenChange={setOpen} columnWidth={280} drawerWidth={300}
              className={({ presentation }) => (presentation === 'column' ? 'border-s border-border bg-background' : undefined)}>
              <AdaptivePaneHeader>
                <AdaptivePaneTitle>Activity</AdaptivePaneTitle>
                <AdaptivePaneClose backLabel="Profile" />
              </AdaptivePaneHeader>
              <Activity />
            </AdaptivePane>
          </SizeClassProvider>
        </div>
      </Frame>
    </div>
  );
}
export const Auto: Story = { render: () => <AutoDemo /> };

const MODES: AdaptivePanePresentation[] = ['column', 'drawer', 'push', 'cover', 'hidden'];

/** Every presentation of one start pane, picked by hand; the children stay mounted through each switch. */
function ModesDemo() {
  const [mode, setMode] = useState<AdaptivePanePresentation>('column');
  const [open, setOpen] = useState(true);
  return (
    <Frame w={720} h={460}>
      <div className="absolute inset-0 flex">
        <AdaptivePane presentation={mode} open={open} onOpenChange={setOpen} columnWidth={220} drawerWidth={260} zIndex={20}
          className="border-e border-border bg-card">
          <AdaptivePaneHeader>
            <AdaptivePaneTitle>Pane</AdaptivePaneTitle>
            <AdaptivePaneClose backLabel="Page" />
          </AdaptivePaneHeader>
          <div className="px-4 text-footnote text-muted-foreground">Same children in every presentation: {mode}</div>
        </AdaptivePane>
        <div className="flex min-w-0 flex-1 flex-col gap-3.5 p-5">
          <Segmented aria-label="Presentation" value={mode} onValueChange={(v) => { setMode(v as AdaptivePanePresentation); setOpen(true); }}>
            {MODES.map((m) => <SegmentedItem key={m} value={m}>{m}</SegmentedItem>)}
          </Segmented>
          {!open ? <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>Show pane</Button> : null}
        </div>
      </div>
    </Frame>
  );
}
export const Modes: Story = { render: () => <ModesDemo /> };

/** The separator drags the width (arrows, Home and End too; Enter or a double-click resets); a drawer also swipes
 *  shut toward its edge and, with `swipeToOpen`, swipes open from the left edge. */
function ResizableDemo() {
  const [mode, setMode] = useState<AdaptivePanePresentation>('column');
  const [open, setOpen] = useState(true);
  return (
    <Frame w={720} h={460}>
      <div className="absolute inset-0 flex">
        <AdaptivePane presentation={mode} open={open} onOpenChange={setOpen} swipeToOpen resizable
          columnWidth={220} drawerWidth={260} zIndex={20} aria-label="Pane" className="border-e border-border bg-card">
          <div className="p-4">
            <div className="mb-1.5 font-bold">Pane</div>
            <div className="text-footnote text-muted-foreground">Drag the edge to resize ({mode}).</div>
          </div>
        </AdaptivePane>
        <div className="flex min-w-0 flex-1 flex-col gap-3.5 p-5">
          <Segmented aria-label="Presentation" value={mode} onValueChange={(v) => { setMode(v as AdaptivePanePresentation); setOpen(true); }}>
            {['column', 'drawer'].map((m) => <SegmentedItem key={m} value={m}>{m}</SegmentedItem>)}
          </Segmented>
        </div>
      </div>
    </Frame>
  );
}
export const Resizable: Story = { render: () => <ResizableDemo /> };
