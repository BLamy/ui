'use client';
import type { ComponentProps } from 'react';
import {
  Popover as SdkPopover,
  PopoverArrow as SdkPopoverArrow,
  PopoverContent as SdkPopoverContent,
  PopoverDescription as SdkPopoverDescription,
  PopoverTitle as SdkPopoverTitle,
} from '@ui-sdk/react/popover';
import { cva, type VariantProps } from 'class-variance-authority';
import { popoverArrow, popoverArrowGlyph, popoverMotion, popoverSurface } from '@/lib/primitives';
import { cx } from '@/lib/utils';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { usePresentation } from '@/lib/container';

/* ══ Popover — UI SDK's Popover on the kit's floating surface ══
   UI SDK owns the behavior: placement beside the trigger with flipping (`side`, `align`, `sideOffset`), Esc and
   outside-press dismissal, focus moving in and back to the trigger, `modal`, `openOnHover`, and
   `presentation="auto"`, which turns it into a bottom sheet in a compact container. It renders into BLProvider's
   root (see `useLayerHost`), so it keeps the theme tokens and stays inside the app's frame.
   <Popover>
     <PopoverTrigger className={buttonVariants({ variant: 'secondary' })}>Dimensions</PopoverTrigger>
     <PopoverContent align="start">
       <PopoverTitle>Dimensions</PopoverTitle>
       …
     </PopoverContent>
   </Popover>
   A trigger elsewhere on the page connects through a controller (`createPopoverController`). ══ */

export { PopoverClose, PopoverTrigger, createPopoverController } from '@ui-sdk/react/popover';
export type { PopoverController } from '@ui-sdk/react/popover';

export type PopoverProps = ComponentProps<typeof SdkPopover>;

export function Popover({ container, presentation, ...props }: PopoverProps) {
  const host = useLayerHost();
  // "auto" follows the nearest size class around (a sheet when compact), even when the content is portaled.
  const shown = usePresentation(presentation, 'popover');
  return <SdkPopover container={container === undefined ? host : container} presentation={shown} {...props} />;
}

/* The kit's floating surface. As a sheet it is shaped like the kit's bottom Sheet: the full width of its host, square
   at the bottom edge. Its `--sheet-backdrop` only dims the page when the popup is in the top layer: in a layer host
   (BLProvider is one) a popover sheet has no scrim behind it, unlike the kit's Sheet. */
export const popoverContentVariants = cva(
  [
    popoverSurface,
    popoverMotion,
    'box-border data-[presentation=sheet]:max-h-[calc(100%-48px)] data-[presentation=sheet]:w-full data-[presentation=sheet]:min-w-0 data-[presentation=sheet]:rounded-t-card data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pb-[max(16px,env(safe-area-inset-bottom))] data-[presentation=sheet]:[--sheet-backdrop:var(--overlay,color-mix(in_oklab,black_40%,transparent))]',
  ],
  {
    variants: {
      variant: {
        /** A padded panel for arbitrary content, 18rem wide. */
        panel: 'w-72 p-4',
        /** The bare surface, at least as wide as its anchor: for a list or a layout that pads itself. */
        surface: 'min-w-(--anchor-width)',
      },
    },
    defaultVariants: { variant: 'panel' },
  },
);

export type PopoverContentProps<Payload = unknown> =
  Parameters<typeof SdkPopoverContent<Payload>>[0] & VariantProps<typeof popoverContentVariants>;

/** The floating surface. It has the dialog role: name it with a PopoverTitle (`sr-only` to hide it); without one it
    takes its trigger's name (UI SDK points `aria-labelledby` at the trigger, which wins over an `aria-label`). */
export function PopoverContent<Payload = unknown>({ className, style, variant, sideOffset = 8, ...props }: PopoverContentProps<Payload>) {
  const scope = useThemeScopeProps();
  return (
    <SdkPopoverContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      sideOffset={sideOffset}
      className={cx([popoverContentVariants({ variant }), scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    />
  );
}

/** A pointer on the surface's edge toward the trigger. Put it first inside PopoverContent, and leave the surface's
    overflow visible. */
export function PopoverArrow({ className, ...props }: ComponentProps<typeof SdkPopoverArrow>) {
  return (
    <SdkPopoverArrow className={cx([popoverArrow, '[--bl-arrow-h:6px] [--bl-arrow-w:12px]'], className)} {...props}>
      <svg width={12} height={6} viewBox="0 0 12 6" aria-hidden="true" className={`${popoverArrowGlyph} fill-popover`}>
        <path d="M0 0 L6 6 L12 0" />
      </svg>
    </SdkPopoverArrow>
  );
}

/** Names the popover. */
export function PopoverTitle({ className, ...props }: ComponentProps<typeof SdkPopoverTitle>) {
  return <SdkPopoverTitle className={cx('m-0 text-body font-semibold text-foreground', className)} {...props} />;
}

/** Describes the popover, under its title. */
export function PopoverDescription({ className, ...props }: ComponentProps<typeof SdkPopoverDescription>) {
  return <SdkPopoverDescription className={cx('m-0 text-footnote text-muted-foreground', className)} {...props} />;
}
