/* @internal Reading a command line, in the few ways the sandbox's Worker needs to. */

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
