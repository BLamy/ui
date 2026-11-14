/* Class fragments shared by the shadcn primitives (badge … form). Internal — not exported from the package. */

/** Keyboard focus ring. */
export const focusRing = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45';

/** Floating surface for popovers, menus and select/combobox lists. It is never taller than the room UI SDK
    measured beside the anchor (`--available-height`), so a list inside it scrolls. Size a popup against its anchor
    with `--anchor-width` (`min-w-(--anchor-width)`). */
export const popoverSurface =
  'max-h-(--available-height) rounded-[14px] bg-popover text-popover-foreground shadow-[0_12px_40px_--alpha(black/20%),0_0_0_.5px_var(--border)] outline-none';

/** Enter/exit for anchored popups, as transitions out of UI SDK's `data-starting-style` and into its
    `data-ending-style`: the popup grows out of its anchor (scale from `--transform-origin`, drifting a few px away
    from the side it landed on, `data-side`) on the snappy spring; exits are quicker. A popup that opens at once
    (`data-instant`: the next tooltip while one is warm) skips it, reduced motion keeps only the fade, and a popup
    presented as a sheet (`data-presentation="sheet"`) is left to the sheet, which moves itself. */
export const popoverMotion = [
  'origin-(--transform-origin) transition-[opacity,scale,translate] duration-spring-snappy ease-spring-snappy data-[presentation=sheet]:transition-none',
  'not-data-[presentation=sheet]:data-starting-style:opacity-0 motion-safe:not-data-[presentation=sheet]:data-starting-style:scale-90 motion-safe:not-data-[presentation=sheet]:data-starting-style:[translate:var(--bl-pop-x,0)_var(--bl-pop-y,0)]',
  'not-data-[presentation=sheet]:data-ending-style:opacity-0 motion-safe:not-data-[presentation=sheet]:data-ending-style:scale-96 data-ending-style:duration-exit data-ending-style:ease-exit',
  'data-[side=bottom]:[--bl-pop-y:-6px] data-[side=top]:[--bl-pop-y:6px] data-[side=left]:[--bl-pop-x:6px] data-[side=right]:[--bl-pop-x:-6px]',
  'data-instant:duration-0',
  'motion-reduce:duration-spring-smooth motion-reduce:ease-spring-smooth',
].join(' ');

/** A popup's arrow part. UI SDK slides it along the edge that faces the anchor and reports that edge as `data-side`;
    these classes hang it outside that edge and turn the glyph inside (a triangle drawn pointing down) to match.
    The part sets the glyph's size as `--bl-arrow-w` / `--bl-arrow-h`, so the box it is centered against is right on
    every side. */
export const popoverArrow = [
  'group/arrow pointer-events-none absolute grid h-(--bl-arrow-h) w-(--bl-arrow-w) place-items-center',
  'data-[side=top]:top-full data-[side=bottom]:bottom-full data-[side=left]:left-full data-[side=right]:right-full',
  'data-[side=left]:h-(--bl-arrow-w) data-[side=left]:w-(--bl-arrow-h) data-[side=right]:h-(--bl-arrow-w) data-[side=right]:w-(--bl-arrow-h)',
].join(' ');
export const popoverArrowGlyph =
  'block shrink-0 group-data-[side=bottom]/arrow:rotate-180 group-data-[side=left]/arrow:-rotate-90 group-data-[side=right]/arrow:rotate-90';

/** BLProvider turns text selection off for the chrome; text fields opt back in. */
export const selectableText = 'select-text [-webkit-user-select:text]';
