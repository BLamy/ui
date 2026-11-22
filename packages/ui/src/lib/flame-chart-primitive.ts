import {
  bindDrag,
  createChange,
  createCommit,
  definePrimitive,
  dispatch,
  type ChangeDetails,
  type CommitDetails,
} from '@ui-sdk/core';
import { TRACE_MIN_SPAN, clampView } from '@/lib/trace-timeline-model';
import type { FlameRange } from '@/lib/flame-chart-model';

/* ══ The flame-chart primitive: a trace's spans on a canvas, with a playhead ══
   The chart draws on a canvas, so what is under the pointer and where a key goes depend on its lanes, rows and view,
   which the component works out (`gestures`). This is the rest: the state, each key controlled or not and every change
   through `createChange` with a reason (the playhead `value`, with one `onValueCommit` when an interaction ends; the
   `view` on show; the `selected` span; the `collapsedLanes`), `onSpanActivate` through `dispatch`, the root's role, keys
   and focus, the drags as UI SDK's `bindDrag` (pointer capture, a move once a frame, Escape puts things back), a second
   finger turning a drag into a pinch, and the wheel. No React: `components/flame-chart.tsx` renders it. */

/** Why the playhead moved: a press on empty space or the ruler (`track-press`), a drag on the ruler (`drag`), a key
 *  (`step-key`), Escape putting a ruler drag back (`escape-key`), or a controller (`imperative`). */
export type FlameValueChangeReason = 'track-press' | 'drag' | 'step-key' | 'escape-key' | 'imperative';
export type FlameValueChangeDetails = ChangeDetails<FlameValueChangeReason>;
export type FlameValueCommitDetails = CommitDetails<FlameValueChangeReason>;

/** Why the view moved: the wheel or a trackpad pinch (`wheel`), two fingers (`pinch`), `+`, `-` or `0` (`zoom-key`),
 *  Shift with an arrow (`pan-key`), a drag on the body (`drag`), the minimap (`minimap`), the selection or the playhead
 *  leaving it (`follow`), Escape putting a drag back (`escape-key`), a new `range` (`range-change`), or a controller
 *  (`imperative`: `fit`, `setView`, `reveal`). */
export type FlameViewChangeReason = 'wheel' | 'pinch' | 'zoom-key' | 'pan-key' | 'drag' | 'minimap' | 'follow' | 'escape-key' | 'range-change' | 'imperative';
export type FlameViewChangeDetails = ChangeDetails<FlameViewChangeReason>;

/** Why the selection changed: a press on a span (`item-press`), an arrow key (`list-navigation`), Escape
 *  (`escape-key`), or a controller (`imperative`). */
export type FlameSelectReason = 'item-press' | 'list-navigation' | 'escape-key' | 'imperative';
export type FlameSelectedChangeDetails = ChangeDetails<FlameSelectReason>;

/** Why lanes collapsed or opened: a press on a lane's header (`trigger-press`), or a controller (`imperative`, which
 *  `reveal` is too when it opens the lane of the span it shows). */
export type FlameCollapseReason = 'trigger-press' | 'imperative';
export type FlameCollapsedLanesChangeDetails = ChangeDetails<FlameCollapseReason>;

/** Why a span was opened: a double press (`double-press`), Enter (`enter-key`), or a controller (`imperative`). */
export type FlameActivateReason = 'double-press' | 'enter-key' | 'imperative';
export type FlameActivateDetails = ChangeDetails<FlameActivateReason>;

/** What a press starts: a scrub of the playhead (the ruler), a drag (the body, the gutter, the minimap: the component
 *  follows it), or nothing. */
export type FlamePress = { kind: 'scrub'; time: number } | { kind: 'drag' } | null;

/** What the component answers from its lanes, rows and view. */
export type FlameChartGestures = {
  press: (event: PointerEvent) => FlamePress;
  /** A pressed pointer moved, at most once a frame: where a scrub takes the playhead, or null for a drag. */
  move: (event: PointerEvent) => number | null;
  /** A press is over: `canceled` when the browser took the pointer or Escape was pressed. A drag that didn't move is a
   *  press; return a time to seek there (a press on empty space). */
  release: (event: PointerEvent, canceled: boolean) => number | null;
  /** The pointers, while two or more are down (a pinch), and null once fewer are. */
  pinch: (points: ReadonlyArray<{ x: number; y: number }> | null, event?: PointerEvent) => void;
  /** Where a key takes the playhead; `true` for a key it handled another way; null to leave the key alone. */
  key: (event: KeyboardEvent, value: number) => number | true | null;
  wheel: (event: WheelEvent) => void;
};

export type FlameChartOptions = {
  value?: number;
  defaultValue?: number;
  onValueChange?: (time: number, details: FlameValueChangeDetails) => void;
  onValueCommit?: (time: number, details: FlameValueCommitDetails) => void;
  view?: FlameRange;
  defaultView?: FlameRange;
  onViewChange?: (view: FlameRange, details: FlameViewChangeDetails) => void;
  minSpan?: number;
  selected?: number;
  defaultSelected?: number;
  onSelectedChange?: (index: number, details: FlameSelectedChangeDetails) => void;
  collapsedLanes?: readonly string[];
  defaultCollapsedLanes?: readonly string[];
  onCollapsedLanesChange?: (lanes: string[], details: FlameCollapsedLanesChangeDetails) => void;
  onSpanActivate?: (index: number, details: FlameActivateDetails) => void;
  /** How many spans there are, so `select` and `activate` can refuse one that isn't. */
  count: number;
  min: number;
  max: number;
  gestures: FlameChartGestures;
};

type FlameChartState = {
  value: number;
  view: FlameRange;
  selected: number;
  collapsedLanes: readonly string[];
  count: number;
  min: number;
  max: number;
  minSpan: number;
};

type Drag = { pointerId: number; kind: 'scrub' | 'drag'; before: number; moved: boolean; release: () => void };

const NO_LANES: readonly string[] = [];
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Enter', 'Escape', '+', '=', '-', '_', '0'] as const;

export const flameChart = definePrimitive({
  name: 'flame-chart',
  options: {
    value: 'number', defaultValue: 'number', onValueChange: 'callback', onValueCommit: 'callback',
    view: 'value', defaultView: 'value', onViewChange: 'callback', minSpan: 'number',
    selected: 'number', defaultSelected: 'number', onSelectedChange: 'callback',
    collapsedLanes: 'value', defaultCollapsedLanes: 'value', onCollapsedLanesChange: 'callback',
    onSpanActivate: 'callback', count: 'number', min: 'number', max: 'number', gestures: 'value',
  },
  controlled: ['value', 'view', 'selected', 'collapsedLanes'],
  commits: ['value'],
  state: (options: FlameChartOptions): FlameChartState => ({
    value: options.value ?? options.defaultValue ?? options.min,
    view: options.view ?? options.defaultView ?? { start: options.min, end: options.max },
    selected: options.selected ?? options.defaultSelected ?? -1,
    collapsedLanes: options.collapsedLanes ?? options.defaultCollapsedLanes ?? NO_LANES,
    count: options.count,
    min: options.min,
    max: options.max,
    minSpan: options.minSpan ?? TRACE_MIN_SPAN,
  }),
  sync: (options) => ({
    count: options.count,
    min: options.min,
    max: options.max,
    minSpan: options.minSpan ?? TRACE_MIN_SPAN,
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.view === undefined ? {} : { view: options.view }),
    ...(options.selected === undefined ? {} : { selected: options.selected }),
    ...(options.collapsedLanes === undefined ? {} : { collapsedLanes: options.collapsedLanes }),
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const commit = createCommit(context);
    const gestures = () => context.options().gestures;
    const clamp = (t: number) => Math.max(store.get().min, Math.min(store.get().max, t));
    // Where the last change asked the playhead to go: a controlled value lags until the host passes it back.
    let asked: number | null = null;
    const value = () => asked ?? store.get().value;
    const seek = (to: number, details: { reason: FlameValueChangeReason; event?: Event }) => {
      const t = clamp(to);
      asked = t;
      return change('value', t, details);
    };
    context.onOptions(() => { asked = null; });

    const range = (): FlameRange => ({ start: store.get().min, end: store.get().max });
    const viewOf = (view: FlameRange) => clampView({ start: view.start, end: view.end }, range(), store.get().minSpan);
    const setView = (view: FlameRange, details: { reason: FlameViewChangeReason; event?: Event } = { reason: 'imperative' }) => {
      if (!Number.isFinite(view.start) || !Number.isFinite(view.end)) return false;
      const next = viewOf(view);
      const now = viewOf(store.get().view);
      if (next.start === now.start && next.end === now.end) return false;
      return change('view', next, details);
    };
    const select = (index: number, details: { reason: FlameSelectReason; event?: Event } = { reason: 'imperative' }) => {
      const to = Number.isInteger(index) && index >= 0 && index < store.get().count ? index : -1;
      return store.get().selected === to ? false : change('selected', to, details);
    };
    const setCollapsedLanes = (lanes: readonly string[], details: { reason: FlameCollapseReason; event?: Event } = { reason: 'imperative' }) => {
      const now = store.get().collapsedLanes;
      if (now.length === lanes.length && lanes.every((key) => now.includes(key))) return false;
      return change('collapsedLanes', [...lanes], details);
    };

    const pointers = new Map<number, { x: number; y: number }>();
    let drag: Drag | null = null;
    let pinching = false;
    let spent = false;
    context.onDestroy(() => drag?.release());

    const endDrag = (event: PointerEvent, canceled: boolean, escaped: boolean) => {
      const d = drag;
      if (!d) return;
      drag = null;
      const at = gestures().release(event, canceled);
      if (d.kind === 'scrub') {
        if (escaped) {
          seek(d.before, { reason: 'escape-key' });
          commit('value', value(), { reason: 'escape-key' });
        } else {
          commit('value', value(), { reason: d.moved ? 'drag' : 'track-press', event });
        }
      } else if (at != null && !canceled) {
        if (seek(at, { reason: 'track-press', event })) commit('value', value(), { reason: 'track-press', event });
      }
    };

    return {
      getValue: () => store.get().value,
      getView: () => viewOf(store.get().view),
      /** Shows a stretch of time. Returns whether the change went through. */
      setView,
      /** Shows the whole range. */
      fit: (details: { reason: FlameViewChangeReason; event?: Event } = { reason: 'imperative' }) => setView(range(), details),
      /** Moves the playhead, as a controller or an agent would. */
      setValue: (time: number, { reason = 'imperative', event }: { reason?: FlameValueChangeReason; event?: Event } = {}) => {
        const done = seek(time, { reason, event });
        if (done) commit('value', value(), { reason, event });
        return done;
      },
      /** Selects a span by index, or none with -1. */
      select,
      /** Opens a span, as a double press or Enter does: runs `onSpanActivate`. Returns whether a listener canceled it. */
      activate: (index: number, details: { reason: FlameActivateReason; event?: Event } = { reason: 'imperative' }) => {
        if (!(Number.isInteger(index) && index >= 0 && index < store.get().count)) return false;
        return dispatch(context, 'onSpanActivate', index, details);
      },
      /** Collapses exactly these lanes, by key. */
      setCollapsedLanes,
      /** Collapses a lane, or opens it. */
      toggleLane: (key: string, details: { reason: FlameCollapseReason; event?: Event } = { reason: 'imperative' }) => {
        const now = store.get().collapsedLanes;
        return setCollapsedLanes(now.includes(key) ? now.filter((k) => k !== key) : [...now, key], details);
      },
      internal: {
        pointerdown(el: HTMLElement, event: PointerEvent) {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size === 2) {
            // A second finger makes this a pinch: take back the first finger's scrub.
            const d = drag;
            if (d) {
              drag = null;
              d.release();
              if (d.kind === 'scrub') {
                seek(d.before, { reason: 'drag', event });
                commit('value', value(), { reason: 'drag', event });
              }
              gestures().release(event, true);
            }
            pinching = true;
            gestures().pinch([...pointers.values()], event);
            return;
          }
          if (pointers.size > 2 || drag || spent || pinching) return;
          const press = gestures().press(event);
          if (!press) {
            pointers.delete(event.pointerId);
            return;
          }
          const d: Drag = { pointerId: event.pointerId, kind: press.kind, before: value(), moved: false, release: () => {} };
          drag = d;
          if (press.kind === 'scrub') seek(press.time, { reason: 'track-press', event });
          d.release = bindDrag(el, event, {
            onMove: ({ event: move }) => {
              if (drag !== d) return;
              d.moved = true;
              const t = gestures().move(move);
              if (d.kind === 'scrub' && t != null && t !== value()) seek(t, { reason: 'drag', event: move });
            },
            onEnd: (end, canceled) => {
              pointers.delete(end.pointerId);
              if (drag !== d) return;
              const escaped = canceled && end.type !== 'pointercancel';
              if (!canceled && d.kind === 'scrub') {
                const t = gestures().move(end);
                if (t != null && t !== value()) seek(t, { reason: d.moved ? 'drag' : 'track-press', event: end });
              }
              endDrag(end, canceled, escaped);
            },
            cancelOnEscape: true,
          });
        },
        pointermove(event: PointerEvent) {
          const known = pointers.get(event.pointerId);
          if (!known) return;
          known.x = event.clientX;
          known.y = event.clientY;
          if (pinching) gestures().pinch([...pointers.values()], event);
        },
        pointerup(event: PointerEvent) {
          if (drag?.pointerId === event.pointerId) return;
          if (!pointers.delete(event.pointerId)) return;
          if (pinching && pointers.size < 2) {
            pinching = false;
            gestures().pinch(null, event);
            spent = pointers.size > 0;
          } else if (spent && !pointers.size) {
            spent = false;
          }
        },
        keydown(event: KeyboardEvent) {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          const at = gestures().key(event, value());
          if (at == null) return;
          event.preventDefault();
          event.stopPropagation();
          if (at === true) return;
          if (seek(at, { reason: 'step-key', event })) commit('value', value(), { reason: 'step-key', event });
        },
        wheel: (event: WheelEvent) => gestures().wheel(event),
        /** Whether a drag or a pinch is under way. */
        busy: () => !!drag || pinching || spent,
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      role: 'application',
      focus: 'tab-stop',
      keys: KEYS,
      attrs: () => ({ tabindex: '0', 'aria-roledescription': 'flame chart' }),
      on: {
        pointerdown: (event, { el, api }) => {
          if (el) api.internal.pointerdown(el, event);
        },
        pointermove: (event, { api }) => api.internal.pointermove(event),
        pointerup: (event, { api }) => api.internal.pointerup(event),
        pointercancel: (event, { api }) => api.internal.pointerup(event),
        wheel: (event, { api }) => api.internal.wheel(event),
        keydown: (event, { api }) => api.internal.keydown(event),
      },
    }),
  }),
  agent: { actions: ['setValue', 'setView', 'fit', 'select', 'activate', 'toggleLane', 'setCollapsedLanes'] },
});
