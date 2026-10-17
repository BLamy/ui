import { describe, expect, it } from 'vitest';
import { addTask, removeTask, scanTasks, setTaskState, setTaskTitle, TaskMoved } from './markdown-tasks';

const DOC = `---
status: draft
---
# Case build

Some prose.

- [ ] Print the back #print
- [x] Order magnets
  - [ ] M3 inserts
  - [~] Hinge pins

## Wiring

1. [b] Solder the display
* [-] Try the other panel

\`\`\`md
- [ ] not a task
\`\`\`

- a plain bullet
- [?] Measure current draw
`;

describe('scanTasks', () => {
  const list = scanTasks(DOC, 'README.md');
  it('takes the title from the first heading and groups tasks under sections', () => {
    expect(list.title).toBe('Case build');
    expect(list.sections).toEqual(['Wiring']);
    expect(list.tasks.map((t) => [t.title, t.state, t.section])).toEqual([
      ['Print the back', 'pending', undefined],
      ['Order magnets', 'verified', undefined],
      ['Solder the display', 'blocked', 'Wiring'],
      ['Try the other panel', 'cancelled', 'Wiring'],
      ['Measure current draw', 'implemented', 'Wiring'],
    ]);
  });
  it('reads every docstream state, nested subtasks and tags, and skips code fences and front matter', () => {
    expect(list.tasks[0]!.tags).toEqual(['print']);
    expect(list.tasks[1]!.subtasks.map((s) => [s.title, s.state])).toEqual([['M3 inserts', 'pending'], ['Hinge pins', 'in-progress']]);
    expect(list.tasks.some((t) => t.title === 'not a task')).toBe(false);
  });
  it('falls back to the file name', () => {
    expect(scanTasks('- [ ] a', 'todo.md').title).toBe('todo');
  });
});

describe('writing tasks back', () => {
  const list = scanTasks(DOC);
  const print = list.tasks[0]!;
  it('changes only the marker', () => {
    const next = setTaskState(DOC, print, 'parked');
    expect(next.split('\n')[print.line]).toBe('- [d] Print the back #print');
    expect(next.replace('[d] Print', '[ ] Print')).toBe(DOC);
    expect(setTaskState(DOC, list.tasks[2]!, 'verified')).toContain('1. [x] Solder the display');
  });
  it('follows a task that moved, and refuses one that changed', () => {
    const moved = `New line\n${DOC}`;
    expect(setTaskState(moved, print, 'verified')).toContain('- [x] Print the back #print');
    expect(() => setTaskState(DOC.replace('Print the back', 'Print it'), print, 'verified')).toThrow(TaskMoved);
  });
  it('renames, removes and adds', () => {
    expect(setTaskTitle(DOC, print, 'Print the lid')).toContain('- [ ] Print the lid #print');
    const removed = removeTask(DOC, list.tasks[1]!);
    expect(removed).not.toContain('Order magnets');
    expect(removed).not.toContain('M3 inserts');
    const added = addTask(DOC, 'Buy screws', 'Wiring');
    expect(scanTasks(added).tasks.find((t) => t.title === 'Buy screws')?.section).toBe('Wiring');
    expect(addTask('# Empty\n', 'First')).toBe('# Empty\n\n- [ ] First\n');
  });
});
