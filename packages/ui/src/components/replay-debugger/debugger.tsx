'use client';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import { LogList } from '@/components/ui/log-list';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Tabs, TabsBar, TabsList, TabsTab } from '@/components/ui/tabs';
import { Workspace, type WorkspaceLayoutInput } from '@/components/ui/workspace';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import type { SizeClass } from '@/lib/size-class';
import { type LogRow } from '@/lib/log-list-model';
import {
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { DebuggerCode } from './code';
import { DebuggerEvaluations, DebuggerPrompt } from './console';
import type { DebuggerModel } from './model';
import {
  DebuggerBreakpoints,
  DebuggerCalls,
  DebuggerScopes,
  DebuggerStack,
} from './stack';
import { DebuggerTimeline } from './timeline';
import { DebuggerToolbar } from './toolbar';
/* ══ All of it, in the room it's given ══
   The block's parts together, for a host that doesn't want to arrange them itself: a timeline of the whole recording
   across the top, the code with its console under it and the stack beside it in a Workspace, and one at a time under a bottom tab bar in a compact box (the kit's size class of its own
   box). The width can change at any moment, and nothing's lost, as everything worth keeping is in the model. */
type Tab = 'code' | 'console' | 'stack';
type Section = 'stack' | 'scopes' | 'breakpoints';
/** Compact below this width: one panel at a time. */
const breakpoints = { medium: 720 };
const PANELS: {
  value: Tab;
  title: string;
  icon: string;
}[] = [
  { value: 'code', title: 'Code', icon: 'doc' },
  { value: 'console', title: 'Console', icon: 'list' },
  { value: 'stack', title: 'Stack', icon: 'layers' },
];
const Sections: {
  value: Section;
  label: string;
}[] = [
  { value: 'stack', label: 'Stack' },
  { value: 'scopes', label: 'Scopes' },
  { value: 'breakpoints', label: 'Breakpoints' },
];
/** A console row, with the step that logged it when it's known: pressing the row pauses there (otherwise at its time). */
export type DebuggerConsoleRow = LogRow & { step?: number };
/** What's been logged and where, for a console: by default, what a host's said with `logged`, and what logpoints found. */
function useConsoleRows(model: DebuggerModel, logged: readonly DebuggerConsoleRow[] = []) {
  const version = useSyncExternalStore(
    model.subscribe,
    () => model.marksVersion,
  );
  return useMemo(() => {
    const hits: DebuggerConsoleRow[] = [];
    for (const [, results] of model.logpointResults) {
      results.entries.forEach((hit, i) => {
        hits.push({
          id: `lp${results.run}:${i}`,
          level: hit.error ? 'error' : 'log',
          time: model.map?.approxTimeOf(hit.step.index),
          step: hit.step.index,
          source: `line ${hit.step.location?.line ?? ''}`,
          message:
            hit.error ?? JSON.stringify(hit.result?.returned?.value ?? '…'),
        });
      });
    }
    return [...logged, ...hits].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
    // The model says when its logpoints have more.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the model saying its logpoints have more.
  }, [model, logged, version]);
}
function ConsolePart({
  model,
  logged,
  onJump,
}: {
  model: DebuggerModel;
  logged?: readonly DebuggerConsoleRow[];
  /** After a press on a row has moved the debugger there. */
  onJump?: () => void;
}) {
  const rows = useConsoleRows(model, logged);
  const time = useSyncExternalStore(
    model.subscribe,
    () => model.playheadMs ?? 0,
  );
  const footer = useMemo(() => <DebuggerEvaluations model={model} />, [model]);
  return (
    <div
      className="debugger-console flex flex-col flex-1 h-full min-h-0"
      data-slot="debugger-console"
    >
      <LogList
        aria-label="Console"
        rows={rows}
        currentTime={time}
        markerLabel="Paused here"
        onAction={(_, { row }) => {
          if (row.step !== undefined) void model.pauseAt(row.step);
          else if (row.time !== undefined) model.setPlayhead(row.time);
          else return;
          onJump?.();
        }}
        footer={footer}
        className="debugger-console-list flex-1 min-h-0"
      />
      <DebuggerPrompt model={model} />
    </div>
  );
}
function StackPart({ model, sizeClass }: { model: DebuggerModel; sizeClass: SizeClass | undefined }) {
  const [section, setSection] = useState<Section>('stack');
  if (sizeClass === 'compact') {
    return (
      <div
        className="debugger-stack flex flex-col flex-1 h-full min-w-0 min-h-0 overflow-hidden"
        data-short=""
      >
        <Segmented<Section>
          aria-label="What to show"
          className="debugger-stack-sections shrink-0 mx-2 my-1"
          value={section}
          onValueChange={(next) => {
            if (next) setSection(next);
          }}
        >
          {Sections.map((s) => (
            <SegmentedItem key={s.value} value={s.value}>
              {s.label}
            </SegmentedItem>
          ))}
        </Segmented>
        <section className="debugger-section min-h-0 flex flex-col overflow-hidden [&+.debugger-section]:border-t [&+.debugger-section]:border-border flex-[1_1_0%]">
          <div className="debugger-section-body flex flex-col flex-1 min-h-0 overflow-hidden">
            {section === 'stack' ? (
              <DebuggerStack model={model} />
            ) : section === 'scopes' ? (
              <DebuggerScopes model={model} />
            ) : (
              <DebuggerBreakpoints model={model} />
            )}
          </div>
          {section === 'stack' ? <DebuggerCalls model={model} /> : null}
        </section>
      </div>
    );
  }
  return (
    <div className="debugger-stack flex flex-col flex-1 h-full min-w-0 min-h-0 overflow-hidden">
      <section className="debugger-section min-h-0 flex flex-col overflow-hidden [&+.debugger-section]:border-t [&+.debugger-section]:border-border flex-[2_1_0%]">
        <div className="debugger-pane-title shrink-0 border-b border-border/60 bg-secondary/25 px-3 py-2 text-muted-foreground text-caption2 font-semibold uppercase tracking-wide">
          Call stack
        </div>
        <div className="debugger-section-body flex flex-col flex-1 min-h-0 overflow-hidden">
          <DebuggerStack model={model} />
        </div>
        <DebuggerCalls model={model} />
      </section>
      <section className="debugger-section min-h-0 flex flex-col overflow-hidden [&+.debugger-section]:border-t [&+.debugger-section]:border-border flex-[3_1_0%]">
        <div className="debugger-pane-title shrink-0 border-b border-border/60 bg-secondary/25 px-3 py-2 text-muted-foreground text-caption2 font-semibold uppercase tracking-wide">
          Scopes
        </div>
        <div className="debugger-section-body flex flex-col flex-1 min-h-0 overflow-hidden">
          <DebuggerScopes model={model} />
        </div>
      </section>
      <section className="debugger-section min-h-0 flex flex-col overflow-hidden [&+.debugger-section]:border-t [&+.debugger-section]:border-border flex-[1_1_0%]">
        <div className="debugger-pane-title shrink-0 border-b border-border/60 bg-secondary/25 px-3 py-2 text-muted-foreground text-caption2 font-semibold uppercase tracking-wide">
          Breakpoints and logpoints
        </div>
        <div className="debugger-section-body flex flex-col flex-1 min-h-0 overflow-hidden">
          <DebuggerBreakpoints model={model} />
        </div>
      </section>
    </div>
  );
}
const defaultLayout: WorkspaceLayoutInput<Tab> = {
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      {
        type: 'split',
        orientation: 'vertical',
        size: 68,
        children: [
          {
            type: 'tabset',
            id: 'main',
            size: 70,
            tabs: [
              { id: 'code', title: 'Code', data: 'code', disableClose: true },
            ],
          },
          {
            type: 'tabset',
            id: 'lower',
            size: 30,
            tabs: [
              {
                id: 'console',
                title: 'Console',
                data: 'console',
                disableClose: true,
              },
            ],
          },
        ],
      },
      {
        type: 'tabset',
        id: 'side',
        size: 32,
        tabs: [
          { id: 'stack', title: 'Stack', data: 'stack', disableClose: true },
        ],
      },
    ],
  },
};
export interface ReplayDebuggerProps extends DebuggerPartProps {
  model: DebuggerModel;
  /** What the recording logged, on the same clock as the model's playhead. Pressing a row pauses at its `step`, or at
   *  its time without one. */
  logged?: readonly DebuggerConsoleRow[];
  /** A timeline of the whole recording across the top, to scrub. Turn it off when the host has its own. Default: on. */
  timeline?: boolean;
  className?: string;
}
export function ReplayDebugger({
  model,
  logged,
  timeline = true,
  className,
  style,
}: ReplayDebuggerProps) {
  const [root, sizeClass] = useSizeClass({ breakpoints });
  const narrow = sizeClass === 'compact';
  const [tab, setTab] = useState<Tab>('code');
  const panel = (id: Tab) => {
    if (id === 'code')
      return (
        <DebuggerCode
          model={model}
          toolbar={<DebuggerToolbar model={model} sizeClass={sizeClass} />}
        />
      );
    // One panel at a time: a press on a console row shows the code it went to.
    if (id === 'console') return <ConsolePart model={model} logged={logged} onJump={narrow ? () => setTab('code') : undefined} />;
    return <StackPart model={model} sizeClass={sizeClass} />;
  };
  return (
    <div
      ref={root}
      className={cn(
        'replay-debugger relative flex flex-col w-full h-full min-h-0 overflow-hidden bg-background text-foreground text-footnote',
        className,
      )}
      data-slot="replay-debugger"
      style={style}
    >
      <SizeClassProvider value={sizeClass}>
      {timeline ? <DebuggerTimeline model={model} compact={narrow} /> : null}
      {narrow ? (
        <>
          <div className="replay-debugger-panel flex flex-col flex-1 min-h-0 h-full">
            {panel(tab)}
          </div>
          <Tabs<Tab> variant="bar" value={tab} onValueChange={(next) => { if (next) setTab(next); }} className="contents">
            <TabsBar hideOnScroll={false} className="replay-debugger-tabs shrink-0 relative! inset-auto!">
              <TabsList aria-label="Panels">
                {PANELS.map((p) => <TabsTab key={p.value} value={p.value} icon={p.icon}>{p.title}</TabsTab>)}
              </TabsList>
            </TabsBar>
          </Tabs>
        </>
      ) : (
        <Workspace<Tab>
          aria-label="The debugger"
          className="replay-debugger-workspace flex-1 min-h-0"
          defaultLayout={defaultLayout}
          renderTabContent={(t) => (
            <div className="replay-debugger-panel flex flex-col flex-1 min-h-0 h-full">
              {panel(t.data)}
            </div>
          )}
        />
      )}
      </SizeClassProvider>
    </div>
  );
}
