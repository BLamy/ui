'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { Button } from '@/components/ui/button';
import { useCanvas } from '@/components/ui/canvas';
import { Diagram, DiagramToolbar, type DiagramData, type DiagramDataChangeDetails, type DiagramItem, type DiagramProps, type DiagramSelectionChangeDetails, type DiagramSelectionChangeReason } from '@/components/ui/diagram';
import { DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFramePanel, DiagramFrameSection, useDiagramFrame, type DiagramFrameProps } from '@/components/ui/diagram-frame';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Toolbar, ToolbarButton } from '@/components/ui/toolbar';
import { changeDetails } from '@/lib/change-details';
import { useControllableChange } from '@/lib/controllable-state';
import { useDiagramHistory } from '@/lib/diagram-history';
import type { DiagramDirection, DiagramLayoutDensity, DiagramLayoutResult } from '@/lib/diagram-layout';
import type { Rect } from '@/lib/canvas-math';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import { NOTHING_SELECTED, type DiagramConnection, type DiagramEdge, type DiagramNode, type DiagramSelection } from '@/lib/diagram-model';
import { Icon } from '@/lib/icon';
import { calloutVariants } from '@/lib/primitives';
import {
  addAction, addContextKey, addState, addTransition, inlineCodeIn, missingImplementations, removeAction, removeContextKey, removeItems, renameAction, renameContextKey, renameState, setContextValue, setInitial,
  setTransitionEvent, setTransitionGuard, setTransitionSource, setTransitionTarget, stateAt, tryEdit, uniqueName,
  type ActionsPlace, type StateMachineConfig, type StateMachineImplementations, type StatePath,
} from '@/lib/state-diagram-edit';
import {
  describeContextValue, machineEdgePlaces, machineStatePaths, machineToDraft, transitionNotation, type StateAction, type StateEdgeData, type StateMachineLike, type StateNodeData, type TransitionPlace,
} from '@/lib/state-diagram-model';
import { createSimulation, type Simulation, type SimulationState, type SimulationStandIns } from '@/lib/state-diagram-simulation';

export type { StateMachineLike } from '@/lib/state-diagram-model';
export type { StateMachineConfig, StateMachineImplementations } from '@/lib/state-diagram-edit';
export type { SimulationStandIns } from '@/lib/state-diagram-simulation';

/* ══ StateDiagram — a machine on a Diagram ══
   Hand it a machine from XState, its config as JSON, or its source text, and it draws it, from `machine.root`, which has
   everything resolved. No machine code runs: a config goes through XState's `createMachine`, and source is read by
   `parseXState` (`lib/state-diagram-source`) without being run. XState and ELK are optional peers, so a config or source
   needs `xstate` installed, and laying it out needs `elkjs`.

   Everything the machine says is drawn (`machineToDraft`, `lib/state-diagram-model`): the machine is the root container,
   its header its name and under it its Context; a state is a card, its header its name (with the final square or the
   history H), then its sections of chips (Entry actions, Exit actions, Invoke, Tags, Meta); a compound or parallel state
   holds its children, and where one starts is its entry marker; a transition's label is a pill with its event, or a card
   with the event over chips for its guard ("if canRetry"), its actions, a delay's clock, and how it goes (re-entering,
   no target, several targets). It runs top to bottom on a lined board.

   Without `editable` it's a picture you can select in and read: nothing moves, connects or is deleted. With `simulate`, it
   also runs a copy of it, with stand-ins for everything it names, so none of an app's code runs here either. Where it is
   is `current` on the board; each transition it can take now has a label that can be pressed (Diagram's `pressable`: a
   primary ring and a play badge, not color alone), which sends its event, as Enter on it does; and a panel offers what it can do next, with its
   context as it is now: a `DiagramFramePanel`, so a column beside the board when there's the room, a drawer over it at
   medium sizes, and a pushed page on a phone.

   With `editable`, what's drawn can be changed, and that writes to its config, which is plain data: states, transitions,
   events, guards, entry and exit actions, a transition's actions, and context keys. A machine's implementations stay out
   of it, by name, so an edit never touches code. Pressing a chip opens it in the panel. Whatever XState won't have is
   refused, with what it said. Undo and redo are the config's, on the Diagram's toolbar and its ⌘Z, through
   `<Diagram history>`. */

/** Why the config changed: an edit (on the board or in the panel), or undoing and redoing one. */
export type StateDiagramConfigChangeReason = 'edit' | 'undo' | 'redo';
export type StateDiagramConfigChangeDetails = ChangeDetails<StateDiagramConfigChangeReason>;

export interface StateDiagramProps extends Pick<DiagramProps, 'minimap' | 'background' | 'fitPadding' | 'aria-label' | 'viewport' | 'defaultViewport' | 'onViewportChange' | 'onAction'> {
  /** A machine, from `createMachine` or `setup(...).createMachine`. */
  machine?: StateMachineLike;
  /** Or a machine's source: TypeScript with one `createMachine({…})`, a config object, or JSON. It's read, never run. */
  source?: string;
  /** Or a machine's config, as JSON, controlled: edits are handed to `onConfigChange`, and what you pass back is shown. */
  config?: StateMachineConfig;
  /** A config to start from, left to the diagram: edits show at once. */
  defaultConfig?: StateMachineConfig;
  /** The config after each edit, undoing included, and why. `details.cancel()` refuses one when the config isn't controlled. */
  onConfigChange?: (config: StateMachineConfig, details: StateDiagramConfigChangeDetails) => void;
  /** Which way the layers run (default `down`, as XState's visualizer draws: it reads on a portrait frame and a phone). */
  direction?: DiagramDirection;
  /** How much room the layout leaves between things (`useDiagramLayout`'s): `compact` for a big machine, `default`,
   *  `comfortable`. */
  density?: DiagramLayoutDensity;
  /** A layout done ahead of time, on a server perhaps, shown until this one's ready. */
  layout?: DiagramLayoutResult<StateNodeData, StateEdgeData>;
  /** Run it here, with a panel to drive it. Pass stand-ins to say how guards answer, how long delays take, and which actors
   *  really run, which are read when it starts. */
  simulate?: boolean | SimulationStandIns;
  /** Let its states and transitions be added, removed and changed. That writes to its config, and never to its code. */
  editable?: boolean;
  /** What's behind the config's names, so that those with nothing are listed. A machine's own are used if there are none here. */
  implementations?: StateMachineImplementations;
  /** What's selected: states and transitions, by the ids `machineToDraft` gives them. Selecting works without `editable` too. */
  selection?: DiagramSelection;
  defaultSelection?: DiagramSelection;
  onSelectionChange?: (selection: DiagramSelection, details: DiagramSelectionChangeDetails) => void;
  /** Whether the panel shows, to control it. */
  panelOpen?: boolean;
  /** Whether the panel starts open. By default it does where it's a column beside the board, and not where it'd go over it. */
  defaultPanelOpen?: boolean;
  onPanelOpenChange?: DiagramFrameProps['onOpenChange'];
  /** How the panel shows (default `auto`: column, drawer or pushed page, by the frame's size class). */
  panelPresentation?: DiagramFrameProps['presentation'];
  className?: string;
  style?: CSSProperties;
}

const XSTATE_PEER = 'This needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';
const NO_CONFIG = 'Simulating needs a machine from XState, which has a config to run a copy of.';

/** A machine's source, read into its config without running it. The reader (and Babel) load only when there's source. */
function useSource(source: string | undefined): { config: StateMachineConfig | undefined; error: string | null } {
  const [read, setRead] = useState<{ source: string; config?: StateMachineConfig; error?: string } | null>(null);
  useEffect(() => {
    if (source === undefined) return undefined;
    let live = true;
    import('@/lib/state-diagram-source').then(({ parseXState }) => {
      if (!live) return;
      try {
        setRead({ source, config: parseXState(source) });
      } catch (e) {
        setRead({ source, error: e instanceof Error ? e.message : String(e) });
      }
    });
    return () => { live = false; };
  }, [source]);
  if (source === undefined || read?.source !== source) return { config: undefined, error: null };
  return { config: read.config, error: read.error ?? null };
}

/** The machine for a config, and XState's own error if it won't make one. */
function useMachine(machine: StateMachineLike | undefined, config: StateMachineConfig | undefined, known: WeakMap<object, StateMachineLike>): { machine: StateMachineLike | null; error: string | null } {
  const [made, setMade] = useState<{ config: unknown; machine: StateMachineLike | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!config || known.has(config)) return;
    let live = true;
    import('xstate').then(
      ({ createMachine }) => {
        if (!live) return;
        try {
          setMade({ config, machine: createMachine(config as never) as unknown as StateMachineLike, error: null });
        } catch (error) {
          setMade({ config, machine: null, error: error instanceof Error ? error.message : String(error) });
        }
      },
      () => { if (live) setMade({ config, machine: null, error: XSTATE_PEER }); },
    );
    return () => { live = false; };
  }, [config, known]);
  if (!config) return { machine: machine ?? null, error: null };
  const madeHere = known.get(config);
  if (madeHere) return { machine: madeHere, error: null };
  if (made?.config !== config) return { machine: null, error: null };
  return { machine: made.machine, error: made.error };
}

/** A simulation of the machine, while it's asked for. Stand-ins are read when one starts, so writing them inline doesn't start
 *  it over each time this renders. */
function useSimulation(machine: StateMachineLike | null, simulate: StateDiagramProps['simulate'], delays: Readonly<Record<string, unknown>> | undefined): { sim: Simulation | null; error: string | null } {
  const on = !!simulate;
  const standIns = useRef(simulate);
  standIns.current = simulate;
  const delaysNow = useRef(delays);
  delaysNow.current = delays;
  // How the guards were set, for when an edit starts it over.
  const guardsWere = useRef<Readonly<Record<string, boolean>> | null>(null);
  const [made, setMade] = useState<{ machine: StateMachineLike; sim: Simulation | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!machine || !on) return undefined;
    let live = true;
    let sim: Simulation | null = null;
    if (!machine.config) {
      setMade({ machine, sim: null, error: NO_CONFIG });
      return undefined;
    }
    import('xstate').then(
      (xstate) => {
        if (!live) return;
        const given = typeof standIns.current === 'object' ? standIns.current : undefined;
        // XState only looks at where a state starts when it's asked, and that's now.
        try {
          sim = createSimulation(xstate, machine.config, { ...given, guards: { ...given?.guards, ...guardsWere.current } }, delaysNow.current);
          setMade({ machine, sim, error: null });
        } catch (e) {
          setMade({ machine, sim: null, error: e instanceof Error ? e.message : String(e) });
        }
      },
      () => { if (live) setMade({ machine, sim: null, error: XSTATE_PEER }); },
    );
    return () => {
      live = false;
      if (sim) guardsWere.current = sim.get().guards;
      sim?.stop();
    };
  }, [machine, on]);
  // The last one stays up until the next one's ready, which is a moment, so that the panel doesn't blink.
  return on && made ? made : { sim: null, error: null };
}

const NOTHING_YET: readonly string[] = [];
const noSubscribe = () => () => undefined;

/** What a screen reader hears for a state: its name, what kind it is, where it is, what it does, and every way in and out. */
function describeState(node: DiagramNode<StateNodeData>, byId: ReadonlyMap<string, DiagramNode<StateNodeData>>, out: readonly DiagramEdge<StateEdgeData>[], into: readonly DiagramEdge<StateEdgeData>[]): string {
  const nameOf = (id: string) => byId.get(id)?.title || id;
  const data = node.data;
  const kind = data?.type === 'final' ? 'final state' : data?.type === 'parallel' ? 'parallel state' : data?.type === 'history' ? `${data.history === 'deep' ? 'deep ' : ''}history state` : node.parent ? 'state' : 'machine';
  const parent = node.parent ? byId.get(node.parent) : undefined;
  const where = parent?.parent ? `, in ${nameOf(parent.id)}` : '';
  const names = (list: readonly StateAction[]) => list.map((a) => a.name).join(', ');
  const does = [
    data?.entry.length ? `On entry: ${names(data.entry)}.` : '',
    data?.exit.length ? `On exit: ${names(data.exit)}.` : '',
    data?.invoke.length ? `Invokes ${data.invoke.map((i) => i.src).join(', ')}.` : '',
    data?.tags.length ? `Tagged ${data.tags.join(', ')}.` : '',
  ].filter(Boolean).map((t) => ` ${t}`).join('');
  const starts = node.entry ? ' Where it starts.' : '';
  const going = out.map((e) => `${transitionNotation(e.data)} ${e.to === node.id ? 'back to itself' : `to ${nameOf(e.to)}`}`);
  const coming = into.filter((e) => e.from !== node.id).map((e) => `${transitionNotation(e.data)} from ${nameOf(e.from)}`);
  const list = (items: string[], what: string) => (items.length ? ` ${items.length} ${what}: ${items.join(', ')}.` : '');
  return `${node.title ?? node.id}, ${kind}${where}.${does}${starts}${list(going, 'going out')}${list(coming, 'coming in')}`;
}

/** How long a drawer takes to slide in, and a frame more. */
const DRAWER_SETTLES = 360;

/** While the panel is a drawer over the board, what's current comes out from under it, into the part of the board it leaves. */
function RevealCurrent({ nodes, ids, board }: { nodes: readonly DiagramNode<StateNodeData>[]; ids: readonly string[]; board: RefObject<HTMLDivElement | null> }) {
  const { viewport, setViewport } = useCanvas();
  const { open, presentation } = useDiagramFrame();
  const key = open && presentation === 'drawer' && ids.length ? ids.join('\0') : null;
  const now = useRef({ viewport, nodes, ids });
  now.current = { viewport, nodes, ids };
  useEffect(() => {
    if (!key) return undefined;
    // Once the drawer's in place: it slides in, and where it's going is what counts.
    const reveal = () => {
      const host = board.current;
      const drawer = host?.closest('[data-slot=diagram-frame]')?.querySelector('[data-slot=diagram-frame-panel-body]');
      if (!host || !drawer) return;
      const b = host.getBoundingClientRect(), d = drawer.getBoundingClientRect();
      // The board that's left: beside the drawer, on whichever side it isn't.
      const atEnd = d.left - b.left > b.right - d.right;
      const room = atEnd ? { from: 0, to: d.left - b.left } : { from: d.right - b.left, to: b.width };
      const { viewport: v, nodes: all, ids: want } = now.current;
      const shown = all.filter((n) => want.includes(n.id));
      if (!shown.length) return;
      const x0 = Math.min(...shown.map((n) => n.x)), x1 = Math.max(...shown.map((n) => n.x + n.w));
      const left = x0 * v.zoom + v.x, right = x1 * v.zoom + v.x, margin = 24;
      if (left >= room.from + margin && right <= room.to - margin) return;
      const x = right - left + margin * 2 > room.to - room.from ? room.from + margin - x0 * v.zoom : room.to - margin - x1 * v.zoom;
      setViewport({ ...v, x }, { reason: 'imperative' });
    };
    const settled = setTimeout(reveal, DRAWER_SETTLES);
    return () => clearTimeout(settled);
  }, [key, board, setViewport]);
  return null;
}

/** What's selected comes into view, in the part of the board nothing covers (the toolbar, the bar, a drawer), when it's
 *  selected from outside the board (the panel, `selection`, `defaultSelection`): something selected on the board is in
 *  view already, and stays where it is. */
function RevealSelected({ nodes, edges, selection, board }: { nodes: readonly DiagramNode<StateNodeData>[]; edges: readonly DiagramEdge<StateEdgeData>[]; selection: DiagramSelection; board: RefObject<HTMLDivElement | null> }) {
  const { viewport, setViewport } = useCanvas();
  const key = [...selection.nodes, '', ...selection.edges].join('\0');
  const now = useRef({ viewport, nodes, edges, selection });
  now.current = { viewport, nodes, edges, selection };
  // What was last brought into view (or was in view already), so that a new layout doesn't move the view again.
  const done = useRef<string | null>(null);
  const placed = nodes.length > 0;
  useEffect(() => {
    if (!placed || done.current === key) return undefined;
    done.current = key;
    if (key === '\0') return undefined;
    // At once, unless a drawer's sliding in: then once it's where it's going.
    const drawerOpen = !!board.current?.closest('[data-slot=diagram-frame][data-presentation=drawer][data-open]');
    const settled = setTimeout(() => {
      const host = board.current;
      const { viewport: v, nodes: all, edges: lines, selection: sel } = now.current;
      if (!host) return;
      const rects: Rect[] = [
        ...all.filter((n) => sel.nodes.includes(n.id)),
        ...lines.filter((e) => sel.edges.includes(e.id)).flatMap((e) => (e.labelBox ? [e.labelBox] : [])),
      ];
      if (!rects.length) return;
      const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
      const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h));
      // The part of the board nothing covers.
      const b = host.getBoundingClientRect();
      const free = { left: 24, top: 24, right: b.width - 24, bottom: b.height - 24 };
      const tools = host.querySelector('[data-slot=diagram-overlay] [data-slot=toolbar]')?.getBoundingClientRect();
      if (tools) free.top = Math.max(free.top, tools.bottom - b.top + 12);
      const bar = host.querySelector('[data-slot=diagram-frame-bar]')?.getBoundingClientRect();
      if (bar) free.bottom = Math.min(free.bottom, bar.top - b.top - 12);
      const drawer = host.closest('[data-slot=diagram-frame][data-presentation=drawer][data-open]')?.querySelector('[data-slot=diagram-frame-panel-body]')?.getBoundingClientRect();
      if (drawer && drawer.width) {
        if (drawer.left - b.left > b.right - drawer.right) free.right = Math.min(free.right, drawer.left - b.left - 24);
        else free.left = Math.max(free.left, drawer.right - b.left + 24);
      }
      const left = x0 * v.zoom + v.x, right = x1 * v.zoom + v.x, top = y0 * v.zoom + v.y, bottom = y1 * v.zoom + v.y;
      if (left >= free.left && right <= free.right && top >= free.top && bottom <= free.bottom) return;
      // In the middle of what's free, or from its top-start corner when it's bigger than that.
      const x = right - left > free.right - free.left ? free.left - x0 * v.zoom : (free.left + free.right) / 2 - ((x0 + x1) / 2) * v.zoom;
      const y = bottom - top > free.bottom - free.top ? free.top - y0 * v.zoom : (free.top + free.bottom) / 2 - ((y0 + y1) / 2) * v.zoom;
      setViewport({ ...v, x, y }, { reason: 'imperative' });
    }, drawerOpen ? DRAWER_SETTLES : 0);
    return () => clearTimeout(settled);
  }, [key, placed, board, setViewport]);
  return null;
}

/* ── The panel ── */

const ms = (n: number) => `${Math.round(n).toLocaleString('en-US')} ms`;

function SimulationPanel({ sim }: { sim: Simulation }) {
  const state = useSyncExternalStore(sim.subscribe, sim.get, sim.get);
  const [running, setRunning] = useState(false);
  const canRun = state.next !== null;
  const run = running && canRun;
  // The clock goes by real time while it's running, and only as far as real time has, so a tab that's been hidden catches up.
  useEffect(() => {
    if (!run) return undefined;
    let last = performance.now();
    const tick = setInterval(() => {
      const now = performance.now();
      sim.advance(now - last);
      last = now;
    }, 100);
    return () => clearInterval(tick);
  }, [run, sim]);
  useEffect(() => { if (!canRun) setRunning(false); }, [canRun]);
  useEffect(() => { setRunning(false); }, [sim]);
  const guards = Object.keys(state.guards);
  return (
    <div data-slot="simulation-panel" data-status={state.status} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <div data-slot="simulation-now" role="status" className="text-subhead font-semibold [overflow-wrap:anywhere]">
          {state.now.join(', ')}{state.status === 'done' ? ' (finished)' : ''}
        </div>
        {state.error ? (
          <div data-slot="simulation-error" role="alert" className={calloutVariants({ tone: 'destructive' })}>
            <Icon name="exclamation-circle" size={16} />
            <span className="min-w-0 [overflow-wrap:anywhere]">{state.error}</span>
          </div>
        ) : null}
      </div>
      {state.events.length ? (
        <DiagramFrameSection title="Events it can take">
          <div className="flex flex-wrap gap-1.5">
            {state.events.map((event) => <Button key={event} data-action="send" data-event={event} variant="secondary" size="sm" onClick={() => sim.send(event)}>{event}</Button>)}
          </div>
        </DiagramFrameSection>
      ) : null}
      {state.finishes.length ? (
        <DiagramFrameSection title="Waiting on">
          <div className="flex flex-wrap gap-1.5">
            {state.finishes.map((f) => <Button key={f.event} data-action="finish" data-event={f.event} variant="secondary" size="sm" onClick={() => sim.send(f.event)}>{f.label}</Button>)}
          </div>
        </DiagramFrameSection>
      ) : null}
      {state.context ? (
        <DiagramFrameSection title="Context">
          <dl data-slot="simulation-context" className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-caption">
            {Object.entries(state.context).map(([key, value]) => (
              <div key={key} data-key={key} className="contents">
                <dt className="text-foreground/70">{key}</dt>
                <dd className="m-0 [overflow-wrap:anywhere]">{describeContextValue(value)}</dd>
              </div>
            ))}
          </dl>
        </DiagramFrameSection>
      ) : null}
      <DiagramFrameSection title="Time">
        <Toolbar aria-label="Time" size="sm" className="flex-wrap">
          <ToolbarButton data-action="next-timer" variant="secondary" disabled={!canRun} onClick={() => sim.stepTime()}>Next timer</ToolbarButton>
          <ToolbarButton data-action="run" variant="secondary" disabled={!canRun} onClick={() => setRunning(!running)}>{run ? 'Pause' : 'Run'}</ToolbarButton>
        </Toolbar>
        <div data-slot="simulation-time" className="text-footnote text-foreground/70 tabular-nums">
          {ms(state.time)}{state.next !== null ? `, next at ${ms(state.next)}` : ', nothing waiting'}
        </div>
      </DiagramFrameSection>
      {guards.length ? (
        <DiagramFrameSection title="Guards">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {guards.map((g) => (
              <li key={g} data-slot="simulation-guard" data-guard={g} className="flex items-center justify-between gap-2 text-footnote">
                <span className="min-w-0 [overflow-wrap:anywhere]">{g}</span>
                <Switch size="sm" aria-label={`${g} answers yes`} checked={state.guards[g]} onCheckedChange={(v) => sim.setGuard(g, v)} />
              </li>
            ))}
          </ul>
        </DiagramFrameSection>
      ) : null}
      <DiagramFrameSection title="What happened">
        <div>
          <Button data-action="reset" variant="secondary" size="sm" onClick={() => { setRunning(false); sim.reset(); }}>Reset</Button>
        </div>
        <ol data-slot="simulation-log" className="m-0 flex list-none flex-col-reverse gap-1 p-0 text-footnote">
          {state.log.map((entry) => (
            <li key={entry.id} data-slot="simulation-log-entry" className="[overflow-wrap:anywhere]">
              <span className="font-semibold">{entry.what}</span>
              <span className="text-foreground/70"> at {ms(entry.at)}, in {entry.now.join(', ')}</span>
            </li>
          ))}
        </ol>
      </DiagramFrameSection>
    </div>
  );
}

/* ── The panel, while editing ── */

/** Which field an edit came from, so that a refusal is that field's error (`name`, `event`, `guard`, `entry:2`,
 *  `actions:0`, `context:key`, `value:key`); `null` for the board and the panel's buttons. */
type EditFieldName = string;
interface Refusal { reason: string; field: EditFieldName | null }

/** A field that changes the config once you're done with it: Enter or leaving it commits, Escape puts it back. Refused, it
 *  says why under it. */
function EditField({ field, label, hideLabel, value, placeholder, refusal, onCommit, mono }: { field: EditFieldName; label: string; hideLabel?: boolean; value: string; placeholder?: string; refusal: Refusal | null; onCommit: (value: string) => void; mono?: boolean }) {
  const refused = refusal?.field === field ? refusal.reason : null;
  return (
    <Field invalid={!!refused} className="min-w-0 flex-1">
      <FieldLabel className={hideLabel ? 'sr-only' : undefined}>{label}</FieldLabel>
      <Input data-field={field} size="sm" value={value} placeholder={placeholder} autoCapitalize="off" autoCorrect="off" spellCheck={false} className={mono ? 'font-mono' : undefined} onValueCommit={onCommit} />
      <FieldError>{refused}</FieldError>
    </Field>
  );
}

/** A remove button for one row of a list in the panel. */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button data-action="remove" variant="ghost" size="icon-sm" aria-label={label} className="mt-0.5 shrink-0 text-foreground/70" onClick={onClick}>
      <Icon name="xmark" size={14} />
    </Button>
  );
}

/** A list of actions to change: each of the machine's own by its name, in a field; code and XState's built-ins as what they
 *  are, which can only be taken away; and a button to add one. */
function ActionList({ id, title, actions, refusal, onRename, onRemove, onAdd }: { id: string; title: string; actions: readonly StateAction[]; refusal: Refusal | null; onRename: (index: number, name: string) => void; onRemove: (index: number) => void; onAdd: () => void }) {
  return (
    <div data-slot="edit-actions" data-actions={id} className="flex flex-col gap-1.5">
      <span className="text-footnote text-foreground/70">{title}</span>
      {actions.map((a, i) => (
        <div key={i} data-slot="edit-action" className="flex items-start gap-1">
          {a.kind === 'named' ? (
            <EditField field={`${id}:${i}`} label={`${title}, ${i + 1}`} hideLabel value={a.name} refusal={refusal} onCommit={(name) => onRename(i, name)} />
          ) : (
            <span data-kind={a.kind} className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 text-footnote [overflow-wrap:anywhere]">
              <Icon name="bolt" size={12} className="shrink-0 text-foreground/70" />
              <span className="font-medium">{a.name}</span>
              {a.detail ? <span className="text-foreground/70">{a.detail}</span> : null}
            </span>
          )}
          <RemoveButton label={`Remove ${a.name} from ${title.toLowerCase()}`} onClick={() => onRemove(i)} />
        </div>
      ))}
      <div>
        <Button data-action={`add-${id}`} variant="secondary" size="sm" onClick={onAdd}>
          <Icon name="plus-circle" size={14} />
          Add
        </Button>
      </div>
    </div>
  );
}

/** A context value as it's typed in a field: JSON, or a string as it is. */
const valueText = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value) ?? '');
const readValue = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

interface EditPanelProps {
  refusal: Refusal | null;
  addStateHere: () => void;
  node: { id: string; label: string; path: StatePath; isStart: boolean; canStart: boolean; entry: readonly StateAction[]; exit: readonly StateAction[] } | null;
  edge: { label: string; event: string | null; guard: string; actions: readonly StateAction[] } | null;
  /** The machine's context, to change, when nothing's selected; null when it's made by code. */
  context: { entries: readonly [string, unknown][]; types: Readonly<Record<string, unknown>> } | null;
  renameNode: (name: string) => void;
  makeStart: () => void;
  addInside: () => void;
  removeSelected: () => void;
  renameEvent: (event: string) => void;
  setGuard: (guard: string) => void;
  actions: { rename: (at: 'entry' | 'exit' | 'actions', index: number, name: string) => void; remove: (at: 'entry' | 'exit' | 'actions', index: number) => void; add: (at: 'entry' | 'exit' | 'actions') => void };
  contextEdits: { rename: (key: string, next: string) => void; set: (key: string, text: string) => void; remove: (key: string) => void; add: () => void };
  missing: { kind: string; names: readonly string[] }[];
  inline: readonly string[];
}

function EditPanel({ refusal, addStateHere, node, edge, context, renameNode, makeStart, addInside, removeSelected, renameEvent, setGuard, actions, contextEdits, missing, inline }: EditPanelProps) {
  // A refusal of the board's, or of a button's, is the panel's; a field's is under the field.
  const general = refusal && !refusal.field ? refusal.reason : null;
  return (
    <div data-slot="edit-panel" className="flex flex-col gap-3.5">
      {general ? (
        <div data-slot="edit-refusal" role="alert" className={calloutVariants({ tone: 'destructive' })}>
          <Icon name="exclamation-circle" size={16} />
          <span className="min-w-0 [overflow-wrap:anywhere]">{general}</span>
        </div>
      ) : null}
      <div>
        <Button data-action="add-state" variant="secondary" size="sm" onClick={addStateHere}>Add state</Button>
      </div>
      {node ? (
        <DiagramFrameSection title="This state">
          <EditField field="name" label="Name" value={node.label} refusal={refusal} onCommit={renameNode} />
          <ActionList id="entry" title="Entry actions" actions={node.entry} refusal={refusal} onRename={(i, n) => actions.rename('entry', i, n)} onRemove={(i) => actions.remove('entry', i)} onAdd={() => actions.add('entry')} />
          <ActionList id="exit" title="Exit actions" actions={node.exit} refusal={refusal} onRename={(i, n) => actions.rename('exit', i, n)} onRemove={(i) => actions.remove('exit', i)} onAdd={() => actions.add('exit')} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {node.canStart ? <Button data-action="make-start" variant="secondary" size="sm" disabled={node.isStart} onClick={makeStart}>{node.isStart ? 'It starts here' : 'Start here'}</Button> : null}
            <Button data-action="add-inside" variant="secondary" size="sm" onClick={addInside}>Add one inside</Button>
            <Button data-action="delete" variant="secondary" size="sm" className="text-destructive" onClick={removeSelected}>Delete</Button>
          </div>
        </DiagramFrameSection>
      ) : edge ? (
        <DiagramFrameSection title="This transition">
          {edge.event !== null ? <EditField field="event" label="Event" value={edge.event} refusal={refusal} onCommit={renameEvent} /> : <div className="text-footnote">{edge.label}</div>}
          <EditField field="guard" label="Guard" value={edge.guard} placeholder="None" refusal={refusal} onCommit={setGuard} />
          <ActionList id="actions" title="Actions" actions={edge.actions} refusal={refusal} onRename={(i, n) => actions.rename('actions', i, n)} onRemove={(i) => actions.remove('actions', i)} onAdd={() => actions.add('actions')} />
          <div className="pt-1"><Button data-action="delete" variant="secondary" size="sm" className="text-destructive" onClick={removeSelected}>Delete</Button></div>
        </DiagramFrameSection>
      ) : (
        <>
          <p data-slot="edit-hint" className="m-0 text-footnote text-foreground/70">Select a state or a transition to change it. To connect two states, select one and drag from a dot on its edge, or press C.</p>
          {context ? (
            <DiagramFrameSection title="Context">
              <div data-slot="edit-context" className="flex flex-col gap-1.5">
                {context.entries.map(([key, value]) => (
                  // The key over its value, each the panel's width: a key is read whole, whatever its length.
                  <div key={key} data-key={key} className="flex items-start gap-1">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <EditField field={`context:${key}`} label={`Context key ${key}`} hideLabel mono value={key} refusal={refusal} onCommit={(next) => contextEdits.rename(key, next)} />
                      {typeof context.types[key] === 'string' && value === undefined ? (
                        <span className="flex min-h-8 min-w-0 items-center ps-2.5 font-mono text-caption text-foreground/70">{String(context.types[key])}</span>
                      ) : (
                        <EditField field={`value:${key}`} label={`Value of ${key}`} hideLabel mono value={valueText(value)} placeholder="No value" refusal={refusal} onCommit={(text) => contextEdits.set(key, text)} />
                      )}
                    </div>
                    <RemoveButton label={`Remove ${key} from the context`} onClick={() => contextEdits.remove(key)} />
                  </div>
                ))}
                <div>
                  <Button data-action="add-context" variant="secondary" size="sm" onClick={contextEdits.add}>
                    <Icon name="plus-circle" size={14} />
                    Add key
                  </Button>
                </div>
              </div>
            </DiagramFrameSection>
          ) : null}
        </>
      )}
      {missing.length ? (
        <DiagramFrameSection title="Named, with nothing behind them">
          <ul data-slot="edit-missing" className="m-0 flex list-none flex-col gap-1 p-0 text-footnote">
            {missing.map((m) => <li key={m.kind} data-kind={m.kind} className="[overflow-wrap:anywhere]"><span className="text-foreground/70">{m.kind}:</span> {m.names.join(', ')}</li>)}
          </ul>
        </DiagramFrameSection>
      ) : null}
      {inline.length ? (
        <DiagramFrameSection title="Code in the config, which JSON can’t hold">
          <ul data-slot="edit-inline" className="m-0 flex list-none flex-col gap-1 p-0 text-footnote [overflow-wrap:anywhere]">
            {inline.map((path) => <li key={path}>{path}</li>)}
          </ul>
        </DiagramFrameSection>
      ) : null}
    </div>
  );
}

/* ── Sending from the board ── */

/** The transitions a simulation can take now: from a state it's in, on an event (or an actor's finish) it can take, through a
 *  guard that answers yes. */
function enabledEdges(edges: readonly DiagramEdge<StateEdgeData>[], state: SimulationState | null): Set<string> {
  const out = new Set<string>();
  if (!state || state.status !== 'active') return out;
  const events = new Set([...state.events, ...state.finishes.map((f) => f.event)]);
  const active = new Set(state.active);
  for (const e of edges) {
    const d = e.data;
    if (!d?.event || !active.has(e.from)) continue;
    if (!events.has(d.event)) continue;
    if (d.guard && state.guards[d.guard.name] === false) continue;
    out.add(e.id);
  }
  return out;
}

/* ── StateDiagram ── */

const isOwnEvent = (place: TransitionPlace | undefined, state: StateMachineConfig | null) => !!place?.event && !!(state?.on as Record<string, unknown> | undefined)?.[place.event];
const eventsOf = (state: StateMachineConfig | null) => Object.keys((state?.on as Record<string, unknown> | undefined) ?? {});
const statesOf = (state: StateMachineConfig | null) => Object.keys((state?.states as Record<string, unknown> | undefined) ?? {});
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function StateDiagram({
  machine: given, source, config, defaultConfig, onConfigChange, direction, density, layout: initialLayout, simulate, editable = false, implementations,
  selection: selectionProp, defaultSelection = NOTHING_SELECTED, onSelectionChange, panelOpen, defaultPanelOpen, onPanelOpenChange, panelPresentation,
  background = 'grid', minimap = 'auto', onAction, className, style, 'aria-label': ariaLabel, ...diagram
}: StateDiagramProps) {
  /* ── What's being shown: `config` when it's controlled; otherwise what it started from (`defaultConfig`, `source` or
        `machine`), until there's an edit to show instead ── */
  const known = useRef(new WeakMap<object, StateMachineLike>()).current;
  const controlled = config !== undefined;
  const read = useSource(controlled || defaultConfig !== undefined ? undefined : source);
  const start = defaultConfig ?? read.config;
  // Something new to start from starts over: what's undone from here is only what was done here.
  const origin = defaultConfig ?? (source !== undefined ? read.config ?? source : given);
  const [held, setHeld] = useState<{ origin: unknown; config: StateMachineConfig } | null>(null);
  const shown = controlled ? config : held && held.origin === origin ? held.config : start;
  const { machine, error } = useMachine(shown ? undefined : given, shown, known);
  const { draft, paths, places, draftError } = useMemo(() => {
    const places = new Map<string, TransitionPlace>();
    const nothing = { draft: { nodes: [], edges: [] }, paths: new Map<string, StatePath>(), places };
    if (!machine) return { ...nothing, draftError: null };
    // A machine that's only half made shows up here, as XState only looks at where a state starts when it's asked.
    try {
      return { draft: machineToDraft(machine, (_t, id, place) => { places.set(id, place); }), paths: machineStatePaths(machine), places, draftError: null };
    } catch (e) {
      return { ...nothing, draftError: e instanceof Error ? e.message : String(e) };
    }
  }, [machine]);
  const board = useRef<HTMLDivElement>(null);
  const laid = useDiagramLayout(draft, { host: board, direction, density, initial: initialLayout });
  const behind = implementations ?? given?.implementations;
  const { sim, error: simError } = useSimulation(machine, simulate, behind?.delays);

  /* ── Editing ── */
  const [xstate, setXState] = useState<typeof import('xstate') | null>(null);
  const [xstateError, setXStateError] = useState<string | null>(null);
  useEffect(() => {
    if (!editable) return undefined;
    let live = true;
    import('xstate').then((x) => { if (live) setXState(x); }, () => { if (live) setXStateError(XSTATE_PEER); });
    return () => { live = false; };
  }, [editable]);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // The field a pressed chip asks for, so the panel opens on it.
  const [focus, setFocus] = useState<string | null>(null);
  const [selection, setSelection] = useControllableChange<DiagramSelection, DiagramSelectionChangeReason>(selectionProp, defaultSelection, onSelectionChange);
  const select = (next: DiagramSelection) => setSelection(next, { reason: 'imperative' });
  const base = (shown ?? (given?.config as StateMachineConfig | undefined)) ?? null;
  useEffect(() => { setRefusal(null); }, [origin, config]);
  /** Shows a config, by telling the caller, and holding it here when it isn't controlled. False when it was refused. */
  const show = (next: StateMachineConfig, reason: StateDiagramConfigChangeReason, event?: Event) => {
    const details = changeDetails<StateDiagramConfigChangeReason>({ reason, event });
    onConfigChange?.(next, details);
    if (details.canceled) return false;
    if (!controlled) setHeld({ origin, config: next });
    return true;
  };
  // The config's history, which the Diagram's toolbar and ⌘Z drive. A config from outside starts it over.
  const history = useDiagramHistory<StateMachineConfig | null>(base, (to, details) => {
    if (!to) return false;
    setRefusal(null);
    return show(to, details.reason, details.event);
  });
  /** Does an edit if XState will have it, and says why not if it won't. What it hands back is the machine, to find things in. */
  const commit = (edit: (c: StateMachineConfig) => StateMachineConfig, field: EditFieldName | null = null): StateMachineLike | null => {
    if (!xstate || !base) return null;
    const outcome = tryEdit<StateMachineLike>(xstate as never, base, edit);
    if (!outcome.ok) {
      setRefusal({ reason: outcome.reason, field });
      return null;
    }
    setRefusal(null);
    if (outcome.config === base) return machine;
    if (machine) known.set(base, machine);
    known.set(outcome.config, outcome.machine);
    if (!show(outcome.config, 'edit')) return null;
    history.record(base, outcome.config);
    return outcome.machine;
  };
  const selectState = (made: StateMachineLike, path: StatePath) => {
    for (const [id, p] of machineStatePaths(made)) if (p.join('\0') === path.join('\0')) { select({ nodes: [id], edges: [] }); return; }
  };
  const selectTransition = (made: StateMachineLike, path: StatePath, event: string | null, index: number) => {
    for (const [id, place] of machineEdgePlaces(made)) if (place.state.join('\0') === path.join('\0') && place.event === event && place.index === index) { select({ nodes: [], edges: [id] }); return; }
  };

  /** What's on the board has changed, and what that means is an edit. The board's data is the layout of the config, so
   *  the change itself is refused, and the config's edit is what redraws it. */
  const onDiagramChange = (change: DiagramData<StateNodeData, StateEdgeData>, details: DiagramDataChangeDetails) => {
    details.cancel();
    if (details.reason === 'connect') {
      const had = new Set(laid.edges.map((e) => e.id));
      const edge = change.edges.find((e) => !had.has(e.id));
      const from = edge && paths.get(edge.from), to = edge && paths.get(edge.to);
      if (!from || !to || !base) return;
      const event = uniqueName('EVENT', eventsOf(stateAt(base, from)));
      const made = commit((c) => addTransition(c, from, event, to));
      if (made) selectTransition(made, from, event, 0);
    } else if (details.reason === 'reconnect') {
      const before = new Map(laid.edges.map((e) => [e.id, e]));
      const edge = change.edges.find((e) => { const was = before.get(e.id); return was && (was.from !== e.from || was.to !== e.to); });
      const was = edge && before.get(edge.id);
      const place = edge && places.get(edge.id);
      if (!edge || !was || !place) return;
      const from = paths.get(edge.from), to = paths.get(edge.to);
      if (!from || !to) return;
      const made = commit((c) => (was.from !== edge.from ? setTransitionSource(c, place, from) : setTransitionTarget(c, place, to)));
      if (made) select(NOTHING_SELECTED);
    } else if (details.reason === 'delete') {
      const nodesLeft = new Set(change.nodes.map((n) => n.id));
      const edgesLeft = new Set(change.edges.map((e) => e.id));
      const states = laid.nodes.filter((n) => !nodesLeft.has(n.id)).flatMap((n) => { const p = paths.get(n.id); return p ? [p] : []; });
      // What's attached to a state that's going goes with it.
      const transitions = laid.edges.filter((e) => !edgesLeft.has(e.id) && nodesLeft.has(e.from) && nodesLeft.has(e.to)).flatMap((e) => { const p = places.get(e.id); return p ? [p] : []; });
      const made = commit((c) => removeItems(c, { states, transitions }));
      if (made) select(NOTHING_SELECTED);
    }
    // Moving isn't on, as where things are is ELK's; undoing is the config's history, which the Diagram drives.
  };
  const validConnection = (c: DiagramConnection): boolean | string => paths.has(c.from) && paths.has(c.to);

  /* ── What the panel's about ── */
  const selectedNode = selection.nodes.length === 1 && !selection.edges.length ? draft.nodes.find((n) => n.id === selection.nodes[0]) : undefined;
  const selectedEdge = selection.edges.length === 1 && !selection.nodes.length ? draft.edges?.find((e) => e.id === selection.edges[0]) : undefined;
  const nodePath = selectedNode ? paths.get(selectedNode.id) : undefined;
  const edgePlace = selectedEdge ? places.get(selectedEdge.id) : undefined;
  const parentOfNode = nodePath?.length && base ? stateAt(base, nodePath.slice(0, -1)) : null;
  /** A new state's a sibling of what's selected, unless that holds others, or nothing's selected. */
  const addStateHere = () => {
    if (!base) return;
    const holds = nodePath && statesOf(stateAt(base, nodePath)).length;
    const parent = nodePath ? (holds ? nodePath : nodePath.slice(0, -1)) : [];
    const name = uniqueName('state', statesOf(stateAt(base, parent)));
    const made = commit((c) => addState(c, parent, name));
    if (made) selectState(made, [...parent, name]);
  };
  const addInside = () => {
    if (!base || !nodePath) return;
    const name = uniqueName('state', statesOf(stateAt(base, nodePath)));
    const made = commit((c) => addState(c, nodePath, name));
    if (made) selectState(made, [...nodePath, name]);
  };
  const renameNode = (name: string) => {
    if (!nodePath) return;
    const made = commit((c) => renameState(c, nodePath, name), 'name');
    if (made) selectState(made, [...nodePath.slice(0, -1), name]);
  };
  const makeStart = () => {
    if (nodePath?.length) commit((c) => setInitial(c, nodePath.slice(0, -1), nodePath[nodePath.length - 1]!));
  };
  const removeSelected = () => {
    const made = nodePath
      ? commit((c) => removeItems(c, { states: [nodePath] }))
      : edgePlace ? commit((c) => removeItems(c, { transitions: [edgePlace] })) : null;
    if (made) select(NOTHING_SELECTED);
  };
  const renameEvent = (event: string) => {
    if (!edgePlace || !base) return;
    const list = (stateAt(base, edgePlace.state)?.on as Record<string, unknown> | undefined)?.[event];
    const made = commit((c) => setTransitionEvent(c, edgePlace, event), 'event');
    if (made) selectTransition(made, edgePlace.state, event, Array.isArray(list) ? list.length : list === undefined ? 0 : 1);
  };
  const setGuard = (guard: string) => {
    if (!edgePlace) return;
    const made = commit((c) => setTransitionGuard(c, edgePlace, guard.trim() || null), 'guard');
    if (made) selectTransition(made, edgePlace.state, edgePlace.event, edgePlace.index);
  };
  /** Where a list of actions in the panel is written: the selected state's entry or exit, or the selected transition's. */
  const actionsAt = (at: 'entry' | 'exit' | 'actions'): ActionsPlace | null => (at === 'actions' ? (edgePlace ? { transition: edgePlace } : null) : nodePath ? { state: nodePath, slot: at } : null);
  /** After an edit to a transition's actions, the same transition stays selected: its place is the same. */
  const keepSelected = (made: StateMachineLike | null) => {
    if (made && edgePlace) selectTransition(made, edgePlace.state, edgePlace.event, edgePlace.index);
  };
  const actionsOf = (at: 'entry' | 'exit' | 'actions') => (at === 'actions' ? selectedEdge?.data?.actions ?? [] : selectedNode?.data?.[at] ?? []);
  const actionEdits = {
    rename: (at: 'entry' | 'exit' | 'actions', index: number, name: string) => {
      const where = actionsAt(at);
      if (where) keepSelected(commit((c) => renameAction(c, where, index, name), `${at}:${index}`));
    },
    remove: (at: 'entry' | 'exit' | 'actions', index: number) => {
      const where = actionsAt(at);
      if (where) keepSelected(commit((c) => removeAction(c, where, index)));
    },
    add: (at: 'entry' | 'exit' | 'actions') => {
      const where = actionsAt(at);
      if (!where) return;
      const name = uniqueName('action', actionsOf(at).map((a) => a.name));
      const made = commit((c) => addAction(c, where, name));
      keepSelected(made);
      if (made) setFocus(`${at}:${actionsOf(at).length}`);
    },
  };
  const contextConfig = base && (base.context === undefined || isPlainObject(base.context)) ? (base.context as Record<string, unknown> | undefined) ?? {} : null;
  const contextTypes = base && isPlainObject(base.types) && isPlainObject(base.types.context) ? base.types.context : {};
  const contextEdits = {
    rename: (key: string, next: string) => { commit((c) => renameContextKey(c, key, next), `context:${key}`); },
    set: (key: string, text: string) => { commit((c) => setContextValue(c, key, readValue(text)), `value:${key}`); },
    remove: (key: string) => { commit((c) => removeContextKey(c, key)); },
    add: () => {
      const key = uniqueName('key', [...Object.keys(contextConfig ?? {}), ...Object.keys(contextTypes)]);
      if (commit((c) => addContextKey(c, key))) setFocus(`context:${key}`);
    },
  };
  const missing = useMemo(() => {
    if (!editable || !base) return [];
    const names = missingImplementations(base, behind);
    return (['guards', 'actions', 'actors', 'delays'] as const).filter((k) => names[k].length).map((kind) => ({ kind, names: names[kind] }));
  }, [editable, base, behind]);
  const inline = useMemo(() => (editable && base ? inlineCodeIn(base) : []), [editable, base]);

  /* ── What's drawn ── */
  const problem = read.error ?? error ?? draftError ?? laid.error?.message ?? simError ?? xstateError;
  const name = ariaLabel ?? (machine ? `State machine ${laid.nodes.find((n) => !n.parent)?.title ?? machine.root.key ?? machine.root.id}` : 'State machine');

  // Only what's current, so time going by doesn't redraw the board.
  const active = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().active ?? NOTHING_YET, () => NOTHING_YET);
  const taken = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().taken ?? NOTHING_YET, () => NOTHING_YET);
  const now = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().now ?? NOTHING_YET, () => NOTHING_YET);
  const simState = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get() ?? null, () => null);
  const rootId = machine?.root.id;
  const where = useMemo(() => ({ nodes: active.filter((id) => id !== rootId), edges: [...taken] }), [active, taken, rootId]);
  // The states it's in that hold none it's in: what to bring out from under a drawer.
  const leaves = useMemo(() => where.nodes.filter((id) => !draft.nodes.some((n) => n.parent === id && where.nodes.includes(n.id))), [where, draft]);
  // What it can take now, which a press on the board sends.
  // The same set while it says the same, so time going by doesn't redraw the board.
  const enabledIds = [...enabledEdges(laid.edges, simState)].join('\0');
  const enabled = useMemo(() => new Set(enabledIds ? enabledIds.split('\0') : []), [enabledIds]);
  // Their labels can be pressed, which sends: the Diagram draws them as buttons, with a ring and a play badge.
  const sendable = useMemo(() => (sim ? { nodes: [], edges: [...enabled] } : undefined), [sim, enabled]);

  const byId = useMemo(() => new Map(laid.nodes.map((n) => [n.id, n])), [laid.nodes]);
  const ends = useMemo(() => {
    const out = new Map<string, DiagramEdge<StateEdgeData>[]>(), into = new Map<string, DiagramEdge<StateEdgeData>[]>();
    for (const e of laid.edges) {
      out.set(e.from, [...(out.get(e.from) ?? []), e]);
      into.set(e.to, [...(into.get(e.to) ?? []), e]);
    }
    return { out, into };
  }, [laid.edges]);
  const describe = useCallback((n: DiagramNode<StateNodeData>) => describeState(n, byId, ends.out.get(n.id) ?? [], ends.into.get(n.id) ?? []), [byId, ends]);
  const describeTransition = useCallback((e: DiagramEdge<StateEdgeData>) => {
    const nameOf = (id: string) => byId.get(id)?.title ?? id;
    return `${transitionNotation(e.data)}, edge from ${nameOf(e.from)} to ${nameOf(e.to)}.${enabled.has(e.id) ? ' It can be sent now: press Enter.' : ''}`;
  }, [byId, enabled]);

  const send = (event: string) => sim?.send(event);
  /** A press on (or Enter on) a transition it can take sends it; a chip pressed while editing opens it in the panel. */
  const act = (item: DiagramItem, details: Parameters<NonNullable<DiagramProps['onAction']>>[1]) => {
    onAction?.(item, details);
    if (item.kind === 'edge' && !item.item && enabled.has(item.id)) {
      const event = laid.edges.find((e) => e.id === item.id)?.data?.event;
      if (event) send(event);
      return;
    }
    if (item.item === undefined) return;
    select(item.kind === 'node' ? { nodes: [item.id], edges: [] } : { nodes: [], edges: [item.id] });
    const owner = item.kind === 'node' ? byId.get(item.id) : undefined;
    // An entry or exit action's field; a transition's action's (`action-2`) or its guard's; a context key's.
    if (owner && !owner.parent && item.section === 'context') { select(NOTHING_SELECTED); setFocus(`context:${item.item}`); }
    else if (item.section === 'label') setFocus(item.item.startsWith('action-') ? `actions:${item.item.slice('action-'.length)}` : item.item === 'guard' ? 'guard' : `label:${item.item}`);
    else setFocus(`${item.section}:${item.item}`);
  };
  // The field a pressed chip asked for gets focus once the panel shows it (after the selection it made has rendered).
  useEffect(() => {
    if (!focus) return undefined;
    let tries = 0;
    let frame = 0;
    const find = () => {
      const panel = board.current?.closest('[data-slot=diagram-frame]');
      const input = panel?.querySelector<HTMLInputElement>(`[data-field="${CSS.escape(focus)}"]`);
      if (input) { input.focus(); setFocus(null); return; }
      if (++tries < 20) frame = requestAnimationFrame(find);
      else setFocus(null);
    };
    frame = requestAnimationFrame(find);
    return () => cancelAnimationFrame(frame);
  }, [focus, selection]);

  const [tab, setTab] = useState<'run' | 'edit'>('edit');
  const showEdit = editable && !!xstate && !!base;
  const both = !!sim && showEdit;
  const title = both ? 'State machine' : showEdit ? 'Edit' : 'Simulation';
  const editPanel = showEdit ? (
    <EditPanel
      refusal={refusal}
      addStateHere={addStateHere}
      node={selectedNode && nodePath && selectedNode.parent ? {
        id: selectedNode.id, label: selectedNode.title ?? '', path: nodePath,
        isStart: !!parentOfNode && (typeof parentOfNode.initial === 'object' ? (parentOfNode.initial as { target?: unknown }).target : parentOfNode.initial) === nodePath[nodePath.length - 1],
        canStart: nodePath.length > 0 && parentOfNode?.type !== 'parallel',
        entry: selectedNode.data?.entry ?? [], exit: selectedNode.data?.exit ?? [],
      } : null}
      edge={selectedEdge && edgePlace ? {
        label: transitionNotation(selectedEdge.data),
        event: isOwnEvent(edgePlace, base && stateAt(base, edgePlace.state)) ? edgePlace.event : null,
        guard: selectedEdge.data?.guard?.text ?? '',
        actions: selectedEdge.data?.actions ?? [],
      } : null}
      context={contextConfig ? { entries: [...new Set([...Object.keys(contextConfig), ...Object.keys(contextTypes)])].map((k) => [k, contextConfig[k]] as [string, unknown]), types: contextTypes } : null}
      renameNode={renameNode}
      makeStart={makeStart}
      addInside={addInside}
      removeSelected={removeSelected}
      renameEvent={renameEvent}
      setGuard={setGuard}
      actions={actionEdits}
      contextEdits={contextEdits}
      missing={missing}
      inline={inline}
    />
  ) : null;
  const simulationPanel = sim ? <SimulationPanel key="run" sim={sim} /> : null;
  // Running goes on while you're looking at something else, so its panel stays mounted, hidden.
  const panel = both ? (
    <Tabs value={tab} onValueChange={(id) => setTab(id as 'run' | 'edit')} size="sm">
      <TabsList aria-label="What the panel shows">
        <TabsTab value="edit">Edit</TabsTab>
        <TabsTab value="run">Run</TabsTab>
      </TabsList>
      <TabsPanel value="edit" keepMounted className="pt-3">{editPanel}</TabsPanel>
      <TabsPanel value="run" keepMounted className="pt-3">{simulationPanel}</TabsPanel>
    </Tabs>
  ) : simulationPanel ?? editPanel;
  const status = now.length ? `In ${now.join(', ')}` : selectedNode?.title ?? (laid.status === 'pending' ? 'Laying out…' : name);
  return (
    <DiagramFrame
      data-state-diagram=""
      open={panelOpen}
      defaultOpen={defaultPanelOpen}
      onOpenChange={onPanelOpenChange}
      presentation={panelPresentation}
      className={className}
      style={style}
    >
      <DiagramFrameBoard ref={board}>
        <Diagram<StateNodeData, StateEdgeData>
          nodes={laid.nodes}
          edges={laid.edges}
          current={where}
          aria-label={name}
          noun="state"
          describeNode={describe}
          describeEdge={describeTransition}
          loading={laid.status === 'pending' && !problem}
          error={problem ?? undefined}
          selection={selection}
          onSelectionChange={setSelection}
          background={background}
          onAction={act}
          pressable={sendable}
          {...(editable ? { editable: true, movable: false, history, onDataChange: onDiagramChange, isValidConnection: validConnection } : null)}
          overlay={<DiagramToolbar />}
          minimap={minimap}
          {...diagram}
        >
          <RevealCurrent nodes={laid.nodes} ids={leaves} board={board} />
          <RevealSelected nodes={laid.nodes} edges={laid.edges} selection={selection} board={board} />
        </Diagram>
        {panel ? <DiagramFrameBar>{status}</DiagramFrameBar> : null}
      </DiagramFrameBoard>
      {panel ? <DiagramFramePanel title={title}>{panel}</DiagramFramePanel> : null}
    </DiagramFrame>
  );
}
