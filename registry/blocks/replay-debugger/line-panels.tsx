'use client';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import type { Hits } from './host';
import type { DebuggerModel, LinePanel } from './model';
import { useModel } from './use-model';
/** Arrows and an editable number for moving through a line's executions. */
export function HitNavigator({
  model,
  hits,
  focusSeq,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
  hits: Hits;
  focusSeq?: number;
}) {
  // Which arrows work, and the number, go by the step.
  useModel(model, (m) => m.step);
  const [typing, setTyping] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const count = hits.length;
  const position = model.hitPosition(hits);
  useEffect(() => {
    if (!focusSeq) return;
    input.current?.focus();
  }, [focusSeq]);
  return (
    <span
      className={cn(
        'debugger-hit-nav inline-flex shrink-0 items-center gap-0.5 text-caption2 [&_[data-slot=button]]:text-[9px] [&_[data-slot=button]]:min-w-[18px] [&_[data-slot=button]]:h-5 [&_[data-slot=button]]:px-[3px] [&_[data-slot=button]]:py-0 [&_[data-slot=button]]:text-foreground [&_[data-disabled]]:opacity-35',
        className,
      )}
      data-slot="debugger-hit-nav"
      style={style}
    >
      <Button
        variant="quiet"
        size="icon-sm"
        data-slot="debugger-hit-previous"
        aria-label="Previous execution"
        title="Previous execution"
        isDisabled={model.hitBefore(hits) < 0}
        onPress={() => model.goToHit(hits, model.hitBefore(hits))}
      >
        ◀
      </Button>
      <Input
        ref={input}
        className="debugger-hit-input min-w-0 border border-border rounded-sm bg-background text-foreground font-mono text-caption outline-offset-0 h-5 px-0.5 py-0 text-center"
        data-slot="debugger-hit-input"
        aria-label="Execution number"
        placeholder="–"
        spellCheck={false}
        title="Type an execution number and press Enter"
        style={{ width: `calc(${String(count).length + 1}ch + 8px)` }}
        value={typing ?? (position === null ? '' : String(position))}
        onChange={(e) => setTyping(e.target.value)}
        onFocus={(e) => {
          setTyping(null);
          // Typing replaces it. A mouse click would otherwise clear this.
          e.currentTarget.select();
        }}
        onClick={(e) => e.currentTarget.select()}
        onBlur={() => setTyping(null)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            setTyping(null);
            e.currentTarget.blur();
          } else if (e.key === 'Enter') {
            const n = parseInt(e.currentTarget.value, 10);
            if (count && !Number.isNaN(n)) {
              const at = Math.max(1, Math.min(count, n));
              setTyping(String(at));
              model.goToHit(hits, at - 1);
            } else {
              setTyping(null);
            }
            const el = e.currentTarget;
            requestAnimationFrame(() => el.select());
          }
        }}
      />
      <span
        className="debugger-hit-total text-muted-foreground whitespace-nowrap"
        data-slot="debugger-hit-total"
      >{`/ ${count.toLocaleString()}`}</span>
      <Button
        variant="quiet"
        size="icon-sm"
        data-slot="debugger-hit-next"
        aria-label="Next execution"
        title="Next execution"
        isDisabled={model.hitNext(hits) < 0}
        onPress={() => model.goToHit(hits, model.hitNext(hits))}
      >
        ▶
      </Button>
    </span>
  );
}
function ExecutionPanel({
  model,
  panel,
  hits,
  focusSeq,
}: {
  model: DebuggerModel;
  panel: LinePanel;
  hits: Hits;
  focusSeq?: number;
}) {
  return (
    <div
      className="debugger-line-panel flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-2 py-[3px] text-caption [&+.debugger-line-panel]:border-t [&+.debugger-line-panel]:border-border [&_[data-slot=debugger-panel-action]]:h-[22px] [&_[data-slot=debugger-panel-action]]:px-2 [&_[data-slot=debugger-panel-action]]:text-caption2"
      data-slot="debugger-line-panel"
      data-line={panel.line}
    >
      <Button
        size="sm"
        variant="ghost"
        type="button"
        className="debugger-panel-line shrink-0 bg-transparent rounded-none border-0 h-auto px-0 py-0 font-normal leading-normal text-primary text-caption2 cursor-pointer"
        data-slot="debugger-panel-line"
        title="Show this line"
        onPress={() => model.scrollToLine(panel.line)}
      >{`Line ${panel.line}`}</Button>
      <span className="debugger-muted text-muted-foreground text-caption2">
        Execution
      </span>
      <HitNavigator model={model} hits={hits} focusSeq={focusSeq} />
      <Button
        variant="secondary"
        size="sm"
        data-slot="debugger-panel-action"
        onPress={() =>
          void model.toggleBreakpoint(panel.line, { logpoint: true })
        }
      >
        Add logpoint
      </Button>
      <Button
        variant="quiet"
        size="icon-sm"
        data-slot="debugger-panel-close"
        aria-label="Close"
        title="Close"
        onPress={() => void model.toggleNavigator(panel.line)}
      >
        ×
      </Button>
    </div>
  );
}
function LogpointPanel({
  model,
  panel,
  hits,
}: {
  model: DebuggerModel;
  panel: LinePanel;
  hits: Hits;
}) {
  const expression = useModel(
    model,
    (m) => m.breakpoints.get(panel.key)?.logpoint ?? '',
  );
  const info = useModel(
    model,
    (m) => m.logpointResults.get(panel.key)?.info ?? null,
  );
  const [draft, setDraft] = useState<string | null>(null);
  const status = info
    ? info.error
      ? ` ${info.error}`
      : ` ${info.count} of ${info.total} hit${info.total === 1 ? '' : 's'} logged`
    : ' evaluating…';
  return (
    <div
      className="debugger-line-panel flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-2 py-[3px] text-caption [&+.debugger-line-panel]:border-t [&+.debugger-line-panel]:border-border [&_[data-slot=debugger-panel-action]]:h-[22px] [&_[data-slot=debugger-panel-action]]:px-2 [&_[data-slot=debugger-panel-action]]:text-caption2 logpoint"
      data-slot="debugger-line-panel"
      data-line={panel.line}
      data-logpoint=""
    >
      <Button
        size="sm"
        variant="ghost"
        type="button"
        className="debugger-panel-line shrink-0 bg-transparent rounded-none border-0 h-auto px-0 py-0 font-normal leading-normal text-primary text-caption2 cursor-pointer"
        data-slot="debugger-panel-line"
        title="Show this line"
        onPress={() => model.scrollToLine(panel.line)}
      >{`Line ${panel.line}`}</Button>
      <span className="debugger-panel-label shrink-0 font-mono text-caption2 text-muted-foreground">
        console.log(
      </span>
      <Input
        className="debugger-panel-input min-w-0 border border-border rounded-sm bg-background text-foreground font-mono text-caption outline-offset-0 flex-[1_1_120px] h-[22px] px-1 py-0"
        data-slot="debugger-panel-input"
        aria-label="What to log"
        spellCheck={false}
        value={draft ?? expression}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            model.setLogpoint(panel.key, e.currentTarget.value);
            setDraft(null);
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
      <span className="debugger-panel-label shrink-0 font-mono text-caption2 text-muted-foreground">
        )
      </span>
      <span
        className="debugger-muted text-muted-foreground text-caption2"
        data-slot="debugger-panel-status"
      >
        {status}
      </span>
      <HitNavigator model={model} hits={hits} />
      <Button
        variant="secondary"
        size="sm"
        data-slot="debugger-panel-action"
        onPress={() => model.removeBreakpoint(panel.key)}
      >
        Remove logpoint
      </Button>
    </div>
  );
}
/** What's open for a line. An editor that draws only what's on screen has nowhere between two lines for these, so they stay
 *  together beside the code, each saying which line it's for, where typing in one isn't interrupted by anything moving. */
export function DebuggerLinePanels({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  useModel(model, (m) => m.marksVersion);
  const focus = useModel(model, (m) => m.focusPanel);
  const panels = model.linePanels();
  if (!panels.length) return null;
  return (
    <div
      className={cn(
        'debugger-line-panels shrink max-h-[40%] overflow-auto border-t border-border',
        className,
      )}
      data-slot="debugger-line-panels"
      style={style}
    >
      {panels.map((panel) => {
        const hits = model.lineHits.get(panel.key) ?? [];
        return panel.logpoint ? (
          <LogpointPanel
            key={`${panel.key}:log`}
            model={model}
            panel={panel}
            hits={hits}
          />
        ) : (
          <ExecutionPanel
            key={`${panel.key}:run`}
            model={model}
            panel={panel}
            hits={hits}
            focusSeq={focus?.key === panel.key ? focus.seq : undefined}
          />
        );
      })}
    </div>
  );
}
