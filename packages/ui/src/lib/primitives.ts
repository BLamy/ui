/* Class fragments shared by the shadcn primitives (badge … form). Internal — not exported from the package. */

/** Keyboard focus ring for react-aria elements (data-focus-visible). */
export const focusRing = 'outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45';

/** Floating surface for popovers, menus and select/combobox lists. */
export const popoverSurface =
  'rounded-[14px] bg-popover text-popover-foreground shadow-[0_12px_40px_rgba(0,0,0,.2),0_0_0_.5px_var(--bl-sep)] outline-none';

/** Enter/exit for anchored overlays: grows out of the trigger (scale from the anchor point, drifting a few px
    away from it) on the snappy spring; exits are quicker. */
export const popoverMotion = [
  'origin-(--trigger-anchor-point) data-entering:animate-bl-pop-in data-exiting:animate-bl-pop-out',
  'data-[placement=bottom]:[--bl-pop-y:-6px] data-[placement=top]:[--bl-pop-y:6px] data-[placement=left]:[--bl-pop-x:6px] data-[placement=right]:[--bl-pop-x:-6px]',
  'motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out',
].join(' ');

/** Overlays portal into BLProvider's root (position: relative) and stack above its chrome. */
export const overlayZ = 'z-[500]';

/** BLProvider turns text selection off for the chrome; text fields opt back in. */
export const selectableText = 'select-text [-webkit-user-select:text]';
