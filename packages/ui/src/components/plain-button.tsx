import * as React from 'react';
import {
  Button as AriaButton,
  ToggleButton as AriaToggleButton,
  type ButtonProps as AriaButtonProps,
  type ToggleButtonProps as AriaToggleButtonProps,
} from 'react-aria-components';

/* ══ PlainButton / PlainToggleButton — react-aria's buttons with no styling of their own ══
   For surfaces that draw their own pressables (icon buttons, pills, rows). They keep `title`: react-aria's buttons
   drop it, and icon buttons rely on it for their tooltip. Use `Button` for the styled, cva-driven one. */
const withTitle = (title: string | undefined) =>
  title ? { render: (props: React.JSX.IntrinsicElements['button']) => <button {...props} title={title} /> } : {};

export interface PlainButtonProps extends Omit<AriaButtonProps, 'render'> {
  title?: string;
}
export function PlainButton({ title, ...props }: PlainButtonProps) {
  return <AriaButton {...props} {...withTitle(title)} />;
}

export interface PlainToggleButtonProps extends Omit<AriaToggleButtonProps, 'render'> {
  title?: string;
}
export function PlainToggleButton({ title, ...props }: PlainToggleButtonProps) {
  return <AriaToggleButton {...props} {...withTitle(title)} />;
}
