import { useState } from 'react';
import {
  createChange,
  createMove,
  createRovingFocus,
  css,
  definePrimitive,
  live,
  spatialMove,
  type ChangeDetails,
  type MoveDraft,
  type MovePoint,
  type MoveReason,
} from '@brett_lamy/ui/sdk/core';
import { createParts } from '@brett_lamy/ui/sdk/react/primitive';

type BoardState = { positions: Record<string, MovePoint>; focused: string | null; moving: MoveDraft | null };
type BoardOptions = {
  defaultPositions: Record<string, MovePoint>;
  onPositionsChange?: (positions: Record<string, MovePoint>, details: ChangeDetails<MoveReason>) => void;
};

/* Freely placed notes. createMove drags a note (the offset goes through a live binding as `translate`, so a pointer
   move re-renders nothing) and commits on release, snapped to `step` and clamped to `bounds`; Escape during a drag
   puts it back. Alt with an arrow nudges the focused note by one step (Shift for ten). Plain arrows move focus to
   the nearest note that way (spatialMove). */
const board = definePrimitive({
  name: 'note-board',
  options: { defaultPositions: 'value', onPositionsChange: 'callback' },
  state: (options: BoardOptions): BoardState => ({ positions: options.defaultPositions, focused: null, moving: null }),
  live: ['moving'],
  api: (context) => {
    const change = createChange(context);
    const move = createMove<BoardState>(context, {
      key: 'positions',
      draft: 'moving',
      set: (value, details) => change('positions', value, details),
      step: () => 8,
      bounds: () => ({ minX: 0, minY: 0, maxX: 256, maxY: 128 }),
    });
    return {
      roving: createRovingFocus<BoardState, { value: string }>(context, { slot: 'note', key: 'focused', move: spatialMove() }),
      move,
      /** Place a note (reason "imperative"): for an agent or a "Tidy up" button. */
      moveNote: (key: string, x: number, y: number) => move.moveTo(key, { x, y }),
    };
  },
  slots: (slot) => ({
    root: slot({ attrs: () => ({ role: 'group' }) }),
    note: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, part) => {
        const at = state.positions[part.key] ?? { x: 0, y: 0 };
        return { role: 'button', tabindex: part.api.roving.tabIndex(state, part), style: css({ left: `${at.x}px`, top: `${at.y}px` }) };
      },
      live: live<BoardState, any, { value: string }>((state, { api, key }) => ({
        'data-dragging': api.move.dragging(state, key) ? '' : undefined,
        style: api.move.style(state, key),
      })),
      on: {
        keydown: (event, { el, api, key }) => api.move.keydown(event, key) || api.roving.keydown(event, el!),
        pointerdown: (event, { el, api, key }) => api.move.pointerdown(event, key, el!),
      },
      bind: (el, part) => part.api.roving.bind(el, part),
    }),
  }),
  agent: { actions: ['moveNote'] },
});

const parts = createParts(board, { root: 'div', note: 'div' });

const START: Record<string, MovePoint> = { Ideas: { x: 16, y: 16 }, Todo: { x: 112, y: 88 }, Done: { x: 200, y: 24 } };

export default function MoveDemo() {
  const [status, setStatus] = useState('Drag a note, or focus one and press Alt with an arrow.');
  return (
    <div className="mx-auto grid w-fit gap-3">
      <parts.Root
        aria-label="Notes"
        defaultPositions={START}
        onPositionsChange={(next, details) => {
          const moved = Object.entries(next).map(([k, p]) => `${k} ${p.x},${p.y}`).join(' · ');
          setStatus(`${moved} (${details.reason})`);
        }}
        className="relative h-48 w-80 overflow-hidden rounded-panel bg-secondary shadow-hairline"
      >
        {Object.keys(START).map((note) => (
          <parts.Note
            key={note}
            value={note}
            aria-label={note}
            aria-roledescription="movable note"
            className="absolute grid size-16 cursor-grab touch-none place-items-center rounded-ctl bg-card text-footnote font-semibold text-foreground shadow-hairline outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/45 data-dragging:z-10 data-dragging:cursor-grabbing data-dragging:shadow-lg"
          >
            {note}
          </parts.Note>
        ))}
      </parts.Root>
      <p className="m-0 max-w-80 text-footnote text-foreground/70" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
