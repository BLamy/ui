'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useCanvas } from '@/components/ui/canvas';
import { Checkbox } from '@/components/ui/checkbox';
import { Diagram, type DiagramChange, type DiagramProps } from '@/components/ui/diagram';
import { DiagramFrame, DiagramPanelField, DiagramPanelSection } from '@/components/ui/diagram-frame';
import { ListBox, ListBoxItem } from '@/components/ui/list-box';
import { SearchField } from '@/components/ui/search-field';
import { StateDiagram } from '@/components/ui/state-diagram';
import { CLOUDFLARE_CATALOG } from '@/lib/cloudflare-catalog.generated';
import type { CatalogProduct } from '@/lib/cloudflare-catalog';
import { catalogBinding, catalogProduct, linkBetween, linkOf, methodSignature, newEdge, runsCode, SERVICE_NODE, serviceIconName, serviceNodeHeight, servicePorts, type CloudflareEdge, type CloudflareService, type ServiceLink } from '@/lib/cloudflare-services';
import { addService, BINDING_NAME, checkMachines, edgeBinding, machineEvents, machinesPast, removeServices, searchCatalog, serviceName, validateSystem, type SystemIssue } from '@/lib/cloudflare-system';
import { useContainerSize } from '@/lib/container';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import { NOTHING_SELECTED, type DiagramConnection, type DiagramEdge, type DiagramNode, type DiagramPort, type DiagramSelection } from '@/lib/diagram-model';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ CloudflareDiagram — Cloudflare's services on a Diagram ══
   Each service is a node with what it can call and receive as ports, from the catalog, and a connection can only be one the
   catalog says there is: a Worker to R2 offers R2's real methods, and R2 to D1 says why not.

   What's given is a system, as data: services, what each is bound as, which have a machine, and which events cross which edge.
   It says what's wrong with one, which can have come from a file. Editing, a search of the catalog adds a service. A service's
   machine opens in a `StateDiagram`, over the board.

   There's no Cloudflare artwork, as their trademark page asks for written permission: names in words, the library's own icons,
   and an `icon` prop for an app that has its own permission. It comes with the catalog, which is about 150 KB, from
   `@brett_lamy/ui/cloudflare`, so it isn't in the main entry. */

export interface CloudflareDiagramChange {
  services: CloudflareService[];
  edges: CloudflareEdge[];
  /** How it came about: on the board, or `edit` for something changed in the panel, or a machine. */
  reason: DiagramChange['reason'] | 'edit';
}

export interface CloudflareDiagramProps extends Pick<DiagramProps, 'minimap' | 'background' | 'fitPadding' | 'aria-label' | 'camera' | 'defaultCamera' | 'onCameraChange'> {
  services: readonly CloudflareService[];
  edges?: readonly CloudflareEdge[];
  onChange?: (change: CloudflareDiagramChange) => void;
  /** Let services be moved, added and connected, and connections and machines changed. */
  editable?: boolean;
  /** What to draw for a product, instead of the library's own icon, for an app with permission to use Cloudflare's. */
  icon?: (product: CatalogProduct) => ReactNode;
  /** Which way a layout runs, when none of the services say where they are (default `RIGHT`). */
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  /** What's selected to begin with. */
  defaultSelection?: DiagramSelection;
  /** Whether the panel starts open. By default it does if it fits beside the board. */
  defaultPanelOpen?: boolean;
  /** Whose machine is open to begin with, by the service's id. */
  defaultMachine?: string;
  /** Something more for the panel, at the top. */
  panelExtra?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface Snapshot {
  services: readonly CloudflareService[];
  edges: readonly CloudflareEdge[];
}
const NO_HISTORY: { past: Snapshot[]; future: Snapshot[] } = { past: [], future: [] };
const HISTORY_LIMIT = 100;
const SEARCH_RESULTS = 6;
const NO_XSTATE = 'Checking its machines needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';

interface ServiceNodeData {
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

const toNode = (service: CloudflareService): Omit<DiagramNode<ServiceNodeData>, 'x' | 'y'> & { x?: number; y?: number } => {
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
};

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
  const right = placed.reduce((m, n) => Math.max(m, n.x! + (n.w ?? 0)), 0);
  const gap = 48;
  let y = placed.reduce((m, n) => Math.min(m, n.y!), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(y)) y = 0;
  return nodes.map((n) => {
    if (n.x !== undefined && n.y !== undefined) return n as DiagramNode<N>;
    const at = { ...n, x: right + gap, y };
    y += (n.h ?? 0) + gap;
    return at as DiagramNode<N>;
  });
}

const PORT_LABEL = 'absolute truncate text-caption text-foreground/70 group-data-[zoom=far]/diagram:hidden group-data-[zoom=mid]/diagram:hidden';

function ServiceNodeBody({ node, icon }: { node: DiagramNode<ServiceNodeData>; icon?: CloudflareDiagramProps['icon'] }) {
  const product = node.data?.product;
  const ports = node.ports ?? [];
  return (
    <div data-slot="cloudflare-service" data-kind={node.data?.service.kind} data-problem={node.data?.problem || undefined} className={cn('absolute inset-0 overflow-hidden rounded-ctl border bg-card text-card-foreground', node.data?.problem ? 'border-destructive' : 'border-border')}>
      <div className="flex h-[46px] items-center gap-2 px-3 group-data-[zoom=far]/diagram:hidden">
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-foreground/70">
          {icon && product ? icon(product) : <Icon name={serviceIconName(product)} size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span data-slot="cloudflare-service-name" className="block truncate text-subhead font-semibold">{node.label}</span>
          {node.detail ? <span className="block truncate text-caption text-foreground/70">{node.detail}</span> : null}
        </span>
        {node.data?.service.machine ? <span data-slot="cloudflare-service-machine" className="shrink-0 rounded-full bg-secondary px-1.5 text-caption text-foreground/70">machine</span> : null}
      </div>
      {ports.map((p) => (
        <span
          key={p.id}
          aria-hidden="true"
          data-slot="cloudflare-port-label"
          className={cn(PORT_LABEL, p.side === 'l' ? 'left-3 text-left' : 'right-3 text-right')}
          style={{ top: `${(p.at ?? 0.5) * 100}%`, maxWidth: p.side === 'l' ? '58%' : '38%', transform: 'translateY(-50%)' }}
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}

/** Brings something that's just been added into view, if the camera's been moved away from where it went. */
function RevealWhenPlaced({ node, onDone }: { node: DiagramNode<ServiceNodeData> | undefined; onDone: () => void }) {
  const { size, toScreen, update } = useCanvas();
  useEffect(() => {
    if (!node) return;
    const a = toScreen({ x: node.x, y: node.y }), b = toScreen({ x: node.x + node.w, y: node.y + node.h });
    const margin = 24;
    // A camera that's still fitting has it in view, so it doesn't get moved, and goes on fitting.
    const by = (start: number, end: number, room: number) => (start >= 0 && end <= room ? 0 : start < 0 || end - start > room ? margin - start : room - margin - end);
    const dx = by(a.x, b.x, size.width), dy = by(a.y, b.y, size.height);
    if (dx || dy) update((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);
  return null;
}

export function CloudflareDiagram({ services, edges = [], onChange, editable = false, icon, direction, defaultSelection = NOTHING_SELECTED, defaultPanelOpen, defaultMachine, panelExtra, className, style, 'aria-label': ariaLabel, ...diagram }: CloudflareDiagramProps) {
  const [host, size] = useContainerSize();
  const byId = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const kindOf = (id: string) => byId.get(id)?.kind;
  const draftNodes = useMemo(() => services.map(toNode), [services]);
  // An edge with an end that isn't there has nowhere to be drawn. It's still in the system, and it's said to be wrong.
  const draftEdges = useMemo(() => edges.filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => toEdge(e, byId)), [edges, byId]);
  // With a place for any of them, those are where they are. With none, they're laid out, which needs ELK.
  const anyPlaced = services.some((s) => s.at);
  const nothing = useMemo(() => ({ nodes: [], edges: [] }), []);
  const draft = useMemo(() => (anyPlaced ? nothing : { nodes: draftNodes, edges: draftEdges }), [anyPlaced, nothing, draftNodes, draftEdges]);
  const laid = useDiagramLayout<ServiceNodeData, ServiceEdgeData>(draft as never, { host, direction });
  const placed = useMemo(() => (anyPlaced ? placeNew<ServiceNodeData>(draftNodes as never) : null), [anyPlaced, draftNodes]);

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
    const system = { services, edges };
    const found = validateSystem(system);
    if (xstate === 'missing' && hasMachine) found.push({ severity: 'warning', code: 'no-xstate', message: NO_XSTATE });
    else if (xstate && xstate !== 'missing') found.push(...checkMachines(xstate, system));
    return found;
  }, [services, edges, xstate, hasMachine]);
  // Only what isn't so is drawn as wrong. It goes on after laying out, as it isn't anything to lay out again for.
  const wrong = useMemo(() => ({
    edges: new Set(issues.filter((i) => i.severity === 'error' && i.edge).map((i) => i.edge!)),
    services: new Set(issues.filter((i) => i.severity === 'error' && i.service && !i.edge).map((i) => i.service!)),
  }), [issues]);
  const baseNodes = placed ?? laid.nodes;
  const baseEdges = placed ? draftEdges : laid.edges;
  const nodes = useMemo(() => baseNodes.map((n) => (wrong.services.has(n.id) ? { ...n, data: { ...n.data!, problem: true } } : n)), [baseNodes, wrong]);
  const shownEdges = useMemo(() => baseEdges.map((e) => (wrong.edges.has(e.id) ? { ...e, kind: 'problem' as const } : e)), [baseEdges, wrong]);

  const [selection, setSelection] = useState<DiagramSelection>(defaultSelection);
  const selectedService = selection.nodes.length === 1 && !selection.edges.length ? byId.get(selection.nodes[0]!) : undefined;
  const selectedEdge = selection.edges.length === 1 && !selection.nodes.length ? edges.find((e) => e.id === selection.edges[0]) : undefined;
  const [justAdded, setJustAdded] = useState<string | null>(null);

  /* What's undone from here is what was done here. Something new from outside starts over. */
  const [history, setHistory] = useState<{ past: Snapshot[]; future: Snapshot[] }>(NO_HISTORY);
  const lastSent = useRef<{ services: unknown; edges: unknown } | null>(null);
  useEffect(() => {
    if (lastSent.current && lastSent.current.services === services && lastSent.current.edges === edges) return;
    setHistory(NO_HISTORY);
  }, [services, edges]);
  const tell = (next: Snapshot, reason: CloudflareDiagramChange['reason']) => {
    const change = { services: [...next.services], edges: [...next.edges], reason };
    lastSent.current = { services: change.services, edges: change.edges };
    onChange?.(change);
  };
  const send = (next: { services?: readonly CloudflareService[]; edges?: readonly CloudflareEdge[] }, reason: CloudflareDiagramChange['reason']) => {
    setHistory((h) => ({ past: [...h.past.slice(-(HISTORY_LIMIT - 1)), { services, edges }], future: [] }));
    tell({ services: next.services ?? services, edges: next.edges ?? edges }, reason);
  };
  const undo = () => {
    const to = history.past[history.past.length - 1];
    if (!to) return;
    setHistory({ past: history.past.slice(0, -1), future: [...history.future, { services, edges }] });
    tell(to, 'undo');
  };
  const redo = () => {
    const to = history.future[history.future.length - 1];
    if (!to) return;
    setHistory({ past: [...history.past, { services, edges }], future: history.future.slice(0, -1) });
    tell(to, 'redo');
  };
  const validConnection = (c: DiagramConnection) => {
    const check = linkBetween(kindOf(c.from) ?? '', c.fromPort, kindOf(c.to) ?? '', c.toPort);
    return check.ok ? true : check.reason;
  };
  const onDiagramChange = (change: DiagramChange<ServiceNodeData, ServiceEdgeData>) => {
    // Undoing's here, as it has more to go back to than the board does.
    if (change.reason === 'undo' || change.reason === 'redo') return;
    const keepPlaces = change.reason === 'move' || anyPlaced;
    const nextServices = change.nodes.flatMap((n) => {
      const s = byId.get(n.id);
      return s ? [keepPlaces ? { ...s, at: { x: n.x, y: n.y } } : s] : [];
    });
    const had = new Set(edges.map((e) => e.id));
    const stillThere = new Set(change.edges.map((e) => e.id));
    const left = new Set(nextServices.map((s) => s.id));
    const kept = edges.filter((e) => stillThere.has(e.id)
      // What the board can't draw isn't its to lose.
      || !byId.has(e.from) || !byId.has(e.to)
      // What carries events stays when its service goes, to say that something's still sending there.
      || (!!e.events?.length && (!left.has(e.from) || !left.has(e.to))));
    const made = change.edges.flatMap((e): CloudflareEdge[] => {
      if (had.has(e.id)) return [];
      const edge = newEdge(services, edges, e);
      return edge ? [edge] : [];
    });
    send({ services: nextServices, edges: [...kept, ...made] }, change.reason);
    if (change.reason === 'connect' && made[0]) setSelection({ nodes: [], edges: [made[0].id] });
  };
  const changeEdge = (id: string, patch: Partial<CloudflareEdge>) => send({ edges: edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, 'edit');
  const changeService = (id: string, patch: Partial<CloudflareService>) => send({ services: services.map((s) => (s.id === id ? { ...s, ...patch } : s)) }, 'edit');
  const removeEdge = (id: string) => {
    setSelection((s) => (s.edges.includes(id) ? NOTHING_SELECTED : s));
    send({ edges: edges.filter((e) => e.id !== id) }, 'delete');
  };
  const removeService = (id: string) => {
    setSelection(NOTHING_SELECTED);
    send(removeServices({ services, edges }, [id]), 'delete');
  };
  const addFromCatalog = (product: CatalogProduct) => {
    const { system, id } = addService({ services, edges }, product.id);
    send(system, 'edit');
    setSelection({ nodes: [id], edges: [] });
    setJustAdded(id);
  };

  /* ── A machine, over the board ── */
  const [openId, setOpenId] = useState<string | null>(defaultMachine ?? null);
  const opened = openId ? byId.get(openId) : undefined;
  const openMachine = opened?.machine ? opened : undefined;
  const focusOpener = useRef(false);
  useEffect(() => {
    if (openMachine || !focusOpener.current) return;
    focusOpener.current = false;
    host.current?.querySelector<HTMLElement>('[data-slot=cloudflare-machine-open]')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMachine]);
  const closeMachine = () => {
    focusOpener.current = true;
    setOpenId(null);
  };
  const machineCover = openMachine ? (
    <>
      <div data-slot="cloudflare-machine-bar" className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <Button data-slot="cloudflare-machine-back" variant="secondary" size="sm" autoFocus onPress={closeMachine}>Back to the services</Button>
        <span className="min-w-0 truncate text-footnote font-semibold">{serviceName(openMachine)}’s machine</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <StateDiagram
          key={openMachine.id}
          config={openMachine.machine}
          simulate
          editable={editable}
          onConfigChange={editable ? (config) => changeService(openMachine.id, { machine: config }) : undefined}
          aria-label={`${serviceName(openMachine)}’s machine`}
        />
      </div>
    </>
  ) : null;

  const renderNode = useCallback((node: DiagramNode<ServiceNodeData>) => <ServiceNodeBody node={node} icon={icon} />, [icon]);
  const selectedDraft = selectedEdge ? draftEdges.find((e) => e.id === selectedEdge.id) : undefined;
  const count = `${services.length} ${services.length === 1 ? 'service' : 'services'}`;
  const panel = (
    <div data-slot="cloudflare-panel" tabIndex={-1} className="flex flex-col gap-3.5 px-3.5 pt-1 pb-3.5 outline-none">
      {panelExtra}
      {editable ? <ServiceSearch onAdd={addFromCatalog} /> : null}
      {editable ? (
        <div className="flex gap-1.5">
          <Button data-slot="cloudflare-undo" variant="secondary" size="sm" isDisabled={!history.past.length} onPress={undo}>Undo</Button>
          <Button data-slot="cloudflare-redo" variant="secondary" size="sm" isDisabled={!history.future.length} onPress={redo}>Redo</Button>
        </div>
      ) : null}
      {selectedEdge ? (
        <EdgePanel edge={selectedEdge} to={byId.get(selectedEdge.to)} link={selectedDraft?.data?.link ?? null} problem={selectedDraft?.data?.problem ?? null} eventIssues={issues.filter((i) => i.edge === selectedEdge.id && i.code.startsWith('event-'))} receivable={[...new Set(machinesPast({ services, edges }, selectedEdge).flatMap((m) => machineEvents(m.machine).events))]} editable={editable} onChange={(patch) => changeEdge(selectedEdge.id, patch)} onRemove={() => removeEdge(selectedEdge.id)} takenNames={edges.filter((e) => e.from === selectedEdge.from && e.id !== selectedEdge.id).map((e) => edgeBinding(e, byId.get(e.to))).filter((n): n is string => !!n)} />
      ) : selectedService ? (
        <ServicePanel service={selectedService} problems={issues.filter((i) => i.service === selectedService.id && i.code === 'machine')} editable={editable} onRename={(label) => changeService(selectedService.id, { label: label.trim() || undefined })} onRemove={() => removeService(selectedService.id)} onOpenMachine={() => setOpenId(selectedService.id)} onAddMachine={() => { changeService(selectedService.id, { machine: { id: selectedService.id, initial: 'idle', states: { idle: {} } } }); setOpenId(selectedService.id); }} onRemoveMachine={() => changeService(selectedService.id, { machine: undefined })} />
      ) : (
        <p data-slot="cloudflare-hint" className="m-0 text-footnote text-foreground/70">Select a service or a connection to see what it does. {editable ? 'To connect two, drag from a dot on the right of one to a dot on the left of another.' : ''}</p>
      )}
      {issues.length ? <IssueList issues={issues} edgesOnBoard={new Set(draftEdges.map((e) => e.id))} editable={editable} onShow={setSelection} onRemoveEdge={removeEdge} /> : null}
      <p data-slot="cloudflare-attribution" className="m-0 text-caption text-foreground/70">Names and descriptions from Cloudflare’s docs, CC-BY-4.0. Cloudflare is a trademark of Cloudflare, Inc., and doesn’t endorse this.</p>
    </div>
  );
  return (
    <DiagramFrame
      slot="cloudflare-diagram"
      host={host}
      size={size}
      title="Services"
      panel={panel}
      status={`${selectedService ? serviceName(selectedService) : count}${issues.length ? `, ${issues.length} ${issues.length === 1 ? 'problem' : 'problems'}` : ''}`}
      defaultOpen={defaultPanelOpen}
      focusSelector="[data-slot=cloudflare-panel]"
      cover={machineCover}
      className={className}
      style={style}
      // The keys for undoing come here, from the board, and a field in the panel keeps its own.
      onBoardKeyDown={!editable ? undefined : (e) => {
        if (!(e.metaKey || e.ctrlKey)) return;
        const key = e.key.toLowerCase();
        if (key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        else if (key === 'y') { e.preventDefault(); redo(); }
      }}
    >
      {(bar) => (
        <Diagram<ServiceNodeData, ServiceEdgeData>
          nodes={nodes}
          edges={shownEdges}
          aria-label={ariaLabel ?? 'Cloudflare services'}
          noun="service"
          selectable
          selection={selection}
          onSelectionChange={setSelection}
          renderNode={renderNode}
          {...(editable ? { editable: true, portsOnly: true, onChange: onDiagramChange, isValidConnection: validConnection } : null)}
          overlay={laid.error && !placed ? (
            <div data-slot="cloudflare-diagram-error" role="alert" className="absolute inset-x-4 top-4 rounded-ctl bg-popover p-3 text-footnote text-destructive shadow-hairline">{laid.error.message}</div>
          ) : bar}
          {...diagram}
        >
          <RevealWhenPlaced node={justAdded ? nodes.find((n) => n.id === justAdded) : undefined} onDone={() => setJustAdded(null)} />
        </Diagram>
      )}
    </DiagramFrame>
  );
}

/** A search of the catalog, to add what it finds. */
function ServiceSearch({ onAdd }: { onAdd: (product: CatalogProduct) => void }) {
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchCatalog(query, SEARCH_RESULTS), [query]);
  const root = useRef<HTMLElement>(null);
  const add = (product: CatalogProduct | undefined) => {
    if (!product) return;
    onAdd(product);
    setQuery('');
    // What was pressed has gone, and there may be another to add.
    root.current?.querySelector('input')?.focus();
  };
  return (
    <section ref={root} data-slot="cloudflare-search" aria-label="Add a service" className="flex flex-col gap-1.5">
      <SearchField value={query} onChange={setQuery} onSubmit={() => add(found[0])} placeholder="Add a service" aria-label="Search Cloudflare’s services" />
      {!query.trim() ? null : found.length ? (
        <ListBox aria-label="What’s in the catalog" variant="popup" selectionMode="none" className="p-0" onAction={(key) => add(found.find((p) => p.id === key))}>
          {found.map((p) => (
            <ListBoxItem key={p.id} id={p.id} textValue={p.name} data-kind={p.id} description={p.description ?? undefined} icon={<Icon name={serviceIconName(p)} size={16} />}>{p.name}</ListBoxItem>
          ))}
        </ListBox>
      ) : (
        <p data-slot="cloudflare-search-none" className="m-0 text-footnote text-foreground/70">Nothing in the catalog matches that, as of {CLOUDFLARE_CATALOG.pins.docs.date}.</p>
      )}
    </section>
  );
}

/** Everything that's wrong, with a way to get to each. */
function IssueList({ issues, edgesOnBoard, editable, onShow, onRemoveEdge }: { issues: readonly SystemIssue[]; edgesOnBoard: ReadonlySet<string>; editable: boolean; onShow: (selection: DiagramSelection) => void; onRemoveEdge: (id: string) => void }) {
  return (
    <DiagramPanelSection title={issues.length === 1 ? 'A problem' : `${issues.length} problems`}>
      <ul data-slot="cloudflare-issues" aria-live="polite" className="m-0 flex list-none flex-col gap-2 p-0">
        {issues.map((issue, i) => (
          // eslint-disable-next-line react/no-array-index-key -- two can say the same thing about the same edge
          <li key={`${issue.code}:${issue.edge ?? issue.service ?? ''}:${i}`} data-slot="cloudflare-issue" data-severity={issue.severity} data-code={issue.code} data-edge={issue.edge} data-service={issue.service} className="flex flex-col items-start gap-1 text-footnote [overflow-wrap:anywhere]">
            <span className={issue.severity === 'error' ? 'text-destructive' : 'text-foreground/70'}>{issue.message}</span>
            {issue.edge && edgesOnBoard.has(issue.edge) ? <Button data-slot="cloudflare-issue-show" variant="secondary" size="sm" onPress={() => onShow({ nodes: [], edges: [issue.edge!] })}>Show it</Button> : null}
            {issue.edge && !edgesOnBoard.has(issue.edge) && editable ? <Button data-slot="cloudflare-issue-remove" variant="secondary" size="sm" onPress={() => onRemoveEdge(issue.edge!)}>Remove the connection</Button> : null}
            {!issue.edge && issue.service ? <Button data-slot="cloudflare-issue-show" variant="secondary" size="sm" onPress={() => onShow({ nodes: [issue.service!], edges: [] })}>Show it</Button> : null}
          </li>
        ))}
      </ul>
    </DiagramPanelSection>
  );
}

function ServicePanel({ service, problems, editable, onRename, onRemove, onOpenMachine, onAddMachine, onRemoveMachine }: { service: CloudflareService; problems: readonly SystemIssue[]; editable: boolean; onRename: (label: string) => void; onRemove: () => void; onOpenMachine: () => void; onAddMachine: () => void; onRemoveMachine: () => void }) {
  const product = catalogProduct(service.kind);
  const machine = service.machine ? machineEvents(service.machine) : null;
  const machineSection = service.machine || (editable && runsCode(service.kind)) ? (
    <DiagramPanelSection title="Its machine">
      {problems.map((p) => <p key={p.message} data-slot="cloudflare-machine-problem" role="alert" className="m-0 text-footnote text-destructive [overflow-wrap:anywhere]">{p.message}</p>)}
      {machine ? (
        <>
          <p data-slot="cloudflare-machine-receives" className="m-0 text-footnote [overflow-wrap:anywhere]"><span className="text-foreground/70">Receives:</span> {machine.anything ? 'anything' : machine.events.join(', ') || 'nothing from outside'}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button data-slot="cloudflare-machine-open" variant="secondary" size="sm" onPress={onOpenMachine}>Open it</Button>
            {editable ? <Button data-slot="cloudflare-machine-remove" variant="secondary" size="sm" onPress={onRemoveMachine}>Remove it</Button> : null}
          </div>
        </>
      ) : <div><Button data-slot="cloudflare-machine-add" variant="secondary" size="sm" onPress={onAddMachine}>Give it one</Button></div>}
    </DiagramPanelSection>
  ) : null;
  if (!product) {
    return (
      <>
        <DiagramPanelSection title={service.label ?? service.kind}>
          <p data-slot="cloudflare-unknown" className="m-0 text-footnote text-destructive">“{service.kind}” isn’t in the catalog, at {CLOUDFLARE_CATALOG.pins.docs.date}. It can be drawn, but nothing says what it can reach.</p>
          {editable ? <div><Button data-slot="cloudflare-delete" variant="secondary" size="sm" onPress={onRemove}>Delete</Button></div> : null}
        </DiagramPanelSection>
        {machineSection}
      </>
    );
  }
  const ports: readonly DiagramPort[] = servicePorts(service.kind);
  const ins = ports.filter((p) => p.direction === 'in'), outs = ports.filter((p) => p.direction === 'out');
  return (
    <>
      <DiagramPanelSection title={product.name}>
        {product.description ? <p data-slot="cloudflare-description" className="m-0 text-footnote">{product.description}</p> : null}
        {editable ? <DiagramPanelField label="Called" slot="cloudflare-label" value={service.label ?? ''} placeholder={product.name} onCommit={onRename} /> : null}
        {ins.length ? <p data-slot="cloudflare-reached-by" className="m-0 text-footnote"><span className="text-foreground/70">Reached by:</span> {ins.map((p) => p.label).join(', ')}</p> : null}
        {outs.length ? <p data-slot="cloudflare-reaches-with" className="m-0 text-footnote"><span className="text-foreground/70">Reaches with:</span> {outs.map((p) => p.label).join(', ')}</p> : null}
        {!ports.length ? <p data-slot="cloudflare-no-ports" className="m-0 text-footnote text-foreground/70">Nothing connects to it here: it has no binding, and no handler for a Worker to run. It can still be on the diagram, to say it’s there.</p> : null}
        <a data-slot="cloudflare-docs-link" className="text-footnote text-primary" href={`https://developers.cloudflare.com${product.url}`} target="_blank" rel="noreferrer">Cloudflare’s docs</a>
        {editable ? <div><Button data-slot="cloudflare-delete" variant="secondary" size="sm" onPress={onRemove}>Delete</Button></div> : null}
      </DiagramPanelSection>
      {machineSection}
    </>
  );
}

function EdgePanel({ edge, to, link, problem, eventIssues, receivable, editable, onChange, onRemove, takenNames }: { edge: CloudflareEdge; to: CloudflareService | undefined; link: ServiceLink | null; problem: string | null; eventIssues: readonly SystemIssue[]; receivable: readonly string[]; editable: boolean; onChange: (patch: Partial<CloudflareEdge>) => void; onRemove: () => void; takenNames: readonly string[] }) {
  const [refused, setRefused] = useState<string | null>(null);
  const used = new Set(edge.operations ?? []);
  const binding = link?.kind === 'binding' ? catalogBinding(link.via.split('.')[0]!) : undefined;
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
  return (
    <>
      <DiagramPanelSection title={link?.label ?? edge.via}>
        {problem ? <p data-slot="cloudflare-edge-problem" role="alert" className="m-0 text-footnote text-destructive">{problem}</p> : null}
        {refused ? <p data-slot="cloudflare-refusal" role="alert" className="m-0 text-footnote text-destructive">{refused}</p> : null}
        {binding?.description ? <p className="m-0 text-footnote text-foreground/70">{binding.description}</p> : null}
        {link?.kind === 'binding' ? (editable ? <DiagramPanelField label="On env, as" slot="cloudflare-binding-name" value={name} onCommit={rename} /> : <p data-slot="cloudflare-binding-name" className="m-0 text-footnote"><span className="text-foreground/70">On env, as:</span> {name}</p>) : null}
        {link?.operations.length ? (
          <>
            <p className="m-0 text-footnote text-foreground/70">{link.kind === 'events' ? 'What it sends' : 'What it can do'}{editable ? ', and which of it this uses' : ''}</p>
            <ul data-slot="cloudflare-operations" className="m-0 flex list-none flex-col gap-1 p-0">
              {link.operations.map((m) => (
                <li key={m.name} data-slot="cloudflare-operation" data-operation={m.name} className="flex items-center gap-2 text-footnote [overflow-wrap:anywhere]">
                  {editable ? (
                    <Checkbox shape="square" aria-label={m.name} isSelected={used.has(m.name)} onChange={(on) => onChange({ operations: link.operations.map((x) => x.name).filter((name) => (name === m.name ? on : used.has(name))) })} />
                  ) : null}
                  <span title={m.returns?.join(' | ')} className={cn(m.deprecated && 'line-through')}>{methodSignature(m)}</span>
                  {m.deprecated ? <span className="text-caption text-foreground/70">deprecated</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {editable ? <div><Button data-slot="cloudflare-delete" variant="secondary" size="sm" onPress={onRemove}>Delete</Button></div> : null}
      </DiagramPanelSection>
      {editable || edge.events?.length ? (
        <DiagramPanelSection title="Machine events it carries">
          {eventIssues.map((issue) => <p key={issue.message} data-slot="cloudflare-event-problem" className={cn('m-0 text-footnote [overflow-wrap:anywhere]', issue.severity === 'error' ? 'text-destructive' : 'text-foreground/70')}>{issue.message}</p>)}
          {editable
            ? <DiagramPanelField label="Their names, with commas between" slot="cloudflare-events" value={(edge.events ?? []).join(', ')} placeholder="None" onCommit={setEvents} />
            : <p data-slot="cloudflare-events" className="m-0 text-footnote [overflow-wrap:anywhere]">{edge.events!.join(', ')}</p>}
          {receivable.length ? <p data-slot="cloudflare-receivable" className="m-0 text-footnote [overflow-wrap:anywhere]"><span className="text-foreground/70">A machine past there receives:</span> {receivable.join(', ')}</p> : null}
        </DiagramPanelSection>
      ) : null}
    </>
  );
}
