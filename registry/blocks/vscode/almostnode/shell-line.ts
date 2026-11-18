/* A command line, as the terminal's Tab and the Run panel read it. (The Sandbox library reads it to run it.) */
import { resolvePath } from '../files';

/** The command line that runs a script. */
export const npmScriptCommand = (name: string) => `npm run ${/^[\w:.-]+$/.test(name) ? name : JSON.stringify(name)}`;

/* ── Tab ── */

/** The first word of a line: what it can run even with no program installed. */
const COMMANDS = [
  'awk', 'cat', 'cd', 'clear', 'cp', 'cut', 'date', 'diff', 'echo', 'env', 'exit', 'export', 'find', 'git', 'grep', 'head', 'ls', 'mkdir', 'mv', 'node', 'npm', 'npx', 'printf', 'pwd',
  'opencode', 'rm', 'rmdir', 'sed', 'seq', 'sleep', 'sort', 'tail', 'tee', 'touch', 'tr', 'uniq', 'wc', 'which', 'xargs',
];

/** Candidates for a path being typed: whole replacements for `word`, folders ending in `/`. */
export function completePath(word: string, cwd: string, files: Iterable<string>, dirs: Iterable<string>): string[] {
  const slash = word.lastIndexOf('/');
  const lead = slash >= 0 ? word.slice(0, slash + 1) : '';
  const stem = slash >= 0 ? word.slice(slash + 1) : word;
  const folder = resolvePath(cwd, lead || '.');
  const prefix = folder === '/' ? '/' : `${folder}/`;
  const out: string[] = [];
  const add = (path: string, suffix: string) => {
    if (!path.startsWith(prefix)) return;
    const rest = path.slice(prefix.length);
    if (rest.includes('/') || !rest.startsWith(stem)) return;
    if (rest.startsWith('.') && !stem.startsWith('.')) return;
    out.push(lead + rest + suffix);
  };
  for (const dir of dirs) add(dir, '/');
  for (const file of files) add(file, '');
  return out.sort();
}

export interface CommandLineContext {
  word: string;
  line: string;
  cursor: number;
  cwd: string;
  files: Iterable<string>;
  dirs: Iterable<string>;
  /** Where installed programs are, ending in `/`. */
  bin: string;
  scripts: () => string[];
}

/** What Tab offers: scripts after `npm run`, commands as the first word, else paths. */
export function completeCommandLine({ word, line, cursor, cwd, files, dirs, bin, scripts }: CommandLineContext): string[] {
  const before = line.slice(0, cursor - word.length);
  if (/^\s*npm\s+(?:run|run-script)\s+$/.test(before)) return scripts().filter((name) => name.startsWith(word));
  if (before.trim() || word.includes('/')) return completePath(word, cwd, files, dirs);
  const programs: string[] = [];
  for (const path of files) if (path.startsWith(bin)) programs.push(path.slice(bin.length));
  return [...new Set([...COMMANDS, ...programs])].filter((name) => name.startsWith(word)).sort();
}
