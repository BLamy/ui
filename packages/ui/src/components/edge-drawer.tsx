import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/utils';

/* ══ EdgeDrawer — headless scrim + panel that slides in from one edge of a positioned host ══
   No chrome of its own: the children are the whole panel. Tapping the scrim calls onClose. */

export interface EdgeDrawerProps {
  side?: 'left' | 'right';
  open: boolean;
  onClose?: () => void;
  width?: number | string;
  maxWidth?: number | string;
  /** z-index of the scrim; the panel sits one above it */
  zIndex?: number;
  scrim?: string;
  shadow?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function EdgeDrawer({
  side = 'left', open, onClose, width, maxWidth, zIndex = 30,
  scrim = 'rgba(0,0,0,.45)', shadow = '0 0 44px rgba(0,0,0,.5)',
  children, className, style,
}: EdgeDrawerProps) {
  return (
    <>
      <div
        data-slot="edge-drawer-scrim"
        onClick={onClose}
        className={cn('absolute inset-0 transition-opacity duration-320 ease-ios', open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0')}
        style={{ zIndex, background: scrim }}
      />
      <div
        data-slot="edge-drawer"
        data-side={side}
        data-open={open}
        aria-hidden={!open}
        className={cn(
          'absolute inset-y-0 transition-transform duration-380 ease-ios',
          side === 'left' ? 'left-0' : 'right-0',
          !open && (side === 'left' ? '-translate-x-[103%]' : 'translate-x-[103%]'),
          className,
        )}
        style={{ zIndex: zIndex + 1, width, maxWidth, boxShadow: open ? shadow : 'none', ...style }}
      >
        {children}
      </div>
    </>
  );
}
