'use client';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import { Button } from '@/components/ui/button';
import {
  CodeEditor,
  type CodeEditorGutter,
  type CodeEditorGutterClickDetails,
  type CodeEditorHandle,
} from '@/components/ui/code-editor';
import { splitCodeLines } from '@/lib/code-editor-model';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from 'react';
import { DebuggerLinePanels } from './line-panels';
import { formatCount, type DebuggerModel } from './model';
import { DebuggerSourceBreadcrumbs } from './sources';
import { useModel } from './use-model';
/* ══ The source, at the moment you're on ══
   A read-only CodeEditor on whatever the source's size: the current line, how many times each line ran, a dot beside it for
   a breakpoint, and its number to go to its next execution. Marks only redraw the rows they change. */
const LinePadding = 30;
const ScrollTries = 12;
function DebuggerEditor({
  model,
  sourceId,
  editor,
}: {
  model: DebuggerModel;
  sourceId: string;
  editor: Ref<CodeEditorHandle>;
}) {
  const source = model.sources.get(sourceId)!;
  const marks = useModel(model, (m) => m.marksVersion);
  const current = useModel(model, (m) => {
    const c = m.currentLocation();
    return c && !c.ran ? c.line : null;
  });
  const column = useModel(model, (m) => m.currentLocation()?.column ?? null);
  const ran = useModel(model, (m) => {
    const c = m.currentLocation();
    return c?.ran ? c.line : null;
  });
  const frameLine = useModel(model, (m) => m.frameLine());
  const lines = useMemo(
    () => splitCodeLines(source.contents),
    [source.contents],
  );
  const breakable = useMemo(
    () => new Set(source.breakableLines),
    [source.breakableLines],
  );
  const hitsOn = useCallback(
    (line: number) => source.hitCounts[line] ?? 0,
    [source.hitCounts],
  );
  const gutters = useMemo<CodeEditorGutter[]>(
    () => [
      {
        id: 'hits',
        width: 38,
        align: 'end',
        className:
          'debugger-hits text-[10px] text-muted-foreground pe-[3px] tabular-nums',
        clickable: (line) => hitsOn(line) > 0,
        onClick: (_event, { line }) => void model.toggleNavigator(line),
        label: (line) =>
          `Line ${line} ran ${hitsOn(line).toLocaleString()} times`,
        title: (line) => {
          const hits = hitsOn(line);
          if (hits)
            return `Ran ${hits.toLocaleString()} time${hits === 1 ? '' : 's'}. Click to move between executions`;
          return breakable.has(line) ? 'Never ran' : undefined;
        },
        render: (line) =>
          breakable.has(line) ? formatCount(hitsOn(line)) : '',
      },
      {
        id: 'breakpoint',
        width: 16,
        clickable: (line) => breakable.has(line),
        onClick: (_event, { line }) => void model.toggleBreakpoint(line),
        label: (line) =>
          `${model.breakpoints.has(`${sourceId}:${line}`) ? 'Remove the' : 'Add a'} breakpoint on line ${line}`,
        title: (line) =>
          breakable.has(line) ? 'Click to toggle a breakpoint' : undefined,
        className: 'debugger-marker-cell grid place-items-center',
        render: (line) => {
          const bp = model.breakpoints.get(`${sourceId}:${line}`);
          if (!bp)
            return breakable.has(line) ? (
              <span className="debugger-marker block size-[9px] rounded-full [&.on]:bg-warning [&.on[data-kind=logpoint]]:bg-primary [&.on:not([data-enabled])]:opacity-35" />
            ) : null;
          return (
            <span
              className="debugger-marker block size-[9px] rounded-full [&.on]:bg-warning [&.on[data-kind=logpoint]]:bg-primary [&.on:not([data-enabled])]:opacity-35 on"
              data-kind={bp.logpoint !== null ? 'logpoint' : 'breakpoint'}
              data-enabled={bp.enabled || undefined}
            />
          );
        },
      },
      // Marks change what's in the rows, and this says so.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ],
    [model, sourceId, breakable, hitsOn, marks],
  );
  const isClickable = useCallback((line: number) => hitsOn(line) > 0, [hitsOn]);
  const onNumber = useCallback(
    (_event: unknown, { line }: CodeEditorGutterClickDetails) => void model.jumpToLine(line),
    [model],
  );
  const numberLabel = useCallback(
    (line: number) => `Go to the next execution of line ${line}`,
    [],
  );
  const numberTitle = useCallback(
    (line: number) =>
      hitsOn(line) ? "Click to jump to this line's next execution" : undefined,
    [hitsOn],
  );
  const lineDecoration = useCallback(
    (line: number) => {
      if (line === frameLine)
        return { tint: 'info' as const, className: 'debugger-frame-line' };
      if (line === ran)
        return { tint: 'muted' as const, className: 'debugger-last-ran' };
      if (breakable.has(line) && !hitsOn(line))
        return { textClassName: 'debugger-unexecuted' };
      return null;
    },
    [frameLine, ran, breakable, hitsOn],
  );
  return (
    <CodeEditor
      ref={editor}
      readOnly
      variant="ghost"
      lines={lines}
      aria-label={source.url || source.id}
      gutters={gutters}
      currentLine={current ?? undefined}
      currentColumn={current !== null ? (column ?? undefined) : undefined}
      lineDecoration={lineDecoration}
      lineNumbers={{ onClick: onNumber, clickable: isClickable, label: numberLabel, title: numberTitle }}
      lineHeight={19}
    />
  );
}
function CodeTitle({ model }: { model: DebuggerModel }) {
  useModel(model, (m) => m.version);
  const source = model.sourceId ? model.sources.get(model.sourceId) : null;
  if (!source)
    return (
      <div
        className="debugger-title-text flex flex-1 min-w-0 items-center gap-1.5 text-caption"
        data-slot="debugger-title"
      />
    );
  const format = model.titleFormat();
  return (
    <div
      className="debugger-title-text flex flex-1 min-w-0 items-center gap-1.5 text-caption"
      data-slot="debugger-title"
    >
      <DebuggerSourceBreadcrumbs model={model} />
      {format ? (
        <span
          className="debugger-format shrink-0 text-muted-foreground text-caption2"
          data-slot="debugger-format"
          title={format.title}
        >
          {format.text}
        </span>
      ) : null}
      {format?.toggle ? (
        <Button
          variant="quiet"
          size="sm"
          className="debugger-format-toggle shrink-0 h-5 px-1.5 text-caption2"
          data-slot="debugger-format-toggle"
          title={format.toggle.title}
          onClick={format.toggle.press}
        >
          {format.toggle.label}
        </Button>
      ) : null}
    </div>
  );
}
export interface DebuggerCodeHandle {
  /** Goes to a line that was asked for while this was put away. */
  followPosition(): void;
  /** The CodeEditor's own handle. */
  editor(): CodeEditorHandle | null;
}
export function DebuggerCode({
  model,
  ref,
  toolbar,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
  ref?: Ref<DebuggerCodeHandle>;
  toolbar?: React.ReactNode;
}) {
  const sourceId = useModel(model, (m) => m.sourceId);
  const request = useModel(model, (m) => m.scrollRequest);
  const root = useRef<HTMLDivElement>(null);
  const editor = useRef<CodeEditorHandle>(null);
  /* A line's only moved to when it isn't already comfortably in view. An editor that's just been made for another source
       hasn't measured itself yet, and takes no notice until it has, so this goes on asking for a few frames. */
  const asking = useRef(0);
  /* A line that's been asked for while this was put away, which it goes to when it's back. */
  const owed = useRef<number | null>(null);
  const bringIntoView = useCallback((line: number) => {
    const ask = ++asking.current;
    let tries = 0;
    const attempt = () => {
      if (ask !== asking.current) return;
      const el = root.current;
      const handle = editor.current;
      if (el && handle) {
        const row = el.querySelector(
          `[data-slot="code-editor-gutter-row"][data-line="${line}"]`,
        );
        const box = el
          .querySelector('[data-slot="code-editor-content"]')
          ?.getBoundingClientRect();
        if (row && box?.height) {
          const r = row.getBoundingClientRect();
          if (
            r.top >= box.top + LinePadding &&
            r.bottom <= box.bottom - LinePadding
          ) {
            owed.current = null;
            return;
          }
        }
        if (box?.height) {
          handle.scrollToLine(line);
          owed.current = null;
        } else {
          owed.current = line;
        }
      }
      if (++tries < ScrollTries) requestAnimationFrame(attempt);
    };
    attempt();
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      // Only what's been asked for since it went away: where someone's scrolled to stays where they left it.
      followPosition() {
        if (owed.current !== null) bringIntoView(owed.current);
      },
      editor: () => editor.current,
    }),
    [model, bringIntoView],
  );
  // After the commit that shows the line's source.
  useEffect(() => {
    if (request) bringIntoView(request.line);
  }, [request, bringIntoView]);
  return (
    <div
      ref={root}
      className={cn(
        'debugger-code flex flex-col flex-1 h-full min-w-0 min-h-0',
        className,
      )}
      data-slot="debugger-code"
      style={style}
    >
      {toolbar}
      <div className="debugger-code-head flex shrink-0 items-center gap-2 min-h-8 px-2 py-1 border-b border-border bg-secondary/20 min-w-0">
        <CodeTitle model={model} />
      </div>
      <div className="debugger-code-body relative flex flex-1 min-h-0">
        <div
          className="debugger-editor relative flex-1 min-w-0 min-h-0 [&>*]:h-full"
          data-slot="debugger-editor"
        >
          {sourceId && model.sources.has(sourceId) ? (
            <DebuggerEditor
              key={sourceId}
              model={model}
              sourceId={sourceId}
              editor={editor}
            />
          ) : null}
        </div>
      </div>
      <DebuggerLinePanels model={model} />
    </div>
  );
}
