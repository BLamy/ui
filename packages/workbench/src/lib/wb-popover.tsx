import * as React from 'react';
import {
  Popover as AriaPopover,
  PopoverContext,
  composeRenderProps,
  useSlottedContext,
  type PopoverProps as AriaPopoverProps,
} from 'react-aria-components';
import { cn } from './util';

/* ══ WbPopover — a react-aria Popover that keeps the Workbench palette ══
   Popovers portal to <body>, outside the element that set the --wb-* tokens (WorkbenchTheme, WorkbenchShell,
   ArtifactChatContainer, a host's own map). The popover reads the tokens off its trigger when it opens, so a
   menu matches the surface it came from in either appearance. */

const WB_TOKENS = [
  '--wb-bg', '--wb-card', '--wb-card2', '--wb-fill', '--wb-fill2', '--wb-sep', '--wb-label', '--wb-label2', '--wb-label3',
  '--wb-tint', '--wb-red', '--wb-green', '--wb-shadow', '--wb-handle', '--bl-tint',
];

/** The trigger's resolved --wb-* tokens and color-scheme, as a style object for a portaled surface. */
export function readWbTokens(el: Element | null | undefined): React.CSSProperties {
  if (!el || typeof getComputedStyle === 'undefined') return {};
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const name of WB_TOKENS) {
    const v = cs.getPropertyValue(name).trim();
    if (v) out[name] = v;
  }
  if (cs.colorScheme && cs.colorScheme !== 'normal') out.colorScheme = cs.colorScheme;
  return out as React.CSSProperties;
}

/** Whether an element sits in a light Workbench surface (for the `.wb-light` hover rules). */
export function isLightSurface(el: Element | null | undefined): boolean {
  if (!el || typeof getComputedStyle === 'undefined') return false;
  return getComputedStyle(el).colorScheme === 'light' || !!el.closest('.wb-light,[data-tone="light"],[data-appearance="light"]');
}

export const wbPopoverSurface =
  'box-border rounded-[12px] border border-wb-sep bg-wb-card font-ios text-wb-label shadow-[0_14px_44px_rgba(0,0,0,.34),0_2px_8px_rgba(0,0,0,.12)] outline-none backdrop-blur-[18px] ' +
  'origin-(--trigger-anchor-point) data-entering:animate-[wb-pop-in_var(--duration-spring-snappy)_var(--ease-spring-snappy)] data-exiting:animate-[wb-pop-out_.14s_ease-in_forwards] motion-reduce:animate-none';

export interface WbPopoverProps extends AriaPopoverProps {}

export function WbPopover({ className, style, offset = 8, triggerRef, ...props }: WbPopoverProps) {
  // Read off the trigger MenuTrigger/DialogTrigger provides, each time the popover renders open — not once at
  // mount, when a host may not have applied its tokens yet.
  const ctx = useSlottedContext(PopoverContext);
  const ref = triggerRef ?? ctx?.triggerRef;
  return (
    <AriaPopover
      data-slot="wb-popover"
      offset={offset}
      triggerRef={triggerRef}
      className={composeRenderProps(className, (cls) => cn(wbPopoverSurface, isLightSurface(ref?.current) ? 'wb-light' : 'wb-dark', 'z-500', cls))}
      style={composeRenderProps(style, (s) => ({ ...readWbTokens(ref?.current), ...s }))}
      {...props}
    />
  );
}
