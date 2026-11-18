import { useState } from 'react';
import {
  createFocusRecovery,
  createRovingFocus,
  createTypeahead,
  definePrimitive,
  isTypeaheadKey,
  labelOf,
  selects,
} from '@brett_lamy/ui/sdk/core';
import { createParts } from '@brett_lamy/ui/sdk/react/primitive';
import { Button } from '@/components/ui/button';

type TasksState = { focused: string | null };
type TaskProps = { value: string; index: number };

/* A list with one tab stop (Up/Down/Home/End), typeahead (type the first letters of a task), and focus recovery:
   when the focused task is removed, focus goes to the task that took its place, or to the last one. */
const taskList = definePrimitive({
  name: 'task-list',
  state: (): TasksState => ({ focused: null }),
  api: (context) => {
    const roving = createRovingFocus<TasksState, TaskProps>(context, { slot: 'task', key: 'focused' });
    const typeahead = createTypeahead();
    const recovery = createFocusRecovery<TaskProps>({
      fallback: (lost) => {
        const items = roving.items();
        return (items[lost.props.index] ?? items.at(-1))?.el;
      },
    });
    return {
      roving,
      recovery,
      keydown(event: KeyboardEvent, el: HTMLElement) {
        if (event.defaultPrevented || roving.keydown(event, el) || !isTypeaheadKey(event)) return;
        if (event.key === ' ' && typeahead.active()) event.preventDefault();
        const items = roving.items();
        const index = typeahead(
          event.key,
          items.map((item) => labelOf(item.el)),
          items.findIndex((item) => item.el === el),
        );
        if (index !== -1) roving.focus(items[index].key);
      },
    };
  },
  slots: (slot) => ({
    root: slot({ attrs: () => ({ role: 'list' }) }),
    task: slot<TaskProps>({
      props: { value: 'string', index: 'number' },
      selects: selects({ focused: ({ key }) => [key, null] }),
      attrs: (state, part) => ({ role: 'listitem', tabindex: part.api.roving.tabIndex(state, part) }),
      on: { keydown: (event, { el, api }) => api.keydown(event, el!) },
      bind: (el, part) => {
        const cleanups = [part.api.roving.bind(el, part), part.api.recovery.bind(el, part)];
        return () => cleanups.forEach((cleanup) => cleanup?.());
      },
    }),
  }),
  // Focus only: the tasks themselves belong to the page.
  agent: { actions: [] },
});

const parts = createParts(taskList, { root: 'div', task: 'div' });

const START = ['Draft the release notes', 'Fix the flaky test', 'Plan the offsite', 'Review the design', 'Rename the repo', 'Write the changelog'];

export default function TaskListDemo() {
  const [tasks, setTasks] = useState(START);
  const remove = (task: string) => setTasks((list) => list.filter((t) => t !== task));
  return (
    <div className="mx-auto grid w-full max-w-sm gap-3">
      <parts.Root aria-label="Tasks" className="grid overflow-hidden rounded-panel bg-card shadow-hairline">
        {tasks.map((task, index) => (
          <parts.Task
            key={task}
            value={task}
            index={index}
            onKeyDown={(event) => {
              if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                remove(task);
              }
            }}
            className="flex h-row items-center px-4 text-body text-foreground shadow-hairline-b outline-none last:shadow-none focus-visible:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset"
          >
            {task}
          </parts.Task>
        ))}
        {tasks.length ? null : <p className="m-0 px-4 py-3 text-footnote text-foreground/70">All done.</p>}
      </parts.Root>
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-footnote text-foreground/70">Press R to cycle the R tasks; Delete removes one.</p>
        <Button variant="secondary" size="sm" onClick={() => setTasks(START)}>
          Reset
        </Button>
      </div>
    </div>
  );
}
