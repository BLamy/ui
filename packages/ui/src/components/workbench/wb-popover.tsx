import {
  Popover as AriaPopover,
  PopoverContext,
  composeRenderProps,
  useSlottedContext,
  type PopoverProps as AriaPopoverProps,
} from 'react-aria-components';
import { cn } from '../../lib/workbench/util';
import { readThemeVars } from '../../lib/theme';

/* ══ WbPopover — a react-aria Popover that keeps the surface's palette ══
   Popovers portal out of the element that set the theme (a Workbench scope, ArtifactChatContainer, a host's own
   scope). The popover copies the resolved theme variables off its trigger when it opens (`readThemeVars`), so a
   menu matches the surface it came from in either appearance. */

/** Whether an element sits in a light surface: the nearest appearance root (`light` / `dark`, set by BLProvider,
    ThemeScope and the theme-scoped shells) decides, else the computed color scheme. */
export function isLightSurface(el: Element | null | undefined): boolean {
  if (!el) return false;
  const root = el.closest('.light,.dark,[data-tone]');
  if (root) return root.classList.contains('light') || root.getAttribute('data-tone') === 'light';
  return typeof getComputedStyle !== 'undefined' && getComputedStyle(el).colorScheme === 'light';
}

export const wbPopoverSurface =
  'box-border rounded-[12px] border border-border bg-card font-ios text-foreground shadow-[0_14px_44px_color-mix(in_srgb,black_34%,transparent),0_2px_8px_color-mix(in_srgb,black_12%,transparent)] outline-none backdrop-blur-[18px] ' +
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
      data-theme-scope="workbench"
      offset={offset}
      triggerRef={triggerRef}
      className={composeRenderProps(className, (cls) => cn(wbPopoverSurface, isLightSurface(ref?.current) ? 'light' : 'dark', 'z-500', cls))}
      style={composeRenderProps(style, (s) => ({ ...readThemeVars(ref?.current), ...s }))}
      {...props}
    />
  );
}
