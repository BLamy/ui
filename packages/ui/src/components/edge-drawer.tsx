import type { CSSProperties, ReactNode } from 'react';
import { cn, EASE } from '../lib/utils';

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
        style={{
          position: 'absolute', inset: 0, zIndex, background: scrim,
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .32s ' + EASE,
        }}
      />
      <div
        data-slot="edge-drawer"
        data-side={side}
        data-open={open}
        aria-hidden={!open}
        className={cn(className)}
        style={{
          position: 'absolute', top: 0, bottom: 0, [side]: 0, zIndex: zIndex + 1, width, maxWidth,
          transform: open ? 'none' : `translateX(${side === 'left' ? '-' : ''}103%)`,
          transition: 'transform .38s ' + EASE, boxShadow: open ? shadow : 'none',
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );
}
