import * as React from 'react';
import {
  Button as AriaButton,
  ToggleButton as AriaToggleButton,
  type ButtonProps as AriaButtonProps,
  type ToggleButtonProps as AriaToggleButtonProps,
} from 'react-aria-components';

/* ══ Safari-haptics-safe react-aria buttons (internal) ══
   Under ios-vibrator-pro-max (the Safari haptics polyfill) every control is covered by an overlay <label>;
   the tap lands on the overlay, which replays it on the control as an untrusted `click`. A raw
   <button onClick> saw that click; react-aria's usePress ignores it, so the press would be lost.
   These wrappers render the native <button> react-aria asks for and press once on such a replayed click
   when react-aria didn't already handle the gesture. Trusted clicks (every other path) are untouched.
   They also forward `title`, which react-aria's buttons drop. */

let lastPress = 0;
/** A replayed click this soon after a react-aria press belongs to the same gesture. */
const SAME_GESTURE_MS = 400;

function usePolyfillPress(onPress: (() => void) | undefined, title: string | undefined) {
  const press = onPress
    ? () => {
        lastPress = performance.now();
        onPress();
      }
    : undefined;
  const render = (props: React.JSX.IntrinsicElements['button']) => (
    <button
      {...props}
      title={title}
      onClick={(e) => {
        props.onClick?.(e);
        if (!press || e.isTrusted || e.currentTarget.disabled) return;
        if (performance.now() - lastPress < SAME_GESTURE_MS) return;
        press();
      }}
    />
  );
  return { onPress: press, render };
}

export interface ButtonProps extends Omit<AriaButtonProps, 'onPress' | 'render'> {
  onPress?: () => void;
  title?: string;
}
/** react-aria Button that also presses under the Safari haptics polyfill. */
export function Button({ onPress, title, ...props }: ButtonProps) {
  return <AriaButton {...props} {...usePolyfillPress(onPress, title)} />;
}

export interface ToggleButtonProps extends Omit<AriaToggleButtonProps, 'onPress' | 'render'> {
  onPress?: () => void;
  title?: string;
}
/** react-aria ToggleButton that also presses under the Safari haptics polyfill (drive state from onPress). */
export function ToggleButton({ onPress, title, ...props }: ToggleButtonProps) {
  return <AriaToggleButton {...props} {...usePolyfillPress(onPress, title)} />;
}
