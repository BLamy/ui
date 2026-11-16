'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCanvas } from '@/components/ui/canvas';
import { Checkbox, CheckboxGroup } from '@/components/ui/checkbox';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxInputGroup, ComboboxItem, ComboboxList,
} from '@/components/ui/combobox';
import { Diagram, DiagramToolbar, type DiagramProps } from '@/components/ui/diagram';
import {
  DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFrameCover, DiagramFrameInput, DiagramFramePanel, DiagramFrameSection,
  type DiagramFrameProps,
} from '@/components/ui/diagram-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { StateDiagram } from '@/components/ui/state-diagram';
import { ToolbarButton, ToolbarSeparator } from '@/components/ui/toolbar';
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from '@/components/ui/tooltip';
import { CLOUDFLARE_CATALOG } from '@/lib/cloudflare-catalog.generated';
import type { CatalogProduct } from '@/lib/cloudflare-catalog';
import {
  catalogBinding, catalogProduct, linkBetween, linkOf, methodSignature, newEdge, runsCode, SERVICE_NODE, serviceIconName, serviceNodeHeight, servicePorts,
  type CloudflareEdge, type CloudflareService, type ServiceLink,
} from '@/lib/cloudflare-services';
import {
  addService, BINDING_NAME, checkMachines, edgeBinding, machineEvents, machinesPast, removeServices, searchCatalog, serviceName, validateSystem,
  type CloudflareSystem, type SystemIssue,
} from '@/lib/cloudflare-system';
import { useControllableChange } from '@/lib/controllable-state';
import type { DiagramDirection } from '@/lib/diagram-layout';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import { NOTHING_SELECTED, type DiagramConnection, type DiagramEdge, type DiagramNode, type DiagramPort, type DiagramSelection } from '@/lib/diagram-model';
import type { DiagramDataChangeReason, DiagramSelectionChangeDetails, DiagramSelectionChangeReason } from '@/lib/diagram-primitive';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ CloudflareDiagram — Cloudflare's services on a Diagram ══
   Each service is a node with what it can call and receive as ports, from the catalog, and a connection can only be one the
   catalog says there is: a Worker to R2 offers R2's real methods, and R2 to D1 says why not.

   What's given is a system, as data: services, what each is bound as, which have a machine, and which events cross which edge.
   It says what's wrong with one, which can have come from a file. With `editable`, a search of the catalog adds a service,
   and a service's machine opens in a `StateDiagram`, over the board. Without it, it's a picture to inspect: nothing moves,
   connects or is deleted, and the panel only reads.

   The parts: `CloudflareDiagram` composes `DiagramFrame` (board, bar, panel, cover) around a `Diagram`. A service's look is
   `CloudflareServiceNode` (`cloudflareServiceVariants`), for a plain `Diagram`'s `renderNode`; the catalog search is
   `CloudflareServiceSearch`, for a toolbar of your own.

   There's no Cloudflare artwork, as their trademark page asks for written permission: names in words, the library's own icons,
   and an `icon` prop for an app that has its own permission. It comes with the catalog, which is about 150 KB, from
   `@brett_lamy/ui/cloudflare`, so it isn't in the main entry. */

/** Why the system changed: on the board (Diagram's reasons), `edit` for the panel or a machine, `add` from the search. */
export type CloudflareDiagramChangeReason = DiagramDataChangeReason | 'edit' | 'add';
export type CloudflareDiagramChangeDetails = ChangeDetails<CloudflareDiagramChangeReason>;
export type CloudflareMachineChangeReason = 'press' | 'imperative';

export interface CloudflareDiagramProps
  extends Pick<DiagramProps, 'minimap' | 'background' | 'fitPadding' | 'viewport' | 'defaultViewport' | 'onViewportChange'> {
  /** The system's services. Pass it (with `edges`) to control the diagram; `defaultServices` leaves it to the diagram. */
  services?: readonly CloudflareService[];
  edges?: readonly CloudflareEdge[];
  defaultServices?: readonly CloudflareService[];
  defaultEdges?: readonly CloudflareEdge[];
  /** The whole system after a change, and why. `details.cancel()` refuses it when uncontrolled; controlled, what you pass
   *  back decides. */
  onDataChange?: (data: CloudflareSystem, details: CloudflareDiagramChangeDetails) => void;
  /** Services can be moved, added, connected and deleted, and connections and machines changed. Default `false`: a
   *  read-only picture with a panel to inspect it. */
  editable?: boolean;
  selection?: DiagramSelection;
  defaultSelection?: DiagramSelection;
  onSelectionChange?: (selection: DiagramSelection, details: DiagramSelectionChangeDetails) => void;
  /** The panel: open or not (default: open when it shows as a column beside the board), and how it shows. */
  panelOpen?: boolean;
  defaultPanelOpen?: boolean;
  onPanelOpenChange?: DiagramFrameProps['onOpenChange'];
  panelPresentation?: DiagramFrameProps['presentation'];
  /** Whose machine is open over the board, by the service's id, or `null`. */
  openMachine?: string | null;
  defaultOpenMachine?: string | null;
  onOpenMachineChange?: (id: string | null, details: ChangeDetails<CloudflareMachineChangeReason>) => void;
  /** Which way a layout runs, when none of the services say where they are. Default `right`. */
  direction?: DiagramDirection;
  /** What to draw for a product, instead of the library's own icon, for an app with permission to use Cloudflare's. */
  icon?: (product: CatalogProduct) => ReactNode;
  /** What an empty system shows. Default: an `EmptyState` that says how to add a service. */
  emptyState?: ReactNode;
  /** More for the panel, at its top: a name field, an app's own actions. */
  children?: ReactNode;
  /** The diagram's name. Default `Cloudflare services`. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

const HISTORY_LIMIT = 100;
const SEARCH_RESULTS = 6;
const NO_XSTATE = 'Checking its machines needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';
const NO_SERVICES: readonly CloudflareService[] = [];
const NO_EDGES: readonly CloudflareEdge[] = [];

interface Snapshot {
  services: readonly CloudflareService[];
  edges: readonly CloudflareEdge[];
}
const NO_HISTORY: { past: Snapshot[]; future: Snapshot[] } = { past: [], future: [] };

/** What a service's node carries on a Diagram. */
export interface CloudflareServiceNodeData {
  service: CloudflareService;
  product: CatalogProduct | undefined;
  /** Something's wrong with it. */
  problem?: boolean;
}

interface ServiceEdgeData {
  edge: CloudflareEdge;
  link: ServiceLink | null;
  /** Why it isn't what it says it is, if it isn't. */
  problem: string | null;
}

/** A service as a Diagram node: its size and ports from the catalog, and its place if it has one. */
export function serviceNode(service: CloudflareService): Omit<DiagramNode<CloudflareServiceNodeData>, 'x' | 'y'> & { x?: number; y?: number } {
  const product = catalogProduct(service.kind);
  const ports = servicePorts(service.kind);
  const ins = ports.filter((p) => p.direction === 'in').length, outs = ports.length - ins;
  return {
    id: service.id,
    label: service.label ?? product?.name ?? service.kind,
    detail: !product ? 'not in the catalog' : service.label ? product.name : undefined,
    kind: 'node',
    w: SERVICE_NODE.w,
    h: serviceNodeHeight(ins, outs),
    ports,
    data: { service, product },
    ...(service.at ? { x: service.at.x, y: service.at.y } : null),
  };
}

/** What an edge says on the board: what it's bound as, and which of what's on offer it uses. */
function edgeLabel(edge: CloudflareEdge, to: CloudflareService | undefined, link: ServiceLink | null): string {
  const name = edgeBinding(edge, to) ?? link?.label ?? edge.via;
  const used = edge.operations ?? [];
  if (!used.length) return name;
  const shown = used.slice(0, 3).join(', ');
  return `${name}: ${shown}${used.length > 3 ? ` +${used.length - 3}` : ''}`;
}

const toEdge = (edge: CloudflareEdge, byId: ReadonlyMap<string, CloudflareService>): DiagramEdge<ServiceEdgeData> => {
  const to = byId.get(edge.to);
  const check = linkOf(edge, byId.get(edge.from)?.kind ?? '', to?.kind ?? '');
  const link = check.ok ? check.link : null;
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    ...(link ? { fromPort: link.fromPort, toPort: link.toPort } : null),
    label: edgeLabel(edge, to, link),
    data: { edge, link, problem: check.ok ? null : check.reason },
  };
};

/** Where a service with no place of its own goes, among those that have one: in a column to the right of them. */
function placeNew<N>(nodes: (Partial<DiagramNode<N>> & { id: string; w?: number; h?: number })[]): DiagramNode<N>[] {
  const placed = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
  const right = placed.reduce((m, n) => Math.max(m, (n.x ?? 0) + (n.w ?? 0)), 0);
  const gap = 48;
  let y = placed.reduce((m, n) => Math.min(m, n.y ?? 0), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(y)) y = 0;
  return nodes.map((n) => {
    if (n.x !== undefined && n.y !== undefined) return n as DiagramNode<N>;
    const at = { ...n, x: right + gap, y };
    y += (n.h ?? 0) + gap;
    return at as DiagramNode<N>;
  });
}

/* ── A service, drawn ── */

/** A service's card: a hairline box on the card surface, red-edged when something's wrong with it. */
export const cloudflareServiceVariants = cva('absolute inset-0 overflow-hidden rounded-ctl border bg-card text-card-foreground', {
  variants: {
    tone: {
      default: 'border-border',
      destructive: 'border-destructive',
    },
  },
  defaultVariants: { tone: 'default' },
});

const portLabelClass = 'absolute -translate-y-1/2 truncate text-caption text-foreground/70 group-data-[zoom=far]/diagram:hidden group-data-[zoom=mid]/diagram:hidden';

export interface CloudflareServiceNodeProps extends VariantProps<typeof cloudflareServiceVariants> {
  node: DiagramNode<CloudflareServiceNodeData>;
  /** What to draw for its product, instead of the library's own icon. */
  icon?: (product: CatalogProduct) => ReactNode;
  className?: string;
}

/** A service as a Diagram node's body: its icon, its name and what it is, whether it has a machine, and its ports named.
 *  `renderNode={(node) => <CloudflareServiceNode node={node} />}` on a plain Diagram draws services the same way. */
export function CloudflareServiceNode({ node, icon, tone, className }: CloudflareServiceNodeProps) {
  const product = node.data?.product;
  const ports = node.ports ?? [];
  const problem = tone ? tone === 'destructive' : !!node.data?.problem;
  return (
    <div
      data-slot="cloudflare-service"
      data-kind={node.data?.service.kind}
      data-problem={problem || undefined}
      className={cn(cloudflareServiceVariants({ tone: problem ? 'destructive' : 'default' }), className)}
    >
      <div className="flex h-[46px] items-center gap-2 px-3 group-data-[zoom=far]/diagram:hidden">
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-foreground/70">
          {icon && product ? icon(product) : <Icon name={serviceIconName(product)} size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span data-slot="cloudflare-service-name" className="block truncate text-subhead font-semibold">{node.label}</span>
          {node.detail ? <span className="block truncate text-caption text-foreground/70">{node.detail}</span> : null}
        </span>
        {node.data?.service.machine ? <Badge data-part="machine" variant="secondary" size="sm">machine</Badge> : null}
      </div>
      {ports.map((p) => (
        <span
          key={p.id}
          aria-hidden="true"
          data-slot="cloudflare-port-label"
          data-side={p.side === 'l' ? 'start' : 'end'}
          className={cn(portLabelClass, p.side === 'l' ? 'left-3 max-w-[58%] text-left' : 'right-3 max-w-[38%] text-right')}
          // Where along its side the port is, which the catalog's ports say as a fraction.
          style={{ top: `${(p.at ?? 0.5) * 100}%` }}
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}

/** Services to bring into view once they've been placed again. `after` is the placing they were in when it was asked
 *  for: the places given (a new array when a service is added), or ELK's last result (a new one for each new graph). */
interface Reveal {
  ids: string[];
  after: unknown;
}

/** Brings what's just been added or connected into view, once it's been placed: wherever the viewport had been moved to,
 *  and wherever laying out again has moved it to. */
function RevealWhenPlaced({ nodes, placing, want, onDone }: { nodes: readonly DiagramNode<CloudflareServiceNodeData>[]; placing: unknown; want: Reveal | null; onDone: () => void }) {
  const { reveal } = useCanvas();
  useEffect(() => {
    if (!want || placing === want.after) return;
    const shown = nodes.filter((n) => want.ids.includes(n.id));
    if (shown.length < want.ids.length) return;
    const x = Math.min(...shown.map((n) => n.x)), y = Math.min(...shown.map((n) => n.y));
    const w = Math.max(...shown.map((n) => n.x + n.w)) - x, h = Math.max(...shown.map((n) => n.y + n.h)) - y;
    // Not `focus-in`: the Diagram leaves those to its keys, and this is asked for.
    reveal({ x, y, w, h }, { padding: 24 }, { reason: 'imperative' });
    onDone();
  }, [nodes, placing, want, reveal, onDone]);
  return null;
}

/* ── The diagram ── */

export function CloudflareDiagram({
  services: servicesProp, edges: edgesProp, defaultServices = NO_SERVICES, defaultEdges = NO_EDGES, onDataChange,
  editable = false, selection: selectionProp, defaultSelection = NOTHING_SELECTED, onSelectionChange,
  panelOpen, defaultPanelOpen, onPanelOpenChange, panelPresentation,
  openMachine: openMachineProp, defaultOpenMachine = null, onOpenMachineChange,
  direction = 'right', icon, emptyState, children, className, style, 'aria-label': ariaLabel = 'Cloudflare services', ...diagram
}: CloudflareDiagramProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* ── The system: controlled by `services` / `edges`, or the diagram's own ── */
  const controlled = servicesProp !== undefined;
  const given = useMemo<CloudflareSystem | undefined>(
    () => (controlled ? { services: servicesProp, edges: edgesProp ?? NO_EDGES } : undefined),
    [controlled, servicesProp, edgesProp],
  );
  const [system, setSystem] = useControllableChange<CloudflareSystem, CloudflareDiagramChangeReason>(
    given, { services: defaultServices, edges: defaultEdges }, onDataChange,
  );
  const { services, edges } = system;

  const byId = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const kindOf = (id: string) => byId.get(id)?.kind;
  const draftNodes = useMemo(() => services.map(serviceNode), [services]);
  // An edge with an end that isn't there has nowhere to be drawn. It's still in the system, and it's said to be wrong.
  const draftEdges = useMemo(() => edges.filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => toEdge(e, byId)), [edges, byId]);
  // With a place for any of them, those are where they are. With none, they're laid out, which needs ELK.
  const anyPlaced = services.some((s) => s.at);
  const nothing = useMemo(() => ({ nodes: [], edges: [] }), []);
  const draft = useMemo(() => (anyPlaced ? nothing : { nodes: draftNodes, edges: draftEdges }), [anyPlaced, nothing, draftNodes, draftEdges]);
  const laid = useDiagramLayout<CloudflareServiceNodeData, ServiceEdgeData>(draft as never, { host: boardRef, direction });
  const placed = useMemo(() => (anyPlaced ? placeNew<CloudflareServiceNodeData>(draftNodes as never) : null), [anyPlaced, draftNodes]);

  /* ── What's wrong with it. XState's only loaded if there's a machine for it to look at, as it's an optional peer. ── */
  const hasMachine = services.some((s) => s.machine);
  const [xstate, setXState] = useState<{ createMachine: (config: never) => unknown } | 'missing' | null>(null);
  useEffect(() => {
    if (!hasMachine || xstate) return undefined;
    let live = true;
    import('xstate').then((x) => { if (live) setXState(x as never); }, () => { if (live) setXState('missing'); });
    return () => { live = false; };
  }, [hasMachine, xstate]);
  const issues = useMemo(() => {
    const found = validateSystem(system);
    if (xstate === 'missing' && hasMachine) found.push({ severity: 'warning', code: 'no-xstate', message: NO_XSTATE });
    else if (xstate && xstate !== 'missing') found.push(...checkMachines(xstate, system));
    return found;
  }, [system, xstate, hasMachine]);
  // Only what isn't so is drawn as wrong. It goes on after laying out, as it isn't anything to lay out again for.
  const wrong = useMemo(() => ({
    edges: new Set(issues.flatMap((i) => (i.severity === 'error' && i.edge ? [i.edge] : []))),
    services: new Set(issues.flatMap((i) => (i.severity === 'error' && i.service && !i.edge ? [i.service] : []))),
  }), [issues]);
  const baseNodes = placed ?? laid.nodes;
  const baseEdges = placed ? draftEdges : laid.edges;
  const nodes = useMemo(() => baseNodes.map((n) => (wrong.services.has(n.id) && n.data ? { ...n, data: { ...n.data, problem: true } } : n)), [baseNodes, wrong]);
  const shownEdges = useMemo(() => baseEdges.map((e) => (wrong.edges.has(e.id) ? { ...e, kind: 'problem' as const } : e)), [baseEdges, wrong]);

  /* ── Selection, and what's open ── */
  const [selection, setSelection] = useControllableChange<DiagramSelection, DiagramSelectionChangeReason>(selectionProp, defaultSelection, onSelectionChange);
  const select = (next: DiagramSelection) => setSelection(next, { reason: 'imperative' });
  const selectedService = selection.nodes.length === 1 && !selection.edges.length ? byId.get(selection.nodes[0] ?? '') : undefined;
  const selectedEdge = selection.edges.length === 1 && !selection.nodes.length ? edges.find((e) => e.id === selection.edges[0]) : undefined;
  // What's to come into view once it's placed: something added, or both ends of a new connection, which ELK may move.
  const placing: unknown = placed ?? laid.bounds;
  const [toReveal, setToReveal] = useState<Reveal | null>(null);
  const revealed = useCallback(() => setToReveal(null), []);
  const [openId, setOpenId] = useControllableChange<string | null, CloudflareMachineChangeReason>(openMachineProp, defaultOpenMachine, onOpenMachineChange);

  /* ── One history for the board, the panel and the machines. What's undone here is what was done here; something new
        from outside starts over. ── */
  const [history, setHistory] = useState<{ past: Snapshot[]; future: Snapshot[] }>(NO_HISTORY);
  const lastSent = useRef<Snapshot | null>(null);
  useEffect(() => {
    if (lastSent.current && lastSent.current.services === services && lastSent.current.edges === edges) return;
    setHistory(NO_HISTORY);
  }, [services, edges]);
  const tell = (next: Snapshot, reason: CloudflareDiagramChangeReason, event?: Event) => {
    const sent = { services: [...next.services], edges: [...next.edges] };
    lastSent.current = sent;
    return setSystem(sent, { reason, event });
  };
  const send = (next: Partial<Snapshot>, reason: CloudflareDiagramChangeReason, event?: Event) => {
    const before = { services, edges };
    if (tell({ services: next.services ?? services, edges: next.edges ?? edges }, reason, event)) {
      setHistory((h) => ({ past: [...h.past.slice(-(HISTORY_LIMIT - 1)), before], future: [] }));
    }
  };
  const undo = () => {
    const to = history.past[history.past.length - 1];
    if (!to || !tell(to, 'undo')) return;
    setHistory({ past: history.past.slice(0, -1), future: [...history.future, { services, edges }] });
  };
  const redo = () => {
    const to = history.future[history.future.length - 1];
    if (!to || !tell(to, 'redo')) return;
    setHistory({ past: [...history.past, { services, edges }], future: history.future.slice(0, -1) });
  };

  const validConnection = (c: DiagramConnection) => {
    const check = linkBetween(kindOf(c.from) ?? '', c.fromPort, kindOf(c.to) ?? '', c.toPort);
    return check.ok ? true : check.reason;
  };
  const onDiagramDataChange: NonNullable<DiagramProps<CloudflareServiceNodeData, ServiceEdgeData>['onDataChange']> = (data, details) => {
    // Undoing's here, as it has more to go back to than the board does.
    if (details.reason === 'undo' || details.reason === 'redo') return;
    const keepPlaces = details.reason === 'move' || anyPlaced;
    const nextServices = data.nodes.flatMap((n) => {
      const s = byId.get(n.id);
      return s ? [keepPlaces ? { ...s, at: { x: n.x, y: n.y } } : s] : [];
    });
    const had = new Set(edges.map((e) => e.id));
    const stillThere = new Set(data.edges.map((e) => e.id));
    const left = new Set(nextServices.map((s) => s.id));
    const kept = edges.filter((e) => stillThere.has(e.id)
      // What the board can't draw isn't its to lose.
      || !byId.has(e.from) || !byId.has(e.to)
      // What carries events stays when its service goes, to say that something's still sending there.
      || (!!e.events?.length && (!left.has(e.from) || !left.has(e.to))));
    const made = data.edges.flatMap((e): CloudflareEdge[] => {
      if (had.has(e.id)) return [];
      const edge = newEdge(services, edges, e);
      return edge ? [edge] : [];
    });
    send({ services: nextServices, edges: [...kept, ...made] }, details.reason, details.event);
    if (details.reason === 'connect' && made[0]) {
      select({ nodes: [], edges: [made[0].id] });
      if (!anyPlaced) setToReveal({ ids: [made[0].from, made[0].to], after: placing });
    }
  };
  const changeEdge = (id: string, patch: Partial<CloudflareEdge>) => send({ edges: edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, 'edit');
  const changeService = (id: string, patch: Partial<CloudflareService>) => send({ services: services.map((s) => (s.id === id ? { ...s, ...patch } : s)) }, 'edit');
  const removeEdge = (id: string) => {
    if (selection.edges.includes(id)) select(NOTHING_SELECTED);
    send({ edges: edges.filter((e) => e.id !== id) }, 'delete');
  };
  const removeService = (id: string) => {
    select(NOTHING_SELECTED);
    send(removeServices({ services, edges }, [id]), 'delete');
  };
  const addFromCatalog = (product: CatalogProduct) => {
    const { system: next, id } = addService({ services, edges }, product.id);
    send(next, 'add');
    select({ nodes: [id], edges: [] });
    setToReveal({ ids: [id], after: placing });
  };

  /* ── A machine, over the board ── */
  const opened = openId ? byId.get(openId) : undefined;
  const openService = opened?.machine ? opened : undefined;
  const focusOpener = useRef(false);
  useEffect(() => {
    if (openService || !focusOpener.current) return undefined;
    focusOpener.current = false;
    // The panel stays inert until the frame has seen the cover go, a render after this one, and focus can't go into it
    // before then.
    let frame = 0;
    const focus = (tries: number) => {
      const opener = panelRef.current?.querySelector<HTMLElement>('[data-action=open-machine]');
      if (opener && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
      else if (opener && tries > 0) frame = requestAnimationFrame(() => focus(tries - 1));
    };
    focus(10);
    return () => cancelAnimationFrame(frame);
  }, [openService]);
  const closeMachine = () => {
    focusOpener.current = true;
    setOpenId(null, { reason: 'press' });
  };

  const onBoardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // The keys for undoing come here, from the board, and a field in the panel keeps its own.
    if (!editable || !(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (key === 'y') { e.preventDefault(); redo(); }
  };

  const selectedDraft = selectedEdge ? draftEdges.find((e) => e.id === selectedEdge.id) : undefined;
  const count = `${services.length} ${services.length === 1 ? 'service' : 'services'}`;
  const status = `${selectedService ? serviceName(selectedService) : count}${issues.length ? `, ${issues.length} ${issues.length === 1 ? 'problem' : 'problems'}` : ''}`;
  const empty = emptyState ?? (
    <EmptyState
      size="sm"
      icon={<Icon name="cloud" />}
      title="No services yet"
      description={editable ? 'Search the catalog in the panel to add one.' : 'This system has no services to draw.'}
    />
  );

  return (
    <DiagramFrame
      data-cloudflare-diagram=""
      open={panelOpen}
      defaultOpen={defaultPanelOpen}
      onOpenChange={onPanelOpenChange}
      presentation={panelPresentation}
      className={className}
      style={style}
    >
      <DiagramFrameBoard ref={boardRef} onKeyDown={onBoardKeyDown}>
        <Diagram<CloudflareServiceNodeData, ServiceEdgeData>
          nodes={nodes}
          edges={shownEdges}
          aria-label={ariaLabel}
          noun="service"
          selectable
          selection={selection}
          onSelectionChange={setSelection}
          renderNode={(node) => <CloudflareServiceNode node={node} icon={icon} />}
          emptyState={empty}
          loading={!placed && services.length > 0 && !laid.nodes.length && laid.status !== 'error'}
          undoable={false}
          {...(editable ? { editable: true, portsOnly: true, onDataChange: onDiagramDataChange, isValidConnection: validConnection } : null)}
          overlay={
            <>
              <DiagramToolbar side="top">
                {editable ? (
                  <>
                    <ToolbarSeparator />
                    <HistoryTool label="Undo" shortcut="mod+z" icon="arrow-uturn-backward" disabled={!history.past.length} onClick={undo} />
                    <HistoryTool label="Redo" shortcut="mod+shift+z" icon="arrow-uturn-forward" disabled={!history.future.length} onClick={redo} />
                  </>
                ) : null}
              </DiagramToolbar>
              {laid.error && !placed ? (
                <div data-slot="cloudflare-diagram-error" role="alert" className="absolute inset-x-3 top-16 rounded-ctl bg-popover p-3 text-footnote text-destructive shadow-raised">{laid.error.message}</div>
              ) : null}
            </>
          }
          {...diagram}
        >
          <RevealWhenPlaced nodes={nodes} placing={placing} want={toReveal} onDone={revealed} />
        </Diagram>
        <DiagramFrameBar>
          <span data-slot="cloudflare-status" className="min-w-0 truncate">{status}</span>
        </DiagramFrameBar>
      </DiagramFrameBoard>
      <DiagramFramePanel title="Services">
        <div ref={panelRef} data-slot="cloudflare-panel" className="flex flex-col gap-3.5">
          {children}
          {editable ? <CloudflareServiceSearch onAction={addFromCatalog} /> : null}
          {selectedEdge ? (
            <EdgePanel
              edge={selectedEdge}
              to={byId.get(selectedEdge.to)}
              link={selectedDraft?.data?.link ?? null}
              problem={selectedDraft?.data?.problem ?? null}
              eventIssues={issues.filter((i) => i.edge === selectedEdge.id && i.code.startsWith('event-'))}
              receivable={[...new Set(machinesPast({ services, edges }, selectedEdge).flatMap((m) => machineEvents(m.machine).events))]}
              editable={editable}
              onChange={(patch) => changeEdge(selectedEdge.id, patch)}
              onRemove={() => removeEdge(selectedEdge.id)}
              takenNames={edges.filter((e) => e.from === selectedEdge.from && e.id !== selectedEdge.id).flatMap((e) => edgeBinding(e, byId.get(e.to)) ?? [])}
            />
          ) : selectedService ? (
            <ServicePanel
              service={selectedService}
              problems={issues.filter((i) => i.service === selectedService.id && i.code === 'machine')}
              editable={editable}
              onRename={(label) => changeService(selectedService.id, { label: label.trim() || undefined })}
              onRemove={() => removeService(selectedService.id)}
              onOpenMachine={() => setOpenId(selectedService.id, { reason: 'press' })}
              onAddMachine={() => {
                changeService(selectedService.id, { machine: { id: selectedService.id, initial: 'idle', states: { idle: {} } } });
                setOpenId(selectedService.id, { reason: 'press' });
              }}
              onRemoveMachine={() => changeService(selectedService.id, { machine: undefined })}
            />
          ) : (
            <p data-slot="cloudflare-hint" className="m-0 text-footnote text-foreground/70">
              Select a service or a connection to see what it does.{editable ? ' To connect two, drag from a dot on the right of one to a dot on the left of another.' : ''}
            </p>
          )}
          {issues.length ? <IssueList issues={issues} edgesOnBoard={new Set(draftEdges.map((e) => e.id))} editable={editable} onShow={select} onRemoveEdge={removeEdge} /> : null}
          <p data-slot="cloudflare-attribution" className="m-0 text-caption text-foreground/70">
            Names and descriptions from Cloudflare’s docs, CC-BY-4.0. Cloudflare is a trademark of Cloudflare, Inc., and doesn’t endorse this.
          </p>
        </div>
      </DiagramFramePanel>
      {openService?.machine ? (
        <DiagramFrameCover>
          <div data-slot="cloudflare-machine-bar" className="flex shrink-0 items-center gap-2 border-b border-border p-2">
            <Button data-action="machine-back" variant="secondary" size="sm" autoFocus onClick={closeMachine}>
              <Icon name="chevron-left" /> Services
            </Button>
            <span className="min-w-0 truncate text-footnote font-semibold">{serviceName(openService)}’s machine</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <StateDiagram
              key={openService.id}
              config={openService.machine}
              simulate
              editable={editable}
              onConfigChange={editable ? (config) => changeService(openService.id, { machine: config }) : undefined}
              aria-label={`${serviceName(openService)}’s machine`}
            />
          </div>
        </DiagramFrameCover>
      ) : null}
    </DiagramFrame>
  );
}

/** One of the diagram's own history tools, beside DiagramToolbar's: the system's history, not the board's. */
function HistoryTool({ label, shortcut, icon, disabled, onClick }: { label: string; shortcut: string; icon: 'arrow-uturn-backward' | 'arrow-uturn-forward'; disabled: boolean; onClick: () => void }) {
  return (
    <Tooltip type="label" shortcut={shortcut}>
      <TooltipTrigger render={<ToolbarButton data-action={label.toLowerCase()} aria-label={label} size="icon-sm" disabled={disabled} onClick={onClick} />}>
        <Icon name={icon} size={16} />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <TooltipShortcut />
      </TooltipContent>
    </Tooltip>
  );
}

/* ── The catalog search ── */

export interface CloudflareServiceSearchProps {
  /** A product was chosen: from the list, or the first match on Enter. */
  onAction: (product: CatalogProduct, details: ChangeDetails<'item-press' | string>) => void;
  /** How many matches to offer. Default 6. */
  limit?: number;
  placeholder?: string;
  className?: string;
}

/** A search of the catalog: names first, then binding keys and what things are for. Choosing one hands it over and
 *  empties the search, ready for another. */
export function CloudflareServiceSearch({ onAction, limit = SEARCH_RESULTS, placeholder = 'Add a service', className }: CloudflareServiceSearchProps) {
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchCatalog(query, limit), [query, limit]);
  return (
    <div data-slot="cloudflare-search" className={cn('flex flex-col', className)}>
      <Combobox<string>
        value={null}
        query={query}
        onQueryChange={(next) => setQuery(next)}
        onValueChange={(id, details) => {
          const product = found.find((p) => p.id === id);
          if (!product) return;
          details.cancel();
          setQuery('');
          onAction(product, details);
        }}
        filter={false}
        autoHighlight
      >
        <ComboboxInputGroup size="sm">
          <Icon name="magnifyingglass" size={14} className="shrink-0 text-tertiary-foreground" />
          <ComboboxInput aria-label="Search Cloudflare’s services" placeholder={placeholder} />
        </ComboboxInputGroup>
        <ComboboxContent>
          <ComboboxEmpty title="Nothing matches" description={`Not in the catalog, as of ${CLOUDFLARE_CATALOG.pins.docs.date}.`} />
          <ComboboxList>
            {found.map((p) => (
              <ComboboxItem key={p.id} value={p.id} data-kind={p.id} description={p.description ?? undefined} icon={<Icon name={serviceIconName(p)} size={16} />}>{p.name}</ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

/* ── The panel's parts ── */

/** Everything that's wrong, with a way to get to each. */
function IssueList({ issues, edgesOnBoard, editable, onShow, onRemoveEdge }: { issues: readonly SystemIssue[]; edgesOnBoard: ReadonlySet<string>; editable: boolean; onShow: (selection: DiagramSelection) => void; onRemoveEdge: (id: string) => void }) {
  return (
    <DiagramFrameSection title={issues.length === 1 ? 'A problem' : `${issues.length} problems`}>
      <ul data-slot="cloudflare-issues" aria-live="polite" className="m-0 flex list-none flex-col gap-2.5 p-0">
        {issues.map((issue, i) => {
          const edge = issue.edge, service = issue.service;
          return (
            <li key={`${issue.code}:${edge ?? service ?? ''}:${i}`} data-slot="cloudflare-issue" data-severity={issue.severity} data-code={issue.code} data-edge={edge} data-service={service} className="flex flex-col items-start gap-1 text-footnote [overflow-wrap:anywhere]">
              <span className="flex items-start gap-1.5">
                <Badge variant={issue.severity === 'error' ? 'destructive' : 'outline'} size="sm" className="mt-px">{issue.severity === 'error' ? 'Wrong' : 'Note'}</Badge>
                <span className={issue.severity === 'error' ? 'text-destructive' : 'text-foreground/70'}>{issue.message}</span>
              </span>
              {edge && edgesOnBoard.has(edge) ? <Button data-action="show-issue" variant="secondary" size="sm" onClick={() => onShow({ nodes: [], edges: [edge] })}>Show it</Button> : null}
              {edge && !edgesOnBoard.has(edge) && editable ? <Button data-action="remove-edge" variant="secondary" size="sm" onClick={() => onRemoveEdge(edge)}>Remove the connection</Button> : null}
              {!edge && service ? <Button data-action="show-issue" variant="secondary" size="sm" onClick={() => onShow({ nodes: [service], edges: [] })}>Show it</Button> : null}
            </li>
          );
        })}
      </ul>
    </DiagramFrameSection>
  );
}

const fact = (label: string, value: ReactNode, slot: string) => (
  <p data-slot={slot} className="m-0 text-footnote [overflow-wrap:anywhere]"><span className="text-foreground/70">{label}:</span> {value}</p>
);

function ServicePanel({ service, problems, editable, onRename, onRemove, onOpenMachine, onAddMachine, onRemoveMachine }: { service: CloudflareService; problems: readonly SystemIssue[]; editable: boolean; onRename: (label: string) => void; onRemove: () => void; onOpenMachine: () => void; onAddMachine: () => void; onRemoveMachine: () => void }) {
  const product = catalogProduct(service.kind);
  const machine = service.machine ? machineEvents(service.machine) : null;
  const remove = editable ? <div><Button data-action="delete" variant="destructive" size="sm" onClick={onRemove}>Delete</Button></div> : null;
  const machineSection = service.machine || (editable && runsCode(service.kind)) ? (
    <DiagramFrameSection title="Its machine">
      {problems.map((p) => <p key={p.message} data-slot="cloudflare-machine-problem" role="alert" className="m-0 text-footnote text-destructive [overflow-wrap:anywhere]">{p.message}</p>)}
      {machine ? (
        <>
          {fact('Receives', machine.anything ? 'anything' : machine.events.join(', ') || 'nothing from outside', 'cloudflare-machine-receives')}
          <div className="flex flex-wrap gap-1.5">
            <Button data-action="open-machine" variant="secondary" size="sm" onClick={onOpenMachine}>Open it</Button>
            {editable ? <Button data-action="remove-machine" variant="secondary" size="sm" onClick={onRemoveMachine}>Remove it</Button> : null}
          </div>
        </>
      ) : <div><Button data-action="add-machine" variant="secondary" size="sm" onClick={onAddMachine}>Give it one</Button></div>}
    </DiagramFrameSection>
  ) : null;
  if (!product) {
    return (
      <>
        <DiagramFrameSection title={service.label ?? service.kind}>
          <p data-slot="cloudflare-unknown" className="m-0 text-footnote text-destructive">“{service.kind}” isn’t in the catalog, at {CLOUDFLARE_CATALOG.pins.docs.date}. It can be drawn, but nothing says what it can reach.</p>
          {remove}
        </DiagramFrameSection>
        {machineSection}
      </>
    );
  }
  const ports: readonly DiagramPort[] = servicePorts(service.kind);
  const ins = ports.filter((p) => p.direction === 'in'), outs = ports.filter((p) => p.direction === 'out');
  return (
    <>
      <DiagramFrameSection title={product.name}>
        {product.description ? <p data-slot="cloudflare-description" className="m-0 text-footnote">{product.description}</p> : null}
        {editable ? <DiagramFrameInput data-field="label" label="Called" value={service.label ?? ''} placeholder={product.name} onValueCommit={onRename} /> : null}
        {ins.length ? fact('Reached by', ins.map((p) => p.label).join(', '), 'cloudflare-reached-by') : null}
        {outs.length ? fact('Reaches with', outs.map((p) => p.label).join(', '), 'cloudflare-reaches-with') : null}
        {!ports.length ? <p data-slot="cloudflare-no-ports" className="m-0 text-footnote text-foreground/70">Nothing connects to it here: it has no binding, and no handler for a Worker to run. It can still be on the diagram, to say it’s there.</p> : null}
        <a data-slot="cloudflare-docs-link" className="text-footnote text-link" href={`https://developers.cloudflare.com${product.url}`} target="_blank" rel="noreferrer">Cloudflare’s docs for {product.name}</a>
        {remove}
      </DiagramFrameSection>
      {machineSection}
    </>
  );
}

function EdgePanel({ edge, to, link, problem, eventIssues, receivable, editable, onChange, onRemove, takenNames }: { edge: CloudflareEdge; to: CloudflareService | undefined; link: ServiceLink | null; problem: string | null; eventIssues: readonly SystemIssue[]; receivable: readonly string[]; editable: boolean; onChange: (patch: Partial<CloudflareEdge>) => void; onRemove: () => void; takenNames: readonly string[] }) {
  const [refused, setRefused] = useState<string | null>(null);
  const binding = link?.kind === 'binding' ? catalogBinding(link.via.split('.')[0] ?? '') : undefined;
  const name = edgeBinding(edge, to) ?? '';
  const rename = (next: string) => {
    const name = next.trim();
    if (!name) { setRefused('A binding needs a name.'); return; }
    if (!BINDING_NAME.test(name)) { setRefused(`“${name}” can’t be a name on env.`); return; }
    if (takenNames.includes(name)) { setRefused(`There’s already a binding called “${name}” on that.`); return; }
    setRefused(null);
    onChange({ binding: name });
  };
  const setEvents = (text: string) => {
    const events = [...new Set(text.split(/[\s,]+/).filter(Boolean))];
    onChange({ events: events.length ? events : undefined });
  };
  const offered = link?.operations ?? [];
  return (
    <>
      <DiagramFrameSection title={link?.label ?? edge.via}>
        {problem ? <p data-slot="cloudflare-edge-problem" role="alert" className="m-0 text-footnote text-destructive">{problem}</p> : null}
        {binding?.description ? <p className="m-0 text-footnote text-foreground/70">{binding.description}</p> : null}
        {link?.kind === 'binding' ? (editable ? (
          <>
            <DiagramFrameInput data-field="binding-name" label="On env, as" value={name} onValueCommit={rename} />
            {refused ? <p data-slot="cloudflare-refusal" role="alert" className="m-0 text-footnote text-destructive">{refused}</p> : null}
          </>
        ) : fact('On env, as', name, 'cloudflare-binding-name')) : null}
        {offered.length ? (
          editable ? (
            <CheckboxGroup
              data-part="operations"
              aria-label={link?.kind === 'events' ? 'What it sends, and which of it this uses' : 'What it can do, and which of it this uses'}
              value={edge.operations ?? []}
              // In the catalog's order, whatever order they were checked in.
              onValueChange={(next: string[]) => onChange({ operations: offered.map((m) => m.name).filter((n) => next.includes(n)) })}
              className="flex flex-col gap-1"
            >
              <p className="m-0 text-footnote text-foreground/70">{link?.kind === 'events' ? 'What it sends' : 'What it can do'}, and which of it this uses</p>
              {offered.map((m) => (
                <Label key={m.name} variant="control" data-operation={m.name} className="text-footnote [overflow-wrap:anywhere]">
                  <Checkbox shape="square" value={m.name} />
                  <span title={m.returns?.join(' | ')} className={cn(m.deprecated && 'line-through')}>{methodSignature(m)}</span>
                  {m.deprecated ? <Badge variant="outline" size="sm">deprecated</Badge> : null}
                </Label>
              ))}
            </CheckboxGroup>
          ) : (
            <>
              <p className="m-0 text-footnote text-foreground/70">{link?.kind === 'events' ? 'What it sends' : 'What it can do'}</p>
              <ul data-slot="cloudflare-operations" className="m-0 flex list-none flex-col gap-1 p-0">
                {offered.map((m) => (
                  <li key={m.name} data-slot="cloudflare-operation" data-operation={m.name} data-used={edge.operations?.includes(m.name) ? '' : undefined} className="flex items-center gap-2 text-footnote [overflow-wrap:anywhere]">
                    <span title={m.returns?.join(' | ')} className={cn(m.deprecated && 'line-through', !edge.operations?.includes(m.name) && 'text-foreground/70')}>{methodSignature(m)}</span>
                    {edge.operations?.includes(m.name) ? <Badge variant="tinted" size="sm">used</Badge> : null}
                    {m.deprecated ? <Badge variant="outline" size="sm">deprecated</Badge> : null}
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}
        {editable ? <div><Button data-action="delete" variant="destructive" size="sm" onClick={onRemove}>Delete</Button></div> : null}
      </DiagramFrameSection>
      {editable || edge.events?.length ? (
        <DiagramFrameSection title="Machine events it carries">
          {eventIssues.map((issue) => <p key={issue.message} data-slot="cloudflare-event-problem" className={cn('m-0 text-footnote [overflow-wrap:anywhere]', issue.severity === 'error' ? 'text-destructive' : 'text-foreground/70')}>{issue.message}</p>)}
          {editable
            ? <DiagramFrameInput data-field="events" label="Their names, with commas between" value={(edge.events ?? []).join(', ')} placeholder="None" onValueCommit={setEvents} />
            : fact('Carries', (edge.events ?? []).join(', '), 'cloudflare-events')}
          {receivable.length ? fact('A machine past there receives', receivable.join(', '), 'cloudflare-receivable') : null}
        </DiagramFrameSection>
      ) : null}
    </>
  );
}
