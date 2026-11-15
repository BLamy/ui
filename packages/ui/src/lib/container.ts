'use client';
import { createContext, createElement, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { bindSizeClass, type SizeClass, type SizeClassBreakpoints } from '@/lib/size-class';

/* ══ Container primitives shared by every adaptive shell ══
   Shells size themselves by their own box, not the viewport, so nested and resizable hosts behave. A shell that
   only needs to know whether it is compact, medium or regular uses `useSizeClass` (`bindSizeClass` from
   `lib/size-class`, which also writes `data-size-class` on the element for CSS); code that needs pixels measures.

   Size-class scope: every container that measures its size class (BLProvider's root, SplitView, NavigationStack,
   SidebarProvider, ArtifactChatContainer…) provides it to what it renders with `SizeClassProvider`.
   React context crosses portals, so a popup rendered into BLProvider's root from inside a compact SplitView column
   still sees "compact": the kit's popup wrappers resolve `presentation="auto"` from it (`usePresentation`). ══ */

export type { SizeClass, SizeClassBreakpoints };

const SizeClassContext = createContext<SizeClass | undefined>(undefined);

/** Makes `value` the size class of everything rendered inside, popups included. `undefined` (not measured yet)
 *  passes the scope around it through. */
export function SizeClassProvider({ value, children }: { value: SizeClass | undefined; children?: ReactNode }) {
  const around = useContext(SizeClassContext);
  return createElement(SizeClassContext.Provider, { value: value ?? around }, children);
}

/** The size class of the nearest container around, or `undefined` outside every one. */
export function useSizeClassScope(): SizeClass | undefined {
  return useContext(SizeClassContext);
}

export interface UseSizeClassOptions {
  /** The widths, px, the medium and regular classes start at. Default 640 and 1024. */
  breakpoints?: SizeClassBreakpoints;
  /** The class until the element is measured (and on the server). Default: the nearest scope's, else `regular`. */
  initial?: SizeClass;
}
/** The size class of an element's own box: put the returned ref on the element (it gets `data-size-class` too),
 *  and wrap what it renders in `<SizeClassProvider value={sizeClass}>` so popups inside follow it. Until the ref
 *  is attached (or without attaching it at all) the class is the nearest scope's, so `const [, sizeClass] =
 *  useSizeClass()` reads where a component sits. */
export function useSizeClass<T extends HTMLElement = HTMLDivElement>(
  { breakpoints, initial }: UseSizeClassOptions = {},
): [(el: T | null) => void, SizeClass] {
  const scope = useContext(SizeClassContext);
  const [el, setEl] = useState<T | null>(null);
  const [measured, setMeasured] = useState<SizeClass | undefined>(undefined);
  const medium = breakpoints?.medium;
  const regular = breakpoints?.regular;
  useLayoutEffect(() => {
    if (!el) return;
    const stop = bindSizeClass(el, { breakpoints: { medium, regular }, onChange: setMeasured });
    return () => {
      stop();
      setMeasured(undefined);
    };
  }, [el, medium, regular]);
  return [setEl, (el && measured) || initial || scope || 'regular'];
}

/** What a popup wrapper passes to UI SDK for `presentation`: `"auto"` becomes `"sheet"` inside a compact scope and
 *  the component's own presentation (`fallback`) inside a medium or regular one. With no scope at all `"auto"` goes
 *  through, and UI SDK's own rule (a small touch screen) decides. Any other value is the author's. */
export function usePresentation<P extends string>(presentation: P | undefined, fallback: P): P | undefined {
  const scope = useContext(SizeClassContext);
  if (presentation !== 'auto' || !scope) return presentation;
  return (scope === 'compact' ? 'sheet' : fallback) as P;
}

/** A key for a popup root that follows its resolved `presentation` until the first frame after it mounts, then
 *  holds. UI SDK decides a popup's presentation when it opens, and one open at mount opens before the containers
 *  around it have measured their size class; keyed by this, it opens again (before paint) once they have. Later
 *  size-class changes keep the open popup as it is, as UI SDK does. */
export function useMountPresentationKey(shown: string | undefined): string {
  const key = useRef(shown ?? '');
  const settled = useRef(false);
  useLayoutEffect(() => {
    const view = typeof window === 'undefined' ? undefined : window;
    if (!view) return;
    const frame = view.requestAnimationFrame(() => { settled.current = true; });
    return () => view.cancelAnimationFrame(frame);
  }, []);
  if (!settled.current) key.current = shown ?? '';
  return key.current;
}

/** Measures an element's width with a ResizeObserver. `initial` is used until the first measurement. */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(initial = 1200): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number) => { if (w > 0) setWidth(w); };
    apply(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => apply(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export interface ContainerSize {
  width: number;
  height: number;
}
/** Measures an element's width and height with a ResizeObserver (content box, like `useContainerWidth`).
 *  `initial` is used until the first measurement; a zero-sized first read (not laid out yet) is ignored. */
export function useContainerSize<T extends HTMLElement = HTMLDivElement>(
  initial: ContainerSize = { width: 1200, height: 800 },
): [RefObject<T | null>, ContainerSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ContainerSize>(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (width: number, height: number) => {
      if (width <= 0 && height <= 0) return;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    const r = el.getBoundingClientRect();
    apply(r.width, r.height);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => apply(entries[0].contentRect.width, entries[0].contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
