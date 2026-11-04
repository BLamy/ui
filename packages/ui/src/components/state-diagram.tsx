'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { Diagram, type DiagramChange, type DiagramProps } from '@/components/ui/diagram';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { SideDrawer } from '@/components/ui/side-drawer';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { useContainerSize } from '@/lib/container';
import type { DiagramLayoutResult } from '@/lib/diagram-layout';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import { NOTHING_SELECTED, type DiagramConnection, type DiagramSelection } from '@/lib/diagram-model';
import {
  addState, addTransition, inlineCodeIn, missingImplementations, removeItems, renameState, setInitial, setTransitionEvent, setTransitionGuard, setTransitionSource, setTransitionTarget, stateAt, tryEdit, uniqueName,
  type MachineConfig, type MachineImplementations, type StatePath,
} from '@/lib/state-diagram-edit';
import { machineEdgePlaces, machineStatePaths, machineToDraft, type MachineLike, type StateEdgeData, type StateNodeData, type TransitionPlace } from '@/lib/state-diagram-model';
import { createSimulation, type Simulation, type SimulationStandIns } from '@/lib/state-diagram-simulation';
import { cn } from '@/lib/utils';

/* ══ StateDiagram — a machine on a Diagram ══
   Hand it a machine from XState, or a machine's config as JSON, and it draws it, from `machine.root`, which has everything
   resolved. No machine code runs. XState and ELK are optional peers, so a config needs `xstate` installed, and laying it out
   needs `elkjs`.

   With `simulate`, it also runs a copy of it, with stand-ins for everything it names, so none of an app's code runs here
   either. Where it is gets lit, and a panel offers what it can do next: in a column beside the board, or in a tray when
   there isn't the room.

   With `editable`, what's drawn can be changed, and that writes to its config, which is plain data. A machine's implementations
   stay out of it, by name, so an edit never touches code. Whatever XState won't have is refused, with what it said. */

export interface StateDiagramProps extends Pick<DiagramProps, 'minimap' | 'background' | 'fitPadding' | 'aria-label' | 'camera' | 'defaultCamera' | 'onCameraChange'> {
  /** A machine, from `createMachine` or `setup(...).createMachine`. */
  machine?: MachineLike;
  /** Or a machine's config, as JSON. */
  config?: Record<string, unknown>;
  /** Which way the layers run (default `RIGHT`). */
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  /** A layout done ahead of time, on a server perhaps. */
  initial?: DiagramLayoutResult<StateNodeData, StateEdgeData>;
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
  /** Whether the panel starts open. By default it does if it fits beside the board, and it doesn't if it'd go over it. */
  defaultPanelOpen?: boolean;
  className?: string;
  style?: CSSProperties;
}

const XSTATE_PEER = 'Reading a machine’s config needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';
const XSTATE_PEER_SIMULATE = 'Simulating a machine needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';
const XSTATE_PEER_EDIT = 'Editing a machine needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';
const NO_CONFIG = 'Simulating needs a machine from XState, which has a config to run a copy of.';

/** The panel goes beside the board at this width or more, and in a tray under it. */
const PANEL_BESIDE_FROM = 560;
const PANEL_WIDTH = 280;
/** How much of the height a tray takes, up to a limit, and how much of that isn't its contents: its margins and its header. */
const TRAY_SHARE = 0.58;
const TRAY_MOST = 480;
const TRAY_CHROME = 70;

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
      () => { if (live) setMade({ machine, sim: null, error: XSTATE_PEER_SIMULATE }); },
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

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-slot="simulation-section" aria-label={title} className="flex flex-col gap-1.5">
      <h3 className="m-0 text-footnote font-semibold text-foreground/70">{title}</h3>
      {children}
    </section>
  );
}

function SimulationPanel({ sim, panelRef }: { sim: Simulation; panelRef?: RefObject<HTMLDivElement | null> }) {
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
    <div ref={panelRef} data-slot="simulation-panel" data-status={state.status} tabIndex={-1} className="flex flex-col gap-3.5 px-3.5 pt-1 pb-3.5 outline-none">
      <div>
        <div data-slot="simulation-now" role="status" className="text-subhead font-semibold [overflow-wrap:anywhere]">
          {state.now.join(', ')}{state.status === 'done' ? ' (finished)' : ''}
        </div>
        {state.error ? <div data-slot="simulation-error" role="alert" className="mt-1 text-footnote text-destructive">{state.error}</div> : null}
      </div>
      {state.events.length ? (
        <PanelSection title="Events it can take">
          <div className="flex flex-wrap gap-1.5">
            {state.events.map((event) => <Button key={event} data-slot="simulation-event" data-event={event} variant="secondary" size="sm" onPress={() => sim.send(event)}>{event}</Button>)}
          </div>
        </PanelSection>
      ) : null}
      {state.finishes.length ? (
        <PanelSection title="Waiting on">
          <div className="flex flex-wrap gap-1.5">
            {state.finishes.map((f) => <Button key={f.event} data-slot="simulation-finish" data-event={f.event} variant="secondary" size="sm" onPress={() => sim.send(f.event)}>{f.label}</Button>)}
          </div>
        </PanelSection>
      ) : null}
      <PanelSection title="Time">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button data-slot="simulation-next" variant="secondary" size="sm" isDisabled={!canRun} onPress={() => sim.stepTime()}>Next timer</Button>
          <Button data-slot="simulation-run" variant="secondary" size="sm" isDisabled={!canRun} onPress={() => setRunning(!running)}>{run ? 'Pause' : 'Run'}</Button>
        </div>
        <div data-slot="simulation-time" className="text-footnote text-foreground/70 tabular-nums">
          {ms(state.time)}{state.next !== null ? `, next at ${ms(state.next)}` : ', nothing waiting'}
        </div>
      </PanelSection>
      {guards.length ? (
        <PanelSection title="Guards">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {guards.map((g) => (
              <li key={g} data-slot="simulation-guard" data-guard={g} className="flex items-center justify-between gap-2 text-footnote">
                <span className="min-w-0 [overflow-wrap:anywhere]">{g}</span>
                <Switch aria-label={`${g} answers yes`} checked={state.guards[g]} onChange={(v) => sim.setGuard(g, v)} />
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}
      <PanelSection title="What happened">
        <div>
          <Button data-slot="simulation-reset" variant="secondary" size="sm" onPress={() => { setRunning(false); sim.reset(); }}>Reset</Button>
        </div>
        <ol data-slot="simulation-log" className="m-0 flex list-none flex-col-reverse gap-1 p-0 text-footnote">
          {state.log.map((entry) => (
            <li key={entry.id} data-slot="simulation-log-entry" className="[overflow-wrap:anywhere]">
              <span className="font-semibold">{entry.what}</span>
              <span className="text-foreground/70"> at {ms(entry.at)}, in {entry.now.join(', ')}</span>
            </li>
          ))}
        </ol>
      </PanelSection>
    </div>
  );
}

/* ── The panel, while editing ── */

/** A field that changes something when you've finished with it: on Enter, or on leaving it. Escape puts it back. */
function EditField({ label, value, slot, placeholder, onCommit }: { label: string; value: string; slot: string; placeholder?: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => {
    if (draft === value) return;
    onCommit(draft);
    // If it's refused, the value hasn't changed, so this is what puts it back.
    setDraft(value);
  };
  return (
    <TextField data-slot={slot} value={draft} onChange={setDraft} onBlur={commit} onKeyDown={(e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { setDraft(value); e.stopPropagation(); }
    }}>
      <Label variant="field">{label}</Label>
      <Input size="sm" placeholder={placeholder} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
    </TextField>
  );
}

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
    <div data-slot="edit-panel" tabIndex={-1} className="flex flex-col gap-3.5 px-3.5 pt-1 pb-3.5 outline-none">
      {refusal ? <div data-slot="edit-refusal" role="alert" className="text-footnote text-destructive [overflow-wrap:anywhere]">{refusal}</div> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button data-slot="edit-add-state" variant="secondary" size="sm" onPress={addStateHere}>Add state</Button>
        <Button data-slot="edit-undo" variant="secondary" size="sm" isDisabled={!canUndo} onPress={undo}>Undo</Button>
        <Button data-slot="edit-redo" variant="secondary" size="sm" isDisabled={!canRedo} onPress={redo}>Redo</Button>
      </div>
      {node ? (
        <PanelSection title="This state">
          <EditField label="Name" slot="edit-name" value={node.label} onCommit={renameNode} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {node.canStart ? <Button data-slot="edit-make-start" variant="secondary" size="sm" isDisabled={node.isStart} onPress={makeStart}>{node.isStart ? 'It starts here' : 'Start here'}</Button> : null}
            <Button data-slot="edit-add-inside" variant="secondary" size="sm" onPress={addInside}>Add one inside</Button>
            <Button data-slot="edit-delete" variant="secondary" size="sm" onPress={removeSelected}>Delete</Button>
          </div>
        </PanelSection>
      ) : edge ? (
        <PanelSection title="This transition">
          {edge.event !== null ? <EditField label="Event" slot="edit-event" value={edge.event} onCommit={renameEvent} /> : <div className="text-footnote">{edge.label}</div>}
          <EditField label="Guard" slot="edit-guard" value={edge.guard} placeholder="None" onCommit={setGuard} />
          <div className="pt-1"><Button data-slot="edit-delete" variant="secondary" size="sm" onPress={removeSelected}>Delete</Button></div>
        </PanelSection>
      ) : (
        <p data-slot="edit-hint" className="m-0 text-footnote text-foreground/70">Select a state or a transition to change it. To connect two states, select one and drag from a dot on its edge, or press C.</p>
      )}
      {missing.length ? (
        <PanelSection title="Named, with nothing behind them">
          <ul data-slot="edit-missing" className="m-0 flex list-none flex-col gap-1 p-0 text-footnote">
            {missing.map((m) => <li key={m.kind} data-kind={m.kind} className="[overflow-wrap:anywhere]"><span className="text-foreground/70">{m.kind}:</span> {m.names.join(', ')}</li>)}
          </ul>
        </PanelSection>
      ) : null}
      {inline.length ? (
        <PanelSection title="Code in the config, which JSON can’t hold">
          <ul data-slot="edit-inline" className="m-0 flex list-none flex-col gap-1 p-0 text-footnote [overflow-wrap:anywhere]">
            {inline.map((path) => <li key={path}>{path}</li>)}
          </ul>
        </PanelSection>
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

export function StateDiagram({ machine: given, config, direction, initial, simulate, editable = false, onConfigChange, implementations, defaultSelection = NOTHING_SELECTED, defaultPanelOpen, className, style, 'aria-label': ariaLabel, ...diagram }: StateDiagramProps) {
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
  const [host, size] = useContainerSize();
  const laid = useDiagramLayout(draft, { host, direction, initial });
  const behind = implementations ?? given?.implementations;
  const { sim, error: simError } = useSimulation(machine, simulate, behind?.delays);

  /* ── Editing ── */
  const [xstate, setXState] = useState<typeof import('xstate') | null>(null);
  const [xstateError, setXStateError] = useState<string | null>(null);
  useEffect(() => {
    if (!editable) return undefined;
    let live = true;
    import('xstate').then((x) => { if (live) setXState(x); }, () => { if (live) setXStateError(XSTATE_PEER_EDIT); });
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

  /** What's on the board has changed, and what that means is an edit. */
  const onDiagramChange = (change: DiagramChange<StateNodeData, StateEdgeData>) => {
    if (change.reason === 'connect') {
      const had = new Set(laid.edges.map((e) => e.id));
      const edge = change.edges.find((e) => !had.has(e.id));
      const from = edge && paths.get(edge.from), to = edge && paths.get(edge.to);
      if (!from || !to || !base) return;
      const event = uniqueName('EVENT', eventsOf(stateAt(base, from)));
      const made = commit((c) => addTransition(c, from, event, to));
      if (made) selectTransition(made, from, event, 0);
    } else if (change.reason === 'reconnect') {
      const before = new Map(laid.edges.map((e) => [e.id, e]));
      const edge = change.edges.find((e) => { const was = before.get(e.id); return was && (was.from !== e.from || was.to !== e.to); });
      const was = edge && before.get(edge.id);
      const place = edge && places.get(edge.id);
      if (!edge || !was || !place) return;
      const from = paths.get(edge.from), to = paths.get(edge.to);
      if (!from || !to) return;
      const made = commit((c) => (was.from !== edge.from ? setTransitionSource(c, place, from) : setTransitionTarget(c, place, to)));
      if (made) setSelection(NOTHING_SELECTED);
    } else if (change.reason === 'delete') {
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
  const beside = size.width >= PANEL_BESIDE_FROM;

  // Only what's lit, so time going by doesn't redraw the board.
  const active = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().active ?? NOTHING_YET, () => NOTHING_YET);
  const taken = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().taken ?? NOTHING_YET, () => NOTHING_YET);
  const now = useSyncExternalStore(sim ? sim.subscribe : noSubscribe, () => sim?.get().now ?? NOTHING_YET, () => NOTHING_YET);
  const rootId = machine?.root.id;
  const lit = useMemo(() => ({ nodes: active.filter((id) => id !== rootId), edges: [...taken] }), [active, taken, rootId]);

  const [openChoice, setOpen] = useState<boolean | null>(defaultPanelOpen ?? null);
  const open = openChoice ?? beside;
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'run' | 'edit'>('edit');
  const showEdit = editable && !!xstate && !!base;
  // Beside the board, the panel and the button that opens it take each other's place, so focus has to go from one to the other.
  // A tray does this itself, so the button stays there for it to come back to.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current || !beside) return;
    moved.current = false;
    if (open) panelRef.current?.querySelector<HTMLElement>(showEdit && (!sim || tab === 'edit') ? '[data-slot=edit-panel]' : '[data-slot=simulation-panel]')?.focus({ preventScroll: true });
    else openerRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [open, beside]);
  const choose = (next: boolean) => {
    moved.current = true;
    setOpen(next);
  };
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
  // Running goes on while you're looking at something else, so it's only hidden.
  const panel = both ? (
    <>
      <div className="px-3.5 pb-2"><Segmented aria-label="What the panel shows" options={[{ id: 'edit', label: 'Edit' }, { id: 'run', label: 'Run' }]} value={tab} onChange={(id) => setTab(id as 'run' | 'edit')} /></div>
      <div hidden={tab !== 'run'}>{simulationPanel}</div>
      <div hidden={tab !== 'edit'}>{editPanel}</div>
    </>
  ) : simulationPanel ?? editPanel;
  const trayHeight = Math.round(Math.min(size.height * TRAY_SHARE, TRAY_MOST));
  const opener = panel && (!open || !beside) ? (
    <div ref={openerRef} data-slot="simulation-bar" className={cn('absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-ctl bg-popover p-2 pl-3 text-footnote text-foreground shadow-hairline', open && 'pointer-events-none opacity-0')}>
      <span className="min-w-0 truncate font-semibold">{now.length ? now.join(', ') : selectedNode?.label ?? ''}</span>
      <Button data-slot="simulation-open" variant="secondary" size="sm" onPress={() => choose(true)}>{title}</Button>
    </div>
  ) : null;
  return (
    <div ref={host} data-slot="state-diagram" className={cn('absolute inset-0 flex overflow-hidden', !beside && 'flex-col', className)} style={style}>
      <div
        className="relative min-h-0 min-w-0 flex-1"
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
          lit={lit}
          aria-label={name}
          noun="state"
          {...(editable ? {
            editable: true, movable: false, selection, onSelectionChange: setSelection, onChange: onDiagramChange, isValidConnection: validConnection,
          } : null)}
          overlay={problem ? (
            <div data-slot="state-diagram-error" role="alert" className="absolute inset-x-4 top-4 rounded-ctl bg-popover p-3 text-footnote text-destructive shadow-hairline">
              {problem}
            </div>
          ) : laid.status === 'pending' ? (
            <div data-slot="state-diagram-status" role="status" className="absolute top-3 left-3 rounded-ctl bg-popover px-3 py-2 text-footnote text-foreground shadow-hairline">Laying out…</div>
          ) : opener}
          {...diagram}
        />
      </div>
      {panel && beside && open ? <div ref={panelRef} className="contents"><SideDrawer mode="fixed" open onClose={() => choose(false)} title={title} width={PANEL_WIDTH}>{panel}</SideDrawer></div> : null}
      {panel && !beside ? (
        // A tray's modal to what it's in. That's only this, under the board, which isn't covered or dimmed, as it's what you're watching.
        <div data-slot="simulation-tray-host" className="relative shrink-0 bg-background [&>div:first-child]:bg-transparent" style={{ height: open ? trayHeight : 0 }}>
          <Credenza compact open={open} onClose={() => choose(false)} title={title} className="top-2.5">
            <div data-slot="simulation-tray" className="bl-scroll touch-pan-y overflow-y-auto" style={{ height: trayHeight - TRAY_CHROME }}>{panel}</div>
          </Credenza>
        </div>
      ) : null}
    </div>
  );
}
