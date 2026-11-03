import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import {
  CodeViewer, type CodeViewerGutter, type CodeViewerHandle, type CodeViewerLineDecoration, type CodeViewerMarker, type CodeViewerProps,
} from '@/components/ui/code-viewer';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { splitCodeLines } from '@/lib/code-viewer';
import { createGpuCodeHighlight } from '@/lib/code-viewer-gpu';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { Phone as Frame } from '../stories/frame';

const meta: Meta<typeof CodeViewer> = {
  title: 'Organisms/CodeViewer',
  component: CodeViewer,
};
export default meta;
type Story = StoryObj<typeof CodeViewer>;

/* ── Demo data: all of it a pure function of its arguments, since visual regression compares these at zero tolerance. ── */

/** A readable source of a good length for a window. */
const STORE_SOURCE = `// A small store, the way the bundles in a recording tend to start out.
import { produce } from 'immer';

/* Actions are plain objects. Reducers get the state
   and an action, and return the next state. */
export const ADD_TODO = 'todos/add';
export const TOGGLE_TODO = 'todos/toggle';
const MAX_HISTORY = 128;

export function createStore(reducer, preloaded) {
  let state = preloaded;
  let listeners = new Set();
  const history = [];

  function getState() {
    return state;
  }

  function dispatch(action) {
    if (typeof action?.type !== 'string') {
      throw new TypeError(\`Actions need a type, got \${JSON.stringify(action)}\`);
    }
    const previous = state;
    state = reducer(previous, action);
    history.push({ action, at: history.length });
    if (history.length > MAX_HISTORY) history.shift();
    for (const listener of listeners) {
      listener(state, previous);
    }
    return action;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  dispatch({ type: '@@init' });
  return { getState, dispatch, subscribe, history };
}

export function todos(state = [], action) {
  switch (action.type) {
    case ADD_TODO:
      return [...state, { id: state.length + 1, text: action.text, done: false }];
    case TOGGLE_TODO:
      return state.map((todo) => (todo.id === action.id ? { ...todo, done: !todo.done } : todo));
    default:
      return state;
  }
}

export const visible = (list, filter = /./) =>
  list.filter((todo) => filter.test(todo.text)).sort((a, b) => a.id - b.id);

export function formatTitle(todo, width = 40) {
  const mark = todo.done ? '[x]' : '[ ]';
  const title = \`\${mark} \${todo.text}\`;
  return title.length > width ? title.slice(0, width - 1) + '…' : title.padEnd(width, ' ');
}

const store = createStore(todos, []);
const unsubscribe = store.subscribe((next, previous) => {
  console.log('todos', previous.length, '->', next.length);
});

store.dispatch({ type: ADD_TODO, text: 'Scrub back to the render that dropped a row, and find out which action it was' });
store.dispatch({ type: ADD_TODO, text: 'Ship it' });
store.dispatch({ type: TOGGLE_TODO, id: 1 });

for (const todo of visible(store.getState(), /scrub/i)) {
  console.log(formatTitle(todo));
}

unsubscribe();
export default store;
`;

const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
};

const NAMES = ['a', 'b', 'c', 'e', 'n', 'r', 't', 'i', 'o', 's', 'u', 'l', 'f', 'd', 'h', 'p', 'm', 'g', 'y', 'x', 'k', 'w', 'v', 'z', 'Ne', 'Oe', 'qt', 'Zn', 'jr', 'Kt'];
const PROPS = ['type', 'props', 'key', 'ref', 'current', 'memoizedState', 'return', 'child', 'sibling', 'flags', 'lanes', 'stateNode', 'updateQueue', 'alternate', 'then', 'value', 'length', 'push', 'call', 'apply'];
const WORDS = ['react.element', 'function', 'object', 'symbol', 'undefined', 'Minified error #', 'hidden', 'click', 'data-testid', 'aria-label', 'http://www.w3.org/2000/svg'];

/** Minified code, as a bundler leaves it: a pure function of its seed, with the regular expressions, templates and nested
    strings that trip up a lexer, and now and then a multi-byte character inside a string. */
function minifiedCode(length: number, seed = 7): string {
  const next = seeded(seed);
  const pick = <T,>(list: readonly T[]): T => list[next() % list.length];
  const name = () => pick(NAMES);
  const prop = () => pick(PROPS);
  const pieces: string[] = [];
  let size = 0;
  const templates = [
    () => `function ${name()}(${name()},${name()}){return ${name()}.${prop()}===${name()}?${name()}:${next() % 9}}`,
    () => `var ${name()}=${name()}.${prop()},${name()}="${pick(WORDS)}";`,
    () => `if(${name()}&&typeof ${name()}.${prop()}=="function")${name()}.${prop()}(${name()},${name()});`,
    () => `${name()}=${name()}/${next() % 8 + 2}|0;`,
    () => `const ${name()}=/["'\`]/g.test(${name()}),${name()}=\`${pick(WORDS)}\${${name()}?\`\${${name()}}\`:'${pick(WORDS)}'}\`;`,
    () => `for(let ${name()}=0;${name()}<${next() % 64};${name()}++)${name()}[${name()}]=${name()}*${next() % 100}/${next() % 9 + 1};`,
    () => `class ${pick(['Ae', 'Be', 'Ce', 'De'])} extends ${pick(['Fe', 'Ge', 'He'])}{${prop()}(){return this.${prop()}??null}}`,
    () => `${name()}.${prop()}(${name()}=>{${name()}.${prop()}=${name()}.${prop()}||${next() % 2 === 0 ? 'true' : 'void 0'}});`,
    () => (next() % 8 === 0 ? `${name()}="実行中 … 🚀";` : `/*! ${pick(WORDS)} */`),
    () => `switch(${name()}.${prop()}){case ${next() % 32}:${name()}=${name()};break;default:${name()}=0}`,
  ];
  for (;;) {
    const piece = pick(templates)();
    if (size + piece.length > length) break;
    pieces.push(piece);
    size += piece.length;
  }
  // Whole statements, and padding to the exact length: nothing is left open for the next line.
  return pieces.join('') + ';'.repeat(length - size);
}

const LOCALS = ['node', 'fiber', 'queue', 'update', 'next', 'lane', 'child', 'state', 'props', 'context'];
const ACTIONS = ['flushWork', 'commitRoot', 'scheduleUpdate', 'markRootUpdated', 'readContext', 'bailout', 'resetHooks', 'pushEffect'];

/** A line of a generated, pretty printed file with no end to speak of: a pure function of its index, so it needs no memory.
    Lines repeat a 12 line shape that varies with the index. */
function generatedLine(index: number): string {
  const block = Math.floor(index / 12);
  const local = LOCALS[block % LOCALS.length];
  const action = ACTIONS[(block * 7) % ACTIONS.length];
  switch (index % 12) {
    case 0:
      return `function ${action}_${block}(${local}, lanes) {`;
    case 1:
      return `  // Block ${block.toLocaleString('en-US')} of a generated file`;
    case 2:
      return `  const previous = ${local}.memoizedState;`;
    case 3:
      return `  if (previous === null || (lanes & ${1 << (block % 24)}) === 0) {`;
    case 4:
      return `    return ${action}_${Math.max(0, block - 1)}(${local}.return, lanes);`;
    case 5:
      return '  }';
    case 6:
      return `  const label = "${action}:" + ${local}.key + \` at \${${block}}\`;`;
    case 7:
      return `  ${local}.flags |= 0x${(block % 4096).toString(16).padStart(3, '0')};`;
    case 8:
      return `  console.log(label, ${local}.type?.name ?? null, ${(block % 97) / 8});`;
    case 9:
      return '  return previous;';
    case 10:
      return '}';
    default:
      return '';
  }
}

/** The widest `generatedLine`, near enough: a known bound saves the viewer a pass over the file to find out. */
const GENERATED_MAX_LINE = 64;

/** Tabs, wide characters and things a font can't be trusted with. */
const UNICODE_SOURCE = [
  '// Tabs reach the next stop, wherever they start.',
  'switch (kind) {',
  '\tcase 1:\tvalue = "tab\tin a string";\tbreak;',
  '\tcase 22:\tvalue = 2;\t\tbreak;',
  '\tcase 333:\tvalue = 3;\t\tbreak;',
  '}',
  '',
  '// Wide characters and emoji are two cells, and accents stay on their letters.',
  'const greetings = ["こんにちは世界", "안녕하세요", "你好，世界", "Olá, café", "Привет"];',
  'const status = "✅ done 🚀 shipped 👩\u200d💻 by a person 🇺🇸 here 👍🏽";',
  'const combining = "cafe\u0301 and an e\u0301 and a\u0308";',
  '',
  '// A column keeps its place on the grid after any of them.',
  '/* 漢字 */ const after = 1;',
  '/* abcd */ const after = 1;',
  '/* 😀😀 */ const after = 1;',
  '',
  '// Invisible characters show, and bidi controls have no effect.',
  'const zero = "a\u200bb", joiner = "a\u2060b", override = "x\u202eyz";',
  'const arabic = "مرحبا بالعالم"; const hebrew = "שלום עולם";',
];

const LINES = splitCodeLines(STORE_SOURCE);

/** A window of the size the desktop app starts at. */
function WindowFrame({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return <Frame w={1240} h={680} dark={dark}>{children}</Frame>;
}

/** A phone-size window. */
function PhoneFrame({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return <Frame w={390} h={844} dark={dark}>{children}</Frame>;
}

function Header({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-3 font-mono text-caption text-muted-foreground">
      <span className="min-w-0 truncate text-foreground">{title}</span>
      {detail ? <span className="ml-auto shrink-0 text-caption2">{detail}</span> : null}
    </div>
  );
}

function Pane({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-card">
      <Header title={title} detail={detail} />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export const Desktop: Story = {
  render: () => (
    <WindowFrame>
      <Pane title="src/store.js" detail={`${LINES.length} lines`}>
        <CodeViewer lines={LINES} aria-label="store.js" />
      </Pane>
    </WindowFrame>
  ),
};

export const Dark: Story = {
  render: () => (
    <WindowFrame dark>
      <Pane title="src/store.js" detail={`${LINES.length} lines`}>
        <CodeViewer lines={LINES} aria-label="store.js" />
      </Pane>
    </WindowFrame>
  ),
};

export const Phone: Story = {
  render: () => (
    <PhoneFrame>
      <Pane title="src/store.js">
        <CodeViewer lines={LINES} aria-label="store.js" />
      </Pane>
    </PhoneFrame>
  ),
};

export const Wrapped: Story = {
  render: () => (
    <PhoneFrame>
      <Pane title="src/store.js" detail="wrapped">
        <CodeViewer lines={LINES} wrap aria-label="store.js" />
      </Pane>
    </PhoneFrame>
  ),
};

export const NoHighlighter: Story = {
  render: () => (
    <WindowFrame>
      <Pane title="src/store.js" detail="highlight={null}">
        <CodeViewer lines={LINES} highlight={null} aria-label="store.js" />
      </Pane>
    </WindowFrame>
  ),
};

export const TabsAndWideCharacters: Story = {
  render: () => (
    <WindowFrame>
      <Pane title="unicode.js" detail="tabSize 4">
        <CodeViewer lines={UNICODE_SOURCE} tabSize={4} aria-label="unicode.js" />
      </Pane>
    </WindowFrame>
  ),
};

/* ── A debugger: everything it needs from the viewer, composed the way a host would. Nothing in CodeViewer knows what
   a breakpoint or an execution is. ── */

/** How many times each line ran, and what's breakable: what a host gets from its engine. */
const HITS: Record<number, number> = {
  10: 1, 11: 1, 12: 1, 13: 1, 15: 212, 16: 212, 19: 5, 20: 5, 23: 5, 24: 5, 25: 5, 26: 5, 27: 5, 28: 4, 30: 5, 33: 1, 34: 1, 35: 1, 36: 1, 40: 1,
  41: 1, 44: 6, 45: 6, 47: 2, 49: 1, 51: 3, 55: 1, 56: 1, 59: 1, 60: 1, 61: 1, 62: 1, 65: 1, 66: 1, 70: 1, 71: 1, 72: 1, 74: 1, 75: 1,
};
const NEVER_RAN = new Set([21, 29, 37, 38, 46, 48, 50, 52, 57, 58, 63, 67, 68]);
const breakable = (line: number) => line in HITS || NEVER_RAN.has(line);
const formatHits = (hits: number) => (hits >= 1000 ? `${Math.floor(hits / 100) / 10}k` : String(hits));

/** The hit count's popover: back and forth through a line's executions, or type which one. A host's own; the viewer only
    gave it a cell to sit in. */
function HitCount({ line, current, onGo }: { line: number; current: { line: number; hit: number }; onGo: (line: number, hit: number) => void }) {
  const hits = HITS[line] ?? 0;
  const hit = current.line === line ? current.hit : 0;
  return (
    <PopoverTrigger>
      <Button
        variant="ghost"
        aria-label={`Line ${line} ran ${hits} times`}
        className="h-full w-full rounded-none bg-transparent px-1 text-right font-mono text-caption2 font-normal text-muted-foreground tabular-nums data-hovered:bg-secondary data-hovered:text-foreground"
      >
        <span className="ml-auto">{formatHits(hits)}</span>
      </Button>
      <Popover placement="bottom start" offset={4} className="w-auto">
        <Dialog aria-label={`Executions of line ${line}`} className="flex items-center gap-1 p-1.5 outline-none">
          <Button size="icon-sm" variant="quiet" aria-label="Previous execution" isDisabled={hit <= 1} onPress={() => onGo(line, hit - 1)}>
            <Icon name="chevron-left" size={14} />
          </Button>
          <input
            aria-label="Execution number"
            className="h-7 w-12 rounded-ctl border-0 bg-secondary text-center font-mono text-caption text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={hit || ''}
            placeholder="–"
            inputMode="numeric"
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isInteger(value) && value >= 1 && value <= hits) onGo(line, value);
            }}
          />
          <span className="pr-1 font-mono text-caption text-muted-foreground">of {hits}</span>
          <Button size="icon-sm" variant="quiet" aria-label="Next execution" isDisabled={hit >= hits} onPress={() => onGo(line, hit + 1)}>
            <Icon name="chevron-right" size={14} />
          </Button>
        </Dialog>
      </Popover>
    </PopoverTrigger>
  );
}

/** Statements on a line: column-level breakpoint sites, in a real engine. */
const SITES: Record<number, number[]> = {
  24: [4, 12, 22],
  25: [4, 12, 25],
  30: [11, 31],
  51: [6, 18, 40, 62],
  60: [8, 26, 44, 65],
  72: [6, 21, 45],
};

const ranAtLeastOnce = (line: number) => (HITS[line] ?? 0) > 0;
const jumpLabel = (line: number) => `Jump to line ${line}'s first execution`;

function DebuggerDemo({ wide = true }: { wide?: boolean }) {
  const [position, setPosition] = useState({ line: 25, column: 12, hit: 3 });
  const [breakpoints, setBreakpoints] = useState(() => new Set([25, 51]));
  const [columnBreakpoints, setColumnBreakpoints] = useState(() => new Set(['25:12', '60:26']));

  const toggle = useCallback((line: number) => {
    setBreakpoints((set) => {
      const next = new Set(set);
      if (!next.delete(line)) next.add(line);
      return next;
    });
  }, []);

  const go = useCallback((line: number, hit: number) => setPosition({ line, column: SITES[line]?.[0] ?? 0, hit }), []);
  const jump = useCallback((line: number) => go(line, 1), [go]);

  const gutters = useMemo<CodeViewerGutter[]>(() => [
    {
      id: 'hits',
      width: wide ? 40 : 30,
      align: 'end',
      render: (line) => (HITS[line] ? <HitCount line={line} current={position} onGo={go} /> : null),
    },
    {
      id: 'breakpoint',
      width: 16,
      onPress: toggle,
      isPressable: breakable,
      label: (line) => `${breakpoints.has(line) ? 'Remove' : 'Add'} a breakpoint on line ${line}`,
      render: (line) =>
        breakable(line) ? (
          <span className={cn('size-[9px] rounded-full', breakpoints.has(line) ? 'bg-warning' : 'bg-warning/50 opacity-0 group-data-hovered:opacity-100')} />
        ) : null,
      className: 'group',
    },
  ], [breakpoints, go, position, toggle, wide]);

  const lineDecoration = useCallback((line: number): CodeViewerLineDecoration | null => {
    if (line === 15) return { tint: 'info' };
    if (NEVER_RAN.has(line)) return { textClassName: 'opacity-45' };
    return null;
  }, []);

  const markers = useCallback((line: number): CodeViewerMarker[] | undefined => SITES[line]?.map((column) => ({
    column,
    label: `Breakpoint at line ${line}, column ${column}`,
    isActive: columnBreakpoints.has(`${line}:${column}`),
    onPress: () => setColumnBreakpoints((set) => {
      const next = new Set(set);
      if (!next.delete(`${line}:${column}`)) next.add(`${line}:${column}`);
      return next;
    }),
  })), [columnBreakpoints]);

  return (
    <div className="absolute inset-0 flex flex-col bg-card">
      <Header title="src/store.js" detail={`paused at ${position.line}:${position.column}, run ${position.hit}`} />
      <div className="min-h-0 flex-1">
        <CodeViewer
          lines={LINES}
          aria-label="store.js"
          gutters={gutters}
          currentLine={position.line}
          currentColumn={position.column}
          lineDecoration={lineDecoration}
          markers={markers}
          onLineNumberPress={jump}
          isLineNumberPressable={ranAtLeastOnce}
          lineNumberLabel={jumpLabel}
        />
      </div>
    </div>
  );
}

export const Debugger: Story = { render: () => <WindowFrame><DebuggerDemo /></WindowFrame> };
export const DebuggerDark: Story = { render: () => <WindowFrame dark><DebuggerDemo /></WindowFrame> };
export const DebuggerPhone: Story = { render: () => <PhoneFrame><DebuggerDemo wide={false} /></PhoneFrame> };

/* ── Sizes ── */

/** One real-looking megabyte, on line 3 of a short file. */
function useMegabyteFile() {
  return useMemo(() => [
    '/*! A bundle, the way it arrives: one line, a megabyte of it. */',
    '"use strict";',
    minifiedCode(1 << 20),
    '//# sourceMappingURL=bundle.js.map',
  ], []);
}

function MegabyteLineDemo({ column, phone, ...props }: { column?: number; phone?: boolean } & Partial<CodeViewerProps>) {
  const lines = useMegabyteFile();
  const scrollTo = useMemo(() => (column === undefined ? null : { line: 3, column, align: 'start' as const }), [column]);
  const Size = phone ? PhoneFrame : WindowFrame;
  return (
    <Size>
      <Pane title="bundle.js" detail="1,048,576 characters on line 3">
        <CodeViewer lines={lines} aria-label="bundle.js" scrollToLine={scrollTo} {...props} />
      </Pane>
    </Size>
  );
}

export const MegabyteLine: Story = { name: 'Megabyte line', render: () => <MegabyteLineDemo /> };
export const MegabyteLineFarRight: Story = { name: 'Megabyte line, 900,000 columns in', render: () => <MegabyteLineDemo column={900_000} /> };
export const MegabyteLinePhone: Story = { name: 'Megabyte line, phone', render: () => <MegabyteLineDemo phone column={500_000} /> };

function HalfMillionDemo({ line, phone }: { line?: number; phone?: boolean }) {
  const Size = phone ? PhoneFrame : WindowFrame;
  return (
    <Size>
      <Pane title="generated.js" detail="500,000 lines">
        <CodeViewer
          lineCount={500_000}
          getLine={generatedLine}
          maxLineLength={GENERATED_MAX_LINE}
          aria-label="generated.js"
          scrollToLine={line}
          currentLine={line}
        />
      </Pane>
    </Size>
  );
}

export const HalfMillionLines: Story = { name: '500,000 lines', render: () => <HalfMillionDemo /> };
export const HalfMillionLinesDeep: Story = { name: '500,000 lines, near the end', render: () => <HalfMillionDemo line={487_321} /> };
export const HalfMillionLinesPhone: Story = { name: '500,000 lines, phone', render: () => <HalfMillionDemo phone line={123_457} /> };

/* ── Selection ── */

function SelectedDemo() {
  const viewer = useRef<CodeViewerHandle>(null);
  const ref = useCallback((handle: CodeViewerHandle | null) => {
    viewer.current = handle;
    handle?.setSelection({ anchor: { line: 11, column: 6 }, focus: { line: 16, column: 12 } });
  }, []);
  return (
    <WindowFrame>
      <Pane title="src/store.js" detail="selection, not focused">
        <CodeViewer ref={ref} lines={LINES} aria-label="store.js" />
      </Pane>
    </WindowFrame>
  );
}

export const Selected: Story = { render: () => <SelectedDemo /> };

/* ── Scrolling ── a ref and a prop. */

function ScrollingDemo() {
  const viewer = useRef<CodeViewerHandle>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [copied, setCopied] = useState('');
  return (
    <WindowFrame>
      <div className="absolute inset-0 flex flex-col bg-card">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2">
          <Button size="sm" variant="secondary" onPress={() => viewer.current?.scrollToLine(1000)}>Line 1,000</Button>
          <Button size="sm" variant="secondary" onPress={() => viewer.current?.scrollToLine(250_000, { align: 'start' })}>Line 250,000 at the top</Button>
          <Button size="sm" variant="secondary" onPress={() => viewer.current?.scrollToLine(2000, { align: 'end', smooth: true })}>Smoothly to line 2,000</Button>
          <Button size="sm" variant="secondary" onPress={() => setTarget(4242)}>Prop: line 4,242</Button>
          <Button size="sm" variant="secondary" onPress={() => viewer.current?.selectAll()}>Select all</Button>
          <span data-testid="copied" className="ml-auto font-mono text-caption text-muted-foreground">{copied}</span>
        </div>
        <div className="min-h-0 flex-1">
          <CodeViewer
            ref={viewer}
            lineCount={500_000}
            getLine={generatedLine}
            maxLineLength={GENERATED_MAX_LINE}
            aria-label="generated.js"
            scrollToLine={target}
            onCopyText={({ text, truncated }) => setCopied(`copied ${text.length.toLocaleString('en-US')} characters${truncated ? ', cut short' : ''}`)}
          />
        </div>
      </div>
    </WindowFrame>
  );
}

export const Scrolling: Story = { render: () => <ScrollingDemo /> };

/* ── The library's GPU highlighter, through the same `highlight` prop. Without WebGPU it uses lexSyntax's fallback. ── */

const gpuHighlight = createGpuCodeHighlight();

export const GpuLexer: Story = {
  name: 'gpu-lexer',
  render: () => (
    <WindowFrame>
      <Pane title="src/store.js" detail="highlight={createGpuCodeHighlight()}">
        <CodeViewer lines={LINES} highlight={gpuHighlight} aria-label="store.js" />
      </Pane>
    </WindowFrame>
  ),
};

export const TwoMillionLines: Story = {
  name: 'Two million lines, past what a browser can scroll',
  render: () => (
    <WindowFrame>
      <Pane title="generated.js" detail="2,000,000 lines">
        <CodeViewer lineCount={2_000_000} getLine={generatedLine} maxLineLength={GENERATED_MAX_LINE} aria-label="generated.js" scrollToLine={1_900_000} currentLine={1_900_000} />
      </Pane>
    </WindowFrame>
  ),
};
