'use client';
import { createContext, useContext, type ComponentProps } from 'react';
import {
  ScrollArea as SdkScrollArea,
  ScrollAreaContent as SdkScrollAreaContent,
  ScrollAreaCorner as SdkScrollAreaCorner,
  ScrollAreaScrollbar as SdkScrollAreaScrollbar,
  ScrollAreaScrollToEnd as SdkScrollAreaScrollToEnd,
  ScrollAreaThumb as SdkScrollAreaThumb,
  ScrollAreaViewport as SdkScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/* ══ ScrollArea — UI SDK's ScrollArea with the kit's thin scrollbars ══
   The viewport is the native scroller (momentum, overscroll, keyboard, find in page), and a tab stop only while it
   scrolls and holds nothing focusable. With no scrollbar parts the browser's own bars stay, in the kit's thin
   `.bl-scroll` look; a `ScrollAreaScrollbar` draws one over the content's edge instead, shown while the area is
   hovered or scrolled. The root says where the view is (`data-at-start`, `data-overflow-y`,
   `--scroll-area-overflow-y-end`…) for fades and shadows, and `stickToEnd` keeps a growing log at its end.
   <ScrollArea className="h-64">
     <ScrollAreaViewport aria-label="Releases"><ScrollAreaContent>…</ScrollAreaContent></ScrollAreaViewport>
   </ScrollArea> ══ */
export { createScrollAreaController } from '@ui-sdk/react/scroll-area';

/** The scroller's look, and which axes scroll. UI SDK's viewport scrolls both, so one axis is taken away with `!`. */
export const scrollAreaViewportVariants = cva(
  'bl-scroll min-h-0 flex-1 overscroll-contain rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45',
  {
    variants: {
      orientation: {
        vertical: 'overflow-x-hidden! overflow-y-auto!',
        horizontal: 'overflow-x-auto! overflow-y-hidden!',
        both: 'overflow-auto',
      },
    },
    defaultVariants: { orientation: 'vertical' },
  },
);

type Orientation = NonNullable<VariantProps<typeof scrollAreaViewportVariants>['orientation']>;
const OrientationCtx = createContext<Orientation>('vertical');

export type ScrollAreaProps = ComponentProps<typeof SdkScrollArea> & {
  /** Which axes scroll: `vertical` (default), `horizontal` or `both`. */
  orientation?: Orientation;
};

/** Size it here (`h-64`, `max-h-80`, or a flex or grid parent that bounds it): the viewport fills it. */
export function ScrollArea({ className, orientation = 'vertical', ...props }: ScrollAreaProps) {
  return (
    <OrientationCtx.Provider value={orientation}>
      <SdkScrollArea data-orientation={orientation} className={cx('flex min-h-0 min-w-0 flex-col', className)} {...props} />
    </OrientationCtx.Provider>
  );
}

export type ScrollAreaViewportProps = ComponentProps<typeof SdkScrollAreaViewport>;

export function ScrollAreaViewport({ className, ...props }: ScrollAreaViewportProps) {
  const orientation = useContext(OrientationCtx);
  return <SdkScrollAreaViewport className={cx(scrollAreaViewportVariants({ orientation }), className)} {...props} />;
}

export const ScrollAreaContent = SdkScrollAreaContent;
export const ScrollAreaCorner = SdkScrollAreaCorner;

export type ScrollAreaScrollbarProps = ComponentProps<typeof SdkScrollAreaScrollbar>;

/** A scrollbar over the viewport's edge, for one axis: a thin thumb with no track. It replaces the browser's. */
export function ScrollAreaScrollbar({ className, children, ...props }: ScrollAreaScrollbarProps) {
  return (
    <SdkScrollAreaScrollbar
      className={cx(
        'flex p-0.5 opacity-0 transition-opacity duration-150 data-visible:opacity-100 data-[orientation=horizontal]:h-[7px] data-[orientation=vertical]:w-[7px] data-[orientation=vertical]:flex-col motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {children ?? <ScrollAreaThumb />}
    </SdkScrollAreaScrollbar>
  );
}

export type ScrollAreaThumbProps = ComponentProps<typeof SdkScrollAreaThumb>;

export function ScrollAreaThumb({ className, ...props }: ScrollAreaThumbProps) {
  return <SdkScrollAreaThumb className={cx('rounded-full bg-muted-foreground/35 data-dragging:bg-muted-foreground/60', className)} {...props} />;
}

export type ScrollAreaScrollToEndProps = ComponentProps<typeof SdkScrollAreaScrollToEnd>;

/** "Jump to latest" for a `stickToEnd` area: a small secondary button over the bottom edge, there only while the
    view is away from the end. Name it with its content. */
export function ScrollAreaScrollToEnd({ className, ...props }: ScrollAreaScrollToEndProps) {
  return (
    <SdkScrollAreaScrollToEnd
      className={cx(
        [buttonVariants({ variant: 'secondary', size: 'sm' }), 'absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 data-visible:opacity-100'],
        className,
      )}
      {...props}
    />
  );
}
