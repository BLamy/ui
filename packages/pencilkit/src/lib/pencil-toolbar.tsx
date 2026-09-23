import * as React from 'react';
import { ToggleButtonGroup, composeRenderProps } from 'react-aria-components';
import { cva } from 'class-variance-authority';
import { cn, Haptics } from '@brett_lamy/ui';
import { PK_INKS, PK_W, type PencilTool, type PKIconName } from './constants';
import { PKIcon } from './pk-icon';
import { Button, ToggleButton, type ButtonProps } from './press';

/* ---------------------------------- button ---------------------------------- */

/** The 38×34 icon button: tinted while `active` (or selected, inside a picker), dimmed while disabled. */
export const pencilToolButtonVariants = cva(
  'grid h-[34px] w-[38px] cursor-pointer place-items-center rounded-[9px] border-0 p-0 data-disabled:cursor-default data-disabled:opacity-[.32]',
  {
    variants: {
      active: {
        true: 'bg-primary text-white',
        false: 'bg-transparent text-muted-foreground data-selected:bg-primary data-selected:text-white',
      },
    },
    defaultVariants: { active: false },
  },
);

export interface PencilToolButtonProps extends Omit<ButtonProps, 'children'> {
  name: PKIconName;
  active?: boolean;
  label?: string;
  /** Alias of `isDisabled`. */
  disabled?: boolean;
}

/** The 38×34 icon button used across the PencilKit toolbar (react-aria Button; use `onPress`). */
export function PencilToolButton({ name, active, label, disabled, isDisabled, className, ...rest }: PencilToolButtonProps) {
  return (
    <Button
      data-slot="pencil-tool-button"
      isDisabled={isDisabled ?? disabled}
      aria-label={label || name}
      title={label || name}
      className={composeRenderProps(className, (cls) => cn(pencilToolButtonVariants({ active: !!active }), cls))}
      {...rest}
    >
      <PKIcon name={name} />
    </Button>
  );
}

/* --------------------------------- container --------------------------------- */

export type PencilToolbarProps = React.HTMLAttributes<HTMLDivElement>;

/** Floating toolbar card, absolutely positioned bottom-center of the canvas. */
export function PencilToolbar({ className, style, children, ...rest }: PencilToolbarProps) {
  return (
    <div
      data-slot="pencil-toolbar"
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'absolute bottom-3.5 left-1/2 box-border flex max-w-[calc(100%-20px)] -translate-x-1/2 cursor-default flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-[9px] shadow-[0_10px_34px_rgba(0,0,0,.24)]',
        className,
      )}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Vertical hairline divider between toolbar groups. */
export function PencilToolbarDivider({ className, style, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="pencil-toolbar-divider" className={cn('w-px self-stretch bg-border', className)} style={style} {...rest} />;
}

/* ---------------------------------- pickers ---------------------------------- */
/* Pickers are single-select react-aria ToggleButtonGroups (radio semantics, arrow keys move focus).
   Every press reports through onChange with a selection tick — including a press on the current value. */

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
          onPress={() => {
            if (onChange) onChange(t);
            Haptics.selection();
          }}
        >
          <PKIcon name={t} />
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
            c === '#F2F2F7' ? 'border-[rgba(0,0,0,.2)]' : 'border-[rgba(0,0,0,.08)]',
          )}
          // the swatch color is data
          style={{ '--ink': c } as React.CSSProperties}
          onPress={() => {
            if (onChange) onChange(i);
            Haptics.selection();
          }}
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
          className="grid size-7 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 data-selected:bg-bl-fill2"
          onPress={() => {
            if (onChange) onChange(i);
            Haptics.selection();
          }}
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
      <PencilToolButton name="undo" onPress={onUndo} disabled={!canUndo} label="Undo" />
      <PencilToolButton name="redo" onPress={onRedo} disabled={!canRedo} label="Redo" />
      <PencilToolButton name="trash" onPress={onClear} disabled={!(canClear ?? canUndo)} label="Clear" />
    </div>
  );
}
