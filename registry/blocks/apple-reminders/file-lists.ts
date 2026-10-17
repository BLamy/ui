/* Markdown files as Reminders lists: every file with at least one task is a list (named by its first heading, else
   the file name), its headings are the sections, and each task is a reminder whose state is its marker. */
import { COLORS, type Reminder, type RList } from './data';
import { isDone, scanTasks, type MarkdownTask } from './markdown-tasks';
import type { TaskRoot } from './use-task-files';

/** A stable color per file, from the Reminders palette. */
function colorFor(path: string) {
  let h = 0;
  for (const c of path) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length]!;
}

export const fileListId = (path: string) => `md:${path}`;

const sourceOf = (path: string, t: MarkdownTask) => ({
  path, line: t.line, raw: t.raw, tags: t.tags, subtasks: t.subtasks.map((s) => ({ line: s.line, raw: s.raw })),
});

export function fileLists(files: Map<string, string>, roots: TaskRoot[]) {
  const lists: RList[] = [];
  const items: Reminder[] = [];
  for (const [path, body] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const root = roots.find((r) => path.startsWith(`${r.path}/`));
    if (!root || !body.includes('[')) continue;
    const scanned = scanTasks(body, path.slice(path.lastIndexOf('/') + 1));
    if (!scanned.tasks.length) continue;
    const list = fileListId(path);
    lists.push({ id: list, name: scanned.title, color: colorFor(path), glyph: 'checklist', sections: scanned.sections, file: { path, root: root.path } });
    for (const t of scanned.tasks) {
      const id = `${list}:${t.line}`;
      items.push({
        id, list, title: t.title, state: t.state, done: isDone(t.state), section: t.section, source: sourceOf(path, t),
        ...(t.tags.length ? { tags: t.tags } : {}),
        ...(t.subtasks.length ? {
          subtasks: t.subtasks.map((s) => ({ id: `${list}:${s.line}`, title: s.title, state: s.state, done: isDone(s.state), source: sourceOf(path, s) })),
        } : {}),
      });
    }
  }
  return { lists, items };
}
