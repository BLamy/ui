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
import { popoverArrow, popoverArrowGlyph, popoverMotion, popoverSheet, popoverSurface } from '@/lib/primitives';
import { cx } from '@/lib/utils';
import { surfaceDescriptionVariants, surfaceTitleVariants } from '@/lib/surface';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { useTriggerPalette, type PopupPalette } from '@/lib/trigger-palette';
import { usePresentation } from '@/lib/container';

/* ══ Popover — UI SDK's Popover on the kit's floating surface ══
   UI SDK owns the behavior: placement beside the trigger with flipping (`side`, `align`, `sideOffset`), Esc and
   outside-press dismissal, focus moving in and back to the trigger, `modal`, `openOnHover`, and
   `presentation="auto"`, which turns it into a bottom sheet in a compact container. It renders into BLProvider's
   root (see `useLayerHost`), so it keeps the theme tokens and stays inside the app's frame.
   <Popover>
     <PopoverTrigger render={<Button variant="secondary" />}>Dimensions</PopoverTrigger>
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

/* The kit's floating surface. As a sheet it is shaped like the kit's bottom Sheet, grabber included (`popoverSheet`). */
export const popoverContentVariants = cva(
  [popoverSurface, popoverMotion, popoverSheet, 'box-border [--avatar-ring:var(--popover)]'],
  {
    variants: {
      variant: {
        /** A padded panel for arbitrary content, 18rem wide. */
        panel: 'w-72 p-4',
        /** No padding or width of its own (only at least as wide as its anchor): for a list or a layout that pads itself. */
        plain: 'min-w-(--anchor-width)',
      },
    },
    defaultVariants: { variant: 'panel' },
  },
);

export type PopoverContentProps<Payload = unknown> =
  Parameters<typeof SdkPopoverContent<Payload>>[0] & VariantProps<typeof popoverContentVariants> & {
    /** Draw a pointer toward the trigger (default false). Leave the surface's overflow visible. */
    arrow?: boolean;
    /** Where the colors come from: the ThemeScope it was opened from (`scope`, the default), or the trigger's
        element (`trigger`), for a trigger on a surface that CSS paints rather than a ThemeScope (see `useTriggerPalette`). */
    palette?: PopupPalette;
  };

/** The floating surface. It has the dialog role: name it with a PopoverTitle (`sr-only` to hide it); without one it
    takes its trigger's name (UI SDK points `aria-labelledby` at the trigger, which wins over an `aria-label`). */
export function PopoverContent<Payload = unknown>({
  className, style, variant, sideOffset = 8, arrow = false, palette = 'scope', ref, children, ...props
}: PopoverContentProps<Payload>) {
  const scope = useThemeScopeProps();
  const trigger = useTriggerPalette(palette === 'trigger', ref);
  const colors = trigger.props ?? scope;
  return (
    <SdkPopoverContent<Payload>
      ref={trigger.ref}
      data-theme-scope={colors['data-theme-scope']}
      sideOffset={sideOffset}
      className={cx([popoverContentVariants({ variant }), colors.className], className)}
      style={scopeStyle(colors.style, style)}
      {...props}
    >
      {(state) => (
        <>
          {arrow ? <PopoverArrow /> : null}
          {typeof children === 'function' ? children(state) : children}
        </>
      )}
    </SdkPopoverContent>
  );
}

/** The pointer on the surface's edge toward the trigger. PopoverContent draws one with `arrow`; place this yourself
    only to style it (first inside the content). */
export function PopoverArrow({ className, ...props }: ComponentProps<typeof SdkPopoverArrow>) {
  return (
    <SdkPopoverArrow className={cx([popoverArrow, '[--bl-arrow-h:6px] [--bl-arrow-w:12px]'], className)} {...props}>
      <svg width={12} height={6} viewBox="0 0 12 6" aria-hidden="true" className={`${popoverArrowGlyph} fill-popover`}>
        <path d="M0 0 L6 6 L12 0" />
      </svg>
    </SdkPopoverArrow>
  );
}

/** Names the popover: a heading in the kit's small surface title (`surfaceTitleVariants({ size: 'sm' })`). */
export function PopoverTitle({ className, ...props }: ComponentProps<typeof SdkPopoverTitle>) {
  return <SdkPopoverTitle className={cx(surfaceTitleVariants({ size: 'sm' }), className)} {...props} />;
}

/** Describes the popover, under its title. */
export function PopoverDescription({ className, ...props }: ComponentProps<typeof SdkPopoverDescription>) {
  return <SdkPopoverDescription className={cx(surfaceDescriptionVariants({ size: 'sm' }), className)} {...props} />;
}
