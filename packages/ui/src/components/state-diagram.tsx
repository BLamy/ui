'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Diagram, type DiagramProps } from '@/components/ui/diagram';
import type { DiagramLayoutResult } from '@/lib/diagram-layout';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model';
import { machineToDraft, type MachineLike, type StateEdgeData, type StateNodeData } from '@/lib/state-diagram-model';
import { cn } from '@/lib/utils';

/* ══ StateDiagram — a machine on a Diagram ══
   Hand it a machine from XState, or a machine's config as JSON, and it draws it, from `machine.root`, which has everything
   resolved. No machine code runs. XState and ELK are optional peers, so a config needs `xstate` installed, and laying it out
   needs `elkjs`. */

export interface StateDiagramProps extends Pick<DiagramProps, 'minimap' | 'background' | 'fitPadding' | 'aria-label' | 'camera' | 'defaultCamera' | 'onCameraChange'> {
  /** A machine, from `createMachine` or `setup(...).createMachine`. */
  machine?: MachineLike;
  /** Or a machine's config, as JSON. */
  config?: Record<string, unknown>;
  /** Which way the layers run (default `RIGHT`). */
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  /** A layout done ahead of time, on a server perhaps. */
  initial?: DiagramLayoutResult<StateNodeData, StateEdgeData>;
  className?: string;
  style?: CSSProperties;
}

const XSTATE_PEER = 'Reading a machine’s config needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';

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

const NO_NODES: DiagramNode<StateNodeData>[] = [];
const NO_EDGES: DiagramEdge<StateEdgeData>[] = [];

export function StateDiagram({ machine: given, config, direction, initial, className, style, 'aria-label': ariaLabel, ...diagram }: StateDiagramProps) {
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
  const host = useRef<HTMLDivElement>(null);
  const laid = useDiagramLayout(draft.draft, { host, direction, initial });
  const problem = error ?? draft.error ?? laid.error?.message ?? null;
  const name = ariaLabel ?? (machine ? `State machine ${machine.root.key || machine.root.id}` : 'State machine');
  return (
    <div ref={host} data-slot="state-diagram" className={cn('absolute inset-0', className)} style={style}>
      <Diagram<StateNodeData, StateEdgeData>
        nodes={problem ? NO_NODES : laid.nodes}
        edges={problem ? NO_EDGES : laid.edges}
        aria-label={name}
        noun="state"
        overlay={problem ? (
          <div data-slot="state-diagram-error" role="alert" className="absolute inset-x-4 top-4 rounded-ctl bg-popover p-3 text-footnote text-destructive shadow-hairline">
            {problem}
          </div>
        ) : laid.status === 'pending' ? (
          <div data-slot="state-diagram-status" role="status" className="absolute top-3 left-3 rounded-ctl bg-popover px-3 py-2 text-footnote text-foreground shadow-hairline">Laying out…</div>
        ) : null}
        {...diagram}
      />
    </div>
  );
}
