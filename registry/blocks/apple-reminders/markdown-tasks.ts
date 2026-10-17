/* Task lists in Markdown, read and written by line. A file's `- [ ]` items are its reminders: headings group them
   into sections, a task indented under another is its subtask, and `#tags` are lifted out of the title. Each task
   keeps its line, so changing its state rewrites that one marker (`[ ]` → `[x]`, `[~]`, …) and nothing else. */
import { TASK_STATES, taskStateFromMarker } from '@brett_lamy/docstream/gitbook';

/** Docstream's task states: pending, in progress, implemented, blocked, parked, refuted, verified, cancelled. */
export type TaskState = (typeof TASK_STATES)[number]['id'];

export interface MarkdownTask {
  /** 0-based line number in the file. */
  line: number;
  /** The line as read: a write only goes ahead while the line still says this. */
  raw: string;
  state: TaskState;
  title: string;
  tags: string[];
  section?: string;
  subtasks: MarkdownTask[];
}

export interface MarkdownTaskList {
  /** The first `# Heading`, else the file name without its extension. */
  title: string;
  /** Section headings that have tasks under them, in order. */
  sections: string[];
  tasks: MarkdownTask[];
}

const TASK = /^(\s*)((?:[-*+]|\d+[.)])\s+)\[([^\]])\](\s+)(.*)$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const TAG = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;

/** States that count as done in Reminders (they leave Today and land in Completed). */
export const isDone = (state: TaskState) => state === 'verified' || state === 'cancelled';

export function scanTasks(markdown: string, fileName = 'Untitled.md'): MarkdownTaskList {
  const lines = markdown.split('\n');
  let title: string | undefined;
  let section: string | undefined;
  let fence: string | null = null;
  const tasks: MarkdownTask[] = [];
  const sections: string[] = [];
  // The open top-level task and its indent: deeper tasks under it are its subtasks.
  let parent: { task: MarkdownTask; indent: number } | null = null;
  let start = 0;
  // Front matter is properties, not tasks.
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l));
    if (end > 0) start = end + 1;
  }
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!.replace(/\r$/, '');
    const f = FENCE.exec(line);
    if (fence) { if (f && f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null; continue; }
    if (f) { fence = f[1]!; continue; }
    const h = HEADING.exec(line);
    if (h) {
      const text = h[2]!.trim();
      if (h[1] === '#' && title === undefined && !tasks.length) title = text;
      else section = text;
      parent = null;
      continue;
    }
    const m = TASK.exec(line);
    if (!m) { if (line.trim() && !/^\s/.test(line)) parent = null; continue; }
    const state = taskStateFromMarker(m[3]!) as TaskState | undefined;
    if (!state) continue;
    const tags: string[] = [];
    const text = m[5]!.replace(TAG, (_, lead: string, tag: string) => { tags.push(tag); return lead; }).replace(/\s+/g, ' ').trim();
    const task: MarkdownTask = { line: i, raw: lines[i]!, state, title: text || m[5]!.trim(), tags, section, subtasks: [] };
    const indent = m[1]!.replace(/\t/g, '    ').length;
    if (parent && indent > parent.indent) { parent.task.subtasks.push(task); continue; }
    tasks.push(task);
    parent = { task, indent };
    if (section && !sections.includes(section)) sections.push(section);
  }
  return { title: title ?? fileName.replace(/\.mdx?$/i, ''), sections, tasks };
}

/** Thrown when the file changed under a task since it was read. */
export class TaskMoved extends Error {
  constructor() { super('The task changed in its file. Showing the latest version.'); }
}

/** The line index holding `raw`: where it was, else the only other line that says the same. */
function locate(lines: string[], line: number, raw: string) {
  if (lines[line] === raw) return line;
  const found = lines.flatMap((l, i) => (l === raw ? [i] : []));
  if (found.length === 1) return found[0]!;
  throw new TaskMoved();
}

/** Sets one task's state in the file's text. */
export function setTaskState(markdown: string, task: Pick<MarkdownTask, 'line' | 'raw'>, state: TaskState) {
  const lines = markdown.split('\n');
  const at = locate(lines, task.line, task.raw);
  const marker = TASK_STATES.find((s) => s.id === state)?.marker ?? ' ';
  lines[at] = lines[at]!.replace(TASK, (_, indent: string, bullet: string, _old: string, gap: string, rest: string) => `${indent}${bullet}[${marker}]${gap}${rest}`);
  return lines.join('\n');
}

/** Renames a task, keeping its marker, indent and tags. */
export function setTaskTitle(markdown: string, task: Pick<MarkdownTask, 'line' | 'raw' | 'tags'>, title: string) {
  const lines = markdown.split('\n');
  const at = locate(lines, task.line, task.raw);
  const tags = task.tags.map((t) => ` #${t}`).join('');
  lines[at] = lines[at]!.replace(TASK, (_, indent: string, bullet: string, marker: string, gap: string) => `${indent}${bullet}[${marker}]${gap}${title.replace(/\n/g, ' ')}${tags}`);
  return lines.join('\n');
}

/** Removes a task and its subtasks. */
export function removeTask(markdown: string, task: Pick<MarkdownTask, 'line' | 'raw'> & { subtasks: readonly unknown[] }) {
  const lines = markdown.split('\n');
  const at = locate(lines, task.line, task.raw);
  lines.splice(at, 1 + task.subtasks.length);
  return lines.join('\n');
}

/** Adds `- [ ] title` after the last task of `section` (or of the file), else under the section's heading, else at the end. */
export function addTask(markdown: string, title: string, section?: string) {
  const list = scanTasks(markdown);
  const lines = markdown.split('\n');
  const entry = `- [ ] ${title.replace(/\n/g, ' ')}`;
  const peers = list.tasks.filter((t) => (section ? t.section === section : true));
  const last = peers.at(-1);
  if (last) {
    const after = (last.subtasks.at(-1) ?? last).line;
    lines.splice(after + 1, 0, entry);
    return lines.join('\n');
  }
  if (section) {
    const heading = lines.findIndex((l) => HEADING.exec(l)?.[2]?.trim() === section);
    if (heading >= 0) { lines.splice(heading + 1, 0, '', entry); return lines.join('\n'); }
  }
  const body = markdown.replace(/\s*$/, '');
  return `${body}${body ? '\n\n' : ''}${entry}\n`;
}
