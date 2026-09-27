import * as React from 'react';
import {
  Button as AriaButton,
  ToggleButton as AriaToggleButton,
  type ButtonProps as AriaButtonProps,
  type ToggleButtonProps as AriaToggleButtonProps,
} from 'react-aria-components';

/* react-aria buttons that keep `title` (react-aria's buttons drop it, and icon buttons rely on it for their
   tooltip). Taps under Safari's haptics polyfill press normally: its replayed clicks are virtual clicks,
   which react-aria presses on. */
const withTitle = (title: string | undefined) =>
  title ? { render: (props: React.JSX.IntrinsicElements['button']) => <button {...props} title={title} /> } : {};

export interface ButtonProps extends Omit<AriaButtonProps, 'render'> {
  title?: string;
}
export function Button({ title, ...props }: ButtonProps) {
  return <AriaButton {...props} {...withTitle(title)} />;
}

export interface ToggleButtonProps extends Omit<AriaToggleButtonProps, 'render'> {
  title?: string;
}
export function ToggleButton({ title, ...props }: ToggleButtonProps) {
  return <AriaToggleButton {...props} {...withTitle(title)} />;
}
