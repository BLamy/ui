'use client';
import {
  useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type ComponentProps, type KeyboardEvent, type ReactNode, type Ref,
} from 'react';
import { TextArea as AriaTextArea } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { sqlSpans, type SqlSpan } from '@/lib/sql-lex';
import type { SqlError } from '@/lib/pglite-core';

/* ══ SqlEditor — a SQL box on react-aria's TextArea ══
   A plain <textarea> sits over a highlighted copy of its own text, so selection, IME, undo, spell-check off,
   accessibility and mobile keyboards are the browser's and nothing heavy (no CodeMirror / Monaco, ~1 MB) ships.
   Highlighting is lib/sql-lex: keywords, types, functions, strings (incl. $$ bodies), numbers and comments, computed
   synchronously. An `error` with a position underlines the offending token.

   ⌘/Ctrl + Enter runs the selection, or everything when nothing is selected. ⌥↑ / ⌥↓ step through `history` (Esc
   brings your draft back). Tab keeps its job of moving focus (indenting would trap keyboard users).
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

export interface SqlEditorProps extends Omit<ComponentProps<'div'>, 'children' | 'onChange' | 'defaultValue' | 'ref'>, VariantProps<typeof sqlEditorVariants> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** ⌘/Ctrl + Enter, or the Run button. Receives the selection, or the whole text. */
  onRun?: (sql: string) => void;
  isRunning?: boolean;
  /** Earlier statements, newest first (see `useSqlHistory`); ⌥↑ / ⌥↓ steps through them. */
  history?: readonly string[];
  /** Underlines `error.position` in the text. */
  error?: Pick<SqlError, 'position'> | null;
  /** Highlight SQL (default true; skipped past 200k characters). */
  highlight?: boolean;
  placeholder?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
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
  value: valueProp, defaultValue = '', onChange, onRun, isRunning = false, history, error, highlight = true, placeholder,
  isDisabled, isReadOnly, autoFocus, actions, footer = true, runLabel = 'Run', size, className, style, ref,
  'aria-label': ariaLabel = 'SQL', ...props
}: SqlEditorProps) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : inner;
  const setValue = useCallback((v: string) => {
    if (!controlled) setInner(v);
    onChange?.(v);
  }, [controlled, onChange]);

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

  // History: ⌥↑ goes back, ⌥↓ forward, Esc returns to the draft.
  const cursor = useRef(-1);
  const draft = useRef('');
  const step = (dir: 1 | -1) => {
    if (!history?.length) return;
    const next = cursor.current + dir;
    if (next < -1 || next >= history.length) return;
    if (cursor.current === -1) draft.current = value;
    cursor.current = next;
    setValue(next === -1 ? draft.current : history[next]);
  };

  const run = () => {
    const a = areaRef.current;
    if (!a || isRunning || !onRun) return;
    const selected = a.selectionStart !== a.selectionEnd ? a.value.slice(a.selectionStart, a.selectionEnd) : '';
    const sql = (selected || a.value).trim();
    if (sql) onRun(sql);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      step(e.key === 'ArrowUp' ? 1 : -1);
    } else if (e.key === 'Escape' && cursor.current !== -1) {
      cursor.current = -1;
      setValue(draft.current);
    }
  };

  const spans = useMemo(() => (highlight && value.length <= HIGHLIGHT_LIMIT ? sqlSpans(value) : []), [highlight, value]);
  const errorAt = error?.position ? error.position - 1 : null;
  const segments = useMemo(() => segmentsOf(value, spans, errorAt), [value, spans, errorAt]);

  return (
    <div
      data-slot="sql-editor"
      data-disabled={isDisabled || undefined}
      data-running={isRunning || undefined}
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
        <AriaTextArea
          ref={areaRef}
          data-slot="sql-editor-input"
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => {
            cursor.current = -1;
            setValue(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          placeholder={placeholder}
          disabled={isDisabled}
          readOnly={isReadOnly}
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
        <div data-slot="sql-editor-footer" className="flex shrink-0 items-center gap-2 px-2 py-1.5 shadow-hairline-t">
          <KbdGroup className="hidden min-w-0 flex-1 text-caption text-foreground/65 sm:inline-flex">
            <Kbd>⌘</Kbd><Kbd>↵</Kbd>
            <span className="truncate">runs the selection, or everything{history?.length ? ' · ⌥↑ history' : ''}</span>
          </KbdGroup>
          <span className="flex-1 sm:hidden" />
          {actions}
          {/* Ink on paper rather than white on the accent blue: 3.7:1 fails WCAG AA for a button this size. */}
          <Button size="sm" className="bg-foreground text-background" isDisabled={isDisabled || isRunning || !onRun || !value.trim()} onPress={run}>
            {isRunning ? 'Running…' : runLabel}
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

/** Statements you ran, newest first. Pass a `key` to keep them in localStorage across reloads (read after mount, so it is SSR safe). */
export function useSqlHistory(key?: string, max = 50): SqlHistory {
  const [entries, setEntries] = useState<string[]>([]);
  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setEntries((JSON.parse(raw) as string[]).slice(0, max));
    } catch {
      /* private mode or a corrupt value: start empty */
    }
  }, [key, max]);
  const persist = useCallback((next: string[]) => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* quota or private mode */
    }
  }, [key]);
  const push = useCallback((sql: string) => {
    const s = sql.trim();
    if (!s) return;
    setEntries((prev) => {
      if (prev[0] === s) return prev;
      const next = [s, ...prev.filter((p) => p !== s)].slice(0, max);
      persist(next);
      return next;
    });
  }, [max, persist]);
  const clear = useCallback(() => {
    setEntries([]);
    persist([]);
  }, [persist]);
  return { entries, push, clear };
}
