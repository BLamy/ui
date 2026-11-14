import {
  announce,
  bindDrag,
  bindDragPreview,
  createAutoScroll,
  createChange,
  definePrimitive,
  dragThreshold,
  type ChangeDetails,
} from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';

type TaggerState = { value: string[]; over: boolean };
type TaggerReason = 'drag' | 'item-press' | 'remove-press';
type TaggerOptions = { onValueChange?: (value: string[], details: ChangeDetails<TaggerReason>) => void };

/* A drag of your own, built from the pieces the sorting behaviors use: bindDrag follows the pointer past
   dragThreshold (Escape cancels), bindDragPreview puts a copy of the tag above the page while the original stays,
   createAutoScroll scrolls the tag tray when the pointer nears its edge, and announce says what happened. Enter on a
   focused tag does the same thing without a pointer, so the drag is never the only way. */
const tagger = definePrimitive({
  name: 'tagger',
  options: { onValueChange: 'callback' },
  state: (_options: TaggerOptions): TaggerState => ({ value: [], over: false }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const add = (tag: string, details: { reason: TaggerReason; event?: Event }) => {
      if (store.get().value.includes(tag)) return false;
      const ok = change('value', [...store.get().value, tag], details);
      if (ok) announce(`${tag} added to Launch plan`);
      return ok;
    };
    let stop: (() => void) | undefined;
    context.onDestroy(() => stop?.());
    return {
      add: (tag: string) => add(tag, { reason: 'item-press' }),
      remove: (tag: string, event?: Event) =>
        change('value', store.get().value.filter((t) => t !== tag), { reason: 'remove-press', event }),
      pointerdown(event: PointerEvent, el: HTMLElement, tag: string) {
        if (event.button !== 0) return;
        const note = context.element('note');
        const inside = (x: number, y: number) => {
          const box = note?.getBoundingClientRect();
          return !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
        };
        let preview: ReturnType<typeof bindDragPreview> | undefined;
        const scroll = createAutoScroll({ edge: 32, speed: 12, ignore: () => preview?.el });
        stop?.();
        stop = bindDrag(el, event, {
          threshold: dragThreshold,
          cancelOnEscape: true,
          onStart: () => {
            preview = bindDragPreview(el, { x: event.clientX, y: event.clientY });
          },
          onMove: ({ x, y }) => {
            const over = inside(x, y);
            preview?.move(x, y);
            preview?.el.toggleAttribute('data-over', over);
            scroll.update(x, y);
            if (over !== store.get().over) store.set({ over });
          },
          onEnd: (end, canceled) => {
            const { over } = store.get();
            preview?.remove();
            scroll.stop();
            stop = undefined;
            store.set({ over: false });
            if (preview && over && !canceled) add(tag, { reason: 'drag', event: end });
          },
        });
      },
      keydown(event: KeyboardEvent, tag: string) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        add(tag, { reason: 'item-press', event });
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, { tags: string[] }>({ state: (state) => ({ tags: state.value }) }),
    tag: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, { key }) => ({ type: 'button', 'data-selected': state.value.includes(key) ? '' : undefined }),
      on: {
        pointerdown: (event, { el, api, key }) => api.pointerdown(event, el!, key),
        keydown: (event, { api, key }) => api.keydown(event, key),
      },
    }),
    note: slot({ attrs: (state) => ({ role: 'group', 'data-over': state.over ? '' : undefined }) }),
  }),
  agent: { actions: ['add', 'remove'] },
});

const parts = createParts(tagger, { root: 'div', tag: 'button', note: 'div' });

const TAGS = ['Urgent', 'Design', 'Later', 'Docs', 'Research', 'Bug', 'Q3', 'Blocked'];

export default function DragPreviewDemo() {
  return (
    <parts.Root className="mx-auto grid w-full max-w-md gap-3">
      {({ tags }) => (
        <>
          <div aria-label="Tags" role="group" className="flex gap-1.5 overflow-x-auto rounded-panel bg-secondary p-1.5">
            {TAGS.map((tag) => (
              <parts.Tag
                key={tag}
                value={tag}
                className="h-8 shrink-0 cursor-grab touch-none rounded-full border-0 bg-card px-3 text-footnote font-semibold text-foreground shadow-hairline outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/45 data-selected:text-foreground/70 data-[over]:ring-2 data-[over]:ring-primary"
              >
                {tag}
              </parts.Tag>
            ))}
          </div>
          <parts.Note
            aria-label="Launch plan"
            className="grid min-h-24 content-start gap-2 rounded-card bg-card p-4 shadow-hairline data-[over]:ring-2 data-[over]:ring-primary"
          >
            <span className="text-subhead font-semibold text-foreground">Launch plan</span>
            <div className="flex flex-wrap gap-1.5">
              {tags.length ? (
                tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-secondary px-2.5 py-0.5 text-caption font-semibold text-secondary-foreground">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-footnote text-foreground/70">Drag a tag here, or focus one and press Enter.</span>
              )}
            </div>
          </parts.Note>
        </>
      )}
    </parts.Root>
  );
}
