import {
  bindDrag,
  createChange,
  createCommit,
  definePrimitive,
  type ChangeDetails,
  type CommitDetails,
} from '@ui-sdk/core';
import { TRACE_MIN_SPAN, clampView, type TraceKey, type TraceRange, type TraceStop } from '@/lib/trace-timeline-model';

/* ══ The trace-timeline primitive: a playhead on a long session, as a slider ══
   The timeline draws on a canvas, so what is under the pointer and where a key lands depend on its axis, its view and
   its rows, which the component works out (`gestures`). This is the rest: the state, each key controlled or not and
   every change through `createChange` with a reason (the playhead `value`, with the stop it landed on and one
   `onValueCommit` when an interaction ends; the `view` on show, which the wheel, a pinch, the zoom keys, a double press
   and a scrub past the edge move; the `focusedLane`, the `selectedThread` and the `selectedRequest` a press picks), the
   slider's role, keys and ARIA on the root, the scrub as UI SDK's `bindDrag` (pointer capture, a move once a frame,
   Escape puts the playhead back), a second finger turning a scrub into a pinch, and the wheel. The component names the
   slider and words its value (`aria-label`, `aria-valuetext`). No React: `components/trace-timeline.tsx` renders it. */

/** Why the playhead moved: a press (`track-press`), a drag (`drag`), a key (`step-key`), Escape putting a scrub back
 *  (`escape-key`), or a controller (`imperative`). */
export type TraceValueChangeReason = 'track-press' | 'drag' | 'step-key' | 'escape-key' | 'imperative';

/** `onValueChange`'s details: UI SDK's change details, and the stop the value snapped to, if any. */
export type TraceValueChangeDetails<K extends TraceKey = TraceKey> = ChangeDetails<TraceValueChangeReason> & { stop: TraceStop<K> | null };
/** `onValueCommit`'s details, once a press, a drag or a key is done. */
export type TraceValueCommitDetails<K extends TraceKey = TraceKey> = CommitDetails<TraceValueChangeReason> & { stop: TraceStop<K> | null };

/** Why the view moved: the wheel or a trackpad pinch (`wheel`), a pinch of two fingers (`pinch`), `+`, `-` or `0`
 *  (`zoom-key`), two presses in one place on a rail (`double-press`), a scrub past the edge (`drag`), the playhead
 *  leaving the view through `value` (`playhead`), a new `range` (`range-change`), or a controller (`imperative`). */
export type TraceViewChangeReason = 'wheel' | 'pinch' | 'zoom-key' | 'double-press' | 'drag' | 'playhead' | 'range-change' | 'imperative';
export type TraceViewChangeDetails = ChangeDetails<TraceViewChangeReason>;

/** Why a lane, a thread or a request was picked: a press on its row (`item-press`), a key that steps through them
 *  (`list-navigation`: Alt+↑/↓ for lanes, `[` `]` for requests, `{` `}` for threads) or a controller (`imperative`). */
export type TracePickReason = 'item-press' | 'list-navigation' | 'imperative';
export type TraceFocusedLaneChangeDetails = ChangeDetails<TracePickReason>;
/** `onSelectedThreadChange`'s details: the lane the thread is in. */
export type TraceSelectedThreadChangeDetails = ChangeDetails<TracePickReason> & { lane: string | null };
export type TraceSelectedRequestChangeDetails = ChangeDetails<TracePickReason>;

/** Where a press, a move or a key takes the playhead. */
export type TraceSeek<K extends TraceKey = TraceKey> = { time: number; stop: TraceStop<K> | null };

/** What the component answers from its axis, view and rows. */
export type TraceTimelineGestures<K extends TraceKey = TraceKey> = {
  /** A press with the main button or a finger: picks what is under it, and says where it seeks to, or null when it
   *  doesn't (the gutter, an empty timeline). */
  press: (event: PointerEvent) => TraceSeek<K> | null;
  /** The scrub's pointer moved, at most once a frame. */
  scrub: (event: PointerEvent) => TraceSeek<K>;
  /** The scrub is over: `canceled` when the browser took the pointer or Escape put the playhead back. */
  release: (event: PointerEvent, canceled: boolean) => void;
  /** The pointers on the timeline, while two or more are down (a pinch), and null once fewer are; with the event behind it. */
  pinch: (points: ReadonlyArray<{ x: number; y: number }> | null, event?: PointerEvent) => void;
  /** Where a key takes the playhead; `true` for a key it handled another way (a zoom); null to leave the key alone. */
  key: (event: KeyboardEvent, value: number) => TraceSeek<K> | true | null;
  /** The wheel and a trackpad pinch (sent as Ctrl with the wheel): they zoom and pan the view. */
  wheel: (event: WheelEvent) => void;
};

export type TraceTimelineOptions<K extends TraceKey = TraceKey> = {
  /** The playhead, to control it. */
  value?: number;
  defaultValue?: number;
  /** Runs as the playhead moves; `details.reason` says why, `details.stop` is the stop it snapped to. */
  onValueChange?: (time: number, details: TraceValueChangeDetails<K>) => void;
  /** Runs once a press, a drag or a key is done, with where the playhead ended. */
  onValueCommit?: (time: number, details: TraceValueCommitDetails<K>) => void;
  /** The stretch of time on show, to control it. */
  view?: TraceRange;
  defaultView?: TraceRange;
  onViewChange?: (view: TraceRange, details: TraceViewChangeDetails) => void;
  /** The shortest stretch of time the view can show. */
  minSpan?: number;
  focusedLane?: string | null;
  defaultFocusedLane?: string | null;
  onFocusedLaneChange?: (lane: string, details: TraceFocusedLaneChangeDetails) => void;
  selectedThread?: TraceKey | null;
  defaultSelectedThread?: TraceKey | null;
  onSelectedThreadChange?: (thread: TraceKey | null, details: TraceSelectedThreadChangeDetails) => void;
  selectedRequest?: TraceKey | null;
  defaultSelectedRequest?: TraceKey | null;
  onSelectedRequestChange?: (request: TraceKey | null, details: TraceSelectedRequestChangeDetails) => void;
  min: number;
  max: number;
  orientation?: 'horizontal' | 'vertical';
  gestures: TraceTimelineGestures<K>;
};

type TraceTimelineState = {
  value: number;
  view: TraceRange;
  focusedLane: string | null;
  selectedThread: TraceKey | null;
  selectedRequest: TraceKey | null;
  min: number;
  max: number;
  minSpan: number;
  orientation: 'horizontal' | 'vertical';
};

type Scrub = { pointerId: number; before: number; moved: boolean; stop: TraceStop | null; release: () => void };

const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', '+', '=', '-', '_', '0', '[', ']', '{', '}'] as const;

export const traceTimeline = definePrimitive({
  name: 'trace-timeline',
  options: {
    value: 'number', defaultValue: 'number', onValueChange: 'callback', onValueCommit: 'callback',
    view: 'value', defaultView: 'value', onViewChange: 'callback', minSpan: 'number',
    focusedLane: 'value', defaultFocusedLane: 'value', onFocusedLaneChange: 'callback',
    selectedThread: 'value', defaultSelectedThread: 'value', onSelectedThreadChange: 'callback',
    selectedRequest: 'value', defaultSelectedRequest: 'value', onSelectedRequestChange: 'callback',
    min: 'number', max: 'number', orientation: 'string', gestures: 'value',
  },
  controlled: ['value', 'view', 'focusedLane', 'selectedThread', 'selectedRequest'],
  commits: ['value'],
  state: (options: TraceTimelineOptions): TraceTimelineState => ({
    value: options.value ?? options.defaultValue ?? options.min,
    view: options.view ?? options.defaultView ?? { start: options.min, end: options.max },
    focusedLane: options.focusedLane ?? options.defaultFocusedLane ?? null,
    selectedThread: options.selectedThread ?? options.defaultSelectedThread ?? null,
    selectedRequest: options.selectedRequest ?? options.defaultSelectedRequest ?? null,
    min: options.min,
    max: options.max,
    minSpan: options.minSpan ?? TRACE_MIN_SPAN,
    orientation: options.orientation ?? 'horizontal',
  }),
  sync: (options) => ({
    min: options.min,
    max: options.max,
    minSpan: options.minSpan ?? TRACE_MIN_SPAN,
    orientation: options.orientation ?? 'horizontal',
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.view === undefined ? {} : { view: options.view }),
    ...(options.focusedLane === undefined ? {} : { focusedLane: options.focusedLane }),
    ...(options.selectedThread === undefined ? {} : { selectedThread: options.selectedThread }),
    ...(options.selectedRequest === undefined ? {} : { selectedRequest: options.selectedRequest }),
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
    const seek = (to: number, details: { reason: TraceValueChangeReason; event?: Event; stop: TraceStop | null }) => {
      const t = clamp(to);
      asked = t;
      return change('value', t, details);
    };
    context.onOptions(() => { asked = null; });

    const pointers = new Map<number, { x: number; y: number }>();
    let scrub: Scrub | null = null;
    let pinching = false;
    // A pinch ended with a finger still down: nothing more until it lifts.
    let spent = false;
    context.onDestroy(() => scrub?.release());

    const endScrub = (event: PointerEvent, canceled: boolean, escaped: boolean) => {
      const s = scrub;
      if (!s) return;
      scrub = null;
      if (escaped) {
        // bindDrag keeps the Escape key's event to itself; the pointer event it hands back isn't what caused this.
        seek(s.before, { reason: 'escape-key', stop: null });
        commit('value', value(), { reason: 'escape-key', stop: null });
      } else {
        commit('value', value(), { reason: s.moved ? 'drag' : 'track-press', event, stop: s.stop });
      }
      gestures().release(event, canceled);
    };

    const range = (): TraceRange => ({ start: store.get().min, end: store.get().max });
    /** The view as it can be shown: inside the range, and no shorter than `minSpan`. */
    const viewOf = (view: TraceRange) => clampView({ start: view.start, end: view.end }, range(), store.get().minSpan);
    const setView = (view: TraceRange, details: { reason: TraceViewChangeReason; event?: Event } = { reason: 'imperative' }) => {
      const next = viewOf(view);
      const now = viewOf(store.get().view);
      if (next.start === now.start && next.end === now.end) return false;
      return change('view', next, details);
    };
    const pick = <Key extends 'focusedLane' | 'selectedThread' | 'selectedRequest'>(
      key: Key, to: TraceTimelineState[Key], details: { reason: TracePickReason; event?: Event; lane?: string | null },
    ) => (store.get()[key] === to ? false : change(key, to, details as never));

    return {
      getValue: () => store.get().value,
      /** The view as it is shown: the state's, held inside the range. */
      getView: () => viewOf(store.get().view),
      /** Shows a stretch of time. Returns whether the change went through. */
      setView,
      /** Shows the whole range. */
      fit: (details: { reason: TraceViewChangeReason; event?: Event } = { reason: 'imperative' }) => setView(range(), details),
      /** Focuses a lane, as a press on its row does. */
      focusLane: (lane: string, details: { reason: TracePickReason; event?: Event } = { reason: 'imperative' }) => pick('focusedLane', lane, details),
      /** Selects a thread of a lane, as a press on its row does. */
      selectThread: (thread: TraceKey | null, details: { reason: TracePickReason; event?: Event; lane?: string | null } = { reason: 'imperative' }) =>
        pick('selectedThread', thread, { ...details, lane: details.lane ?? store.get().focusedLane }),
      /** Selects a request, as a press on it does. */
      selectRequest: (request: TraceKey | null, details: { reason: TracePickReason; event?: Event } = { reason: 'imperative' }) => pick('selectedRequest', request, details),
      /** Moves the playhead, as a controller or the agent would. */
      setValue: (time: number, { reason = 'imperative', event }: { reason?: TraceValueChangeReason; event?: Event } = {}) => {
        const done = seek(time, { reason, event, stop: null });
        if (done) commit('value', value(), { reason, event, stop: null });
        return done;
      },
      internal: {
        pointerdown(el: HTMLElement, event: PointerEvent) {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size === 2) {
            // A second finger makes this a pinch, so take back the first finger's jump.
            const s = scrub;
            if (s) {
              scrub = null;
              s.release();
              seek(s.before, { reason: 'drag', event, stop: null });
              commit('value', value(), { reason: 'drag', event, stop: null });
              gestures().release(event, true);
            }
            pinching = true;
            gestures().pinch([...pointers.values()], event);
            return;
          }
          if (pointers.size > 2 || scrub || spent || pinching) return;
          const at = gestures().press(event);
          if (!at) {
            pointers.delete(event.pointerId);
            return;
          }
          const s: Scrub = { pointerId: event.pointerId, before: value(), moved: false, stop: at.stop, release: () => {} };
          scrub = s;
          seek(at.time, { reason: 'track-press', event, stop: at.stop });
          s.release = bindDrag(el, event, {
            onMove: ({ event: move }) => {
              if (scrub !== s) return;
              const next = gestures().scrub(move);
              s.moved = true;
              s.stop = next.stop;
              if (next.time !== value()) seek(next.time, { reason: 'drag', event: move, stop: next.stop });
            },
            onEnd: (end, canceled) => {
              pointers.delete(end.pointerId);
              if (scrub !== s) return;
              // Escape hands back the last pointer event; the browser taking the pointer sends a pointercancel.
              const escaped = canceled && end.type !== 'pointercancel';
              if (!canceled) {
                const last = gestures().scrub(end);
                s.stop = last.stop;
                if (last.time !== value()) seek(last.time, { reason: s.moved ? 'drag' : 'track-press', event: end, stop: last.stop });
              }
              endScrub(end, canceled, escaped);
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
          if (scrub?.pointerId === event.pointerId) return;
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
          // Cmd and Ctrl with these keys belong to the browser (zoom, history) or the host; Alt is the component's to
          // take (Alt+↑/↓ steps through lanes) or leave (Alt+←/→ is history).
          if (event.metaKey || event.ctrlKey) return;
          const at = gestures().key(event, value());
          if (!at) return;
          event.preventDefault();
          event.stopPropagation();
          if (at === true) return;
          seek(at.time, { reason: 'step-key', event, stop: at.stop });
          commit('value', value(), { reason: 'step-key', event, stop: at.stop });
        },
        wheel: (event: WheelEvent) => gestures().wheel(event),
        /** Whether a scrub or a pinch is under way. */
        busy: () => !!scrub || pinching || spent,
        /** Ends whatever the pointers were doing, keeping the playhead where it is, like when the orientation changes. */
        reset(event?: Event) {
          const s = scrub;
          scrub = null;
          pointers.clear();
          pinching = false;
          spent = false;
          if (s) {
            s.release();
            commit('value', value(), { reason: s.moved ? 'drag' : 'track-press', event, stop: s.stop });
          }
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      role: 'slider',
      focus: 'tab-stop',
      keys: KEYS,
      attrs: (state) => ({
        tabindex: '0',
        'aria-valuemin': String(state.min),
        'aria-valuemax': String(state.max),
        'aria-valuenow': String(Math.max(state.min, Math.min(state.max, state.value))),
        'aria-orientation': state.orientation,
        'data-orientation': state.orientation,
      }),
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
  agent: { actions: ['setValue', 'setView', 'fit', 'focusLane', 'selectThread', 'selectRequest'] },
});
