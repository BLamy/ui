import { createArea, createChange, definePrimitive, type AreaAxis, type AreaReason, type AreaValue, type ChangeDetails } from '@ui-sdk/core';

/* ══ pointPad — a point dragged on a graph: UI SDK's `createArea` as a primitive ══
   The pad is the graph's plotting box; the thumb is the point, a 2D slider: a drag follows the pointer (a press
   on the thumb starts it), arrows step x and y (Shift for ten steps), Page Up and Page Down step y by a tenth of
   its range, Home and End go to x's ends. `value` is the controlled key: every change is asked for through
   `createChange` (reasons `track-press`, `drag`, `step-key`), and `onValueCommit` says when a gesture or a key
   settled. A bezier's control point and a spring's first peak are each one. No React in here: render it with
   `createParts(pointPad, { pad: 'div', thumb: 'span' })`. ══ */

export type PointPadChangeDetails = ChangeDetails<AreaReason>;

export interface PointPadOptions {
  /** Where the point is, in the axes' units. */
  value: AreaValue;
  /** Every change, as it happens: `details.reason` says how; `details.cancel()` refuses it. */
  onValueChange?: (value: AreaValue, details: PointPadChangeDetails) => void;
  /** A drag let go, or a key changed the value. */
  onValueCommit?: (value: AreaValue, details: { reason: AreaReason; event?: Event }) => void;
  /** The x axis, left to right, as the pad spans it: `min`, `max`, `step`, `label`. Default 0–1 in steps of 0.01. */
  x?: AreaAxis;
  /** The y axis, bottom to top. */
  y?: AreaAxis;
  /** What screen readers hear for a value. */
  valueText?: (value: AreaValue) => string;
}

interface PointPadState {
  value: AreaValue;
}

export const pointPad = definePrimitive({
  name: 'ib-point-pad',
  options: {
    value: 'value',
    onValueChange: 'callback',
    onValueCommit: 'callback',
    x: 'value',
    y: 'value',
    valueText: 'action',
  },
  controlled: ['value'],
  state: (options: PointPadOptions): PointPadState => ({ value: options.value }),
  sync: (options) => ({ value: options.value }),
  api: (context) => {
    const change = createChange(context);
    const area = createArea<PointPadState>(context, {
      value: (state) => state.value,
      set: (value, details) => change('value', value, details),
      x: () => context.options().x ?? {},
      y: () => context.options().y ?? {},
      valueText: (value) => context.options().valueText?.(value) ?? `${value.x}, ${value.y}`,
      onCommit: (value, details) => context.options().onValueCommit?.(value, details),
    });
    return {
      area,
      /** Moves the point, snapped and clamped to the axes. */
      setValue: (value: AreaValue) => area.set(value),
    };
  },
  slots: (slot) => ({
    // The plotting box: the thumb's position is a percentage of it, and a drag maps the pointer through it. Presses
    // start on the thumb (the pad itself lets them through to the graph), and bubble up to here.
    pad: slot({
      attrs: () => ({ style: 'touch-action:none;user-select:none' }),
      on: { pointerdown: (event, { el, api }) => api.area.pointerdown(event, el!) },
    }),
    thumb: slot({
      attrs: (state, { api }) => ({ ...api.area.thumbAttrs(state), style: api.area.thumbStyle(state) }),
      on: { keydown: (event, { api }) => api.area.keydown(event) },
    }),
  }),
  agent: { actions: ['setValue'] },
});
