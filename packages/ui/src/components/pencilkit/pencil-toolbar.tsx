import * as React from 'react';
import { ToggleButtonGroup, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { PK_INKS, PK_TOOL_ICONS, PK_W, type PencilTool } from '../../lib/pencilkit/constants';
import { Icon, type IconName } from '../../lib/icon';
import { Button, ToggleButton, type ButtonProps } from '../../lib/workbench/press';

/* ---------------------------------- button ---------------------------------- */

/** The 38×34 icon button: tinted while `active` (or selected, inside a picker), dimmed while disabled. */
export const pencilToolButtonVariants = cva(
  'grid h-[34px] w-[38px] cursor-pointer place-items-center rounded-[9px] border-0 p-0 data-disabled:cursor-default data-disabled:opacity-[.32]',
  {
    variants: {
      active: {
        true: 'bg-primary text-primary-foreground',
        false: 'bg-transparent text-muted-foreground data-selected:bg-primary data-selected:text-primary-foreground',
      },
    },
    defaultVariants: { active: false },
  },
);

export interface PencilToolButtonProps extends Omit<ButtonProps, 'children'>, VariantProps<typeof pencilToolButtonVariants> {
  /** The Icon to draw (e.g. `pencil-tip`, `arrow-uturn-backward`). */
  icon: IconName;
  label?: string;
  /** Alias of `isDisabled`. */
  disabled?: boolean;
}

/** The 38×34 icon button used across the PencilKit toolbar (react-aria Button; use `onPress`). */
export function PencilToolButton({ icon, active, label, disabled, isDisabled, className, ...rest }: PencilToolButtonProps) {
  return (
    <Button
      data-slot="pencil-tool-button"
      isDisabled={isDisabled ?? disabled}
      aria-label={label || icon}
      title={label || icon}
      className={composeRenderProps(className, (cls) => cn(pencilToolButtonVariants({ active: !!active }), cls))}
      {...rest}
    >
      <PencilIcon name={icon} />
    </Button>
  );
}

/** A PencilKit glyph: `Icon` at PencilKit's 19px / 1.7 stroke. */
function PencilIcon({ name }: { name: IconName }) {
  return <Icon name={name} size={19} sw={1.7} />;
}

/* --------------------------------- container --------------------------------- */

export type PencilToolbarProps = React.HTMLAttributes<HTMLDivElement>;

/** Floating toolbar card, absolutely positioned bottom-center of the canvas. Its groups sit on one row; when
 *  they don't fit (a phone), the pickers scroll sideways — edges fade where more tools are hidden — while
 *  PencilActions (undo / redo / clear) stays pinned at the trailing end, instead of everything wrapping into a
 *  ragged second line. Where everything fits it is the plain, centered card. */
export function PencilToolbar({ className, style, children, ...rest }: PencilToolbarProps) {
  const row = React.useRef<HTMLDivElement>(null);
  const [fade, setFade] = React.useState<{ l: boolean; r: boolean }>({ l: false, r: false });
  const sync = React.useCallback(() => {
    const el = row.current;
    if (!el) return;
    const l = el.scrollLeft > 1, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade((f) => (f.l === l && f.r === r ? f : { l, r }));
  }, []);
  React.useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    return () => ro.disconnect();
  }, [sync, children]);
  const all = React.Children.toArray(children);
  const actions = all.filter((c) => React.isValidElement(c) && c.type === PencilActions);
  // Nothing to scroll past (a toolbar of only actions): keep one plain row.
  const pinned = actions.length < all.length ? actions : [];
  const scrolled = pinned.length ? all.filter((c) => !pinned.includes(c)) : all;
  const over = fade.l || fade.r;
  const mask = over
    ? `linear-gradient(to right, ${fade.l ? 'transparent, black 22px' : 'black'}, ${fade.r ? 'black calc(100% - 22px), transparent' : 'black'})`
    : undefined;
  return (
    <div
      data-slot="pencil-toolbar"
      data-overflowing={over ? '' : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'absolute inset-x-2.5 bottom-3.5 mx-auto box-border flex w-fit max-w-[calc(100%-20px)] cursor-default overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_34px_black] shadow-black/24',
        className,
      )}
      style={style}
      {...rest}
    >
      <div
        ref={row}
        data-slot="pencil-toolbar-row"
        onScroll={sync}
        className={cn(
          'flex min-w-0 flex-1 touch-pan-x items-center gap-2.5 overflow-x-auto overscroll-x-contain py-[9px] pl-3 [scrollbar-width:none] *:shrink-0 [&::-webkit-scrollbar]:hidden',
          pinned.length ? 'pr-0' : 'pr-3',
        )}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {scrolled}
      </div>
      {pinned.length ? (
        <div
          data-slot="pencil-toolbar-pinned"
          className="flex shrink-0 items-center gap-2.5 py-[9px] pr-3 pl-2.5"
        >
          {pinned}
        </div>
      ) : null}
    </div>
  );
}

/** Vertical hairline divider between toolbar groups. */
export function PencilToolbarDivider({ className, style, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="pencil-toolbar-divider" className={cn('w-px self-stretch bg-border', className)} style={style} {...rest} />;
}

/* ---------------------------------- pickers ---------------------------------- */
/* Pickers are single-select react-aria ToggleButtonGroups (radio semantics, arrow keys move focus).
   Every press reports through onChange — including a press on the current value. */

type PickerRootProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'dir'>;

export interface ToolPickerProps extends PickerRootProps {
  value: PencilTool;
  onChange?: (tool: PencilTool) => void;
  tools?: PencilTool[];
}

export function ToolPicker({ value, onChange, tools = ['pen', 'marker', 'pencil', 'eraser'], className, style, ...rest }: ToolPickerProps) {
  return (
    <ToggleButtonGroup
      data-slot="pencil-tool-picker"
      aria-label="Tool"
      selectionMode="single"
      selectedKeys={[value]}
      className={cn('flex gap-0.5', className)}
      style={style}
      {...rest}
    >
      {tools.map((t) => (
        <ToggleButton
          key={t}
          id={t}
          aria-label={t}
          title={t}
          className={pencilToolButtonVariants()}
          onPress={() => onChange?.(t)}
        >
          <PencilIcon name={PK_TOOL_ICONS[t]} />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export interface InkPickerProps extends PickerRootProps {
  /** Index into `inks`. */
  value: number;
  onChange?: (index: number) => void;
  inks?: string[];
}

export function InkPicker({ value, onChange, inks = PK_INKS, className, style, ...rest }: InkPickerProps) {
  return (
    <ToggleButtonGroup
      data-slot="pencil-ink-picker"
      aria-label="Ink"
      selectionMode="single"
      selectedKeys={[String(value)]}
      className={cn('flex items-center gap-[7px]', className)}
      style={style}
      {...rest}
    >
      {inks.map((c, i) => (
        <ToggleButton
          key={c}
          id={String(i)}
          aria-label={'Ink ' + c}
          title={c}
          className={cn(
            'size-[21px] cursor-pointer rounded-[50%] border bg-(color:--ink) p-0 outline-offset-2 outline-none data-selected:outline-[2.5px] data-selected:outline-primary data-selected:outline-solid',
            // the near-white ink needs a firmer ring to read on light paper
            c === PK_INKS[1] ? 'border-black/20' : 'border-black/8',
          )}
          // the swatch color is data
          style={{ '--ink': c } as React.CSSProperties}
          onPress={() => onChange?.(i)}
        />
      ))}
    </ToggleButtonGroup>
  );
}

export interface WidthPickerProps extends PickerRootProps {
  /** Index into `widths`. */
  value: number;
  onChange?: (index: number) => void;
  widths?: { m: number; d: number }[];
}

export function WidthPicker({ value, onChange, widths = PK_W, className, style, ...rest }: WidthPickerProps) {
  return (
    <ToggleButtonGroup
      data-slot="pencil-width-picker"
      aria-label="Width"
      selectionMode="single"
      selectedKeys={[String(value)]}
      className={cn('flex items-center gap-1', className)}
      style={style}
      {...rest}
    >
      {widths.map((w, i) => (
        <ToggleButton
          key={i}
          id={String(i)}
          aria-label={'Width ' + (i + 1)}
          className="grid size-7 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 data-selected:bg-secondary-strong"
          onPress={() => onChange?.(i)}
        >
          {/* the dot diameter is data */}
          <span className="block size-(--dot) rounded-[50%] bg-foreground" style={{ '--dot': w.d + 'px' } as React.CSSProperties} />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/* ---------------------------------- actions ---------------------------------- */

export interface PencilActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canClear?: boolean;
}

/** Undo / redo / clear button group. */
export function PencilActions({ onUndo, onRedo, onClear, canUndo, canRedo, canClear, className, style, ...rest }: PencilActionsProps) {
  return (
    <div data-slot="pencil-actions" role="group" aria-label="History" className={cn('flex gap-0.5', className)} style={style} {...rest}>
      <PencilToolButton icon="arrow-uturn-backward" onPress={onUndo} disabled={!canUndo} label="Undo" />
      <PencilToolButton icon="arrow-uturn-forward" onPress={onRedo} disabled={!canRedo} label="Redo" />
      <PencilToolButton icon="trash-slim" onPress={onClear} disabled={!(canClear ?? canUndo)} label="Clear" />
    </div>
  );
}
