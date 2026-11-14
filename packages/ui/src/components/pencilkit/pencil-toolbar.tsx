'use client';
import * as React from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { ScrollArea, ScrollAreaViewport } from '@ui-sdk/react/scroll-area';
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from '@ui-sdk/react/toolbar';
import { ToggleGroup, type ToggleGroupValueChangeReason } from '@ui-sdk/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, cx } from '@/lib/utils';
import { PK_INKS, PK_TOOL_ICONS, PK_W, type PencilTool } from '@/components/ui/pencilkit/constants';
import { Icon, type IconName } from '@/lib/icon';
import { PlainButton, PlainToggleButton, type PlainButtonProps } from '@/components/ui/plain-button';
import { HoverCardTrigger, type HoverCardController } from '@/components/ui/hover-card';

/* ---------------------------------- button ---------------------------------- */

/** The 38×34 icon button: tinted while `active` (or pressed, inside a picker), dimmed while disabled. */
export const pencilToolButtonVariants = cva(
  'grid h-[34px] w-[38px] cursor-pointer place-items-center rounded-[9px] border-0 p-0 data-disabled:cursor-default data-disabled:opacity-[.32]',
  {
    variants: {
      active: {
        true: 'bg-primary text-primary-foreground',
        false: 'bg-transparent text-muted-foreground data-pressed:bg-primary data-pressed:text-primary-foreground',
      },
    },
    defaultVariants: { active: false },
  },
);

export type PencilToolButtonProps = Omit<PlainButtonProps, 'children'> & VariantProps<typeof pencilToolButtonVariants> & {
  /** The Icon to draw (e.g. `pencil-tip`, `arrow-uturn-backward`). */
  icon: IconName;
  /** Its accessible name and tooltip (default: the icon's name). */
  label?: string;
};

/** Whether a part is inside a PencilToolbar, whose items are UI SDK Toolbar parts. */
const InToolbar = React.createContext(false);

/** The 38×34 icon button used across the PencilKit toolbar (`onClick`, `disabled`). Inside a PencilToolbar it is a
 *  ToolbarButton, so it joins the toolbar's one tab stop (a disabled one stays reachable with `aria-disabled`);
 *  elsewhere a PlainButton. */
export function PencilToolButton({ icon, active, label, className, ...rest }: PencilToolButtonProps) {
  const Part = (React.useContext(InToolbar) ? ToolbarButton : PlainButton) as typeof PlainButton;
  return (
    <Part
      aria-label={label || icon}
      title={label || icon}
      className={cx(pencilToolButtonVariants({ active: !!active }), className)}
      {...rest}
    >
      <PencilIcon name={icon} />
    </Part>
  );
}

/** A PencilKit glyph: `Icon` at PencilKit's 19px / 1.7 stroke. */
function PencilIcon({ name }: { name: IconName }) {
  return <Icon name={name} size={19} sw={1.7} />;
}

/* --------------------------------- container --------------------------------- */

export type PencilToolbarProps = Omit<React.ComponentProps<typeof Toolbar>, 'className' | 'children'> & {
  className?: string;
  children?: React.ReactNode;
};

/** Floating toolbar card, absolutely positioned bottom-center of the canvas. Its groups sit on one row; when
 *  they don't fit (a phone), the pickers scroll sideways — edges fade where more tools are hidden — while
 *  PencilActions (undo / redo / clear) stays pinned at the trailing end, instead of everything wrapping into a
 *  ragged second line. Where everything fits it is the plain, centered card. The scrolling row is UI SDK's
 *  ScrollArea, whose viewport says where it overflows (`data-overflow-x`, `data-at-x-start`, `data-at-x-end`).
 *  The card is a UI SDK Toolbar (default name "Drawing tools"): one tab stop, and the arrow keys cross from the
 *  pickers (toggle groups join its navigation) to PencilActions. */
export function PencilToolbar({ className, style, children, ...rest }: PencilToolbarProps) {
  const all = React.Children.toArray(children);
  const actions = all.filter((c) => React.isValidElement(c) && c.type === PencilActions);
  // Nothing to scroll past (a toolbar of only actions): keep one plain row.
  const pinned = actions.length < all.length ? actions : [];
  const scrolled = pinned.length ? all.filter((c) => !pinned.includes(c)) : all;
  return (
    <Toolbar
      aria-label="Drawing tools"
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'absolute inset-x-2.5 bottom-3.5 mx-auto box-border flex w-fit max-w-[calc(100%-20px)] cursor-default overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_34px_black] shadow-black/24',
        className,
      )}
      style={style}
      {...rest}
    >
      <InToolbar.Provider value={true}>
        <ScrollArea className="flex min-w-0 flex-1">
          <ScrollAreaViewport
            className={cn(
              'flex min-w-0 flex-1 touch-pan-x items-center gap-2.5 overscroll-x-contain py-[9px] pl-3 [scrollbar-width:none] *:shrink-0 [&::-webkit-scrollbar]:hidden',
              // A 22px fade on each edge that has more tools past it.
              'data-overflow-x:[mask-image:linear-gradient(to_right,transparent,black_var(--fade-start,0px),black_calc(100%-var(--fade-end,0px)),transparent)]',
              'data-overflow-x:not-data-at-x-start:[--fade-start:22px] data-overflow-x:not-data-at-x-end:[--fade-end:22px]',
              pinned.length ? 'pr-0' : 'pr-3',
            )}
          >
            {scrolled}
          </ScrollAreaViewport>
        </ScrollArea>
        {pinned.length ? (
          <div
            data-slot="pencil-toolbar-pinned"
            className="flex shrink-0 items-center gap-2.5 py-[9px] pr-3 pl-2.5"
          >
            {pinned}
          </div>
        ) : null}
      </InToolbar.Provider>
    </Toolbar>
  );
}

/** Vertical hairline divider between toolbar groups: a ToolbarSeparator inside a PencilToolbar, a decorative line
 *  in any other bar. */
export function PencilToolbarDivider({ className, style, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  const classes = cn('w-px self-stretch bg-border', className);
  if (React.useContext(InToolbar)) return <ToolbarSeparator className={classes} style={style} />;
  return <span aria-hidden="true" data-slot="pencil-toolbar-divider" className={classes} style={style} {...rest} />;
}

/* ---------------------------------- pickers ---------------------------------- */
/* Pickers are UI SDK ToggleGroups that keep exactly one toggle pressed (one tab stop, arrow keys move focus,
   Space or Enter presses). `value` is the pressed one; `onValueChange(value, details)` reports a new one.
   `hoverCard` (ToolPicker, WidthPicker) makes each toggle a trigger of that HoverCard controller, handing it the tool
   or the width index as the payload: one card previews whichever button the pointer rests on or keyboard focus
   reaches, with UI SDK's hover intent (delays, the path into the card, the next button opening at once). */

/** A picker's toggle, or with a controller the toggle as a HoverCardTrigger for `payload`. */
function PickerToggle<P>({ hoverCard, payload, ...props }: React.ComponentProps<typeof PlainToggleButton> & { hoverCard?: HoverCardController<P>; payload: P }) {
  if (!hoverCard) return <PlainToggleButton {...props} />;
  return <HoverCardTrigger controller={hoverCard} payload={payload} render={<PlainToggleButton {...props} />} />;
}

type PickerRootProps<T extends string = string> = Omit<React.ComponentProps<typeof ToggleGroup<T>>, 'value' | 'defaultValue' | 'onValueChange' | 'multiple' | 'deselectable' | 'children'>;
type PickerChangeDetails = ChangeDetails<ToggleGroupValueChangeReason>;

export type ToolPickerProps = PickerRootProps<PencilTool> & {
  value: PencilTool;
  onValueChange?: (tool: PencilTool, details: PickerChangeDetails) => void;
  tools?: PencilTool[];
  /** A HoverCard controller each tool's button triggers, with the tool as its payload. */
  hoverCard?: HoverCardController<PencilTool>;
};

export function ToolPicker({ value, onValueChange, tools = ['pen', 'marker', 'pencil', 'eraser'], hoverCard, className, ...rest }: ToolPickerProps) {
  return (
    <ToggleGroup<PencilTool>
      aria-label="Tool"
      value={[value]}
      deselectable={false}
      onValueChange={([tool], details) => { if (tool) onValueChange?.(tool, details); }}
      className={cx('flex gap-0.5', className)}
      {...rest}
    >
      {tools.map((t) => (
        <PickerToggle key={t} hoverCard={hoverCard} payload={t} value={t} aria-label={t} title={hoverCard ? undefined : t} className={pencilToolButtonVariants()}>
          <PencilIcon name={PK_TOOL_ICONS[t]} />
        </PickerToggle>
      ))}
    </ToggleGroup>
  );
}

export type InkPickerProps = PickerRootProps & {
  /** Index into `inks`. */
  value: number;
  onValueChange?: (index: number, details: PickerChangeDetails) => void;
  inks?: string[];
};

export function InkPicker({ value, onValueChange, inks = PK_INKS, className, ...rest }: InkPickerProps) {
  return (
    <ToggleGroup
      aria-label="Ink"
      value={[String(value)]}
      deselectable={false}
      onValueChange={([index], details) => { if (index != null) onValueChange?.(Number(index), details); }}
      className={cx('flex items-center gap-[7px]', className)}
      {...rest}
    >
      {inks.map((c, i) => (
        <PlainToggleButton
          key={c}
          value={String(i)}
          aria-label={'Ink ' + c}
          title={c}
          className={cn(
            'size-[21px] cursor-pointer rounded-[50%] border bg-(color:--ink) p-0 outline-offset-2 outline-none data-pressed:outline-[2.5px] data-pressed:outline-primary data-pressed:outline-solid',
            // the near-white ink needs a firmer ring to read on light paper
            c === PK_INKS[1] ? 'border-black/20' : 'border-black/8',
          )}
          // the swatch color is data
          style={{ '--ink': c } as React.CSSProperties}
        />
      ))}
    </ToggleGroup>
  );
}

export type WidthPickerProps = PickerRootProps & {
  /** Index into `widths`. */
  value: number;
  onValueChange?: (index: number, details: PickerChangeDetails) => void;
  widths?: { m: number; d: number }[];
  /** A HoverCard controller each width's button triggers, with the width's index as its payload. */
  hoverCard?: HoverCardController<number>;
};

export function WidthPicker({ value, onValueChange, widths = PK_W, hoverCard, className, ...rest }: WidthPickerProps) {
  return (
    <ToggleGroup
      aria-label="Width"
      value={[String(value)]}
      deselectable={false}
      onValueChange={([index], details) => { if (index != null) onValueChange?.(Number(index), details); }}
      className={cx('flex items-center gap-1', className)}
      {...rest}
    >
      {widths.map((w, i) => (
        <PickerToggle
          key={i}
          hoverCard={hoverCard}
          payload={i}
          value={String(i)}
          aria-label={'Width ' + (i + 1)}
          className="grid size-7 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 data-pressed:bg-secondary-strong"
        >
          {/* the dot diameter is data */}
          <span className="block size-(--dot) rounded-[50%] bg-foreground" style={{ '--dot': w.d + 'px' } as React.CSSProperties} />
        </PickerToggle>
      ))}
    </ToggleGroup>
  );
}

/* ---------------------------------- actions ---------------------------------- */

export interface PencilActionsProps extends Omit<React.ComponentProps<typeof ToolbarGroup>, 'className' | 'children'> {
  className?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canClear?: boolean;
}

/** Undo / redo / clear: a ToolbarGroup named "History", for use inside a PencilToolbar. */
export function PencilActions({ onUndo, onRedo, onClear, canUndo, canRedo, canClear, className, style, ...rest }: PencilActionsProps) {
  return (
    <ToolbarGroup aria-label="History" className={cn('flex gap-0.5', className)} style={style} {...rest}>
      <PencilToolButton icon="arrow-uturn-backward" onClick={onUndo} disabled={!canUndo} label="Undo" />
      <PencilToolButton icon="arrow-uturn-forward" onClick={onRedo} disabled={!canRedo} label="Redo" />
      <PencilToolButton icon="trash-slim" onClick={onClear} disabled={!(canClear ?? canUndo)} label="Clear" />
    </ToolbarGroup>
  );
}
