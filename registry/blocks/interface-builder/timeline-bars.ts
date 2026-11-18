import { createChange, createSpans, definePrimitive, type ChangeDetails, type Span, type SpansDraft, type SpansReason } from '@brett_lamy/ui/sdk/core';

/* ══ timelineBars — the motion timeline's bars: UI SDK's `createSpans` as a primitive ══
   A track per animated node and one bar on it: from when its appear starts to when it comes to rest, in ms. Drag a
   bar to move it (its delay) or its end (`data-span-edge="end"`) to stretch it (its duration); a press that never
   passes the drag threshold stays a click. With focus on a bar the arrows move it a step, Shift with them moves its
   end; the other keys pass through. A bar stays on its track, can't be deleted here, and only a `resizable` one stretches: those changes are
   refused before they reach `onBarsChange`. `bars` is the controlled key, through `createChange` (reasons `drag`,
   `move-key`). No React in here: render it with `createParts(timelineBars, { root: 'div', track: 'div', bar: 'div' })`. ══ */

export interface TimelineBar extends Span {
  /** Whether its end can be dragged: a tween's or a time spring's duration. */
  resizable: boolean;
  /** What screen readers call it, like `"Card, 0.2s to 0.6s"`. */
  label: string;
}

/** The change, with the bar that changed and how: `move` (its delay) or `resize` (its duration). */
export type TimelineBarsChangeDetails = ChangeDetails<SpansReason> & { id: string; action: 'move' | 'resize' };

export interface TimelineBarsOptions {
  bars: TimelineBar[];
  /** A bar moved or stretched: the new bars, once the drag lets go or the key lands. */
  onBarsChange?: (bars: TimelineBar[], details: TimelineBarsChangeDetails) => void;
  /** Where the clock ends, ms. */
  max: number;
  /** What starts and ends snap to and the arrows move by, ms. Default 10. */
  step?: number;
}

interface TimelineBarsState {
  bars: TimelineBar[];
  draft: SpansDraft<TimelineBar> | null;
}

export const timelineBars = definePrimitive({
  name: 'ib-timeline-bars',
  options: { bars: 'value', onBarsChange: 'callback', max: 'number', step: 'number' },
  controlled: ['bars'],
  state: (options: TimelineBarsOptions): TimelineBarsState => ({ bars: options.bars, draft: null }),
  sync: (options) => ({ bars: options.bars }),
  api: (context) => {
    const change = createChange(context);
    const spans = createSpans<TimelineBarsState, TimelineBar>(context, {
      key: 'bars',
      draft: 'draft',
      set: (value, details) => {
        const before = context.store.get().bars.find((b) => b.id === details.id);
        const after = value.find((b) => b.id === details.id);
        if (!before || !after || after.track !== before.track) return false;
        if (details.action === 'resize' && (!before.resizable || after.start !== before.start)) return false;
        if (details.action !== 'move' && details.action !== 'resize') return false;
        return change('bars', value, { reason: details.reason, event: details.event, id: details.id, action: details.action });
      },
      axis: 'x',
      min: () => 0,
      max: () => context.options().max,
      step: () => context.options().step ?? 10,
      label: (bar) => bar.label,
      createAutoScroll: false,
    });
    return {
      spans,
      /** Moves or stretches a bar from code. */
      update: (id: string, range: { start?: number; end?: number }) => spans.update(id, range),
    };
  },
  slots: (slot) => ({
    root: slot<object, { bars: TimelineBar[] }>({
      state: (state, { api }) => ({ bars: api.spans.spans(state) }),
    }),
    // A node's lane: it runs the clock from 0 to `max`. Presses on it are the timeline's own (they scrub).
    track: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: () => ({ style: 'position:relative' }),
      bind: (el, { api, key }) => api.spans.bindTrack(el, key),
    }),
    bar: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, { api, key }) => {
        const bar = api.spans.spans(state).find((b) => b.id === key);
        return {
          tabindex: '0',
          'aria-label': bar?.label,
          ...api.spans.spanAttrs(state, key),
          style: bar ? `${api.spans.spanStyle(bar)};touch-action:none` : undefined,
        };
      },
      focus: 'tab-stop',
      keys: ['ArrowLeft', 'ArrowRight', 'shift+ArrowLeft', 'shift+ArrowRight'],
      on: {
        pointerdown: (event, { api, key }) => api.spans.spanPointerdown(event, key),
        // Only the clock's arrows: a bar keeps its track and can't be deleted, so Up/Down and Delete aren't its keys.
        keydown: (event, { api, key }) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') api.spans.keydown(event, key);
        },
      },
      bind: (el, { api, key }) => api.spans.bindSpan(el, key),
    }),
  }),
  agent: { actions: ['update'] },
});
