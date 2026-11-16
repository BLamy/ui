'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Diagram, DiagramToolbar, type DiagramData, type DiagramDataChangeDetails, type DiagramProps } from '@/components/ui/diagram';
import { DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFrameInput, DiagramFramePanel, DiagramFrameSection, type DiagramFrameProps } from '@/components/ui/diagram-frame';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Toolbar, ToolbarButton } from '@/components/ui/toolbar';
import type { DiagramDirection, DiagramLayoutResult } from '@/lib/diagram-layout';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import { NOTHING_SELECTED, type DiagramConnection, type DiagramSelection } from '@/lib/diagram-model';
import {
  addState, addTransition, inlineCodeIn, missingImplementations, removeItems, renameState, setInitial, setTransitionEvent, setTransitionGuard, setTransitionSource, setTransitionTarget, stateAt, tryEdit, uniqueName,
  type MachineConfig, type MachineImplementations, type StatePath,
} from '@/lib/state-diagram-edit';
import { machineEdgePlaces, machineStatePaths, machineToDraft, type MachineLike, type StateEdgeData, type StateNodeData, type TransitionPlace } from '@/lib/state-diagram-model';
import { createSimulation, type Simulation, type SimulationStandIns } from '@/lib/state-diagram-simulation';

/* ══ StateDiagram — a machine on a Diagram ══
   Hand it a machine from XState, or a machine's config as JSON, and it draws it, from `machine.root`, which has everything
   resolved. No machine code runs. XState and ELK are optional peers, so a config needs `xstate` installed, and laying it out
   needs `elkjs`.

   With `simulate`, it also runs a copy of it, with stand-ins for everything it names, so none of an app's code runs here
   either. Where it is is `current` on the board, and a panel offers what it can do next: a `DiagramFramePanel`, so a
   column beside the board when there's the room, a drawer over it at medium sizes, and a pushed page on a phone.

   With `editable`, what's drawn can be changed, and that writes to its config, which is plain data. A machine's implementations
   stay out of it, by name, so an edit never touches code. Whatever XState won't have is refused, with what it said. */

export interface StateDiagramProps extends Pick<DiagramProps, 'minimap' | 'background' | 'fitPadding' | 'aria-label' | 'viewport' | 'defaultViewport' | 'onViewportChange'> {
  /** A machine, from `createMachine` or `setup(...).createMachine`. */
  machine?: MachineLike;
  /** Or a machine's config, as JSON. */
  config?: Record<string, unknown>;
  /** Which way the layers run (default `right`). */
  direction?: DiagramDirection;
  /** A layout done ahead of time, on a server perhaps, shown until this one's ready. */
  layout?: DiagramLayoutResult<StateNodeData, StateEdgeData>;
  /** Run it here, with a panel to drive it. Pass stand-ins to say how guards answer, how long delays take, and which actors
   *  really run, which are read when it starts. */
  simulate?: boolean | SimulationStandIns;
  /** Let its states and transitions be added, removed and changed. That writes to its config, and never to its code. */
  editable?: boolean;
  /** Called with the config after each edit, undoing included. With `config`, it's for you to pass it back. */
  onConfigChange?: (config: MachineConfig) => void;
  /** What's behind the config's names, so that those with nothing are listed. A machine's own are used if there are none here. */
  implementations?: MachineImplementations;
  /** What's selected to begin with, while editing. */
  defaultSelection?: DiagramSelection;
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

/** The machine for a config, and XState's own error if it won't make one. */
function useMachine(machine: MachineLike | undefined, config: Record<string, unknown> | undefined, known: WeakMap<object, MachineLike>): { machine: MachineLike | null; error: string | null } {
  const [made, setMade] = useState<{ config: unknown; machine: MachineLike | null; error: string | null } | null>(null);
  useEffect(() => {
    if (machine || !config || known.has(config)) return;
    let live = true;
    import('xstate').then(
      ({ createMachine }) => {
        if (!live) return;
        try {
          const m = createMachine(config as never) as unknown as MachineLike;
          setMade({ config, machine: m, error: null });
        } catch (error) {
          setMade({ config, machine: null, error: error instanceof Error ? error.message : String(error) });
        }
      },
      () => { if (live) setMade({ config, machine: null, error: XSTATE_PEER }); },
    );
    return () => { live = false; };
  }, [machine, config, known]);
  if (machine) return { machine, error: null };
  if (!config) return { machine: null, error: 'A StateDiagram needs a machine or a config.' };
  const madeHere = known.get(config);
  if (madeHere) return { machine: madeHere, error: null };
  if (made?.config !== config) return { machine: null, error: null };
  return { machine: made.machine, error: made.error };
}

/** A simulation of the machine, while it's asked for. Stand-ins are read when one starts, so writing them inline doesn't start
 *  it over each time this renders. */
function useSimulation(machine: MachineLike | null, simulate: StateDiagramProps['simulate'], delays: Readonly<Record<string, unknown>> | undefined): { sim: Simulation | null; error: string | null } {
  const on = !!simulate;
  const standIns = useRef(simulate);
  standIns.current = simulate;
  const delaysNow = useRef(delays);
  delaysNow.current = delays;
  // How the guards were set, for when an edit starts it over.
  const guardsWere = useRef<Readonly<Record<string, boolean>> | null>(null);
  const [made, setMade] = useState<{ machine: MachineLike; sim: Simulation | null; error: string | null } | null>(null);
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
      <div>
        <div data-slot="simulation-now" role="status" className="text-subhead font-semibold [overflow-wrap:anywhere]">
          {state.now.join(', ')}{state.status === 'done' ? ' (finished)' : ''}
        </div>
        {state.error ? <div data-slot="simulation-error" role="alert" className="mt-1 text-footnote text-destructive">{state.error}</div> : null}
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

interface EditPanelProps {
  refusal: string | null;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addStateHere: () => void;
  node: { id: string; label: string; path: StatePath; isStart: boolean; canStart: boolean } | null;
  edge: { label: string; event: string | null; guard: string } | null;
  renameNode: (name: string) => void;
  makeStart: () => void;
  addInside: () => void;
  removeSelected: () => void;
  renameEvent: (event: string) => void;
  setGuard: (guard: string) => void;
  missing: { kind: string; names: readonly string[] }[];
  inline: readonly string[];
}

function EditPanel({ refusal, canUndo, canRedo, undo, redo, addStateHere, node, edge, renameNode, makeStart, addInside, removeSelected, renameEvent, setGuard, missing, inline }: EditPanelProps) {
  return (
    <div data-slot="edit-panel" className="flex flex-col gap-3.5">
      {refusal ? <div data-slot="edit-refusal" role="alert" className="text-footnote text-destructive [overflow-wrap:anywhere]">{refusal}</div> : null}
      <Toolbar aria-label="Edit" size="sm" className="flex-wrap">
        <ToolbarButton data-action="add-state" variant="secondary" onClick={addStateHere}>Add state</ToolbarButton>
        <ToolbarButton data-action="undo" variant="secondary" disabled={!canUndo} onClick={undo}>Undo</ToolbarButton>
        <ToolbarButton data-action="redo" variant="secondary" disabled={!canRedo} onClick={redo}>Redo</ToolbarButton>
      </Toolbar>
      {node ? (
        <DiagramFrameSection title="This state">
          <DiagramFrameInput data-field="name" label="Name" value={node.label} onValueCommit={renameNode} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {node.canStart ? <Button data-action="make-start" variant="secondary" size="sm" disabled={node.isStart} onClick={makeStart}>{node.isStart ? 'It starts here' : 'Start here'}</Button> : null}
            <Button data-action="add-inside" variant="secondary" size="sm" onClick={addInside}>Add one inside</Button>
            <Button data-action="delete" variant="secondary" size="sm" onClick={removeSelected}>Delete</Button>
          </div>
        </DiagramFrameSection>
      ) : edge ? (
        <DiagramFrameSection title="This transition">
          {edge.event !== null ? <DiagramFrameInput data-field="event" label="Event" value={edge.event} onValueCommit={renameEvent} /> : <div className="text-footnote">{edge.label}</div>}
          <DiagramFrameInput data-field="guard" label="Guard" value={edge.guard} placeholder="None" onValueCommit={setGuard} />
          <div className="pt-1"><Button data-action="delete" variant="secondary" size="sm" onClick={removeSelected}>Delete</Button></div>
        </DiagramFrameSection>
      ) : (
        <p data-slot="edit-hint" className="m-0 text-footnote text-foreground/70">Select a state or a transition to change it. To connect two states, select one and drag from a dot on its edge, or press C.</p>
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

/* ── StateDiagram ── */

const NO_HISTORY: { past: MachineConfig[]; future: MachineConfig[] } = { past: [], future: [] };
const HISTORY_LIMIT = 100;
const isOwnEvent = (place: TransitionPlace | undefined, state: MachineConfig | null) => !!place?.event && !!(state?.on as Record<string, unknown> | undefined)?.[place.event];
const eventsOf = (state: MachineConfig | null) => Object.keys((state?.on as Record<string, unknown> | undefined) ?? {});
const statesOf = (state: MachineConfig | null) => Object.keys((state?.states as Record<string, unknown> | undefined) ?? {});

export function StateDiagram({ machine: given, config, direction, layout: initialLayout, simulate, editable = false, onConfigChange, implementations, defaultSelection = NOTHING_SELECTED, panelOpen, defaultPanelOpen, onPanelOpenChange, panelPresentation, className, style, 'aria-label': ariaLabel, ...diagram }: StateDiagramProps) {
  /* ── What's being shown: what was given, until there's an edit to show instead ── */
  const known = useRef(new WeakMap<object, MachineLike>()).current;
  const outside = config ?? given;
  const controlled = config !== undefined && onConfigChange !== undefined;
  const [held, setHeld] = useState<{ outside: unknown; config: MachineConfig } | null>(null);
  const current = controlled ? config : held && held.outside === outside ? held.config : config;
  const { machine, error } = useMachine(current ? undefined : given, current, known);
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
  const laid = useDiagramLayout(draft, { host: board, direction, initial: initialLayout });
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
  const [history, setHistory] = useState(NO_HISTORY);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [selection, setSelection] = useState<DiagramSelection>(defaultSelection);
  // Something from outside starts over: what's undone from here is only what was done here.
  const lastShown = useRef<unknown>(null);
  useEffect(() => {
    if (config && config === lastShown.current) return;
    setHistory(NO_HISTORY);
    setRefusal(null);
    setHeld(null);
  }, [config, given, known]);
  const base = (current ?? (given?.config as MachineConfig | undefined)) ?? null;
  const show = (next: MachineConfig) => {
    lastShown.current = next;
    if (!controlled) setHeld({ outside, config: next });
    onConfigChange?.(next);
  };
  /** Does an edit if XState will have it, and says why not if it won't. What it hands back is the machine, to find things in. */
  const commit = (edit: (c: MachineConfig) => MachineConfig): MachineLike | null => {
    if (!xstate || !base) return null;
    const outcome = tryEdit<MachineLike>(xstate as never, base, edit);
    if (!outcome.ok) {
      setRefusal(outcome.reason);
      return null;
    }
    setRefusal(null);
    if (outcome.config === base) return machine;
    if (machine) known.set(base, machine);
    known.set(outcome.config, outcome.machine);
    setHistory((h) => ({ past: [...h.past.slice(-(HISTORY_LIMIT - 1)), base], future: [] }));
    show(outcome.config);
    return outcome.machine;
  };
  const undo = () => {
    const to = history.past[history.past.length - 1];
    if (!to || !base) return;
    setHistory({ past: history.past.slice(0, -1), future: [...history.future, base] });
    setRefusal(null);
    show(to);
  };
  const redo = () => {
    const to = history.future[history.future.length - 1];
    if (!to || !base) return;
    setHistory({ past: [...history.past, base], future: history.future.slice(0, -1) });
    setRefusal(null);
    show(to);
  };
  const selectState = (made: MachineLike, path: StatePath) => {
    for (const [id, p] of machineStatePaths(made)) if (p.join('\0') === path.join('\0')) { setSelection({ nodes: [id], edges: [] }); return; }
  };
  const selectTransition = (made: MachineLike, path: StatePath, event: string | null, index: number) => {
    for (const [id, place] of machineEdgePlaces(made)) if (place.state.join('\0') === path.join('\0') && place.event === event && place.index === index) { setSelection({ nodes: [], edges: [id] }); return; }
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
      if (made) setSelection(NOTHING_SELECTED);
    } else if (details.reason === 'delete') {
      const nodesLeft = new Set(change.nodes.map((n) => n.id));
      const edgesLeft = new Set(change.edges.map((e) => e.id));
      const goneNodes = laid.nodes.filter((n) => !nodesLeft.has(n.id));
      const goneEdges = laid.edges.filter((e) => !edgesLeft.has(e.id));
      const states = goneNodes.flatMap((n) => { const p = paths.get(n.id); return p ? [p] : []; });
      // What's only there to say where something starts goes with that something, or not at all.
      const startingOnly = goneEdges.some((e) => !places.has(e.id) && nodesLeft.has(e.to));
      if (startingOnly) {
        setRefusal('That line says where it starts. Select another state and choose Start here.');
        return;
      }
      // What's attached to a state that's going goes with it.
      const transitions = goneEdges.filter((e) => nodesLeft.has(e.from) && nodesLeft.has(e.to)).flatMap((e) => { const p = places.get(e.id); return p ? [p] : []; });
      const made = commit((c) => removeItems(c, { states, transitions }));
      if (made) setSelection(NOTHING_SELECTED);
    }
    // Moving isn't on, and undo and redo are here, as they have the config to go back to.
  };
  const validConnection = (c: DiagramConnection): boolean | string => {
    const why = 'That line says where it starts. Select another state and choose Start here.';
    if (!paths.has(c.from) || !paths.has(c.to)) return why;
    if (c.edge && !places.has(c.edge)) return why;
    return true;
  };

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
    const made = commit((c) => renameState(c, nodePath, name));
    if (made) selectState(made, [...nodePath.slice(0, -1), name]);
  };
  const makeStart = () => {
    if (nodePath?.length) commit((c) => setInitial(c, nodePath.slice(0, -1), nodePath[nodePath.length - 1]));
  };
  const removeSelected = () => {
    const made = nodePath
      ? commit((c) => removeItems(c, { states: [nodePath] }))
      : edgePlace ? commit((c) => removeItems(c, { transitions: [edgePlace] })) : null;
    if (made) setSelection(NOTHING_SELECTED);
  };
  const renameEvent = (event: string) => {
    if (!edgePlace || !base) return;
    const list = (stateAt(base, edgePlace.state)?.on as Record<string, unknown> | undefined)?.[event];
    const made = commit((c) => setTransitionEvent(c, edgePlace, event));
    if (made) selectTransition(made, edgePlace.state, event, Array.isArray(list) ? list.length : list === undefined ? 0 : 1);
  };
  const setGuard = (guard: string) => {
    if (!edgePlace) return;
    const made = commit((c) => setTransitionGuard(c, edgePlace, guard.trim() || null));
    if (made) selectTransition(made, edgePlace.state, edgePlace.event, edgePlace.index);
  };
  const missing = useMemo(() => {
    if (!editable || !base) return [];
    const names = missingImplementations(base, behind);
    return (['guards', 'actions', 'actors', 'delays'] as const).filter((k) => names[k].length).map((kind) => ({ kind, names: names[kind] }));
  }, [editable, base, behind]);
  const inline = useMemo(() => (editable && base ? inlineCodeIn(base) : []), [editable, base]);

  /* ── What's drawn ── */
  const problem = error ?? draftError ?? laid.error?.message ?? simError ?? xstateError;
  const name = ariaLabel ?? (machine ? `State machine ${machine.root.key || machine.root.id}` : 'State machine');

  // Only what's lit, so time going by doesn't redraw the board.
  const active = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().active ?? NOTHING_YET, () => NOTHING_YET);
  const taken = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().taken ?? NOTHING_YET, () => NOTHING_YET);
  const now = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().now ?? NOTHING_YET, () => NOTHING_YET);
  const rootId = machine?.root.id;
  const where = useMemo(() => ({ nodes: active.filter((id) => id !== rootId), edges: [...taken] }), [active, taken, rootId]);

  const [tab, setTab] = useState<'run' | 'edit'>('edit');
  const showEdit = editable && !!xstate && !!base;
  const both = !!sim && showEdit;
  const title = both ? 'State machine' : showEdit ? 'Edit' : 'Simulation';
  const editPanel = showEdit ? (
    <EditPanel
      refusal={refusal}
      canUndo={history.past.length > 0}
      canRedo={history.future.length > 0}
      undo={undo}
      redo={redo}
      addStateHere={addStateHere}
      node={selectedNode && nodePath ? {
        id: selectedNode.id, label: selectedNode.label ?? '', path: nodePath,
        isStart: !!parentOfNode && (typeof parentOfNode.initial === 'object' ? (parentOfNode.initial as { target?: unknown }).target : parentOfNode.initial) === nodePath[nodePath.length - 1],
        canStart: nodePath.length > 0 && parentOfNode?.type !== 'parallel',
      } : null}
      edge={selectedEdge && edgePlace ? {
        label: selectedEdge.label ?? '',
        event: isOwnEvent(edgePlace, base && stateAt(base, edgePlace.state)) ? edgePlace.event : null,
        guard: selectedEdge.data?.guard ?? '',
      } : null}
      renameNode={renameNode}
      makeStart={makeStart}
      addInside={addInside}
      removeSelected={removeSelected}
      renameEvent={renameEvent}
      setGuard={setGuard}
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
  const status = now.length ? `In ${now.join(', ')}` : selectedNode?.label ?? (laid.status === 'pending' ? 'Laying out…' : name);
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
      <DiagramFrameBoard
        ref={board}
        // The keys for undoing come here, from the board, and a field in the panel keeps its own.
        onKeyDown={!editable ? undefined : (e) => {
          if (!(e.metaKey || e.ctrlKey)) return;
          const key = e.key.toLowerCase();
          if (key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
          else if (key === 'y') { e.preventDefault(); redo(); }
        }}
      >
        <Diagram<StateNodeData, StateEdgeData>
          nodes={laid.nodes}
          edges={laid.edges}
          current={where}
          aria-label={name}
          noun="state"
          loading={laid.status === 'pending' && !problem}
          emptyState={problem ? null : undefined}
          {...(editable ? {
            editable: true, movable: false, undoable: false, selection, onSelectionChange: (next: DiagramSelection) => setSelection(next), onDataChange: onDiagramChange, isValidConnection: validConnection,
          } : null)}
          overlay={problem ? (
            <div data-slot="state-diagram-error" role="alert" className="absolute inset-x-4 top-4 rounded-ctl bg-popover p-3 text-footnote text-destructive shadow-raised">
              {problem}
            </div>
          ) : <DiagramToolbar side="top" align="start" />}
          {...diagram}
        />
        {panel ? <DiagramFrameBar>{status}</DiagramFrameBar> : null}
      </DiagramFrameBoard>
      {panel ? <DiagramFramePanel title={title}>{panel}</DiagramFramePanel> : null}
    </DiagramFrame>
  );
}
