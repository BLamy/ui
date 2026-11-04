import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CodeEditor, CodeEditorContent, CodeEditorCopyButton, CodeEditorHeader, CodeEditorTitle,
  type CodeEditorChange, type CodeEditorGutter, type CodeEditorHandle, type CodeEditorProps, type CodeEditorSelection,
} from '@/components/ui/code-editor';
import { lineAfterEdit } from '@/lib/code-document';
import { MAX_PAGE_LINES } from '@/lib/code-editor-model';
import { STORE_SOURCE, generatedLine, halfMillionLines, minifiedCode } from '../stories/code-samples';
import { Phone as Frame } from '../stories/frame';

/* CodeEditor: editable by default. Read-only snippets and source views have stories of their own, under this one. */

const meta: Meta<CodeEditorProps> = {
  title: 'Organisms/CodeEditor',
  component: CodeEditor,
  excludeStories: ['TypeChecks'],
};
export default meta;
type Story = StoryObj<CodeEditorProps>;

const TS = `import { useEffect, useState } from 'react'

/** Poll a URL every \`ms\` milliseconds. */
export function usePoll<T>(url: string, ms = 5_000): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    const tick = async () => {
      const res = await fetch(url)
      if (live && res.ok) setData(await res.json())
    }
    void tick()
    const id = setInterval(tick, ms)
    return () => { live = false; clearInterval(id) }
  }, [url, ms])
  return data
}
`;

/** Where a selection is, the way a status bar says it. */
const describePlace = (selection: CodeEditorSelection | null) => {
  if (!selection) return '';
  const { anchor, focus } = selection;
  return anchor.line === focus.line && anchor.column === focus.column ? `Ln ${focus.line}, Col ${focus.column + 1}` : `Ln ${focus.line}, Col ${focus.column + 1} (selection)`;
};

function WindowFrame({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return <Frame w={1240} h={680} dark={dark}>{children}</Frame>;
}

function PhoneFrame({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return <Frame w={390} h={844} dark={dark}>{children}</Frame>;
}

/** A page: a column with space around it, for the editor to sit in as a card. */
function Page({ children }: { children?: ReactNode }) {
  return <div className="absolute inset-0 flex flex-col gap-3 overflow-auto bg-background p-6 text-foreground">{children}</div>;
}

function Pane({ title, detail, children }: { title: string; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-card">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-3 font-mono text-caption text-muted-foreground">
        <span className="min-w-0 truncate text-foreground">{title}</span>
        {detail ? <span data-testid="detail" className="ml-auto shrink-0 text-caption2">{detail}</span> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/* ── Editable: what you get from nothing but text. ── */

export const Editable: Story = {
  render: () => (
    <WindowFrame>
      <Page>
        <div className="h-[520px]">
          <CodeEditor defaultValue={TS} language="ts" title="use-poll.ts" showCopy aria-label="use-poll.ts" />
        </div>
      </Page>
    </WindowFrame>
  ),
};

/** The same, as tall as its text: with nothing giving it a height, it follows its content, and `maxHeight` caps it. */
export const FollowsItsContent: Story = {
  render: () => (
    <WindowFrame>
      <Page>
        <div>
          <CodeEditor defaultValue={TS.split('\n').slice(0, 8).join('\n')} language="ts" aria-label="short" />
        </div>
        <CodeEditor defaultValue={TS} language="ts" title="capped at 200 px" maxHeight={200} aria-label="capped" />
      </Page>
    </WindowFrame>
  ),
};

export const EditableDark: Story = {
  name: 'Editable, dark',
  render: () => (
    <WindowFrame dark>
      <Page>
        <div className="h-[520px]">
          <CodeEditor defaultValue={TS} language="ts" title="use-poll.ts" showCopy aria-label="use-poll.ts" />
        </div>
      </Page>
    </WindowFrame>
  ),
};

/** Focus and a selection, to see the caret and how the editor looks when it's in use. Reduced motion holds the caret still. */
function FocusedDemo({ dark, wrap }: { dark?: boolean; wrap?: boolean }) {
  const editor = useRef<CodeEditorHandle>(null);
  useEffect(() => {
    editor.current?.setSelection({ anchor: { line: 7, column: 8 }, focus: { line: 9, column: 17 } });
    editor.current?.focus();
  }, []);
  return (
    <WindowFrame dark={dark}>
      <Page>
        <div className="h-[520px]">
          <CodeEditor ref={editor} defaultValue={TS} language="ts" title="use-poll.ts" showCopy wrap={wrap} aria-label="use-poll.ts" />
        </div>
      </Page>
    </WindowFrame>
  );
}

export const Focused: Story = { render: () => <FocusedDemo /> };
export const FocusedDark: Story = { name: 'Focused, dark', render: () => <FocusedDemo dark /> };

function CaretDemo() {
  const editor = useRef<CodeEditorHandle>(null);
  useEffect(() => {
    editor.current?.setSelection({ anchor: { line: 12, column: 22 }, focus: { line: 12, column: 22 } });
    editor.current?.focus();
  }, []);
  return (
    <WindowFrame>
      <Page>
        <div className="h-[520px]">
          <CodeEditor ref={editor} defaultValue={TS} language="ts" aria-label="use-poll.ts" />
        </div>
      </Page>
    </WindowFrame>
  );
}

export const Caret: Story = { render: () => <CaretDemo /> };

/* ── Controlled, as an input is. ── */

function ControlledDemo() {
  const [value, setValue] = useState(TS);
  const [place, setPlace] = useState('');
  const [last, setLast] = useState<CodeEditorChange | null>(null);
  return (
    <WindowFrame>
      <Page>
        <div className="h-[460px]">
          <CodeEditor
            value={value}
            onChange={(next, change) => {
              setValue(next);
              setLast(change);
            }}
            onSelectionChange={(selection) => setPlace(describePlace(selection))}
            language="ts"
            aria-label="use-poll.ts"
          />
        </div>
        <div className="flex items-center gap-4 font-mono text-caption text-muted-foreground">
          <span data-testid="length">{value.length.toLocaleString('en-US')} characters</span>
          <span data-testid="place">{place}</span>
          <span data-testid="change" className="ml-auto">{last ? `${last.origin} at ${last.from.line}:${last.from.column}` : 'no changes yet'}</span>
        </div>
      </Page>
    </WindowFrame>
  );
}

export const Controlled: Story = { render: () => <ControlledDemo /> };

/* ── Gutters on an editor: a breakpoint gutter that stays put as lines come and go. ── */

function WithGuttersDemo() {
  const [breakpoints, setBreakpoints] = useState(() => new Set([11, 14]));
  const toggle = useCallback((line: number) => setBreakpoints((set) => {
    const next = new Set(set);
    if (!next.delete(line)) next.add(line);
    return next;
  }), []);
  const gutters = useMemo<CodeEditorGutter[]>(() => [{
    id: 'breakpoint',
    width: 18,
    onPress: toggle,
    label: (line) => `${breakpoints.has(line) ? 'Remove' : 'Add'} a breakpoint on line ${line}`,
    render: (line) => (breakpoints.has(line) ? <span className="size-[9px] rounded-full bg-warning" /> : null),
  }], [breakpoints, toggle]);
  return (
    <WindowFrame>
      <Pane title="src/store.js" detail="editable, with a gutter">
        <CodeEditor
          variant="ghost"
          defaultValue={STORE_SOURCE}
          language="js"
          gutters={gutters}
          // Whatever a host keeps by line is its own to move, and `lineAfterEdit` says where to.
          onEdit={(change) => setBreakpoints((set) => new Set([...set].map((line) => lineAfterEdit(line, change))))}
          aria-label="store.js"
        />
      </Pane>
    </WindowFrame>
  );
}

export const WithGutters: Story = { name: 'With gutters', render: () => <WithGuttersDemo /> };

/* ── Sizes ── typing here is as quick as in a line of ten. `onEdit` gets each change without the whole text being joined. */

function MegabyteLineDemo({ phone }: { phone?: boolean }) {
  const text = useMemo(() => ['/*! A bundle, the way it arrives: one line, a megabyte of it. */', '"use strict";', minifiedCode(1 << 20), '//# sourceMappingURL=bundle.js.map'].join('\n'), []);
  const [edits, setEdits] = useState(0);
  const Size = phone ? PhoneFrame : WindowFrame;
  return (
    <Size>
      <Pane title="bundle.js" detail={`1,048,576 characters on line 3, ${edits} edits`}>
        <CodeEditor variant="ghost" defaultValue={text} language="js" onEdit={() => setEdits((n) => n + 1)} scrollToLine={{ line: 3, column: 500_000, align: 'start' }} aria-label="bundle.js" />
      </Pane>
    </Size>
  );
}

export const MegabyteLine: Story = { name: 'Megabyte line', render: () => <MegabyteLineDemo /> };
export const MegabyteLinePhone: Story = { name: 'Megabyte line, phone', render: () => <MegabyteLineDemo phone /> };

function HalfMillionDemo({ line, phone, wrap }: { line?: number; phone?: boolean; wrap?: boolean }) {
  const [edits, setEdits] = useState(0);
  const Size = phone ? PhoneFrame : WindowFrame;
  return (
    <Size>
      <Pane title="generated.js" detail={`500,000 lines, ${edits} edits`}>
        <CodeEditor variant="ghost" defaultValue={halfMillionLines()} language="js" onEdit={() => setEdits((n) => n + 1)} scrollToLine={line} wrap={wrap} aria-label="generated.js" />
      </Pane>
    </Size>
  );
}

export const HalfMillionLines: Story = { name: '500,000 lines', render: () => <HalfMillionDemo /> };
export const HalfMillionLinesEnd: Story = { name: '500,000 lines, near the end', render: () => <HalfMillionDemo line={499_990} /> };
export const HalfMillionLinesWrapped: Story = { name: '500,000 lines, wrapped', render: () => <HalfMillionDemo line={499_990} wrap /> };

/* ── At phone width ── */

function PhoneDemo({ wrap, dark }: { wrap?: boolean; dark?: boolean }) {
  return (
    <PhoneFrame dark={dark}>
      <Pane title="src/store.js" detail={wrap ? 'wrapped' : undefined}>
        <CodeEditor variant="ghost" defaultValue={STORE_SOURCE} language="js" wrap={wrap} aria-label="store.js" />
      </Pane>
    </PhoneFrame>
  );
}

export const Phone: Story = { render: () => <PhoneDemo /> };
export const PhoneWrapped: Story = { name: 'Phone, wrapped', render: () => <PhoneDemo wrap /> };
export const PhoneDark: Story = { name: 'Phone, dark', render: () => <PhoneDemo dark /> };

/** A card at phone width, in a page: the caret, a selection, and a line that runs off the side. */
function PhoneCardDemo() {
  const editor = useRef<CodeEditorHandle>(null);
  useEffect(() => {
    editor.current?.setSelection({ anchor: { line: 7, column: 4 }, focus: { line: 7, column: 22 } });
    editor.current?.focus();
  }, []);
  return (
    <PhoneFrame>
      <Page>
        <div className="h-[420px]">
          <CodeEditor ref={editor} defaultValue={TS} language="ts" title="use-poll.ts" showCopy aria-label="use-poll.ts" />
        </div>
      </Page>
    </PhoneFrame>
  );
}

export const PhoneCard: Story = { name: 'Phone, card', render: () => <PhoneCardDemo /> };

/* ── The two renderers side by side: what the same props give in the page and windowed, and how a text picks. ── */

export const ReadOnly: Story = {
  name: 'Read only',
  render: () => (
    <WindowFrame>
      <Page>
        <CodeEditor readOnly value={TS} language="ts" title="src/queue.ts" lineNumbers showCopy highlightLines={[4]} />
        <p className="m-0 text-[15px] leading-6">
          Inline, in a sentence: call <CodeEditor readOnly variant="inline" value="usePoll<User>('/api/me')" language="ts" /> inside a component.
        </p>
      </Page>
    </WindowFrame>
  ),
};

export const Inline: Story = {
  render: () => (
    <WindowFrame>
      <Page>
        <p className="m-0 text-[15px] leading-6">
          Call <CodeEditor readOnly variant="inline" value="usePoll<User>('/api/me', 10_000)" language="ts" /> inside a component, or read
          a flag with <CodeEditor variant="inline" value='process.env.FEATURE === "on"' language="js" />.
        </p>
      </Page>
    </WindowFrame>
  ),
};

export const BothRenderers: Story = {
  name: 'Both renderers',
  render: () => (
    <WindowFrame>
      <Page>
        <div className="grid grid-cols-2 gap-4">
          <CodeEditor readOnly value={TS} language="ts" title="in the page" lineNumbers startLine={10} highlightLines={[13]} addedLines={[16, 17]} removedLines={[15]} maxHeight={420} />
          <CodeEditor readOnly windowed value={TS} language="ts" title="windowed" lineNumbers startLine={10} highlightLines={[13]} addedLines={[16, 17]} removedLines={[15]} maxHeight={420} />
        </div>
      </Page>
    </WindowFrame>
  ),
};

/** A read-only text one line over the limit picks the windowed renderer by itself. */
const JUST_OVER = Array.from({ length: MAX_PAGE_LINES + 1 }, (_, i) => generatedLine(i)).join('\n');

export const TooBigForThePage: Story = {
  name: 'Too big for the page',
  render: () => (
    <WindowFrame>
      <Page>
        <CodeEditor readOnly value={JUST_OVER} language="js" title={`${(MAX_PAGE_LINES + 1).toLocaleString('en-US')} lines: windowed by itself`} lineNumbers maxHeight={560} />
      </Page>
    </WindowFrame>
  ),
};

/* ── Composed from parts ── */

export const Composed: Story = {
  render: () => (
    <WindowFrame>
      <Page>
        <div className="h-[420px]">
          <CodeEditor defaultValue={TS} language="ts" aria-label="use-poll.ts">
            <CodeEditorHeader>
              <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">TS</span>
              <CodeEditorTitle>use-poll.ts</CodeEditorTitle>
              <CodeEditorCopyButton />
            </CodeEditorHeader>
            <CodeEditorContent highlightLines={[4]} />
          </CodeEditor>
        </div>
      </Page>
    </WindowFrame>
  ),
};

/* ── What the types turn down. Not a story: it's here so that it's compiled, and each of these stops compiling if the types let it through. ── */

export const TypeChecks = () => (
  <>
    {/* Fine. */}
    <CodeEditor />
    <CodeEditor defaultValue="a" onEdit={() => {}} />
    <CodeEditor value="a" onChange={() => {}} />
    <CodeEditor readOnly value="a" windowed />
    <CodeEditor readOnly value="a" windowed={false} />
    <CodeEditor readOnly lines={['a']} />
    <CodeEditor readOnly lineCount={1} getLine={() => 'a'} contentKey="k" />
    <CodeEditor readOnly variant="inline" value="a" />
    <CodeEditor variant="inline" value="a" />
    {/* @ts-expect-error `lines` are read-only. */}
    <CodeEditor lines={['a']} />
    {/* @ts-expect-error `getLine` is read-only. */}
    <CodeEditor lineCount={1} getLine={() => 'a'} />
    {/* @ts-expect-error `getLine` needs `lineCount`. */}
    <CodeEditor readOnly getLine={() => 'a'} />
    {/* @ts-expect-error A controlled editor needs `onChange`, as an input does. */}
    <CodeEditor value="a" />
    {/* @ts-expect-error One source of text. */}
    <CodeEditor value="a" defaultValue="b" onChange={() => {}} />
    {/* @ts-expect-error One source of text. */}
    <CodeEditor readOnly value="a" lines={['b']} />
    {/* @ts-expect-error Read-only doesn't change. */}
    <CodeEditor readOnly value="a" onChange={() => {}} />
    {/* @ts-expect-error Read-only doesn't change. */}
    <CodeEditor readOnly value="a" onEdit={() => {}} />
    {/* @ts-expect-error Editing is windowed. */}
    <CodeEditor defaultValue="a" windowed={false} />
    {/* @ts-expect-error Lines are windowed. */}
    <CodeEditor readOnly lines={['a']} windowed={false} />
    {/* @ts-expect-error Inline isn't. */}
    <CodeEditor variant="inline" value="a" windowed />
    {/* @ts-expect-error Inline is text in a sentence. */}
    <CodeEditor variant="inline" lines={['a']} />
    {/* @ts-expect-error Inline can't be edited. */}
    <CodeEditor variant="inline" value="a" onChange={() => {}} />
  </>
);
