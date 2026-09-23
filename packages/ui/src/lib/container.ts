import { Children, isValidElement, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/* ══ Container primitives shared by every adaptive shell ══
   Shells size themselves by their own box, not the viewport, so nested and resizable hosts behave. */

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

export interface SlotProps {
  children?: ReactNode;
}
/** A marker component: renders nothing itself; its parent reads the children with `collectSlots`. */
export type SlotComponent = ((props: SlotProps) => null) & { __tkSlot: string };

export function defineSlot(name: string): SlotComponent {
  const Slot = (() => null) as unknown as SlotComponent;
  Slot.__tkSlot = name;
  return Slot;
}

/** Maps each `defineSlot` child to its children by slot name. Other children are ignored. */
export function collectSlots(children: ReactNode): Record<string, ReactNode> {
  const slots: Record<string, ReactNode> = {};
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== 'function') return;
    const name = (child.type as Partial<SlotComponent>).__tkSlot;
    if (name) slots[name] = (child.props as SlotProps).children ?? null;
  });
  return slots;
}
