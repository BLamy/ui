import { definePrimitive } from '@ui-sdk/core';

/* The card behind a group's selected item, as one element that is measured rather than drawn per item, so it
   slides and resizes from one item to the next. UI SDK's Tabs and SegmentedControl have this as their indicator
   part; its ToggleGroup has none, and the measuring those parts share is not exported, so this is that behavior
   for a group whose items mark the selected one with an attribute (`data-pressed`).

   The indicator sits in the group, which is positioned. It writes the selected item's box on itself as
   `--selection-indicator-left`, `-top`, `-width` and `-height`, in the group's own pixels, when the selection
   moves, items come or go, or the group or an item changes size; and removes them while no item, or more than
   one, is selected. */

export type SelectionIndicatorOptions = {
  /** Selects the group's items among its children.
      @defaultValue '[data-slot="toggle"]' */
  items?: string;
  /** The attribute the selected item carries.
      @defaultValue "data-pressed" */
  attribute?: string;
};

const VARIABLES = ['left', 'top', 'width', 'height'] as const;

/** An item's border box inside its group's padding box, in layout pixels: the rects keep the fraction that
    offsetLeft rounds away, divided by the scale an ancestor's transform gives them. */
function boxIn(item: HTMLElement, list: HTMLElement) {
  const rect = item.getBoundingClientRect();
  const frame = list.getBoundingClientRect();
  const scaleX = list.offsetWidth ? frame.width / list.offsetWidth || 1 : 1;
  const scaleY = list.offsetHeight ? frame.height / list.offsetHeight || 1 : 1;
  return {
    left: (rect.left - frame.left) / scaleX - list.clientLeft + list.scrollLeft,
    top: (rect.top - frame.top) / scaleY - list.clientTop + list.scrollTop,
    width: rect.width / scaleX,
    height: rect.height / scaleY,
  };
}

export const selectionIndicator = definePrimitive({
  name: 'selection-indicator',
  options: { items: 'string', attribute: 'string' },
  state: (_options: SelectionIndicatorOptions) => ({}),
  api: (context) => {
    // Set while the indicator is mounted: new options re-read the items and the attribute.
    let rewatch: (() => void) | undefined;
    context.onOptions(() => { rewatch?.(); });
    return {
      internal: {
        bind(el: HTMLElement) {
          const list = el.parentElement;
          if (!list) return () => {};
          const settings = () => {
            const { items, attribute } = context.options();
            return { items: items || '[data-slot="toggle"]', attribute: attribute || 'data-pressed' };
          };
          // The group's own items: its children, so a toggle inside an item or a nested group is not one of them.
          const itemsOf = () => {
            const { items } = settings();
            return Array.from(list.children).filter((child): child is HTMLElement => child !== el && child.matches(items));
          };
          const write = () => {
            const { attribute } = settings();
            const selected = itemsOf().filter((item) => item.hasAttribute(attribute));
            const box = selected.length === 1 ? boxIn(selected[0], list) : undefined;
            for (const name of VARIABLES) {
              if (box) el.style.setProperty(`--selection-indicator-${name}`, `${box[name]}px`);
              else el.style.removeProperty(`--selection-indicator-${name}`);
            }
          };
          // Happy-dom and old browsers have no ResizeObserver: the selection is still followed, a resize is not.
          const sizes = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(write);
          const watched = new Set<Element>();
          const measure = () => {
            const targets = new Set<Element>([list, ...itemsOf()]);
            for (const target of watched) {
              if (targets.has(target)) continue;
              watched.delete(target);
              sizes?.unobserve(target);
            }
            for (const target of targets) {
              if (watched.has(target)) continue;
              watched.add(target);
              sizes?.observe(target);
            }
            write();
          };
          // The selection is read from the page, so it is followed after the items have rendered it.
          const changes = new MutationObserver(measure);
          let observed = '';
          const observe = () => {
            const { attribute } = settings();
            if (attribute === observed) return;
            observed = attribute;
            changes.disconnect();
            changes.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: [attribute] });
          };
          rewatch = () => { observe(); measure(); };
          rewatch();
          return () => {
            rewatch = undefined;
            changes.disconnect();
            sizes?.disconnect();
          };
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      role: 'presentation',
      bind: (el, { api }) => api.internal.bind(el),
    }),
  }),
  // Decoration: the group's items carry the selection and its actions.
  agent: { actions: [], shown: () => false },
});
