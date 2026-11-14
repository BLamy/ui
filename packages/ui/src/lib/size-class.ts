/* ══ Size classes — how wide an element's own box is, by name ══
   `compact` like a phone, `medium` like a tablet, `regular` like a desktop window. Media queries read the
   viewport; this reads the element, so a phone frame on a wide page stays compact. `bindSizeClass` follows an
   element's width with a ResizeObserver and writes `data-size-class` on it, for its styles and for what is inside
   it; `sizeClassOf` names a width without a page, so a server can render a guess. Framework-free: the React scope
   that popups resolve `presentation="auto"` from is `SizeClassProvider` in `lib/container`. ══ */

/** How wide an element is, by name. */
export type SizeClass = 'compact' | 'medium' | 'regular';

/** The widths, in CSS pixels, where the classes above `compact` start. */
export interface SizeClassBreakpoints {
  /** Where `medium` starts. Default 640. */
  medium?: number;
  /** Where `regular` starts. Default 1024. */
  regular?: number;
}

export interface BindSizeClassOptions {
  /** Where `medium` and `regular` start, when not at 640 and 1024. */
  breakpoints?: SizeClassBreakpoints;
  /** Runs with the class at the start, and again each time the width crosses a breakpoint. */
  onChange?: (sizeClass: SizeClass) => void;
}

/** The size class of a width: `compact` below 640, `medium` from there, `regular` from 1024, unless `breakpoints`
 *  says otherwise. Reads no page. */
export function sizeClassOf(width: number, { medium = 640, regular = 1024 }: SizeClassBreakpoints = {}): SizeClass {
  return width >= regular ? 'regular' : width >= medium ? 'medium' : 'compact';
}

/** Follows `el`'s width (inside its border, without a scrollbar) and writes its size class on it as
 *  `data-size-class`. `onChange` hears the class once it is first measured and on each change. A box with no width
 *  (not rendered, `display: none`) isn't measured: it keeps the class it had, or has none yet. The cleanup stops
 *  following and puts back the attribute the element had before (a value rendered in its markup stays the markup's).
 *
 *  ```ts
 *  const stop = bindSizeClass(frame, { onChange: (sizeClass) => store.set({ sizeClass }) })
 *  ``` */
export function bindSizeClass(el: HTMLElement, options: BindSizeClassOptions = {}): () => void {
  const before = el.getAttribute('data-size-class');
  let last: SizeClass | undefined;
  const measure = () => {
    const width = el.clientWidth;
    if (!width) return;
    const next = sizeClassOf(width, options.breakpoints);
    if (next === last) return;
    last = next;
    el.setAttribute('data-size-class', next);
    options.onChange?.(next);
  };
  const view = el.ownerDocument.defaultView;
  const observer = view?.ResizeObserver ? new view.ResizeObserver(measure) : undefined;
  observer?.observe(el);
  measure();
  return () => {
    observer?.disconnect();
    if (before === null) el.removeAttribute('data-size-class');
    else el.setAttribute('data-size-class', before);
  };
}
