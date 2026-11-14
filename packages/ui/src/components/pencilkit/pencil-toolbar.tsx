'use client';
import * as React from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { ScrollArea, ScrollAreaViewport } from '@ui-sdk/react/scroll-area';
import { Toggle as SdkToggle, type ToggleGroupValueChangeReason } from '@ui-sdk/react/toggle';
import { HoverCardTrigger, type HoverCardController } from '@/components/ui/hover-card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle';
import { Toolbar, ToolbarButton, ToolbarGroup, type ToolbarProps } from '@/components/ui/toolbar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/lib/icon';
import { cn, cx } from '@/lib/utils';
import {
  pencilInks,
  pencilToolIcons,
  pencilToolLabels,
  pencilWidths,
  type PencilInk,
  type PencilTool,
  type PencilWidth,
} from '@/components/ui/pencilkit/constants';

/* ══ PencilToolbar — the tool palette of a drawing, on the kit's Toolbar ══
   One tab stop, arrow keys across every picker and button (toggle groups join the toolbar's navigation). Groups
   are separated with the kit's `ToolbarSeparator`; the actions you want always in view go in `PencilToolbarPinned`.

     <PencilToolbar>
       <PencilToolPicker value={tool} onValueChange={setTool} />
       <ToolbarSeparator />
       <PencilInkPicker value={ink} onValueChange={setInk} />
       <ToolbarSeparator />
       <PencilWidthPicker value={width} onValueChange={setWidth} />
       <PencilToolbarPinned>
         <ToolbarSeparator />
         <PencilActions onUndo={undo} onRedo={redo} onClear={clear} canUndo={canUndo} canRedo={canRedo} canClear={canClear} />
       </PencilToolbarPinned>
     </PencilToolbar>

   The toolbar sits in the flow: position it where it goes (`absolute inset-x-0 bottom-3 mx-auto` over a canvas). When
   its groups don't fit (a phone), they scroll sideways, with a fade on each edge that has more past it, while the
   pinned part stays at the trailing end. */

/* --------------------------------- container --------------------------------- */

export type PencilToolbarProps = Omit<ToolbarProps, 'children'> & { children?: React.ReactNode };

/** The pinned part, found among the toolbar's direct children. */
function isPinned(node: React.ReactNode): boolean {
  return React.isValidElement(node) && node.type === PencilToolbarPinned;
}

/** A Toolbar (default `variant="floating"`, named "Drawing tools") whose groups scroll sideways when they don't fit. */
export function PencilToolbar({ variant = 'floating', className, children, onPointerDown, ...rest }: PencilToolbarProps) {
  const all = React.Children.toArray(children);
  const pinned = all.filter(isPinned);
  const scrolled = all.filter((c) => !isPinned(c));
  return (
    <Toolbar
      aria-label="Drawing tools"
      variant={variant}
      // A press on the tools never reaches a drawing under them.
      onPointerDown={(e) => { e.stopPropagation(); onPointerDown?.(e); }}
      className={cx('max-w-full cursor-default gap-0 overflow-hidden', className)}
      {...rest}
    >
      <ScrollArea className="flex min-w-0 flex-1">
        <ScrollAreaViewport
          className={cn(
            'flex min-w-0 flex-1 touch-pan-x items-center gap-1 overscroll-x-contain px-1 [scrollbar-width:none] *:shrink-0 [&::-webkit-scrollbar]:hidden',
            // A fade on each edge that has more tools past it.
            'data-overflow-x:[mask-image:linear-gradient(to_right,transparent,black_var(--fade-start,0px),black_calc(100%-var(--fade-end,0px)),transparent)]',
            'data-overflow-x:not-data-at-x-start:[--fade-start:--spacing(6)] data-overflow-x:not-data-at-x-end:[--fade-end:--spacing(6)]',
          )}
        >
          {scrolled}
        </ScrollAreaViewport>
      </ScrollArea>
      {pinned}
    </Toolbar>
  );
}

export type PencilToolbarPinnedProps = React.ComponentProps<'div'>;

/** What stays at the trailing end of a PencilToolbar while the rest scrolls (undo, redo, clear). A direct child of
 *  PencilToolbar. */
export function PencilToolbarPinned({ className, ...props }: PencilToolbarPinnedProps) {
  return <div data-slot="pencil-toolbar-pinned" className={cn('flex shrink-0 items-center gap-1 pe-1', className)} {...props} />;
}

/* ---------------------------------- pickers ---------------------------------- */
/* Pickers are ToggleGroups that keep exactly one toggle pressed (one tab stop inside the toolbar's, arrow keys move
   focus, Space or Enter presses). `value` / `defaultValue` is the chosen tool, ink or width itself;
   `onValueChange(value, details)` reports a new one. Each toggle names itself and shows its name in a Tooltip.
   `hoverCard` (tool and width pickers) makes each toggle a trigger of that HoverCard controller instead, with the tool
   or the width scale as the payload: one card previews whichever button the pointer rests on or focus reaches. */

type PickerChangeDetails = ChangeDetails<ToggleGroupValueChangeReason>;
type PickerRootProps = Omit<
  React.ComponentProps<typeof ToggleGroup>,
  'value' | 'defaultValue' | 'onValueChange' | 'multiple' | 'deselectable' | 'children' | 'variant' | 'size'
>;

/** A picker's toggle with its name in a Tooltip, or with a controller, a HoverCardTrigger for `payload`. */
function PickerItem<P>({ label, hoverCard, payload, render }: { label: string; hoverCard?: HoverCardController<P>; payload: P; render: React.ReactElement<Record<string, unknown>> }) {
  if (hoverCard) return <HoverCardTrigger controller={hoverCard} payload={payload} render={render} />;
  return (
    <Tooltip>
      <TooltipTrigger render={render} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Controlled or not: the group's one-item array value. */
function groupValue<T>(value: T | undefined, defaultValue: T | undefined, map: (v: T) => string) {
  return {
    value: value === undefined ? undefined : [map(value)],
    defaultValue: value === undefined && defaultValue !== undefined ? [map(defaultValue)] : undefined,
  };
}

export type PencilToolPickerProps = PickerRootProps & {
  value?: PencilTool;
  /** Default `pen`. */
  defaultValue?: PencilTool;
  onValueChange?: (tool: PencilTool, details: PickerChangeDetails) => void;
  /** Which tools, in order (default pen, marker, pencil, eraser). */
  tools?: PencilTool[];
  /** A HoverCard controller each tool's button triggers, with the tool as its payload. */
  hoverCard?: HoverCardController<PencilTool>;
};

export function PencilToolPicker({
  value, defaultValue = 'pen', onValueChange, tools = ['pen', 'marker', 'pencil', 'eraser'], hoverCard, className, ...rest
}: PencilToolPickerProps) {
  return (
    <ToggleGroup
      aria-label="Tool"
      {...groupValue(value, defaultValue, (t) => t)}
      deselectable={false}
      onValueChange={([tool], details) => { if (tool) onValueChange?.(tool as PencilTool, details); }}
      className={cx('gap-0.5', className)}
      {...rest}
    >
      {tools.map((t) => (
        <PickerItem
          key={t}
          label={pencilToolLabels[t]}
          hoverCard={hoverCard}
          payload={t}
          render={
            <ToggleGroupItem value={t} size="icon" aria-label={pencilToolLabels[t]} className="rounded-ctl">
              <Icon name={pencilToolIcons[t]} size={19} sw={1.7} />
            </ToggleGroupItem>
          }
        />
      ))}
    </ToggleGroup>
  );
}

export type PencilInkPickerProps = PickerRootProps & {
  /** The chosen ink's `value` (a CSS color). */
  value?: string;
  /** Default the first ink. */
  defaultValue?: string;
  onValueChange?: (ink: string, details: PickerChangeDetails) => void;
  /** The swatches (default `pencilInks`). */
  inks?: readonly PencilInk[];
};

export function PencilInkPicker({ value, defaultValue, onValueChange, inks = pencilInks, className, ...rest }: PencilInkPickerProps) {
  return (
    <ToggleGroup
      aria-label="Ink"
      {...groupValue(value, defaultValue ?? inks[0]?.value, (v) => v)}
      deselectable={false}
      onValueChange={([ink], details) => { if (ink != null) onValueChange?.(ink, details); }}
      className={cx('gap-1.5 px-1', className)}
      {...rest}
    >
      {inks.map((ink) => (
        <PickerItem
          key={ink.value}
          label={ink.label}
          payload={ink.value}
          render={
            <SdkToggle
              value={ink.value}
              aria-label={ink.label}
              className={cn(
                'size-5.5 cursor-pointer rounded-full border border-foreground/15 bg-(color:--ink) p-0',
                'outline-offset-2 outline-primary focus-visible:outline-2 data-pressed:outline-2 data-pressed:outline-solid',
              )}
              // the swatch color is data
              style={{ '--ink': ink.value } as React.CSSProperties}
            />
          }
        />
      ))}
    </ToggleGroup>
  );
}

export type PencilWidthPickerProps = PickerRootProps & {
  /** The chosen width's `scale`. */
  value?: number;
  /** Default 1 (Regular). */
  defaultValue?: number;
  onValueChange?: (scale: number, details: PickerChangeDetails) => void;
  /** The widths (default `pencilWidths`). */
  widths?: readonly PencilWidth[];
  /** A HoverCard controller each width's button triggers, with the width's scale as its payload. */
  hoverCard?: HoverCardController<number>;
};

export function PencilWidthPicker({ value, defaultValue = 1, onValueChange, widths = pencilWidths, hoverCard, className, ...rest }: PencilWidthPickerProps) {
  return (
    <ToggleGroup
      aria-label="Width"
      {...groupValue(value, defaultValue, String)}
      deselectable={false}
      onValueChange={([scale], details) => { if (scale != null) onValueChange?.(Number(scale), details); }}
      className={cx('gap-0.5', className)}
      {...rest}
    >
      {widths.map((w) => (
        <PickerItem
          key={w.scale}
          label={w.label}
          hoverCard={hoverCard}
          payload={w.scale}
          render={
            <ToggleGroupItem value={String(w.scale)} variant="quiet" size="icon-sm" aria-label={w.label}>
              {/* the dot diameter is data */}
              <span className="block size-(--dot) rounded-full bg-foreground" style={{ '--dot': w.dot + 'px' } as React.CSSProperties} />
            </ToggleGroupItem>
          }
        />
      ))}
    </ToggleGroup>
  );
}

/* ---------------------------------- actions ---------------------------------- */

export interface PencilActionsProps extends React.ComponentProps<typeof ToolbarGroup> {
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Default `canUndo`. */
  canClear?: boolean;
}

/** One icon tool of PencilActions, named and with its name in a Tooltip. */
function ActionButton({ icon, label, ...props }: React.ComponentProps<typeof ToolbarButton> & { icon: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<ToolbarButton size="icon" aria-label={label} {...props} />}>
        <Icon name={icon} size={19} sw={1.7} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Undo / redo / clear: a ToolbarGroup named "History", inside a PencilToolbar. A disabled action stays reachable
 *  with `aria-disabled`. */
export function PencilActions({ onUndo, onRedo, onClear, canUndo, canRedo, canClear, className, ...rest }: PencilActionsProps) {
  return (
    <ToolbarGroup aria-label="History" className={cx('gap-0.5', className)} {...rest}>
      <ActionButton icon="arrow-uturn-backward" label="Undo" onClick={onUndo} disabled={!canUndo} />
      <ActionButton icon="arrow-uturn-forward" label="Redo" onClick={onRedo} disabled={!canRedo} />
      <ActionButton icon="trash-slim" label="Clear" onClick={onClear} disabled={!(canClear ?? canUndo)} />
    </ToolbarGroup>
  );
}
