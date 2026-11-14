'use client';
import { useCallback, useState, type CSSProperties, type Ref } from 'react';
import { readThemeVars } from '@/lib/theme';

/* ══ Trigger palette — a popup in the colors of the surface it opened from ══
   A popup renders into its layer host (BLProvider's root), outside the element it was opened from. The kit's popups
   wear the nearest <ThemeScope> through React context, which covers every surface the kit paints. Some surfaces
   are painted by CSS the context never sees: a host app's own `[data-theme-scope]` rule, a block's stylesheet, a
   shell that sets `.dark` and variables on a plain element. `palette="trigger"` on PopoverContent or
   DropdownMenuContent reads the palette off the trigger instead: each time the popup opens it copies the theme
   variables resolved at the trigger, its appearance (`light` / `dark`) and its named scope. A popup with no trigger
   to read (opened from a controller or a context-menu area) keeps the ThemeScope's palette. */

/** Where a popup takes its palette from: the nearest ThemeScope (`scope`, the default) or its trigger's element. */
export type PopupPalette = 'scope' | 'trigger';

/** What `palette="trigger"` puts on a popup's content part. */
export interface TriggerPaletteProps {
  'data-theme-scope'?: string;
  /** `light` or `dark`, as the trigger's surface is. */
  className: string;
  /** The theme variables resolved at the trigger, and its color scheme. */
  style: CSSProperties;
}

/** Whether an element sits on a light surface: the nearest appearance root (`.light` / `.dark`, set by BLProvider,
    ThemeScope and the themed shells) decides, else the computed color scheme. */
export function isLightSurface(el: Element | null | undefined): boolean {
  if (!el) return false;
  const root = el.closest('.light,.dark,[data-tone]');
  if (root) return root.classList.contains('light') || root.getAttribute('data-tone') === 'light';
  return typeof getComputedStyle !== 'undefined' && getComputedStyle(el).colorScheme === 'light';
}

/* The element that opened a popup: UI SDK points the trigger at its content with `aria-controls` while it is open. */
function triggerOf(content: HTMLElement | null): Element | null {
  if (!content?.id) return null;
  const root = content.getRootNode() as Document | ShadowRoot;
  return root.querySelector(`[aria-controls="${content.id.replace(/["\\]/g, '\\$&')}"]`);
}

/** Reads the trigger's palette for a popup's content part. Put `ref` on the content (merged with the caller's
    `ref`); `props` is null until the content has mounted and found its trigger, and always null when `enabled` is
    false. The palette is read as the content mounts, which is each time the popup opens: not once up front, when a
    host may not have applied its tokens yet. */
export function useTriggerPalette<T extends HTMLElement>(enabled: boolean, ref?: Ref<T>): { ref: Ref<T> | undefined; props: TriggerPaletteProps | null } {
  const [content, setContent] = useState<HTMLElement | null>(null);
  const merged = useCallback(
    (node: T | null) => {
      setContent(node);
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    },
    [ref],
  );
  if (!enabled) return { ref, props: null };
  const trigger = triggerOf(content);
  if (!trigger) return { ref: merged, props: null };
  return {
    ref: merged,
    props: {
      'data-theme-scope': trigger.closest('[data-theme-scope]')?.getAttribute('data-theme-scope') ?? undefined,
      className: isLightSurface(trigger) ? 'light' : 'dark',
      style: readThemeVars(trigger),
    },
  };
}
