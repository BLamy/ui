'use client';
import { useState, type CSSProperties } from 'react';
import { PopoverContent as SdkPopoverContent } from '@ui-sdk/react/popover';
import { cx } from '@/lib/utils';
import { readThemeVars, scopeStyle } from '@/lib/theme';

/* ══ WbPopoverContent — a popup that keeps the palette of the surface it opened from ══
   A popup renders into its layer host (BLProvider's root), outside the element that set the theme (a Workbench
   scope, ArtifactChatContainer, a host's own scope). `useSurfacePalette` copies the resolved theme variables and
   the appearance off the popup's trigger each time it opens, so a menu matches the surface it came from in either
   appearance. WbPopoverContent is UI SDK's PopoverContent dressed that way, inside the kit's `<Popover>`; a Menu or
   Select popup spreads the hook's props on its own content part, with `wbPopoverSurface`. */

/** Whether an element sits in a light surface: the nearest appearance root (`light` / `dark`, set by BLProvider,
    ThemeScope and the theme-scoped shells) decides, else the computed color scheme. */
export function isLightSurface(el: Element | null | undefined): boolean {
  if (!el) return false;
  const root = el.closest('.light,.dark,[data-tone]');
  if (root) return root.classList.contains('light') || root.getAttribute('data-tone') === 'light';
  return typeof getComputedStyle !== 'undefined' && getComputedStyle(el).colorScheme === 'light';
}

export const wbPopoverSurface =
  'box-border rounded-panel border border-border bg-card font-sans text-foreground shadow-[0_14px_44px_color-mix(in_srgb,black_34%,transparent),0_2px_8px_color-mix(in_srgb,black_12%,transparent)] outline-none backdrop-blur-[18px] ' +
  'origin-(--transform-origin) transition-[opacity,scale,filter] duration-spring-snappy ease-spring-snappy data-starting-style:scale-88 data-starting-style:opacity-0 data-starting-style:blur-[2px] data-ending-style:scale-96 data-ending-style:opacity-0 data-ending-style:duration-exit data-ending-style:ease-in motion-reduce:transition-none';

/* The element that opened a popup: UI SDK points the trigger at its content with `aria-controls` while it is open. */
function triggerOf(content: HTMLElement | null): Element | null {
  if (!content?.id) return null;
  const root = content.getRootNode() as Document | ShadowRoot;
  return root.querySelector(`[aria-controls="${content.id.replace(/["\\]/g, '\\$&')}"]`);
}

export interface SurfacePalette {
  /** Goes on the popup's content part: the hook finds the trigger from it. */
  ref: (content: HTMLElement | null) => void;
  'data-theme-scope': 'workbench';
  /** `light` or `dark`, as the trigger's surface is. */
  className: string;
  /** The theme variables resolved at the trigger. */
  style: CSSProperties;
}

/** The props that dress a popup's content part in its trigger's palette. They are read as the content mounts, which
    is each time the popup opens: not once up front, when a host may not have applied its tokens yet. */
export function useSurfacePalette(): SurfacePalette {
  const [content, setContent] = useState<HTMLElement | null>(null);
  const trigger = triggerOf(content);
  return {
    ref: setContent,
    'data-theme-scope': 'workbench',
    className: isLightSurface(trigger) ? 'light' : 'dark',
    style: readThemeVars(trigger),
  };
}

export type WbPopoverContentProps<Payload = unknown> = Parameters<typeof SdkPopoverContent<Payload>>[0];

export function WbPopoverContent<Payload = unknown>({ className, style, sideOffset = 8, ...props }: WbPopoverContentProps<Payload>) {
  const palette = useSurfacePalette();
  return (
    <SdkPopoverContent<Payload>
      ref={palette.ref}
      data-theme-scope={palette['data-theme-scope']}
      sideOffset={sideOffset}
      className={cx([wbPopoverSurface, palette.className], className)}
      style={scopeStyle(palette.style, style)}
      {...props}
    />
  );
}
