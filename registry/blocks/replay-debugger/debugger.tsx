'use client';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import { LogList } from '@/components/ui/log-list';
import { Segmented } from '@/components/ui/segmented';
import { TabBar } from '@/components/ui/tab-bar';
import { Workspace, type WorkspaceModelInput } from '@/components/ui/workspace';
import { type LogRow } from '@/lib/log-list-model';
import {
  useLayoutEffect,
  useMemo,
  useRef,
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
import { DebuggerToolbar } from './toolbar';
/* ══ All of it, in the room it's given ══
   The block's parts together, for a host that doesn't want to arrange them itself: the code with its console under it and
   the stack beside it in a Workspace, and one at a time with a TabBar where there's no room for that. The width can change at
   any moment, and nothing's lost, as everything worth keeping is in the model. */
type Tab = 'code' | 'console' | 'stack';
type Section = 'stack' | 'scopes' | 'breakpoints';
const NarrowWidth = 720;
const Tabs: {
  id: Tab;
  title: string;
  icon: string;
}[] = [
  { id: 'code', title: 'Code', icon: 'doc' },
  { id: 'console', title: 'Console', icon: 'list' },
  { id: 'stack', title: 'Stack', icon: 'layers' },
];
const Sections: {
  id: Section;
  label: string;
}[] = [
  { id: 'stack', label: 'Stack' },
  { id: 'scopes', label: 'Scopes' },
  { id: 'breakpoints', label: 'Breakpoints' },
];
/** What's been logged and where, for a console: by default, what a host's said with `logged`, and what logpoints found. */
function useConsoleRows(model: DebuggerModel, logged: readonly LogRow[] = []) {
  const version = useSyncExternalStore(
    model.subscribe,
    () => model.marksVersion,
  );
  return useMemo(() => {
    const hits: LogRow[] = [];
    for (const [, results] of model.logpointResults) {
      results.entries.forEach((hit, i) => {
        hits.push({
          id: `lp${results.run}:${i}`,
          level: hit.error ? 'error' : 'log',
          time: model.map?.approxTimeOf(hit.step.index),
          source: `line ${hit.step.location?.line ?? ''}`,
          message:
            hit.error ?? JSON.stringify(hit.result?.returned?.value ?? '…'),
        });
      });
    }
    return [...logged, ...hits].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
    // The model says when its logpoints have more.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, logged, version]);
}
function ConsolePart({
  model,
  logged,
}: {
  model: DebuggerModel;
  logged?: readonly LogRow[];
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
        footer={footer}
        className="debugger-console-list flex-1 min-h-0"
      />
      <DebuggerPrompt model={model} />
    </div>
  );
}
function StackPart({
  model,
  compact,
}: {
  model: DebuggerModel;
  compact: boolean;
}) {
  const [section, setSection] = useState<Section>('stack');
  if (compact) {
    return (
      <div
        className="debugger-stack flex flex-col flex-1 h-full min-w-0 min-h-0 overflow-hidden"
        data-short=""
      >
        <Segmented
          aria-label="What to show"
          className="debugger-stack-sections shrink-0 mx-2 my-1"
          options={Sections}
          value={section}
          onChange={(id) => setSection(id as Section)}
        />
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
        <div className="debugger-pane-title shrink-0 px-2 py-[3px] text-muted-foreground text-caption2 font-semibold">
          Call stack
        </div>
        <div className="debugger-section-body flex flex-col flex-1 min-h-0 overflow-hidden">
          <DebuggerStack model={model} />
        </div>
        <DebuggerCalls model={model} />
      </section>
      <section className="debugger-section min-h-0 flex flex-col overflow-hidden [&+.debugger-section]:border-t [&+.debugger-section]:border-border flex-[3_1_0%]">
        <div className="debugger-pane-title shrink-0 px-2 py-[3px] text-muted-foreground text-caption2 font-semibold">
          Scopes
        </div>
        <div className="debugger-section-body flex flex-col flex-1 min-h-0 overflow-hidden">
          <DebuggerScopes model={model} />
        </div>
      </section>
      <section className="debugger-section min-h-0 flex flex-col overflow-hidden [&+.debugger-section]:border-t [&+.debugger-section]:border-border flex-[1_1_0%]">
        <div className="debugger-pane-title shrink-0 px-2 py-[3px] text-muted-foreground text-caption2 font-semibold">
          Breakpoints and logpoints
        </div>
        <div className="debugger-section-body flex flex-col flex-1 min-h-0 overflow-hidden">
          <DebuggerBreakpoints model={model} />
        </div>
      </section>
    </div>
  );
}
const defaultLayout: WorkspaceModelInput<Tab> = {
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
  /** What the recording logged, on the same clock as the model's playhead. */
  logged?: readonly LogRow[];
  className?: string;
}
export function ReplayDebugger({
  model,
  logged,
  className,
  style,
}: ReplayDebuggerProps) {
  const root = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [tab, setTab] = useState<Tab>('code');
  useLayoutEffect(() => {
    const el = root.current!;
    const look = () => {
      if (el.clientWidth) setNarrow(el.clientWidth < NarrowWidth);
    };
    look();
    const observer = new ResizeObserver(look);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const panel = (id: Tab) => {
    if (id === 'code')
      return (
        <DebuggerCode
          model={model}
          toolbar={<DebuggerToolbar model={model} compact={narrow} />}
        />
      );
    if (id === 'console') return <ConsolePart model={model} logged={logged} />;
    return <StackPart model={model} compact={narrow} />;
  };
  return (
    <div
      ref={root}
      className={cn(
        'replay-debugger relative flex flex-col w-full h-full min-h-0 overflow-hidden bg-background text-foreground text-footnote',
        className,
      )}
      data-slot="replay-debugger"
      data-narrow={narrow || undefined}
      style={style}
    >
      {narrow ? (
        <>
          <div className="replay-debugger-panel flex flex-col flex-1 min-h-0 h-full">
            {panel(tab)}
          </div>
          <TabBar
            items={Tabs}
            selected={tab}
            onSelect={(id) => setTab(id as Tab)}
            hideOnScroll={false}
            className="replay-debugger-tabs shrink-0 relative! inset-auto!"
          />
        </>
      ) : (
        <Workspace<Tab>
          aria-label="The debugger"
          className="replay-debugger-workspace flex-1 min-h-0 border-0 rounded-none"
          defaultModel={defaultLayout}
          renderTabContent={(t: { data: Tab }) => (
            <div className="replay-debugger-panel flex flex-col flex-1 min-h-0 h-full">
              {panel(t.data)}
            </div>
          )}
        />
      )}
    </div>
  );
}
