/* Plain functions over file paths and text: the Explorer's tree, the status bar's facts, and Search. */
import type { TreeNode } from '@/components/ui/tree';
import type { FileContent } from './runtime';

export const dirname = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';
export const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** Resolves `.` and `..` against a folder. */
export function resolvePath(cwd: string, path: string): string {
  const parts: string[] = [];
  for (const part of (path.startsWith('/') ? path : `${cwd}/${path}`).split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return `/${parts.join('/')}`;
}

/** A name a file can have: one path segment. */
export const isValidName = (name: string) => !!name.trim() && !/[/\0]/.test(name) && name !== '.' && name !== '..';

/** The folders above a path, nearest first, up to but not including `/`. */
export function ancestors(path: string): string[] {
  const out: string[] = [];
  for (let dir = dirname(path); dir !== '/'; dir = dirname(dir)) out.push(dir);
  return out;
}

/** What's in a folder, as the Tree wants it. `node_modules` and dotfiles read as secondary. */
export function buildTree(root: string, files: Iterable<string>, dirs: Iterable<string>): TreeNode[] {
  interface Folder { node: TreeNode; children: TreeNode[] }
  const top: TreeNode[] = [];
  const folders = new Map<string, Folder>();
  const prefix = `${root}/`;
  const place = (node: TreeNode, path: string) => {
    const parent = dirname(path);
    (parent === root ? top : folderAt(parent).children).push(node);
  };
  function folderAt(path: string): Folder {
    let folder = folders.get(path);
    if (!folder) {
      const children: TreeNode[] = [];
      const name = basename(path);
      const node: TreeNode = { id: path, name, children, ...(name === 'node_modules' || name.startsWith('.') ? { dimmed: true } : {}) };
      folder = { node, children };
      folders.set(path, folder);
      place(node, path);
    }
    return folder;
  }
  for (const dir of dirs) if (dir.startsWith(prefix)) folderAt(dir);
  for (const file of files) {
    if (!file.startsWith(prefix)) continue;
    const name = basename(file);
    place({ id: file, name, ...(name.startsWith('.') ? { dimmed: true } : {}) }, file);
  }
  return top;
}

/** The name a status bar gives a language id. */
const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript', jsx: 'JavaScript JSX', ts: 'TypeScript', tsx: 'TypeScript JSX', json: 'JSON', md: 'Markdown', mdx: 'MDX', css: 'CSS', scss: 'SCSS',
  html: 'HTML', bash: 'Shell Script', yaml: 'YAML', toml: 'TOML', python: 'Python', ruby: 'Ruby', rust: 'Rust', go: 'Go', text: 'Plain Text', svg: 'SVG', xml: 'XML',
  sql: 'SQL', diff: 'Diff', dockerfile: 'Dockerfile', makefile: 'Makefile', kotlin: 'Kotlin', swift: 'Swift', java: 'Java', c: 'C', cpp: 'C++', php: 'PHP',
};

export const languageName = (language: string) => LANGUAGE_NAMES[language] ?? language.toUpperCase();

export interface Indentation {
  kind: 'tabs' | 'spaces';
  size: number;
}

/** How a file is indented, from its lines: the smallest step between neighbouring indents that recurs most. */
export function detectIndentation(text: string): Indentation {
  let tabs = 0;
  let previous = 0;
  const steps = new Map<number, number>();
  for (const line of text.split('\n', 2000)) {
    if (!line.trim()) continue;
    if (line[0] === '\t') {
      tabs += 1;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    const step = Math.abs(indent - previous);
    if (step > 1) steps.set(step, (steps.get(step) ?? 0) + 1);
    previous = indent;
  }
  const spaces = [...steps.values()].reduce((sum, n) => sum + n, 0);
  if (tabs > spaces) return { kind: 'tabs', size: 4 };
  let best = 2;
  let count = 0;
  for (const [step, n] of steps) {
    if (n > count || (n === count && step < best)) {
      best = step;
      count = n;
    }
  }
  return { kind: 'spaces', size: best };
}

export const detectEol = (text: string): 'LF' | 'CRLF' => (text.includes('\r\n') ? 'CRLF' : 'LF');

/* ── Search ── */

export interface SearchOptions {
  matchCase?: boolean;
  regex?: boolean;
  /** Stop after this many matches. */
  limit?: number;
}

export interface SearchMatch {
  /** From 1. */
  line: number;
  /** UTF-16 units from 0. */
  column: number;
  length: number;
  /** The line it's on, trimmed to what's near the match. */
  preview: string;
  /** Where the match is in `preview`. */
  previewColumn: number;
}

export interface SearchFileResult {
  path: string;
  matches: SearchMatch[];
}

export interface SearchResults {
  files: SearchFileResult[];
  count: number;
  /** There were more than the limit. */
  limited: boolean;
  /** The query doesn't compile as a regular expression. */
  error?: string;
}

/** Not worth searching, as an editor's defaults say. */
export const isSearchable = (path: string) => !/(?:^|\/)(?:node_modules|\.git)(?:\/|$)/.test(path);

/** How much of a line to show before a match: the panel is narrow, and the match has to stay on screen. */
const PREVIEW_BEFORE = 12;
const PREVIEW_LENGTH = 160;

/** Where a preview of `line` starts, to show what's at `column`: a little before it, not in the middle of a word. */
function previewStart(line: string, column: number) {
  const indent = line.length - line.trimStart().length;
  let start = Math.max(indent, column - PREVIEW_BEFORE);
  while (start > indent && start < column && /\w/.test(line[start - 1]) && /\w/.test(line[start])) start += 1;
  while (start < column && /\s/.test(line[start])) start += 1;
  return Math.min(start, column);
}

const compile = (query: string, { matchCase, regex }: SearchOptions) =>
  new RegExp(regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');

/** Every match of `query` in the text files given, in order. */
export function searchFiles(files: Iterable<readonly [string, FileContent]>, query: string, options: SearchOptions = {}): SearchResults {
  const results: SearchResults = { files: [], count: 0, limited: false };
  if (!query) return results;
  const limit = options.limit ?? 2000;
  let pattern: RegExp;
  try {
    pattern = compile(query, options);
  } catch (error) {
    return { ...results, error: error instanceof Error ? error.message : String(error) };
  }
  const sorted = [...files].filter(([path, data]) => typeof data === 'string' && isSearchable(path)).sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [path, data] of sorted) {
    const text = data as string;
    let file: SearchFileResult | null = null;
    let lineStart = 0;
    let lineNumber = 1;
    pattern.lastIndex = 0;
    for (let hit = pattern.exec(text); hit; hit = pattern.exec(text)) {
      // A pattern that matches nothing would never move on.
      if (!hit[0]) {
        pattern.lastIndex += 1;
        if (pattern.lastIndex > text.length) break;
        continue;
      }
      if (results.count >= limit) {
        results.limited = true;
        return results;
      }
      while (true) {
        const next = text.indexOf('\n', lineStart);
        if (next < 0 || next >= hit.index) break;
        lineStart = next + 1;
        lineNumber += 1;
      }
      const lineEnd = text.indexOf('\n', hit.index);
      const line = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
      const column = hit.index - lineStart;
      const start = previewStart(line, column);
      file ??= { path, matches: [] };
      file.matches.push({
        line: lineNumber,
        column,
        length: hit[0].length,
        preview: line.slice(start, start + PREVIEW_LENGTH).trimEnd(),
        previewColumn: column - start,
      });
      results.count += 1;
    }
    if (file) results.files.push(file);
  }
  return results;
}
