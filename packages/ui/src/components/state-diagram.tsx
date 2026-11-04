'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { Diagram, type DiagramProps } from '@/components/ui/diagram';
import { SideDrawer } from '@/components/ui/side-drawer';
import { Switch } from '@/components/ui/switch';
import { useContainerSize } from '@/lib/container';
import type { DiagramLayoutResult } from '@/lib/diagram-layout';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import { machineToDraft, type MachineLike, type StateEdgeData, type StateNodeData } from '@/lib/state-diagram-model';
import { createSimulation, type Simulation, type SimulationStandIns } from '@/lib/state-diagram-simulation';
import { cn } from '@/lib/utils';

/* ══ StateDiagram — a machine on a Diagram ══
   Hand it a machine from XState, or a machine's config as JSON, and it draws it, from `machine.root`, which has everything
   resolved. No machine code runs. XState and ELK are optional peers, so a config needs `xstate` installed, and laying it out
   needs `elkjs`.

   With `simulate`, it also runs a copy of it, with stand-ins for everything it names, so none of an app's code runs here
   either. Where it is gets lit, and a panel offers what it can do next: in a column beside the board, or in a tray when
   there isn't the room. */

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
  /** Whether the panel starts open. By default it does if it fits beside the board, and it doesn't if it'd go over it. */
  defaultPanelOpen?: boolean;
  className?: string;
  style?: CSSProperties;
}

const XSTATE_PEER = 'Reading a machine’s config needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';
const XSTATE_PEER_SIMULATE = 'Simulating a machine needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';
const NO_CONFIG = 'Simulating needs a machine from XState, which has a config to run a copy of.';

/** The panel goes beside the board at this width or more, and in a tray under it. */
const PANEL_BESIDE_FROM = 560;
const PANEL_WIDTH = 280;
/** How much of the height a tray takes, up to a limit, and how much of that isn't its contents: its margins and its header. */
const TRAY_SHARE = 0.58;
const TRAY_MOST = 480;
const TRAY_CHROME = 70;

/** The machine for a config, and XState's own error if it won't make one. */
function useMachine(machine: MachineLike | undefined, config: Record<string, unknown> | undefined): { machine: MachineLike | null; error: string | null } {
  const [made, setMade] = useState<{ config: unknown; machine: MachineLike | null; error: string | null } | null>(null);
  useEffect(() => {
    if (machine || !config) return;
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
  }, [machine, config]);
  if (machine) return { machine, error: null };
  if (!config) return { machine: null, error: 'A StateDiagram needs a machine or a config.' };
  if (made?.config !== config) return { machine: null, error: null };
  return { machine: made.machine, error: made.error };
}

/** A simulation of the machine, while it's asked for. Stand-ins are read when one starts, so writing them inline doesn't start
 *  it over each time this renders. */
function useSimulation(machine: MachineLike | null, simulate: StateDiagramProps['simulate']): { sim: Simulation | null; error: string | null } {
  const on = !!simulate;
  const standIns = useRef(simulate);
  standIns.current = simulate;
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
        const given = standIns.current;
        sim = createSimulation(xstate, machine.config, typeof given === 'object' ? given : undefined, machine.implementations?.delays);
        setMade({ machine, sim, error: null });
      },
      () => { if (live) setMade({ machine, sim: null, error: XSTATE_PEER_SIMULATE }); },
    );
    return () => {
      live = false;
      sim?.stop();
    };
  }, [machine, on]);
  return on && made?.machine === machine ? made : { sim: null, error: null };
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

/* ── StateDiagram ── */

export function StateDiagram({ machine: given, config, direction, initial, simulate, defaultPanelOpen, className, style, 'aria-label': ariaLabel, ...diagram }: StateDiagramProps) {
  const { machine, error } = useMachine(given, config);
  const draft = useMemo(() => {
    if (!machine) return { draft: { nodes: [], edges: [] }, error: null };
    // A machine that's only half made shows up here.
    try {
      return { draft: machineToDraft(machine), error: null };
    } catch (e) {
      return { draft: { nodes: [], edges: [] }, error: e instanceof Error ? e.message : String(e) };
    }
  }, [machine]);
  const [host, size] = useContainerSize();
  const laid = useDiagramLayout(draft.draft, { host, direction, initial });
  const { sim, error: simError } = useSimulation(machine, simulate);
  const problem = error ?? draft.error ?? laid.error?.message ?? simError;
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
  // Beside the board, the panel and the button that opens it take each other's place, so focus has to go from one to the other.
  // A tray does this itself, so the button stays there for it to come back to.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current || !beside) return;
    moved.current = false;
    if (open) panelRef.current?.focus({ preventScroll: true });
    else openerRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [open, beside]);
  const choose = (next: boolean) => {
    moved.current = true;
    setOpen(next);
  };
  const panel = sim ? <SimulationPanel sim={sim} panelRef={panelRef} /> : null;
  const trayHeight = Math.round(Math.min(size.height * TRAY_SHARE, TRAY_MOST));
  const opener = sim && (!open || !beside) ? (
    <div ref={openerRef} data-slot="simulation-bar" className={cn('absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-ctl bg-popover p-2 pl-3 text-footnote text-foreground shadow-hairline', open && 'pointer-events-none opacity-0')}>
      <span className="min-w-0 truncate font-semibold">{now.join(', ')}</span>
      <Button data-slot="simulation-open" variant="secondary" size="sm" onPress={() => choose(true)}>Simulation</Button>
    </div>
  ) : null;
  return (
    <div ref={host} data-slot="state-diagram" className={cn('absolute inset-0 flex overflow-hidden', !beside && 'flex-col', className)} style={style}>
      <div className="relative min-h-0 min-w-0 flex-1">
        <Diagram<StateNodeData, StateEdgeData>
          nodes={laid.nodes}
          edges={laid.edges}
          lit={lit}
          aria-label={name}
          noun="state"
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
      {panel && beside && open ? <SideDrawer mode="fixed" open onClose={() => choose(false)} title="Simulation" width={PANEL_WIDTH}>{panel}</SideDrawer> : null}
      {panel && !beside ? (
        // A tray's modal to what it's in. That's only this, under the board, which isn't covered or dimmed, as it's what you're watching.
        <div data-slot="simulation-tray-host" className="relative shrink-0 bg-background [&>div:first-child]:bg-transparent" style={{ height: open ? trayHeight : 0 }}>
          <Credenza compact open={open} onClose={() => choose(false)} title="Simulation" className="top-2.5">
            <div data-slot="simulation-tray" className="bl-scroll touch-pan-y overflow-y-auto" style={{ height: trayHeight - TRAY_CHROME }}>{panel}</div>
          </Credenza>
        </div>
      ) : null}
    </div>
  );
}
