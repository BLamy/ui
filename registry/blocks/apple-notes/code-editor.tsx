/* A code editor for source and text files: a plain <textarea> over a copy of its text highlighted by the library's
   gpu-lexer (SyntaxHighlighting's `useSyntaxTokens`), beside line numbers. Selection, IME, spell-check off, find
   (⌘F is the browser's) and undo are the browser's own: edits made by the keys below go through `insertText`, so
   ⌘Z undoes them too.

   Tab indents (the selected lines, or at the caret) and ⇧Tab outdents, with the file's own indent (a tab, or two or
   four spaces); Enter keeps the line's indent. Esc, then Tab, moves focus on, so the editor never traps the keyboard.
   ⌘S saves at once (edits also save on their own). */
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { TextArea } from 'react-aria-components';
import { SyntaxTokens, useSyntaxTokens } from '@/components/ui/syntax-highlighting';
import { cn } from '@/lib/utils';

/** Past this, the text shows plain (the highlighted copy would be most of the work). */
const HIGHLIGHT_LIMIT = 300_000;

/** The same metrics on the textarea, its highlighted copy and the line numbers, or they drift apart. */
const metrics = 'box-border m-0 border-0 py-3 font-mono text-footnote leading-5 [tab-size:4] whitespace-pre';

/** The indent a file uses: a tab when lines start with one, else the smallest run of leading spaces (2 or 4). */
export function detectIndent(text: string): string {
  let tabs = 0;
  let spaces = 0;
  let smallest = 8;
  for (const line of text.split('\n', 2000)) {
    if (line.startsWith('\t')) tabs++;
    else {
      const run = /^ +(?=\S)/.exec(line)?.[0].length ?? 0;
      if (run >= 2) { spaces++; smallest = Math.min(smallest, run); }
    }
  }
  return tabs > spaces ? '\t' : ' '.repeat(smallest >= 4 && smallest !== 8 ? 4 : 2);
}

/** Replaces the selection with `text` the way typing would, so the browser's undo keeps it. */
function insert(el: HTMLTextAreaElement, text: string) {
  el.focus();
  if (!document.execCommand?.('insertText', false, text)) {
    el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** For labels and `data-language`; gpu-lexer recognizes the language itself. */
  language: string;
  onSave?: () => void;
  isReadOnly?: boolean;
  'aria-label': string;
  className?: string;
}

export function CodeEditor({ value, onChange, language, onSave, isReadOnly, className, 'aria-label': ariaLabel }: CodeEditorProps) {
  const area = useRef<HTMLTextAreaElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const numbers = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);
  const highlight = value.length <= HIGHLIGHT_LIMIT;
  const { lines, highlighter } = useSyntaxTokens(highlight ? value : '', { language, enabled: highlight });
  const lineCount = useMemo(() => {
    let n = 1;
    for (let i = value.indexOf('\n'); i >= 0; i = value.indexOf('\n', i + 1)) n++;
    return n;
  }, [value]);
  const indent = useMemo(() => detectIndent(value), [value]);
  const [focused, setFocused] = useState(false);

  const sync = () => {
    const el = area.current;
    if (!el) return;
    if (layer.current) layer.current.style.translate = `${-el.scrollLeft}px ${-el.scrollTop}px`;
    if (numbers.current) numbers.current.style.translate = `0 ${-el.scrollTop}px`;
  };
  useLayoutEffect(sync, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSave?.(); return; }
    if (e.key === 'Escape') { escaped.current = true; return; }
    if (isReadOnly) return;
    if (e.key === 'Tab' && !escaped.current && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const { selectionStart: start, selectionEnd: end, value: text } = el;
      const multiline = text.slice(start, end).includes('\n');
      if (!multiline && !e.shiftKey) { insert(el, indent); return; }
      // Indent or outdent every line the selection touches, then keep those lines selected.
      const from = text.lastIndexOf('\n', start - 1) + 1;
      const block = text.slice(from, end);
      const next = block.split('\n').map((line) => {
        if (!e.shiftKey) return line ? indent + line : line;
        if (line.startsWith('\t')) return line.slice(1);
        return line.replace(new RegExp(`^ {1,${indent === '\t' ? 4 : indent.length}}`), '');
      }).join('\n');
      el.setSelectionRange(from, end);
      insert(el, next);
      el.setSelectionRange(from, from + next.length);
      return;
    }
    escaped.current = false;
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !(e.nativeEvent as globalThis.KeyboardEvent).isComposing) {
      const text = el.value;
      const lineStart = text.lastIndexOf('\n', el.selectionStart - 1) + 1;
      const lead = /^[\t ]*/.exec(text.slice(lineStart, el.selectionStart))?.[0] ?? '';
      if (lead) { e.preventDefault(); insert(el, `\n${lead}`); }
    }
  };

  const gutter = `${String(lineCount).length + 2}ch`;
  return (
    <div data-slot="code-editor" data-language={language} data-highlighter={highlighter}
      className={cn('relative flex min-h-0 overflow-hidden rounded-xl bg-card shadow-hairline', focused && 'ring-2 ring-primary', className)}>
      <div aria-hidden="true" className="relative shrink-0 overflow-hidden border-0 border-r border-solid border-border bg-secondary/60 text-muted-foreground" style={{ width: gutter }}>
        <div ref={numbers} className={cn(metrics, 'px-2 text-end tabular-nums')}>
          {Array.from({ length: lineCount }, (_, i) => `${i + 1}\n`).join('')}
        </div>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {highlight ? (
          <div ref={layer} aria-hidden="true" className={cn(metrics, 'pointer-events-none absolute top-0 left-0 min-w-full px-3 text-card-foreground')}>
            {lines.map((tokens, i) => <div key={i} className="min-h-5"><SyntaxTokens tokens={tokens} /></div>)}
          </div>
        ) : null}
        <TextArea
          ref={area}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={sync}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); escaped.current = false; }}
          readOnly={isReadOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          className={cn(metrics, 'bl-scroll relative block h-full w-full resize-none overflow-auto bg-transparent px-3 caret-foreground outline-none selection:bg-primary/25',
            highlight ? 'text-transparent' : 'text-card-foreground')}
        />
      </div>
    </div>
  );
}
