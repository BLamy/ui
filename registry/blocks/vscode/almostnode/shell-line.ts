/* Reading a command line, in the few ways this runtime needs to. */
import { resolvePath } from '../files';

export interface LineSegment {
  line: string;
  /** Whether it runs depends on how the one before it went. */
  when: 'always' | 'ok' | 'fail';
}

const KEYWORD = /^(?:if|for|while|until|case|function|select|time|coproc|\{|\(|!)(?:\s|$)/;

/** Splits `a && b; c` into the commands to run one after another. The runtime prints what a Node script logs as it
 *  happens but what `echo` prints only when the whole line ends, so `echo a; node b.js` would print out of order; run
 *  apart, they don't. Anything that isn't a plain list stays whole: a subshell, a substitution, a loop, a `$?`. */
export function splitCommandLine(line: string): LineSegment[] {
  const whole = [{ line, when: 'always' as const }];
  if (line.includes('$?')) return whole;
  const segments: LineSegment[] = [];
  let quote: '"' | "'" | null = null;
  let start = 0;
  let when: LineSegment['when'] = 'always';
  const push = (end: number) => {
    const text = line.slice(start, end).trim();
    if (text) segments.push({ line: text, when });
  };
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    const n = line[i + 1];
    if (c === '\\' && quote !== "'") { i += 1; continue; }
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === ')' || c === '{' || c === '}' || c === '`' || c === '\n') return whole;
    if (c === '$' && n === '(') return whole;
    if (c === '<' && n === '<') return whole;
    if (c === '&' && n === '&') {
      push(i);
      when = 'ok';
      start = i + 2;
      i += 1;
    } else if (c === '|' && n === '|') {
      push(i);
      when = 'fail';
      start = i + 2;
      i += 1;
    } else if (c === ';') {
      if (n === ';') return whole;
      push(i);
      when = 'always';
      start = i + 1;
    } else if (c === '&' && line[i - 1] !== '>' && n !== '>') {
      // A background job.
      return whole;
    }
  }
  if (quote) return whole;
  push(line.length);
  if (!segments.length) return whole;
  return segments.some((s) => KEYWORD.test(s.line)) ? whole : segments;
}

/** `npm run x`, `npm test` and `npm start`: the script's name. */
export function npmScriptOf(line: string): string | null {
  const m = /^npm\s+(?:(?:run|run-script)\s+([^\s-][^\s]*)|(test|t|tst|start))\s*$/.exec(line.trim());
  if (!m) return null;
  return m[1] ?? (m[2] === 'start' ? 'start' : 'test');
}

export interface NpmInstall {
  packages: string[];
  dev: boolean;
}

/** `npm install lodash -D`, or null for anything else (including a line with shell syntax in it). */
export function npmInstallOf(line: string): NpmInstall | null {
  const words = line.trim().split(/\s+/);
  if (words[0] !== 'npm' || !['install', 'i', 'add'].includes(words[1])) return null;
  const rest = words.slice(2);
  if (rest.some((w) => /[|&;<>()$`"'\\*?]/.test(w))) return null;
  return {
    packages: rest.filter((w) => !w.startsWith('-')),
    dev: rest.some((w) => w === '-D' || w === '--save-dev'),
  };
}

export interface PackageManifest {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
}

/** What npm prints above a script's output. */
export function npmScriptHeader(manifest: PackageManifest, script: string): string | null {
  const command = manifest.scripts?.[script];
  if (!command) return null;
  return `\n> ${manifest.name ?? ''}@${manifest.version ?? ''} ${script}\n> ${command}\n\n`;
}

/** What's left of `final` once `streamed`, already shown, comes out of it. */
export function unstreamed(final: string, streamed: string): string {
  if (!streamed) return final;
  if (final === streamed) return '';
  const at = final.indexOf(streamed);
  return at < 0 ? '' : final.slice(0, at) + final.slice(at + streamed.length);
}

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
