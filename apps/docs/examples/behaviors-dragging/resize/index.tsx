import { useState } from 'react';
import {
  createChange,
  createResize,
  definePrimitive,
  live,
  type ChangeDetails,
  type ResizeBox,
  type ResizeDraft,
  type ResizeHandle,
  type ResizeReason,
} from '@brett_lamy/ui/sdk/core';
import { createParts, usePart, type PartProps } from '@brett_lamy/ui/sdk/react/primitive';
import { cn } from '@/lib/utils';

type FrameState = { boxes: Record<string, ResizeBox>; draft: ResizeDraft | null };
type FrameOptions = {
  defaultBox: ResizeBox;
  onBoxesChange?: (boxes: Record<string, ResizeBox>, details: ChangeDetails<ResizeReason>) => void;
};

/* A box with eight handles. createResize drags an edge or a corner (or the whole box, with the "move" handle),
   snaps the result to `step`, keeps it inside `bounds` and above `min`, and commits on release; Escape cancels.
   Each handle is a named button: the arrows move its edge by one step, Shift by ten. */
const frame = definePrimitive({
  name: 'resize-frame',
  options: { defaultBox: 'value', onBoxesChange: 'callback' },
  state: (options: FrameOptions): FrameState => ({ boxes: { frame: options.defaultBox }, draft: null }),
  live: ['draft'],
  api: (context) => {
    const change = createChange(context);
    const resize = createResize<FrameState>(context, {
      boxes: (state) => state.boxes,
      draft: 'draft',
      set: (value, details) => change('boxes', value, details),
      min: () => ({ width: 64, height: 48 }),
      bounds: () => ({ left: 0, top: 0, right: 320, bottom: 192 }),
      step: () => 4,
    });
    return {
      resize,
      /** Set the box (reason "imperative"). */
      resizeFrame: (box: ResizeBox) => resize.resizeTo('frame', box),
    };
  },
  slots: (slot) => ({
    root: slot({}),
    box: slot({
      attrs: (state, { api }) => ({ role: 'group', style: api.resize.boxStyle(state, 'frame') }),
      live: live<FrameState, any, object>((state, { api }) => ({
        style: api.resize.style(state, 'frame'),
        'data-dragging': api.resize.dragging(state, 'frame') ? '' : undefined,
      })),
      on: { pointerdown: (event, { el, api }) => event.target === el && api.resize.pointerdown(event, 'frame', 'move', el!) },
    }),
    handle: slot<{ id: string; handle: ResizeHandle }>({
      props: { handle: 'string' },
      attrs: (_state, { props, api }) => ({ type: 'button', ...api.resize.handleAttrs(props.handle) }),
      on: {
        pointerdown: (event, { el, api, props }) => api.resize.pointerdown(event, 'frame', props.handle, el!),
        keydown: (event, { api, props }) => api.resize.keydown(event, 'frame', props.handle),
      },
    }),
  }),
  agent: { actions: ['resizeFrame'] },
});

const parts = createParts(frame, { root: 'div', box: 'div' });

function Handle({ handle, ...props }: { handle: ResizeHandle } & PartProps<'button'>) {
  return usePart(frame, 'handle', { id: handle, handle }, props, 'button');
}

// Where each handle sits on the box, and its name.
const HANDLES: [ResizeHandle, string, string][] = [
  ['nw', 'top left', '-top-1.5 -left-1.5'],
  ['n', 'top', '-top-1.5 left-1/2 -translate-x-1/2'],
  ['ne', 'top right', '-top-1.5 -right-1.5'],
  ['e', 'right', 'top-1/2 -right-1.5 -translate-y-1/2'],
  ['se', 'bottom right', '-right-1.5 -bottom-1.5'],
  ['s', 'bottom', '-bottom-1.5 left-1/2 -translate-x-1/2'],
  ['sw', 'bottom left', '-bottom-1.5 -left-1.5'],
  ['w', 'left', 'top-1/2 -left-1.5 -translate-y-1/2'],
];

export default function ResizeDemo() {
  const [status, setStatus] = useState('136 × 96 at 92, 48');
  return (
    <div className="mx-auto grid w-fit gap-3">
      <parts.Root
        defaultBox={{ x: 92, y: 48, width: 136, height: 96 }}
        onBoxesChange={({ frame: box }, details) => setStatus(`${box.width} × ${box.height} at ${box.x}, ${box.y} (${details.reason})`)}
        className="relative h-48 w-80 rounded-panel bg-secondary shadow-hairline"
      >
        <parts.Box
          aria-label="Frame"
          className="absolute cursor-move touch-none rounded-ctl bg-card shadow-hairline select-none data-dragging:shadow-lg"
        >
          {HANDLES.map(([handle, name, place]) => (
            <Handle
              key={handle}
              handle={handle}
              aria-label={`Resize ${name}`}
              className={cn(
                'absolute size-3 rounded-full border-0 bg-primary p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45',
                place,
              )}
            />
          ))}
        </parts.Box>
      </parts.Root>
      <p className="m-0 text-footnote text-foreground/70 tabular-nums" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
