'use client';
import type { ComponentProps, ReactNode, SyntheticEvent } from 'react';
import {
  HoverCard as SdkHoverCard,
  HoverCardArrow as SdkHoverCardArrow,
  HoverCardContent as SdkHoverCardContent,
} from '@ui-sdk/react/hover-card';
import { popoverArrow, popoverArrowGlyph, popoverMotion, popoverSurface } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';
import { surfaceDescriptionVariants, surfaceTitleVariants } from '@/components/ui/dialog';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';

/* ══ HoverCard — UI SDK's Hover Card on the kit's floating surface ══
   A preview of what a trigger points at (a person, a link, a file, a commit), shown while the pointer rests on it
   or keyboard focus stays on it. Unlike a Tooltip it is a card: rich content, and the pointer can move into it (to
   select text or follow a link) without it closing. Touch never opens it, so it only ever previews what pressing
   the trigger shows in full. UI SDK owns the hover intent, Esc, focus moving into the card and its placement; the
   card renders into BLProvider's root (see `useLayerHost`).
   <HoverCard>
     <HoverCardTrigger href="/u/june">@june</HoverCardTrigger>
     <HoverCardContent>…</HoverCardContent>
   </HoverCard>
   The trigger is a link; `render` makes it any other element that has a name (a button, a row, an avatar with an
   `aria-label`). One card serves many triggers through a controller: each `<HoverCardTrigger controller payload>`
   hands the card its payload, the card moves along as the pointer sweeps across them, and
   `controller.open({ anchor, payload })` opens it for something you hit-test yourself (a canvas item, a map pin). ══ */

export { HoverCardTrigger, createHoverCardController } from '@ui-sdk/react/hover-card';
export type { HoverCardController } from '@ui-sdk/react/hover-card';

export type HoverCardProps = ComponentProps<typeof SdkHoverCard>;

export function HoverCard({ container, ...props }: HoverCardProps) {
  const host = useLayerHost();
  return <SdkHoverCard container={container === undefined ? host : container} {...props} />;
}

export type HoverCardContentProps<Payload = unknown> = Parameters<typeof SdkHoverCardContent<Payload>>[0] & {
  /** Draw a pointer toward the trigger (default false). */
  arrow?: boolean;
};

/* The card renders elsewhere in the page, but React still bubbles its events through the trigger's ancestors: a
   press in the card must not also press the row or button it previews. */
const contained = <E extends SyntheticEvent>(handler?: (event: E) => void) => (event: E) => {
  handler?.(event);
  event.stopPropagation();
};

/** The card: a padded surface, 18rem wide, that never blocks the page. */
export function HoverCardContent<Payload = unknown>({
  className, style, sideOffset = 8, arrow = false, children,
  onPointerDown, onPointerUp, onMouseDown, onMouseUp, onClick, onDoubleClick, onContextMenu, ...props
}: HoverCardContentProps<Payload>) {
  const scope = useThemeScopeProps();
  return (
    <SdkHoverCardContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      sideOffset={sideOffset}
      className={cx([popoverSurface, popoverMotion, 'box-border w-72 max-w-(--available-width) p-4 text-subhead', scope.className], className)}
      style={scopeStyle(scope.style, style)}
      onPointerDown={contained(onPointerDown)}
      onPointerUp={contained(onPointerUp)}
      onMouseDown={contained(onMouseDown)}
      onMouseUp={contained(onMouseUp)}
      onClick={contained(onClick)}
      onDoubleClick={contained(onDoubleClick)}
      onContextMenu={contained(onContextMenu)}
      {...props}
    >
      {(state) => (
        <>
          {arrow ? <HoverCardArrow /> : null}
          {typeof children === 'function' ? children(state) : children}
        </>
      )}
    </SdkHoverCardContent>
  );
}

/** The pointer on the card's edge. HoverCardContent draws one with `arrow`. */
export function HoverCardArrow({ className, ...props }: ComponentProps<typeof SdkHoverCardArrow>) {
  return (
    <SdkHoverCardArrow className={cx([popoverArrow, '[--bl-arrow-h:6px] [--bl-arrow-w:12px]'], className)} {...props}>
      <svg width={12} height={6} viewBox="0 0 12 6" aria-hidden="true" className={`${popoverArrowGlyph} fill-popover`}>
        <path d="M0 0 L6 6 L12 0" />
      </svg>
    </SdkHoverCardArrow>
  );
}

export interface HoverCardHeaderProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** The leading thing: an Avatar, an icon or a thumbnail. */
  icon?: ReactNode;
  /** What the card previews. It is the card's heading. */
  title: ReactNode;
  /** A handle, path or kind under the title. */
  description?: ReactNode;
  /** A trailing control or status (a Follow button, a Badge). */
  trailing?: ReactNode;
}

/** The usual top of a card, in the kit's row anatomy: `icon`, `title` (a heading), `description` and `trailing`.
    Other props go on its `div`. */
export function HoverCardHeader({ icon, title, description, trailing, className, ...props }: HoverCardHeaderProps) {
  return (
    <div data-slot="hover-card-header" className={cn('flex min-w-0 items-center gap-3', className)} {...props}>
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        <h3 className={cn(surfaceTitleVariants({ size: 'sm' }), 'truncate')}>{title}</h3>
        {description ? <p className={cn(surfaceDescriptionVariants({ size: 'sm' }), 'truncate')}>{description}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
