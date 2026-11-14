'use client';
import {
  useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type ComponentProps, type KeyboardEvent, type ReactNode, type Ref,
} from 'react';
import { createInputHistory, createLocalStorage } from '@ui-sdk/core';
import { Textarea, createInputController, type TextareaOptions } from '@ui-sdk/react/textarea';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { sqlSpans, type SqlSpan } from '@/lib/sql-lex';
import type { SqlError } from '@/lib/pglite-core';

/* ══ SqlEditor — a SQL box on UI SDK's Textarea ══
   A native <textarea> sits over a highlighted copy of its own text, so selection, IME, undo, spell-check off,
   accessibility and mobile keyboards are the browser's and nothing heavy (no CodeMirror / Monaco, ~1 MB) ships.
   Highlighting is lib/sql-lex: keywords, types, functions, strings (incl. $$ bodies), numbers and comments, computed
   synchronously. An `error` with a position underlines the offending token.

   ⌘ + Enter (Ctrl + Enter off Apple platforms: the Textarea's `mod+enter` submit shortcut) runs the selection, or
   everything when nothing is selected. ↑ on the first line and ↓ on the last step through `history` with UI SDK's
   `createInputHistory`, like a terminal: ↓ past the newest brings your draft back. Tab keeps its job of moving
   focus (indenting would trap keyboard users).
   `ref` exposes `focus()` and `insert(text)` (at the cursor), which is how SchemaTree pastes a table name in. */

export const sqlEditorVariants = cva(
  'flex min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline transition-shadow duration-spring-snappy ease-spring-snappy focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset',
  {
    variants: {
      size: {
        default: '[--editor-rows:8]',
        sm: '[--editor-rows:4]',
        lg: '[--editor-rows:14]',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

/** Same metrics on the textarea and its highlighted copy, or the two drift apart. */
const metrics = 'box-border m-0 border-0 px-3 py-2.5 font-mono text-footnote leading-5 [tab-size:2] whitespace-pre';

export interface SqlEditorHandle {
  focus: () => void;
  /** Inserts text at the cursor (replacing the selection) and focuses the editor. */
  insert: (text: string) => void;
}

export interface SqlEditorProps extends Omit<ComponentProps<'div'>, 'children' | 'defaultValue' | 'ref'>, VariantProps<typeof sqlEditorVariants> {
  value?: string;
  defaultValue?: string;
  /** Every change to the text, with the Textarea's `details`: typing is `input-change`; a history step and
      `insert()` are `imperative`. Canceling a history step leaves the text and the arrow key to the browser. */
  onValueChange?: TextareaOptions['onValueChange'];
  /** ⌘/Ctrl + Enter, or the Run button. Receives the selection, or the whole text. */
  onRun?: (sql: string) => void;
  /** A statement is running: Run is disabled and reads "Running…". */
  running?: boolean;
  /** Earlier statements, newest first (see `useSqlHistory`); ↑ on the first line and ↓ on the last step through them. */
  history?: readonly string[];
  /** Underlines `error.position` in the text. */
  error?: Pick<SqlError, 'position'> | null;
  /** Highlight SQL (default true; skipped past 200k characters). */
  highlight?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  /** Extra controls in the footer, before Run. */
  actions?: ReactNode;
  /** `false` hides the footer (Run button and shortcut hint). */
  footer?: boolean;
  runLabel?: string;
  'aria-label'?: string;
  ref?: Ref<SqlEditorHandle>;
}

const HIGHLIGHT_LIMIT = 200_000;

const SQUIGGLE = 'underline decoration-destructive decoration-wavy decoration-from-font underline-offset-2';

type Segment = { text: string; className?: string };

/** The source cut at every span and error boundary, each piece with its token class (and the squiggle on the error). */
function segmentsOf(code: string, spans: readonly SqlSpan[], errorAt: number | null): Segment[] {
  let errStart = -1;
  let errEnd = -1;
  if (errorAt !== null && errorAt >= 0 && errorAt < code.length) {
    const word = /^[\w$\u0080-￿]+/.exec(code.slice(errorAt));
    errStart = errorAt;
    errEnd = errorAt + (word ? word[0].length : 1);
  }
  const cuts = new Set<number>([0, code.length]);
  for (const s of spans) {
    cuts.add(s.start);
    cuts.add(s.end);
  }
  if (errStart >= 0) {
    cuts.add(errStart);
    cuts.add(Math.min(errEnd, code.length));
  }
  const bounds = [...cuts].filter((n) => n >= 0 && n <= code.length).sort((a, b) => a - b);
  const out: Segment[] = [];
  let k = 0; // index of the first span that may still cover the current piece
  for (let i = 0; i + 1 < bounds.length; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    while (k < spans.length && spans[k].end <= a) k++;
    const span = k < spans.length && spans[k].start <= a ? spans[k] : undefined;
    const bad = a >= errStart && b <= errEnd && errStart >= 0;
    out.push({ text: code.slice(a, b), className: cn(span && `bl-tok bl-tok-${span.type}`, bad && SQUIGGLE) || undefined });
  }
  return out;
}

export function SqlEditor({
  value: valueProp, defaultValue = '', onValueChange, onRun, running = false, history, error, highlight = true, placeholder,
  disabled, readOnly, autoFocus, actions, footer = true, runLabel = 'Run', size, className, style, ref,
  'aria-label': ariaLabel = 'SQL', ...props
}: SqlEditorProps) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : inner;
  // Writes from here (a history step, `insert`) go through the Textarea's controller, so they reach
  // `onValueChange` like typing does.
  const [input] = useState(createInputController);
  const setValue = useCallback((v: string) => { input.setValue(v); }, [input]);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLPreElement>(null);
  const syncScroll = useCallback(() => {
    const a = areaRef.current;
    if (a && layerRef.current) layerRef.current.style.translate = `${-a.scrollLeft}px ${-a.scrollTop}px`;
  }, []);

  useImperativeHandle(ref, () => ({
    focus: () => areaRef.current?.focus(),
    insert: (text: string) => {
      const a = areaRef.current;
      if (!a) return;
      const from = a.selectionStart ?? a.value.length;
      const to = a.selectionEnd ?? from;
      const next = a.value.slice(0, from) + text + a.value.slice(to);
      setValue(next);
      requestAnimationFrame(() => {
        a.focus();
        a.setSelectionRange(from + text.length, from + text.length);
      });
    },
  }), [setValue]);

  // History: ArrowUp on the first line goes back, ArrowDown on the last goes forward and past the newest returns
  // the draft. `createInputHistory` takes the entries oldest first and leaves modified, composing, selecting,
  // read-only and expanded-popup key presses alone.
  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; }, [history]);
  const [recall] = useState(() => createInputHistory<string>({
    entries: () => (historyRef.current ? [...historyRef.current].reverse() : undefined),
    read: () => areaRef.current?.value ?? '',
    // Textarea's reasons have no `history-key` yet (gaps/r2-leaf.md), so a step is the controller's `imperative`,
    // which takes no event. `setValue` reports false for an unchanged value too, which is still a step.
    write: (v) => input.setValue(v) || areaRef.current?.value === v,
  }));

  const run = () => {
    const a = areaRef.current;
    if (!a || running || !onRun) return;
    const selected = a.selectionStart !== a.selectionEnd ? a.value.slice(a.selectionStart, a.selectionEnd) : '';
    const sql = (selected || a.value).trim();
    if (sql) onRun(sql);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    recall.keydown(e.nativeEvent);
  };

  const spans = useMemo(() => (highlight && value.length <= HIGHLIGHT_LIMIT ? sqlSpans(value) : []), [highlight, value]);
  const errorAt = error?.position ? error.position - 1 : null;
  const segments = useMemo(() => segmentsOf(value, spans, errorAt), [value, spans, errorAt]);

  return (
    <div
      data-slot="sql-editor"
      data-disabled={disabled || undefined}
      data-running={running || undefined}
      className={cn(sqlEditorVariants({ size }), className)}
      style={style}
      {...props}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* The highlighted copy: decoration, not content (the textarea is what assistive tech reads). */}
        <pre
          ref={layerRef}
          aria-hidden="true"
          data-slot="sql-editor-highlight"
          className={cn(metrics, 'pointer-events-none absolute top-0 left-0 min-w-full text-card-foreground')}
        >
          {segments.map((s, i) => (s.className ? <span key={i} className={s.className}>{s.text}</span> : s.text))}
          {'\n'}
        </pre>
        <Textarea
          ref={areaRef}
          controller={input}
          aria-label={ariaLabel}
          value={value}
          onValueChange={(next, details) => {
            onValueChange?.(next, details);
            if (details.canceled) return;
            if (!controlled) setInner(next);
          }}
          submitShortcut="mod+enter"
          onSubmit={run}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          className={cn(
            metrics,
            'bl-scroll relative block h-[calc(var(--editor-rows)*1.25rem+1.25rem)] w-full resize-none overflow-auto bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/25 placeholder:text-foreground/65',
            selectableText,
          )}
        />
      </div>

      {footer ? (
        // The footer is its own container: the hint shows once the editor (not the window) has room for it.
        <div data-slot="sql-editor-footer" className="@container/sql-footer flex shrink-0 items-center gap-2 px-2 py-1.5 shadow-hairline-t">
          <KbdGroup className="hidden min-w-0 flex-1 text-caption text-foreground/65 @md/sql-footer:inline-flex">
            <Kbd keys="mod+enter" />
            <span className="truncate">runs the selection, or everything</span>
            {history?.length ? (
              <>
                <Kbd keys="arrowup" />
                <span className="truncate">history</span>
              </>
            ) : null}
          </KbdGroup>
          <span className="flex-1 @md/sql-footer:hidden" />
          {actions}
          {/* Ink on paper rather than white on the accent blue: 3.7:1 fails WCAG AA for a button this size. */}
          <Button size="sm" className="bg-foreground text-background" disabled={disabled || running || !onRun || !value.trim()} onClick={run}>
            {running ? 'Running…' : runLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ── History ── */

export interface SqlHistory {
  /** Newest first. */
  entries: string[];
  /** Records a statement run (blank ones and a repeat of the newest are skipped). */
  push: (sql: string) => void;
  clear: () => void;
}

const parseEntries = (raw: string | null, max: number): string[] => {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, max) : [];
  } catch {
    return []; // a corrupt value: start empty
  }
};

/** Statements you ran, newest first. Pass a `key` to keep them in localStorage (UI SDK's `createLocalStorage`): they
    last across reloads and follow other tabs' runs. Read after mount, so it is SSR safe. */
export function useSqlHistory(key?: string, max = 50): SqlHistory {
  const storage = useMemo(() => (key ? createLocalStorage(key) : undefined), [key]);
  const [entries, setEntries] = useState<string[]>([]);
  // The newest list, for writes that land before React re-renders (two runs in one tick).
  const latest = useRef<string[]>([]);
  useEffect(() => {
    if (!storage) return;
    const load = (raw: string | null) => {
      const next = parseEntries(raw, max);
      if (JSON.stringify(next) === JSON.stringify(latest.current)) return;
      latest.current = next;
      setEntries(next);
    };
    load(storage.get());
    return storage.subscribe(load);
  }, [storage, max]);
  const commit = useCallback((next: string[]) => {
    latest.current = next;
    setEntries(next);
    if (!storage) return;
    if (next.length) storage.set(JSON.stringify(next));
    else storage.remove();
  }, [storage]);
  const push = useCallback((sql: string) => {
    const s = sql.trim();
    const prev = latest.current;
    if (!s || prev[0] === s) return;
    commit([s, ...prev.filter((p) => p !== s)].slice(0, max));
  }, [max, commit]);
  const clear = useCallback(() => commit([]), [commit]);
  return { entries, push, clear };
}
