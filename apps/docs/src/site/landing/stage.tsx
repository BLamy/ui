/* The frame the landing page's live app runs in, and the two controls that set its width: a Segmented control with the
   kit's three size classes, and a Slider for every width between. The frame is the app's root (a BLProvider), so the
   app's popups stay inside it and the app measures the frame, not the page: narrowing it is the same as running the
   app on a smaller screen. On a page too narrow to offer more than one size class there is nothing to choose, so the
   controls step aside and the frame takes the page's width. */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { useContainerWidth } from '@/lib/container';
import { sizeClassOf, type SizeClass } from '@/lib/size-class';
import { BLProvider } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** The narrowest frame: a small phone. */
const MIN_WIDTH = 320;
/** Where the kit's medium and regular size classes start (lib/size-class.ts). */
const MEDIUM = 640;
const REGULAR = 1024;
/** The width a size class's button sets: a phone, a tablet in portrait, and as wide as the page allows. */
const PRESET: Record<SizeClass, number | null> = { compact: 390, medium: 768, regular: null };
const CLASSES: Array<{ id: SizeClass; label: string; from: number }> = [
  { id: 'compact', label: 'Compact', from: MIN_WIDTH },
  { id: 'medium', label: 'Medium', from: MEDIUM },
  { id: 'regular', label: 'Regular', from: REGULAR },
];

export interface StageState {
  /** The page is wide enough to offer more than one size class. */
  resizable: boolean;
  sizeClass: SizeClass;
  width: number;
  /** The widest the frame can be here, and whether that reaches the regular class. */
  available: number;
  regularFits: boolean;
}

export function Stage({ children, label, lead, caption }: {
  children: ReactNode;
  /** Names the frame for assistive technology. */
  label: string;
  /** One line beside the controls. */
  lead: ReactNode;
  /** What the frame is showing, under it. */
  caption: (state: StageState) => ReactNode;
}) {
  const [host, measured] = useContainerWidth<HTMLDivElement>(1072);
  const available = Math.max(MIN_WIDTH, Math.floor(measured));
  /** The width the reader chose; `null` fills the page. */
  const [chosen, setChosen] = useState<number | null>(null);
  /** A preset springs to its width; the slider is followed as it moves. */
  const [springing, setSpringing] = useState(false);
  const width = Math.min(chosen ?? available, available);
  const sizeClass = sizeClassOf(width);
  const resizable = available >= MEDIUM;

  const preset = (next: SizeClass) => {
    const to = PRESET[next];
    setSpringing(true);
    setChosen(to === null || to >= available ? null : to);
  };

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="m-0 text-subhead text-foreground">{lead}</p>
        {resizable ? (
          <div role="group" aria-label="Frame width" className="flex items-center gap-3">
            <Segmented<SizeClass> aria-label="Size class" size="sm" value={sizeClass} onValueChange={(v) => { if (v) preset(v); }} className="w-60">
              {CLASSES.map((c) => <SegmentedItem key={c.id} value={c.id} disabled={available < c.from}>{c.label}</SegmentedItem>)}
            </Segmented>
            <Slider
              aria-label="Frame width, in pixels"
              min={MIN_WIDTH}
              max={available}
              step={1}
              largeStep={64}
              value={width}
              onValueChange={(v) => { setSpringing(false); setChosen(v >= available ? null : v); }}
              className="w-32 @4xl/page:w-44"
            />
            <output aria-label="Frame width" className="w-14 text-end text-footnote text-muted-foreground tabular-nums">{width} px</output>
          </div>
        ) : null}
      </div>
      {/* The canvas is the room the page gives the app; the frame is how much of it the app gets. */}
      <div ref={host} className="rounded-card bg-muted">
        <div
          role="region"
          aria-label={label}
          data-size-class={sizeClass}
          onTransitionEnd={(e) => { if (e.target === e.currentTarget) setSpringing(false); }}
          className={cn(
            'relative mx-auto h-140 w-(--frame-width) max-w-full overflow-hidden rounded-card shadow-raised',
            springing && 'transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
          )}
          style={{ '--frame-width': `${width}px` } as CSSProperties}
        >
          <BLProvider>{children}</BLProvider>
        </div>
      </div>
      <figcaption className="max-w-3xl text-footnote text-pretty text-muted-foreground">{caption({ resizable, sizeClass, width, available, regularFits: available >= REGULAR })}</figcaption>
    </figure>
  );
}
