'use client';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { CallStack } from '@/components/ui/call-stack';
import { ObjectTree } from '@/components/ui/object-tree';
import { type CallStackFrame } from '@/lib/call-stack-model';
import { useEffect, useMemo, useRef } from 'react';
import { stopAt } from './seed-stops';
import type { SeedStop } from './host';
import { HitNavigator } from './line-panels';
import { frameName, sourceName, type DebuggerModel } from './model';
import { useModel } from './use-model';
import { loadChildren, scopeRoot, type ValueNode } from './values';
/** The call stack: runs of framework frames fold into one row, as a server component's stack goes through a long way of
 *  React's renderer. */
export function DebuggerStack({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  const version = useModel(model, (m) => m.version);
  const selected = useModel(model, (m) => m.selectedFrame);
  const idle = useModel(model, (m) => Boolean(m.idle));
  const frames = useMemo<CallStackFrame[]>(
    () =>
      model.stackFrames().map((f, i) => {
        const loc = model.viewed(f.location?.[0]);
        const source = loc ? model.sourceEntries.get(loc.sourceId) : undefined;
        return {
          id: String(i),
          functionName: frameName(f),
          location: loc
            ? {
                file: source ? sourceName(source) : loc.sourceId,
                line: loc.line,
                column: loc.column,
              }
            : undefined,
          kind: model.isFrameworkSource(loc?.sourceId) ? 'framework' : 'app',
        };
        // What's in it can change with anything that moves or has been pretty printed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
    [model, version],
  );
  return (
    <CallStack
      aria-label="Call stack"
      frames={frames}
      selectedId={String(selected)}
      onSelect={(_, index) => void model.selectFrame(index)}
      emptyMessage={idle ? 'No JS is on the stack at this point.' : 'No frames'}
      className={cn(className)}
      style={style}
    />
  );
}
/** A simulated seed's actions, each a place to go, with the one that broke something an error. */
export function DebuggerSeed({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  const simulation = useModel(model, (m) => m.summary?.simulation ?? null);
  const step = useModel(model, (m) => m.step);
  const list = useRef<HTMLDivElement>(null);
  const current = simulation
    ? (stopAt(simulation.stops, step) as SeedStop | null)
    : null;
  useEffect(() => {
    if (current)
      list.current
        ?.querySelector(`[data-stop="${current.index}"]`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [current]);
  if (!simulation) return null;
  const { seed, stops, violation } = simulation;
  return (
    <section
      className={cn(
        'debugger-seed shrink max-h-[40%] min-h-24 flex flex-col overflow-hidden border-b border-border',
        className,
      )}
      data-slot="debugger-seed"
      style={style}
    >
      <div
        className="debugger-pane-title shrink-0 px-2 py-[3px] text-muted-foreground text-caption2 font-semibold"
        title="PageUp and PageDown walk these"
      >
        {seed === null
          ? `Simulated seed: ${stops.length} actions`
          : `Seed ${seed}: ${stops.length} actions`}
      </div>
      {violation ? (
        <div
          className="debugger-seed-violation shrink-0 px-2 pt-0.5 pb-1 text-destructive text-caption2 [overflow-wrap:anywhere]"
          data-slot="debugger-seed-violation"
        >{`${violation.kind}, after step ${violation.step}: ${violation.message}`}</div>
      ) : null}
      <div
        ref={list}
        className="debugger-seed-list flex-auto min-h-0 overflow-auto"
        data-slot="debugger-seed-list"
      >
        {stops.map((stop) => (
          <Button
            size="sm"
            variant="ghost"
            key={stop.index}
            type="button"
            className="debugger-seed-row box-border grid grid-cols-[26px_minmax(0,1fr)] gap-1 w-full px-2 py-px text-caption2 font-mono cursor-default rounded-none border-0 h-auto min-h-0 font-normal leading-normal text-start data-hovered:bg-muted data-[current]:bg-primary/18 [&[data-error]_.debugger-seed-label]:text-destructive [&[data-error]_.debugger-seed-label]:font-semibold"
            data-slot="debugger-seed-row"
            data-stop={stop.index}
            data-error={stop.error || undefined}
            data-current={stop === current || undefined}
            title={stop.name}
            onPress={() => void model.pauseAt(stop.step)}
          >
            <span className="debugger-muted text-muted-foreground text-caption2">
              {stop.index + 1}
            </span>
            <span
              className="debugger-seed-label overflow-hidden text-ellipsis whitespace-nowrap"
              data-slot="debugger-seed-label"
            >
              {stop.label}
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}
/** The system calls a step made, when it made any. */
export function DebuggerCalls({
  model,
  onSelect,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
  onSelect?: (index: number) => void;
}) {
  const calls = useModel(model, (m) => m.calls);
  if (!calls.rows.length) return null;
  return (
    <div
      className={cn(
        'debugger-calls shrink max-h-[30%] min-h-0 overflow-auto border-t border-border',
        className,
      )}
      data-slot="debugger-calls"
      style={style}
    >
      <div
        className="debugger-pane-title shrink-0 px-2 py-[3px] text-muted-foreground text-caption2 font-semibold"
        title="Calls the recorder captured between this step and the next"
      >
        System calls from this step
      </div>
      {calls.rows.map((row) => {
        const content = (
          <>
            <span
              className="debugger-call-name font-mono text-caption"
              data-slot="debugger-call-name"
            >
              {row.name}
            </span>
            <span className="debugger-muted text-muted-foreground text-caption2 debugger-mono font-mono text-caption">
              {row.summary}
            </span>
          </>
        );
        return onSelect ? (
          <Button
            size="sm"
            variant="ghost"
            key={row.index}
            type="button"
            className="debugger-call box-border flex gap-1.5 w-full px-2 py-px text-caption2 font-normal leading-normal whitespace-nowrap overflow-hidden text-ellipsis rounded-none h-auto min-h-0 border-0 justify-start [&:is(button)]:cursor-pointer data-hovered:bg-accent"
            data-slot="debugger-call"
            title="Show this call"
            onPress={() => onSelect(row.index)}
          >
            {content}
          </Button>
        ) : (
          <div
            key={row.index}
            className="debugger-call box-border flex gap-1.5 w-full px-2 py-px text-caption2 font-normal leading-normal whitespace-nowrap overflow-hidden text-ellipsis rounded-none h-auto min-h-0 border-0 justify-start [&:is(button)]:cursor-pointer data-hovered:bg-accent"
            data-slot="debugger-call"
          >
            {content}
          </div>
        );
      })}
      {calls.more > 0 ? (
        <div className="debugger-muted text-muted-foreground text-caption2 debugger-hint px-2 py-1 text-caption2">{`and ${calls.more.toLocaleString()} more`}</div>
      ) : null}
    </div>
  );
}
/** What's in scope in the selected frame. Values read ahead have only what was kept, and open as far as that goes. */
export function DebuggerScopes({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  const version = useModel(model, (m) => m.scopesVersion);
  const stale = useModel(model, (m) => m.scopesStale);
  const error = useModel(model, (m) => m.scopesError);
  const selected = useModel(model, (m) => m.selectedFrame);
  const { root, tooEarly } = useMemo(() => {
    const pause = model.pause;
    const frame = pause?.frames?.[selected];
    if (!pause || !frame)
      return {
        root: null as ValueNode[] | null,
        tooEarly: Boolean(pause?.tooEarly),
      };
    const step = model.step;
    const fetch = pause.readAhead
      ? undefined
      : (id: string) => model.fetchPreview(pause, step, id);
    return {
      root: scopeRoot(frame, pause.scopes, { objects: pause.objects, fetch }),
      tooEarly: false,
    };
    // The scopes say when they've something new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, version, selected]);
  // The previous scopes stay, dimmed, so dragging doesn't make them flicker.
  const kept = useRef<ValueNode[]>([]);
  if (root) kept.current = root;
  else if (!stale) kept.current = [];
  return (
    <div
      className={cn(
        'debugger-scopes flex flex-col flex-1 min-h-0 overflow-hidden data-[stale]:opacity-55',
        className,
      )}
      data-slot="debugger-scopes"
      data-stale={stale || undefined}
      style={style}
    >
      {error ? (
        <div
          className="debugger-error text-destructive text-caption"
          data-slot="debugger-scopes-error"
        >
          {error}
        </div>
      ) : null}
      {tooEarly ? (
        <div className="debugger-muted text-muted-foreground text-caption2 debugger-hint px-2 py-1 text-caption2">
          The runtime hasn&apos;t set up its debugger yet at this point, so
          values aren&apos;t available. The line and call stack still are.
        </div>
      ) : null}
      <ObjectTree<ValueNode['data'] & object>
        aria-label="Scopes"
        root={kept.current as never}
        loadChildren={loadChildren as never}
        emptyMessage=""
        className="debugger-scopes-tree flex-1 min-h-0"
      />
    </div>
  );
}
/** Breakpoints and logpoints, wherever they are. */
export function DebuggerBreakpoints({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  useModel(model, (m) => m.marksVersion);
  const breakpoints = [...model.breakpoints.entries()];
  if (!breakpoints.length) {
    return (
      <div
        className={cn(
          'debugger-breakpoints flex-1 min-h-0 overflow-auto',
          className,
        )}
        data-slot="debugger-breakpoints"
        style={style}
      >
        <div className="debugger-muted text-muted-foreground text-caption2 debugger-hint px-2 py-1 text-caption2">
          Click the dot beside a line number for a breakpoint. Click a hit count
          to add a logpoint.
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'debugger-breakpoints flex-1 min-h-0 overflow-auto',
        className,
      )}
      data-slot="debugger-breakpoints"
      data-scroll-memory="debugger-breakpoints"
      style={style}
    >
      {breakpoints.map(([key, bp]) => {
        const source = model.sourceEntries.get(bp.sourceId);
        return (
          <div
            key={key}
            className="debugger-breakpoint flex items-center gap-1 px-2 py-px text-caption min-w-0"
            data-slot="debugger-breakpoint"
            data-kind={bp.logpoint !== null ? 'logpoint' : 'breakpoint'}
          >
            <Checkbox
              data-slot="debugger-breakpoint-enabled"
              aria-label={`${bp.enabled ? 'Disable' : 'Enable'} line ${bp.line}`}
              isSelected={bp.enabled}
              onChange={(selected) => model.setBreakpointEnabled(key, selected)}
            />
            <span
              className="debugger-breakpoint-kind shrink-0 text-[10px] text-warning data-[kind=logpoint]:text-primary"
              data-kind={bp.logpoint !== null ? 'logpoint' : 'breakpoint'}
            >
              {bp.logpoint !== null ? 'log' : 'bp'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="debugger-breakpoint-place flex-1 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis cursor-pointer rounded-none border-0 h-auto min-h-0 px-0 py-0 font-normal leading-normal justify-start data-hovered:underline"
              data-slot="debugger-breakpoint-place"
              onPress={() => void model.goToBreakpoint(bp)}
            >
              {`${sourceName(source)}:${bp.line}${source?.pretty ? ' (raw)' : ''}`}
              {bp.logpoint !== null ? (
                <span className="debugger-muted text-muted-foreground text-caption2">{` ${bp.logpoint}`}</span>
              ) : null}
            </Button>
            <HitNavigator model={model} hits={bp.hits} />
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="debugger-breakpoint-remove shrink-0 px-1 py-0 text-muted-foreground cursor-pointer rounded-none border-0 h-auto min-h-0 font-normal leading-normal"
              data-slot="debugger-breakpoint-remove"
              aria-label="Remove"
              title="Remove"
              onPress={() => model.removeBreakpoint(key)}
            >
              ×
            </Button>
          </div>
        );
      })}
    </div>
  );
}
