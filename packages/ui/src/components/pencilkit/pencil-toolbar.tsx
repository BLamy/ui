'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';
import type { ChangeDetails } from '@ui-sdk/core';
import { ScrollArea, ScrollAreaViewport } from '@ui-sdk/react/scroll-area';
import { Toggle as SdkToggle, type ToggleGroupValueChangeReason } from '@ui-sdk/react/toggle';
import { HoverCardTrigger, type HoverCardController } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
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
   are separated with the kit's `ToolbarSeparator`; the actions you want always in view go in `trailing`.

     <PencilToolbar
       trailing={<><ToolbarSeparator /><PencilActions onUndo={undo} onRedo={redo} onClear={clear} canUndo={canUndo} canRedo={canRedo} canClear={canClear} /></>}
     >
       <PencilToolPicker value={tool} onValueChange={setTool} />
       <ToolbarSeparator />
       <PencilInkPicker value={ink} onValueChange={setInk} />
       <ToolbarSeparator />
       <PencilWidthPicker value={width} onValueChange={setWidth} />
     </PencilToolbar>

   The toolbar sits in the flow: position it where it goes (`absolute inset-x-0 bottom-3 mx-auto` over a canvas). When
   its groups don't fit (a phone, a narrow pane), the ink and width pickers fold into one button each that opens their
   row in a popover; if that still isn't enough, the groups scroll sideways under a fade on each edge that has more
   past it, while `trailing` stays in view at the end. */

/* --------------------------------- container --------------------------------- */

export type PencilToolbarProps = Omit<ToolbarProps, 'children'> & {
  /** The tools: they scroll sideways when they don't fit. */
  children?: React.ReactNode;
  /** What stays in view at the toolbar's trailing end while the tools scroll (undo, redo, clear; usually after a
   *  `ToolbarSeparator`). */
  trailing?: React.ReactNode;
};

/** What a PencilToolbar tells the pickers inside it. `compact`: its groups ran out of room. When compact, a folded
 *  ink picker offers a spot in its popover (`inkSlot`) where a folded width picker puts its row, so the two share one
 *  button; `inks` and `widths` count the pickers folded that way. */
interface PencilToolbarContextValue {
  compact: boolean;
  inks: number;
  widths: number;
  inkSlot: HTMLElement | null;
  setInkSlot: (el: HTMLElement | null) => void;
  join: (kind: 'inks' | 'widths') => () => void;
}
const PencilToolbarContext = React.createContext<PencilToolbarContextValue | null>(null);

/** Whether the toolbar is compact: its groups overflowed the room it has. It collapses when they overflow and
 *  expands again only once the box it sits in grows past the width it had then (so it never flips back and forth). */
function useCompact(viewport: React.RefObject<HTMLDivElement | null>): boolean {
  const [compact, setCompact] = React.useState(false);
  const collapsedAt = React.useRef(0);
  React.useLayoutEffect(() => {
    const vp = viewport.current;
    const host = vp?.closest<HTMLElement>('[role="toolbar"]')?.parentElement;
    if (!vp || !host) return;
    const check = () => {
      if (!compact) {
        if (vp.scrollWidth > vp.clientWidth + 1) {
          collapsedAt.current = host.clientWidth;
          setCompact(true);
        }
      } else if (host.clientWidth > collapsedAt.current + 1) setCompact(false);
    };
    check();
    const RO = vp.ownerDocument.defaultView?.ResizeObserver;
    if (!RO) return;
    const observer = new RO(check);
    observer.observe(vp);
    observer.observe(host);
    return () => observer.disconnect();
  }, [compact, viewport]);
  return compact;
}

/** A Toolbar (default `variant="floating"`, named "Drawing tools"). When its groups don't fit, the ink and width
 *  pickers fold into one button that opens them in a popover; whatever still doesn't fit scrolls sideways under an
 *  edge fade. */
export function PencilToolbar({ variant = 'floating', className, children, trailing, onPointerDown, ...rest }: PencilToolbarProps) {
  const viewport = React.useRef<HTMLDivElement>(null);
  const compact = useCompact(viewport);
  const [inkSlot, setInkSlot] = React.useState<HTMLElement | null>(null);
  const [count, setCount] = React.useState({ inks: 0, widths: 0 });
  const join = React.useCallback((kind: 'inks' | 'widths') => {
    setCount((c) => ({ ...c, [kind]: c[kind] + 1 }));
    return () => setCount((c) => ({ ...c, [kind]: c[kind] - 1 }));
  }, []);
  const context = React.useMemo(
    () => ({ compact, inks: count.inks, widths: count.widths, inkSlot, setInkSlot, join }),
    [compact, count, inkSlot, join],
  );
  return (
    <PencilToolbarContext.Provider value={context}>
      <Toolbar
        aria-label="Drawing tools"
        variant={variant}
        data-compact={compact || undefined}
        // A press on the tools (or in a picker's popover) never reaches a drawing under them.
        onPointerDown={(e) => { e.stopPropagation(); onPointerDown?.(e); }}
        className={cx('max-w-full cursor-default gap-0 overflow-hidden', className)}
        {...rest}
      >
        <ScrollArea className="flex min-w-0 flex-1">
          <ScrollAreaViewport
            ref={viewport}
            className={cn(
              'flex min-w-0 flex-1 touch-pan-x items-center gap-1 overscroll-x-contain px-1 [scrollbar-width:none] *:shrink-0 [&::-webkit-scrollbar]:hidden',
              // Compact: the edge padding (room for the swatches' rings) goes, every pixel counts.
              'in-data-compact:px-0',
              // A separator left with nothing after it (the width picker folded into the ink button) goes too.
              '[&>[role=separator]:not(:has(~:not([hidden],[role=separator],[data-slot=tooltip-content])))]:hidden',
              // A fade on each edge that has more tools past it.
              'data-overflow-x:[mask-image:linear-gradient(to_right,transparent,black_var(--fade-start,0px),black_calc(100%-var(--fade-end,0px)),transparent)]',
              'data-overflow-x:not-data-at-x-start:[--fade-start:--spacing(6)] data-overflow-x:not-data-at-x-end:[--fade-end:--spacing(6)]',
            )}
          >
            {children}
          </ScrollAreaViewport>
        </ScrollArea>
        {trailing != null ? (
          <div data-part="trailing" className="flex shrink-0 items-center gap-1 pe-1">
            {trailing}
          </div>
        ) : null}
      </Toolbar>
    </PencilToolbarContext.Provider>
  );
}

/* ---------------------------------- pickers ---------------------------------- */
/* Pickers are ToggleGroups that keep exactly one toggle pressed (one tab stop inside the toolbar's, arrow keys move
   focus, Space or Enter presses). `value` / `defaultValue` is the chosen tool, ink or width itself;
   `onValueChange(value, details)` reports a new one. Each toggle names itself and shows its name in a Tooltip.
   `hoverCard` (tool and width pickers) makes each toggle a trigger of that HoverCard controller instead, with the tool
   or the width scale as the payload: one card previews whichever button the pointer rests on or focus reaches.
   The ink and width pickers take a `presentation`: `inline` (the row of swatches), `popover` (one button showing the
   current choice, which opens the row in a popover) or `auto` (the default: `popover` once the PencilToolbar around
   them runs out of room, `inline` otherwise). */

type PickerChangeDetails = ChangeDetails<ToggleGroupValueChangeReason>;
type PickerRootProps = Omit<
  React.ComponentProps<typeof ToggleGroup>,
  'value' | 'defaultValue' | 'onValueChange' | 'multiple' | 'deselectable' | 'children' | 'variant' | 'size'
>;

/** How the ink and width pickers show: the row of swatches, or one button that opens it. */
export type PencilPickerPresentation = 'auto' | 'inline' | 'popover';

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

/** A picker's value, controlled or not: the value shown and the change handler that keeps it (unless canceled). */
function usePickerValue<T>(value: T | undefined, defaultValue: T, onValueChange?: (value: T, details: PickerChangeDetails) => void) {
  const [inner, setInner] = React.useState(defaultValue);
  const current = value === undefined ? inner : value;
  const change = (next: T, details: PickerChangeDetails) => {
    onValueChange?.(next, details);
    if (!details.canceled && value === undefined) setInner(next);
  };
  return [current, change] as const;
}

/** `presentation="auto"` resolved against the PencilToolbar around the picker. */
function usePresentationOf(presentation: PencilPickerPresentation): 'inline' | 'popover' {
  const toolbar = React.useContext(PencilToolbarContext);
  return presentation === 'auto' ? (toolbar?.compact ? 'popover' : 'inline') : presentation;
}

/** A picker's row inside a popover: a toolbar of its own, so its arrow keys move across its swatches and never reach
 *  the PencilToolbar the button sits in. */
function PopoverRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Toolbar aria-label={label} onKeyDown={(event) => event.stopPropagation()} className="justify-center">
      {children}
    </Toolbar>
  );
}

/** A folded picker: a toolbar button showing the current choice, which opens the picker's row in a popover. The
 *  popover stays open while the choice changes (the button shows it at once); an outside press or Escape closes it. */
function PickerPopover({ label, face, children }: { label: string; face: React.ReactNode; children: React.ReactNode }) {
  return (
    <Popover presentation="popover">
      {/* No tooltip: it would sit over the popover the button opens. */}
      <ToolbarButton size="icon" aria-label={label} render={<PopoverTrigger />}>
        {face}
      </ToolbarButton>
      <PopoverContent side="top" palette="trigger" className="flex w-auto flex-col gap-1 rounded-card p-1.5">
        {children}
      </PopoverContent>
    </Popover>
  );
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
  const [current, change] = usePickerValue(value, defaultValue, onValueChange);
  return (
    <ToggleGroup
      aria-label="Tool"
      value={[current]}
      deselectable={false}
      onValueChange={([tool], details) => { if (tool) change(tool as PencilTool, details); }}
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

/** An ink swatch: a disc of the ink with a hairline ring, so black and white both read on any surface. */
const swatchClass = 'size-5.5 rounded-full border border-foreground/15 bg-(color:--ink)';

export type PencilInkPickerProps = PickerRootProps & {
  /** The chosen ink's `value` (a CSS color). */
  value?: string;
  /** Default the first ink. */
  defaultValue?: string;
  onValueChange?: (ink: string, details: PickerChangeDetails) => void;
  /** The swatches (default `pencilInks`). */
  inks?: readonly PencilInk[];
  /** `inline` swatches, a `popover` behind one button, or `auto` (default): a popover once the toolbar runs out of room. */
  presentation?: PencilPickerPresentation;
};

export function PencilInkPicker({ value, defaultValue, onValueChange, inks = pencilInks, presentation = 'auto', className, ...rest }: PencilInkPickerProps) {
  const [current, change] = usePickerValue(value, defaultValue ?? inks[0]?.value ?? '', onValueChange);
  const shown = usePresentationOf(presentation);
  const toolbar = React.useContext(PencilToolbarContext);
  const folded = shown === 'popover' && !!toolbar;
  // A folded ink picker offers the width picker a spot in its popover.
  const join = toolbar?.join;
  React.useLayoutEffect(() => (folded && join ? join('inks') : undefined), [folded, join]);
  const row = (
    <ToggleGroup
      aria-label="Ink"
      value={[current]}
      deselectable={false}
      onValueChange={([ink], details) => { if (ink != null) change(ink, details); }}
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
                swatchClass,
                'cursor-pointer p-0 outline-offset-2 outline-primary focus-visible:outline-2 data-pressed:outline-2 data-pressed:outline-solid',
              )}
              // the swatch color is data
              style={{ '--ink': ink.value } as React.CSSProperties}
            />
          }
        />
      ))}
    </ToggleGroup>
  );
  if (shown === 'inline') return row;
  const name = (folded && toolbar.widths > 0 ? 'Ink and width' : 'Ink') + ': ' + (inks.find((ink) => ink.value === current)?.label ?? current);
  return (
    <PickerPopover
      label={name}
      // the swatch color is data
      face={<span aria-hidden="true" className={cn(swatchClass, 'block')} style={{ '--ink': current } as React.CSSProperties} />}
    >
      <PopoverRow label="Ink">{row}</PopoverRow>
      {folded ? <div ref={toolbar.setInkSlot} data-slot="pencil-ink-picker-more" className="contents" /> : null}
    </PickerPopover>
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
  /** `inline` dots, a `popover` behind one button, or `auto` (default): a popover once the toolbar runs out of room. */
  presentation?: PencilPickerPresentation;
};

/** A width's dot, its diameter the width's own. */
function WidthDot({ dot }: { dot: number }) {
  // the dot diameter is data
  return <span aria-hidden="true" className="block size-(--dot) rounded-full bg-foreground" style={{ '--dot': dot + 'px' } as React.CSSProperties} />;
}

export function PencilWidthPicker({
  value, defaultValue = 1, onValueChange, widths = pencilWidths, hoverCard, presentation = 'auto', className, ...rest
}: PencilWidthPickerProps) {
  const [current, change] = usePickerValue(value, defaultValue, onValueChange);
  const shown = usePresentationOf(presentation);
  const toolbar = React.useContext(PencilToolbarContext);
  // Folded by the toolbar, with a folded ink picker beside it: the row joins the ink's popover, under its swatches.
  const joined = presentation === 'auto' && shown === 'popover' && !!toolbar && toolbar.inks > 0;
  const join = toolbar?.join;
  React.useLayoutEffect(() => (joined && join ? join('widths') : undefined), [joined, join]);
  const row = (
    <ToggleGroup
      aria-label="Width"
      value={[String(current)]}
      deselectable={false}
      onValueChange={([scale], details) => { if (scale != null) change(Number(scale), details); }}
      className={cx('gap-0.5', className)}
      {...rest}
    >
      {widths.map((w) => (
        <PickerItem
          key={w.scale}
          label={w.label}
          hoverCard={shown === 'inline' ? hoverCard : undefined}
          payload={w.scale}
          render={
            <ToggleGroupItem value={String(w.scale)} variant="quiet" size="icon-sm" aria-label={w.label}>
              <WidthDot dot={w.dot} />
            </ToggleGroupItem>
          }
        />
      ))}
    </ToggleGroup>
  );
  if (shown === 'inline') return row;
  if (joined) {
    return toolbar.inkSlot
      ? createPortal(<><Separator decorative className="my-0.5" /><PopoverRow label="Width">{row}</PopoverRow></>, toolbar.inkSlot)
      : null;
  }
  const width = widths.find((w) => w.scale === current);
  return (
    <PickerPopover label={'Width: ' + (width?.label ?? current)} face={<WidthDot dot={width?.dot ?? 5} />}>
      <PopoverRow label="Width">{row}</PopoverRow>
    </PickerPopover>
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
