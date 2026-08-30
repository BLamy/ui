import * as React from 'react';
import { cn, Haptics } from '@touchkit/ui';
import { PK_INKS, PK_W, type PencilTool, type PKIconName } from './constants';
import { PKIcon } from './pk-icon';

/* ---------------------------------- button ---------------------------------- */

export interface PencilToolButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'name'> {
  name: PKIconName;
  active?: boolean;
  label?: string;
}

/** The 38×34 icon button used across the PencilKit toolbar. */
export function PencilToolButton({ name, active, label, disabled, className, style, ...rest }: PencilToolButtonProps) {
  return (
    <button
      data-slot="pencil-tool-button"
      disabled={disabled}
      aria-label={label || name}
      title={label || name}
      className={cn(className)}
      style={{
        width: 38, height: 34, border: 0, borderRadius: 9, cursor: disabled ? 'default' : 'pointer',
        display: 'grid', placeItems: 'center',
        background: active ? 'var(--tk-tint)' : 'transparent',
        color: active ? '#fff' : 'var(--tk-label2)',
        opacity: disabled ? 0.32 : 1, padding: 0,
        ...style,
      }}
      {...rest}
    >
      <PKIcon name={name} />
    </button>
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
      className={cn(className)}
      style={{
        position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)',
        maxWidth: 'calc(100% - 20px)', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
        background: 'var(--tk-card)', border: '1px solid var(--tk-sep)', borderRadius: 16,
        padding: '9px 12px', boxShadow: '0 10px 34px rgba(0,0,0,.24)', cursor: 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Vertical hairline divider between toolbar groups. */
export function PencilToolbarDivider({ className, style, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="pencil-toolbar-divider"
      className={cn(className)}
      style={{ width: 1, alignSelf: 'stretch', background: 'var(--tk-sep)', ...style }}
      {...rest}
    />
  );
}

/* ---------------------------------- pickers ---------------------------------- */

export interface ToolPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: PencilTool;
  onChange?: (tool: PencilTool) => void;
  tools?: PencilTool[];
}

export function ToolPicker({ value, onChange, tools = ['pen', 'marker', 'pencil', 'eraser'], className, style, ...rest }: ToolPickerProps) {
  return (
    <div data-slot="pencil-tool-picker" className={cn(className)} style={{ display: 'flex', gap: 2, ...style }} {...rest}>
      {tools.map((t) => (
        <PencilToolButton
          key={t}
          name={t}
          active={value === t}
          label={t}
          onClick={() => {
            if (onChange) onChange(t);
            Haptics.selection();
          }}
        />
      ))}
    </div>
  );
}

export interface InkPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Index into `inks`. */
  value: number;
  onChange?: (index: number) => void;
  inks?: string[];
}

export function InkPicker({ value, onChange, inks = PK_INKS, className, style, ...rest }: InkPickerProps) {
  return (
    <div data-slot="pencil-ink-picker" className={cn(className)} style={{ display: 'flex', gap: 7, alignItems: 'center', ...style }} {...rest}>
      {inks.map((c, i) => (
        <button
          key={c}
          onClick={() => {
            if (onChange) onChange(i);
            Haptics.selection();
          }}
          aria-label={'Ink ' + c}
          title={c}
          style={{
            width: 21, height: 21, borderRadius: '50%', cursor: 'pointer', background: c, padding: 0,
            border: '1px solid ' + (c === '#F2F2F7' ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,.08)'),
            outline: value === i ? '2.5px solid var(--tk-tint)' : 'none', outlineOffset: 2,
          }}
        />
      ))}
    </div>
  );
}

export interface WidthPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Index into `widths`. */
  value: number;
  onChange?: (index: number) => void;
  widths?: { m: number; d: number }[];
}

export function WidthPicker({ value, onChange, widths = PK_W, className, style, ...rest }: WidthPickerProps) {
  return (
    <div data-slot="pencil-width-picker" className={cn(className)} style={{ display: 'flex', gap: 4, alignItems: 'center', ...style }} {...rest}>
      {widths.map((w, i) => (
        <button
          key={i}
          onClick={() => {
            if (onChange) onChange(i);
            Haptics.selection();
          }}
          aria-label={'Width ' + (i + 1)}
          style={{
            width: 28, height: 28, border: 0, borderRadius: 8, cursor: 'pointer',
            display: 'grid', placeItems: 'center', padding: 0,
            background: value === i ? 'var(--tk-fill2)' : 'transparent',
          }}
        >
          <span style={{ width: w.d, height: w.d, borderRadius: '50%', background: 'var(--tk-label)', display: 'block' }} />
        </button>
      ))}
    </div>
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
    <div data-slot="pencil-actions" className={cn(className)} style={{ display: 'flex', gap: 2, ...style }} {...rest}>
      <PencilToolButton name="undo" onClick={onUndo} disabled={!canUndo} label="Undo" />
      <PencilToolButton name="redo" onClick={onRedo} disabled={!canRedo} label="Redo" />
      <PencilToolButton name="trash" onClick={onClear} disabled={!(canClear ?? canUndo)} label="Clear" />
    </div>
  );
}
