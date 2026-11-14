'use client';
import type { ComponentProps } from 'react';
import { Button } from '@ui-sdk/react/button';
import { Toggle } from '@ui-sdk/react/toggle';

/* ══ PlainButton / PlainToggleButton — UI SDK's Button and Toggle, as they are ══
   For surfaces that draw their own pressables (icon buttons, pills, rows): the behavior (`onClick`, pending while
   its Promise runs, `disabled`, `render` for a link; `pressed` / `onPressedChange` and `data-pressed` on the
   toggle) with whatever classes you give it. These are UI SDK's own parts under the kit's names, not wrappers.
   Use `Button` and `Toggle` from the kit for the styled, cva-driven ones. */
export { Button as PlainButton } from '@ui-sdk/react/button';
export { Toggle as PlainToggleButton } from '@ui-sdk/react/toggle';

export type PlainButtonProps = ComponentProps<typeof Button>;
export type PlainToggleButtonProps = ComponentProps<typeof Toggle>;
