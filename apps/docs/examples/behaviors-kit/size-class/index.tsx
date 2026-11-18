import { definePrimitive } from '@brett_lamy/ui/sdk/core';
import { bindSizeClass, sizeClassOf, type SizeClass, type SizeClassBreakpoints } from '@/lib/size-class';
import { createParts } from '@brett_lamy/ui/sdk/react/primitive';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { SizeClassProvider } from '@/lib/container';
import { cn } from '@/lib/utils';

/* Breakpoints for this demo, small enough that all three classes fit in a docs column. The defaults are 640 and
   1024. */
const BREAKPOINTS: SizeClassBreakpoints = { medium: 420, regular: 640 };

type FrameOptions = { initialWidth?: number };

/* An app frame, the way BLProvider's root is one: a layer host (`data-layer-host` with `contain: layout`: popups
   opened inside stay inside its box, and its modals make only it inert) that names its own width as a size class
   (`bindSizeClass`). Both attributes are in the markup, so the first paint and a popup that is open from the start
   already see them. The frame provides its class to what it renders (`SizeClassProvider`), which is what the kit's
   `presentation="auto"` reads. */
const frame = definePrimitive({
  name: 'app-frame',
  options: { initialWidth: 'number' },
  state: (options: FrameOptions) => ({ sizeClass: sizeClassOf(options.initialWidth ?? 390, BREAKPOINTS) as SizeClass }),
  api: (context) => ({
    bind: (el: HTMLElement) =>
      bindSizeClass(el, { breakpoints: BREAKPOINTS, onChange: (sizeClass) => context.store.set({ sizeClass }) }),
  }),
  slots: (slot) => ({
    root: slot<object, { sizeClass: SizeClass }>({
      state: (state) => ({ sizeClass: state.sizeClass }),
      attrs: (state) => ({ 'data-layer-host': '', 'data-size-class': state.sizeClass }),
      bind: (el, { api }) => api.bind(el),
    }),
  }),
  // A container: the controls inside it are what an agent uses.
  agent: { actions: [], shown: () => false },
});

const { Root: AppFrame } = createParts(frame, { root: 'div' });

const MAILBOXES = ['Inbox', 'Drafts', 'Sent', 'Archive'];

export default function SizeClassDemo() {
  const [width, setWidth] = useState(360);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-3 text-footnote text-foreground/70">
        Frame width
        <input type="range" min={300} max={720} step={10} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="flex-1" />
        <span className="w-12 font-mono text-foreground">{width}px</span>
      </label>
      <AppFrame
        ref={setHost}
        initialWidth={width}
        // The width is the only runtime value: everything else follows data-size-class.
        style={{ width }}
        className="group/frame relative mx-auto h-80 max-w-full overflow-clip rounded-sheet bg-background shadow-hairline [contain:layout]"
      >
        {({ sizeClass }) => (
          <SizeClassProvider value={sizeClass}>
            <div className="grid h-full grid-cols-1 group-data-[size-class=medium]/frame:grid-cols-[10rem_1fr] group-data-[size-class=regular]/frame:grid-cols-[12rem_1fr_12rem]">
              <nav aria-label="Mailboxes" className="hidden border-r border-border bg-secondary p-2 group-not-data-[size-class=compact]/frame:block">
                {MAILBOXES.map((name) => (
                  <div key={name} className="flex h-8 items-center rounded-ctl px-2 text-footnote text-foreground first:bg-background">
                    {name}
                  </div>
                ))}
              </nav>
              <main className="grid content-start gap-3 p-4">
                <p className="m-0 text-footnote text-foreground/70">
                  data-size-class=<span className="font-mono text-foreground">{sizeClass}</span>
                </p>
                <Popover presentation="auto" container={host ?? undefined}>
                  <PopoverTrigger className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'justify-self-start')}>Share</PopoverTrigger>
                  <PopoverContent>
                    <PopoverTitle className="m-0 text-body font-semibold">Share</PopoverTitle>
                    <p className="m-0 mt-1 text-footnote text-foreground/70">
                      A sheet while the frame is compact, a popover from medium up, whatever the size of the screen.
                    </p>
                  </PopoverContent>
                </Popover>
              </main>
              <aside aria-label="Details" className="hidden border-l border-border p-4 text-footnote text-foreground/70 group-data-[size-class=regular]/frame:block">
                Details column (regular only)
              </aside>
            </div>
          </SizeClassProvider>
        )}
      </AppFrame>
    </div>
  );
}
