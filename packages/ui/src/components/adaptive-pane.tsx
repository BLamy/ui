import type { CSSProperties, ReactNode } from 'react';
import { EdgeDrawer, type EdgeDrawerProps } from './edge-drawer';

/* ══ AdaptivePane — one region, four presentations ══
   mode="column" docks it beside its siblings in a flex row, mode="drawer" moves the same children into an
   EdgeDrawer over the host, mode="cover" fills the positioned host, mode="hidden" renders nothing.
   The host decides the mode from its width; the children never change, so their state survives. */

export type AdaptivePaneMode = 'column' | 'drawer' | 'cover' | 'hidden';

export interface AdaptivePaneProps extends Omit<EdgeDrawerProps, 'open' | 'width'> {
  mode: AdaptivePaneMode;
  /** drawer visibility; ignored in the other modes */
  open?: boolean;
  columnWidth?: number | string;
  drawerWidth?: number | string;
  /** style of the docked column; `style` applies to the drawer panel */
  columnStyle?: CSSProperties;
  children?: ReactNode;
}

export function AdaptivePane({ mode, open = false, columnWidth, drawerWidth, columnStyle, side = 'left', children, ...drawer }: AdaptivePaneProps) {
  if (mode === 'hidden') return null;
  if (mode === 'cover') {
    return <div data-slot="adaptive-pane" data-mode="cover" style={{ position: 'absolute', inset: 0, zIndex: drawer.zIndex }}>{children}</div>;
  }
  if (mode === 'drawer') {
    return <EdgeDrawer {...drawer} side={side} open={open} width={drawerWidth}>{children}</EdgeDrawer>;
  }
  return (
    <div data-slot="adaptive-pane" data-mode="column" data-side={side} style={{ width: columnWidth, flexShrink: 0, minHeight: 0, ...columnStyle }}>
      {children}
    </div>
  );
}
