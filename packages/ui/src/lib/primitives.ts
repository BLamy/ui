/* Class fragments shared by the shadcn primitives (badge … form). Internal — not exported from the package. */
import { cva, type VariantProps } from 'class-variance-authority';

/** Keyboard focus ring. */
export const focusRing = 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45';

/** The solid focus ring of pressables (Button, Toggle, ToggleGroup items): the ring colour at full strength, set off
    from the control by a gap in the surface's own colour, so it reads on a filled or tinted control in both schemes. */
export const pressableFocusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Floating surface for popovers, menus and select/combobox lists. It is never taller than the room UI SDK
    measured beside the anchor (`--available-height`), so a list inside it scrolls. Size a popup against its anchor
    with `--anchor-width` (`min-w-(--anchor-width)`). */
export const popoverSurface =
  'max-h-(--available-height) rounded-card bg-popover text-popover-foreground shadow-popover outline-none';

/** A popover or menu presented as a sheet (`data-presentation="sheet"`): shaped like the kit's bottom Sheet (the full
    width of its host, square at the bottom edge, the safe area under its last row) with the Sheet's grabber at the
    top. Its `--sheet-backdrop` only dims the page when the popup is in the top layer: in a layer host (BLProvider is
    one) a popup sheet has no scrim behind it, unlike the kit's Sheet. The grabber is SheetContent's (5×36px,
    `bg-secondary-strong`), drawn as a `::before` because the popup's content is the caller's. */
export const popoverSheet = [
  'data-[presentation=sheet]:max-h-[calc(100%-48px)] data-[presentation=sheet]:w-full data-[presentation=sheet]:min-w-0 data-[presentation=sheet]:rounded-t-card data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pt-4 data-[presentation=sheet]:pb-[max(16px,env(safe-area-inset-bottom))] data-[presentation=sheet]:[--sheet-backdrop:var(--overlay,color-mix(in_oklab,black_40%,transparent))]',
  "data-[presentation=sheet]:before:pointer-events-none data-[presentation=sheet]:before:absolute data-[presentation=sheet]:before:inset-x-0 data-[presentation=sheet]:before:top-[5px] data-[presentation=sheet]:before:mx-auto data-[presentation=sheet]:before:h-[5px] data-[presentation=sheet]:before:w-9 data-[presentation=sheet]:before:rounded-full data-[presentation=sheet]:before:bg-secondary-strong data-[presentation=sheet]:before:content-['']",
].join(' ');

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

/** The small header over a group of rows. Type and color only: the host sets its padding, because the same label
    sits flush in a form and inset by a row's padding in a list.
    - `grouped`: the iOS inset-grouped header ("NOTIFICATIONS" over a Settings card): uppercase footnote, muted.
      List sections and FieldLegend.
    - `sidebar`: a desktop sidebar's section title: uppercase caption2, bold, tertiary. Sidebar sections.
    - `menu`: the header of a group inside a popup or a source list: footnote semibold, muted, not uppercase.
      Listbox / Select / Combobox / DropdownMenu group labels and SplitViewSection's default label. */
export const sectionLabelVariants = cva('m-0 min-w-0', {
  variants: {
    variant: {
      grouped: 'text-footnote leading-[18px] font-normal tracking-[.02em] text-muted-foreground uppercase',
      sidebar: 'text-caption2 leading-4 font-bold tracking-[.06em] whitespace-nowrap text-tertiary-foreground uppercase',
      menu: 'text-footnote leading-[18px] font-semibold text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'grouped' },
});
export type SectionLabelVariant = NonNullable<VariantProps<typeof sectionLabelVariants>['variant']>;

/** The layers of a dense data row (a log line, a table row): its own background stays free for a tint (a warning's
    wash), and hover, press and selection share a `::before` layer over it, so a selected warning still reads as one.
    The `::after` line under the row is lighter than a list's hairline: at this density a full one rules the list like
    paper. The row must be `relative`/`absolute`; add `data-current:before:bg-primary/10` where a row can be "now". */
export const dataRowLayers = [
  "isolate outline-none before:absolute before:inset-0 before:-z-1 before:content-[''] hover:before:bg-foreground/4 active:before:bg-foreground/8",
  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/60 after:content-['']",
  'data-selected:before:bg-primary/16',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
].join(' ');
