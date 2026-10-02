import type { CSSProperties, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ══ EdgeDrawer — headless scrim + panel that slides in from one edge of a positioned host ══
   No chrome of its own: the children are the whole panel. Tapping the scrim calls onClose. SideDrawer's overlay
   mode, Sidebar's compact overlay and AdaptivePane's drawer mode are configurations of it. An internal building
   block, not a public component: reach for Sheet (modal) or FloatingSheet (beside the page) instead. */

/** The sliding panel: its edge, and (while open) the lifted shadow. Closed, it waits just past its edge. */
export const edgeDrawerVariants = cva(
  'absolute inset-y-0 z-(--edge-drawer-z) transition-[translate,box-shadow] duration-spring-tray ease-spring-tray motion-reduce:transition-none',
  {
    variants: {
      side: { left: 'left-0', right: 'right-0' },
      open: { true: '', false: '' },
      /** The default lifted shadow (off when the caller gives its own). */
      lifted: { true: '', false: '' },
    },
    compoundVariants: [
      { open: true, lifted: true, class: 'shadow-[0_0_44px_black] shadow-black/50' },
      { side: 'left', open: false, class: '-translate-x-[103%]' },
      { side: 'right', open: false, class: 'translate-x-[103%]' },
    ],
    defaultVariants: { side: 'left', open: false, lifted: true },
  },
);

export interface EdgeDrawerProps extends Pick<VariantProps<typeof edgeDrawerVariants>, 'side'> {
  side?: 'left' | 'right';
  open: boolean;
  onClose?: () => void;
  width?: number | string;
  maxWidth?: number | string;
  /** z-index of the scrim; the panel sits one above it */
  zIndex?: number;
  /** Classes for the scrim (default `bg-black/45`; e.g. `bg-overlay`, `bg-transparent`). */
  scrimClassName?: string;
  /** Any CSS background for the scrim — a runtime override of `scrimClassName`'s color. */
  scrim?: string;
  /** Any CSS box-shadow for the open panel, replacing the default lift (`none` for flat). Or pass `shadow-*`
   *  utilities in `className`. */
  shadow?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const len = (v: number | string | undefined) => (typeof v === 'number' ? v + 'px' : v);

export function EdgeDrawer({
  side = 'left', open, onClose, width, maxWidth, zIndex = 30, scrimClassName, scrim, shadow,
  children, className, style,
}: EdgeDrawerProps) {
  return (
    <>
      <div
        data-slot="edge-drawer-scrim"
        onClick={onClose}
        className={cn(
          'absolute inset-0 z-(--edge-drawer-z) bg-black/45 transition-opacity duration-spring-smooth ease-spring-smooth',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          scrimClassName,
          scrim != null && 'bg-(--edge-drawer-scrim)',
        )}
        style={{ '--edge-drawer-z': zIndex, ...(scrim != null ? { '--edge-drawer-scrim': scrim } : null) } as CSSProperties}
      />
      <div
        data-slot="edge-drawer"
        data-side={side}
        data-open={open}
        aria-hidden={!open}
        // Hidden from assistive tech is not enough: a closed drawer's buttons would still take focus.
        inert={!open || undefined}
        className={cn(
          edgeDrawerVariants({ side, open, lifted: shadow == null }),
          width != null && 'w-(--edge-drawer-w)',
          maxWidth != null && 'max-w-(--edge-drawer-max-w)',
          shadow != null && open && '[box-shadow:var(--edge-drawer-shadow)]',
          className,
        )}
        // Size, stacking and caller colors are props, fed in as variables.
        style={{
          '--edge-drawer-z': zIndex + 1,
          ...(width != null ? { '--edge-drawer-w': len(width) } : null),
          ...(maxWidth != null ? { '--edge-drawer-max-w': len(maxWidth) } : null),
          ...(shadow != null ? { '--edge-drawer-shadow': shadow } : null),
          ...style,
        } as CSSProperties}
      >
        {children}
      </div>
    </>
  );
}
