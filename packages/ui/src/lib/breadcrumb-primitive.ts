import { definePrimitive } from '@ui-sdk/core';

/* ══ The breadcrumb primitive: a trail that collapses its middle when it does not fit ══
   UI SDK ships no breadcrumb or overflow behavior, so this measures and fits. The `measure` slot is an off-screen,
   inert copy of the full trail (each row an item and its separator, then one `…` row); its `bind` reads every
   row's width and the root's inner width, and again whenever either box resizes, the copy's content changes or
   web fonts load. `fitBreadcrumbs` (pure) turns those widths into how many leading (`head`) and trailing (`tail`)
   items stay; the rest go behind the `…`. Before anything is measured, and on the server, the whole trail shows.
   An agent reads the trail as the root's items and activates one with `activate`. No React:
   `components/breadcrumb.tsx` renders it. */

export interface BreadcrumbFit {
  /** How many leading items stay. */
  head: number;
  /** How many trailing items stay (0 when nothing is hidden). The hidden ones are `head … length - tail`. */
  tail: number;
}

export interface BreadcrumbFitOptions {
  /** Leading items that always stay. Default 1. */
  keepHead?: number;
  /** Trailing items that always stay: at least 1 (the current page), default 1. */
  keepTail?: number;
}

/** How many items to keep so a trail fits `available` px. `widths` are each item's own width; `separatorWidth` is
 *  what sits between two neighbours (separator and its spacing); `ellipsisWidth` is the `…` item's own width.
 *  When everything fits (or there is nothing to hide, or no width is known: `available <= 0`) the result is
 *  `{ head: widths.length, tail: 0 }`. Otherwise the middle collapses into the ellipsis: the head stays and
 *  the most trailing items that fit stay — at least `keepTail`, even when that overflows. */
export function fitBreadcrumbs(
  widths: readonly number[],
  available: number,
  separatorWidth = 0,
  ellipsisWidth = 0,
  { keepHead = 1, keepTail = 1 }: BreadcrumbFitOptions = {},
): BreadcrumbFit {
  const n = widths.length;
  const all: BreadcrumbFit = { head: n, tail: 0 };
  const head = Math.max(0, Math.min(keepHead, n));
  // The last item is the current page: it always stays, so `tail: 0` can only ever mean "nothing is hidden".
  const minTail = Math.max(1, keepTail);
  if (available <= 0 || n - head <= minTail) return all;
  const sum = (from: number, to: number) => {
    let w = 0;
    for (let i = from; i < to; i++) w += widths[i];
    return w;
  };
  if (sum(0, n) + (n - 1) * separatorWidth <= available) return all;
  // Trail = head items, the ellipsis, `tail` items: (head + 1 + tail) entries and as many gaps, less one.
  const widthWith = (tail: number) => sum(0, head) + ellipsisWidth + sum(n - tail, n) + (head + tail) * separatorWidth;
  for (let tail = n - head - 1; tail > minTail; tail--) if (widthWith(tail) <= available) return { head, tail };
  return { head, tail: minTail };
}

/** One entry of the trail, as the primitive knows it: its key and its plain-text name. */
export type BreadcrumbTrailItem = { value: string; label: string };

export type BreadcrumbOptions = {
  /** The whole trail, in order. Its length is what the measured widths must match. */
  items: BreadcrumbTrailItem[];
  /** Collapse the middle into `…` when the items do not fit. Default true. */
  collapse?: boolean;
  /** Leading items that never collapse. Default 1. */
  keepHead?: number;
  /** Trailing items that never collapse: at least 1 (the current page), default 1. */
  keepTail?: number;
};

export type BreadcrumbState = BreadcrumbFit & {
  /** How many items the trail has. */
  count: number;
};

type Metrics = {
  /** Each item's own width (without its separator). */
  widths: number[];
  separator: number;
  ellipsis: number;
  available: number;
};

const sameMetrics = (a: Metrics | null, b: Metrics) =>
  !!a && a.available === b.available && a.separator === b.separator && a.ellipsis === b.ellipsis
  && a.widths.length === b.widths.length && a.widths.every((w, i) => w === b.widths[i]);

/** An element's inner width: what its children can fill. */
function contentWidth(el: HTMLElement) {
  const cs = el.ownerDocument.defaultView?.getComputedStyle(el);
  return el.clientWidth - (parseFloat(cs?.paddingLeft ?? '') || 0) - (parseFloat(cs?.paddingRight ?? '') || 0);
}

const full = (count: number): BreadcrumbState => ({ count, head: count, tail: 0 });

export const breadcrumb = definePrimitive({
  name: 'breadcrumb',
  options: { items: 'list', collapse: 'boolean', keepHead: 'number', keepTail: 'number' },
  state: (options: BreadcrumbOptions): BreadcrumbState => full(options.items?.length ?? 0),
  api: (context) => {
    const { store } = context;
    let metrics: Metrics | null = null;

    /** The fit for the newest options and widths. Widths measured for another trail length don't count. */
    const refit = () => {
      const { items = [], collapse = true, keepHead, keepTail } = context.options();
      const next = collapse && metrics && metrics.widths.length === items.length
        ? { count: items.length, ...fitBreadcrumbs(metrics.widths, metrics.available, metrics.separator, metrics.ellipsis, { keepHead, keepTail }) }
        : full(items.length);
      const now = store.get();
      if (now.count !== next.count || now.head !== next.head || now.tail !== next.tail) store.set(next);
    };

    /** Reads layout only, so a render it causes can never feed back into another measure. */
    const measure = () => {
      const root = context.element('root');
      const copy = context.element('measure')?.firstElementChild;
      if (!root || !(copy instanceof HTMLElement) || context.options().collapse === false) return;
      const rows = Array.from(copy.children) as HTMLElement[];
      const separator = copy.querySelector<HTMLElement>('[data-slot=breadcrumb-separator]')?.offsetWidth ?? 0;
      const own = rows.map((row) => Math.max(0, row.offsetWidth - separator));
      const next: Metrics = { widths: own.slice(0, -1), separator, ellipsis: own[own.length - 1] ?? 0, available: contentWidth(root) };
      if (!sameMetrics(metrics, next)) metrics = next;
      refit();
    };

    // The adapter passes options after the trail it describes is in the page: a new trail is measured at once.
    context.onOptions(() => {
      refit();
      measure();
    });

    return {
      /** The items the trail shows, in order; the hidden ones are rows of the `…` menu, a Menu of its own. */
      items(): BreadcrumbTrailItem[] {
        const { count, head, tail } = store.get();
        const items = context.options().items ?? [];
        if (count !== items.length || tail === 0 || count - head - tail <= 0) return items;
        return [...items.slice(0, head), ...items.slice(count - tail)];
      },
      /** Presses a shown item's link, button or sibling picker. False for the current page when it is plain text,
       *  for an unknown item, and for one behind the `…` (choose it from that menu instead). */
      activate(value: string) {
        const el = context.element('item', value);
        const control = el?.querySelector<HTMLElement>('a[href], button, [role=button]');
        if (!control) return false;
        control.click();
        return true;
      },
      internal: {
        /** Watches the root and the copy, and measures them now. */
        observe(el: HTMLElement) {
          const view = el.ownerDocument.defaultView;
          let live = true;
          const run = () => { if (live) measure(); };
          const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run);
          const root = context.element('root');
          if (root) sizes?.observe(root);
          if (el.firstElementChild) sizes?.observe(el.firstElementChild);
          // A label or icon that changes without a new trail changes the widths too.
          const content = view?.MutationObserver ? new view.MutationObserver(run) : null;
          content?.observe(el, { childList: true, subtree: true, characterData: true });
          // Web fonts change every width.
          void el.ownerDocument.fonts?.ready.then(run);
          measure();
          return () => {
            live = false;
            sizes?.disconnect();
            content?.disconnect();
          };
        },
      },
    };
  },
  slots: (slot) => ({
    // The `nav` landmark: named by its `aria-label`. `data-collapsed` while items are behind the `…`.
    root: slot<Record<never, never>, BreadcrumbState>({
      state: (state) => state,
      attrs: (state) => ({ 'data-collapsed': state.tail > 0 && state.count - state.head - state.tail > 0 ? '' : undefined }),
    }),
    list: slot({}),
    // One shown item, keyed by its value; `current` is the last one, the page itself.
    item: slot<{ value: string; current?: boolean }>({
      props: { value: 'string', current: 'boolean' },
      attrs: (_state, { props }) => ({ 'data-current': props.current ? '' : undefined }),
    }),
    ellipsis: slot({}),
    // The off-screen copy the fit is measured from: hidden from assistive tech, agents and the pointer.
    measure: slot({
      attrs: () => ({ 'aria-hidden': 'true', inert: '' }),
      bind: (el, { api }) => api.internal.observe(el),
    }),
  }),
  agent: { actions: ['activate'], items: (api) => api.items() },
});
