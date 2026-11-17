'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCanvas } from '@/components/ui/canvas';
import { Checkbox, CheckboxGroup } from '@/components/ui/checkbox';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxInputGroup, ComboboxItem, ComboboxList,
} from '@/components/ui/combobox';
import { Diagram, DiagramNodeBody, DiagramToolbar, type DiagramItem, type DiagramNoun, type DiagramProps } from '@/components/ui/diagram';
import {
  DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFrameCover, DiagramFrameCoverHeader, DiagramFramePanel, DiagramFrameSection,
  DiagramFrameTrigger, useDiagramFrame, type DiagramFrameProps,
} from '@/components/ui/diagram-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StateDiagram } from '@/components/ui/state-diagram';
import {
  cloudflareBoardData, cloudflareNoun, cloudflareProblems, placeInLayers,
  type CloudflareServiceEdgeData, type CloudflareServiceNodeData,
} from '@/lib/cloudflare-board';
import { CLOUDFLARE_CATALOG } from '@/lib/cloudflare-catalog.generated';
import type { CatalogProduct } from '@/lib/cloudflare-catalog';
import {
  catalogBinding, catalogProduct, linkBetween, methodSignature, newEdge, runsCode, serviceIconName, servicePorts,
  type CloudflareEdge, type CloudflareService, type ServiceLink,
} from '@/lib/cloudflare-services';
import {
  addService, BINDING_NAME, checkMachines, edgeBinding, machineEvents, machinesPast, removeServices, searchCatalog, serviceName, validateSystem,
  type CloudflareSystem, type SystemIssue,
} from '@/lib/cloudflare-system';
import { useControllableChange } from '@/lib/controllable-state';
import { useDiagramHistory } from '@/lib/diagram-history';
import type { DiagramBoardSize, DiagramDirection, DiagramLayoutDensity } from '@/lib/diagram-layout';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import { NOTHING_SELECTED, type DiagramConnection, type DiagramEdge, type DiagramNode, type DiagramPort, type DiagramSelection } from '@/lib/diagram-model';
import type { DiagramDataChangeReason, DiagramSelectionChangeDetails, DiagramSelectionChangeReason } from '@/lib/diagram-primitive';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ CloudflareDiagram — Cloudflare's services on a Diagram ══
   A system drawn the way a statechart is: the system is a container with its name and what's account-wide; an environment
   is a box in it, and a Worker holds its Durable Object classes; each service is a card with a header (its name, its
   product's glyph, its product) and labelled sections of chips (what it handles, its names on `env`, its triggers, its
   settings, its machine); a connection's label is a card with its name on `env` and what it uses; where requests,
   schedules and messages come in there's an entry marker. What's drawn is `lib/cloudflare-board`, as data.

   A connection can only be one the catalog says there is: a Worker to R2 offers R2's real methods, and R2 to D1 says why
   not. Ports are only for connecting: with `editable`, a handler's is a dot on its row and the rest are dots at either end of
   the header strip, so an editable card is the same card as a read-only one; read-only, there are none, and the picture is
   cards, sections and labelled edges.

   The parts: `CloudflareDiagram` composes `DiagramFrame` (board, bar, panel, cover) around a `Diagram`. The board half is a
   Diagram preset, `cloudflareBoardProps(system)`: a plain `<Diagram {...cloudflareBoardProps(system)} />` draws a system the
   same way, with the catalog's connection rule. The catalog search is `CloudflareServiceSearch`, for a toolbar of your own.

   There's no Cloudflare artwork, as their trademark page asks for written permission: names in words, the library's own icons,
   and an `icon` prop for an app that has its own permission. It comes with the catalog, which is about 150 KB, from
   `@brett_lamy/ui/cloudflare`, so it isn't in the main entry. */

/** Why the system changed: on the board (Diagram's reasons), `edit` for the panel or a machine, `add` from the search, and
 *  `undo` / `redo`. */
export type CloudflareDiagramChangeReason = DiagramDataChangeReason | 'edit' | 'add' | 'undo' | 'redo';
export type CloudflareDiagramChangeDetails = ChangeDetails<CloudflareDiagramChangeReason>;
export type CloudflareMachineChangeReason = 'press' | 'imperative';

export interface CloudflareDiagramProps
  extends Pick<DiagramProps, 'minimap' | 'background' | 'fitPadding' | 'viewport' | 'defaultViewport' | 'onViewportChange' | 'onAction'> {
  /** The system's services. Pass it (with `edges`) to control the diagram; `defaultServices` leaves it to the diagram. */
  services?: readonly CloudflareService[];
  edges?: readonly CloudflareEdge[];
  defaultServices?: readonly CloudflareService[];
  defaultEdges?: readonly CloudflareEdge[];
  /** The system's name, in its header. Default "Cloudflare". */
  title?: string;
  /** The account it's on, in its header with what else is account-wide. */
  accountId?: string;
  /** The whole system after a change, and why. `details.cancel()` refuses it when uncontrolled; controlled, what you pass
   *  back decides. */
  onDataChange?: (data: CloudflareSystem, details: CloudflareDiagramChangeDetails) => void;
  /** Services can be moved, added, connected and deleted, and connections and machines changed. Default `false`: a
   *  picture you can select in and read, with a panel to inspect it. */
  editable?: boolean;
  selection?: DiagramSelection;
  defaultSelection?: DiagramSelection;
  onSelectionChange?: (selection: DiagramSelection, details: DiagramSelectionChangeDetails) => void;
  /** The panel: open or not, and how it shows. By default it's closed, with its button on the bar, until something's
   *  selected (or, editable, while there's nothing yet to select): then it opens beside or over the board, and on a phone
   *  its button says what's selected. */
  panelOpen?: boolean;
  defaultPanelOpen?: boolean;
  onPanelOpenChange?: DiagramFrameProps['onOpenChange'];
  panelPresentation?: DiagramFrameProps['presentation'];
  /** At the top of the panel: a name field, an app's own actions. */
  panelHeader?: ReactNode;
  /** Whose machine is open over the board, by the service's id, or `null`. */
  openMachine?: string | null;
  defaultOpenMachine?: string | null;
  onOpenMachineChange?: (id: string | null, details: ChangeDetails<CloudflareMachineChangeReason>) => void;
  /** Which way a layout runs, when none of the services say where they are. Default `down`. */
  direction?: DiagramDirection;
  /** How much room a layout leaves between things, when none of the services say where they are (`useDiagramLayout`'s):
   *  `compact` for a big system, `default`, `comfortable`. */
  density?: DiagramLayoutDensity;
  /** What to draw for a product, instead of the library's own icon, for an app with permission to use Cloudflare's. */
  icon?: (product: CatalogProduct) => ReactNode;
  /** What an empty system shows. Default: an `EmptyState` that says how to add a service. */
  emptyState?: ReactNode;
  /** The diagram's name. Default `Cloudflare services`. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

const SEARCH_RESULTS = 6;
const NO_XSTATE = 'Checking its machines needs xstate, an optional peer of @brett_lamy/ui: npm install xstate';
const NO_SERVICES: readonly CloudflareService[] = [];
const NO_EDGES: readonly CloudflareEdge[] = [];

/** What's wrong, drawn on what's been laid out: as it isn't anything to lay out again for. */
function markProblems(board: { nodes: DiagramNode<CloudflareServiceNodeData>[]; edges: DiagramEdge<CloudflareServiceEdgeData>[] }, issues: readonly SystemIssue[]) {
  const wrong = cloudflareProblems(issues);
  return {
    nodes: board.nodes.map((n) => (wrong.services.has(n.id) && n.data ? { ...n, tone: 'destructive' as const, data: { ...n.data, problem: true } } : n)),
    edges: board.edges.map((e) => (wrong.edges.has(e.id) ? { ...e, tone: 'destructive' as const } : e)),
  };
}

/** Whether the catalog says two ports can join, as a Diagram's `isValidConnection`: true, or why not. */
const catalogConnection = (byId: ReadonlyMap<string, CloudflareService>) => (c: DiagramConnection): boolean | string => {
  const check = linkBetween(byId.get(c.from)?.kind ?? '', c.fromPort, byId.get(c.to)?.kind ?? '', c.toPort);
  return check.ok ? true : check.reason;
};

/** The far-zoom rule the Diagram's own parts follow: past a zoom where words can't be read, they aren't drawn. */
const FAR_HIDDEN = 'group-data-[zoom=far]/diagram:hidden';

/** A card drawn with an app's own glyph for its product, in the header's glyph's place. */
function ServiceWithOwnIcon({ node, icon }: { node: DiagramNode<CloudflareServiceNodeData>; icon: (product: CatalogProduct) => ReactNode }) {
  const product = node.data?.product;
  if (!product) return <DiagramNodeBody node={node} />;
  return (
    <DiagramNodeBody node={node} className="relative [&_[data-slot=diagram-node-icon]>*]:invisible">
      <span aria-hidden="true" data-part="own-icon" className={cn('pointer-events-none absolute top-1.5 left-2.5 flex size-3.5 items-center justify-center overflow-hidden text-muted-foreground [&>*]:max-h-full [&>*]:max-w-full', FAR_HIDDEN)}>
        {icon(product)}
      </span>
    </DiagramNodeBody>
  );
}

export interface CloudflareBoardOptions {
  /** What to draw for a product, instead of the library's own icon. */
  icon?: (product: CatalogProduct) => ReactNode;
  /** What's wrong with it, drawn as wrong. Default `validateSystem(system)`; add `checkMachines` to it to have the machines
   *  checked, with XState. */
  issues?: readonly SystemIssue[];
  /** With ports to connect by: dots on each card's handler rows and at either end of its header. Default `false`. */
  editable?: boolean;
  /** The system's header. Default its `name`, or "Cloudflare". */
  title?: string;
}

/** What `cloudflareBoardProps` gives a Diagram. */
export interface CloudflareBoardProps {
  nodes: DiagramNode<CloudflareServiceNodeData>[];
  edges: DiagramEdge<CloudflareServiceEdgeData>[];
  isValidConnection: (connection: DiagramConnection) => boolean | string;
  portsOnly: true;
  autoSize: true;
  background: 'grid';
  noun: DiagramNoun;
  renderNode?: (node: DiagramNode<CloudflareServiceNodeData>) => ReactNode;
}

/** A system as a plain Diagram's props: the system a container with its name and what's account-wide, each service a card
 *  (placed where it says, the rest top to bottom with `placeInLayers`), each connection an edge whose label says what it's
 *  bound as and uses, what's wrong drawn as wrong, the lined board, and the catalog's rule for connecting.
 *  `<Diagram {...cloudflareBoardProps(system)} />`. Memoize it on the system. */
export function cloudflareBoardProps(system: CloudflareSystem, { icon, issues, editable = false, title }: CloudflareBoardOptions = {}): CloudflareBoardProps {
  const placed = placeInLayers(system, { editable });
  const board = cloudflareBoardData(placed, { editable, issues: issues ?? validateSystem(system), title });
  return {
    ...board,
    isValidConnection: catalogConnection(new Map(placed.services.map((s) => [s.id, s]))),
    portsOnly: true,
    autoSize: true,
    background: 'grid',
    noun: cloudflareNoun,
    ...(icon ? { renderNode: (node: DiagramNode<CloudflareServiceNodeData>) => (node.data ? <ServiceWithOwnIcon node={node} icon={icon} /> : <DiagramNodeBody node={node} />) } : null),
  };
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
    const shown = nodes.filter((n) => n.data && want.ids.includes(n.id));
    if (shown.length < want.ids.length) return;
    const x = Math.min(...shown.map((n) => n.x)), y = Math.min(...shown.map((n) => n.y));
    const w = Math.max(...shown.map((n) => n.x + n.w)) - x, h = Math.max(...shown.map((n) => n.y + n.h)) - y;
    // Not `focus-in`: the Diagram leaves those to its keys, and this is asked for.
    reveal({ x, y, w, h }, { padding: 24 }, { reason: 'imperative' });
    onDone();
  }, [nodes, placing, want, reveal, onDone]);
  return null;
}

/** How big an element is, in steps of 40 px, once it's been measured: the board a layout wraps to fill. */
function useFrameSize(ref: RefObject<HTMLElement | null>): DiagramBoardSize | null {
  const [size, setSize] = useState<DiagramBoardSize | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const step = (v: number) => Math.round(v / 40) * 40;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setSize((was) => (was && was.width === step(r.width) && was.height === step(r.height) ? was : { width: step(r.width), height: step(r.height) }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/* ── The diagram ── */

const sameSystem = (a: CloudflareSystem, b: CloudflareSystem) => a.services === b.services && a.edges === b.edges && a.name === b.name && a.accountId === b.accountId;
const DEAD_LETTER = 'dead-letter:';

export function CloudflareDiagram({
  services: servicesProp, edges: edgesProp, defaultServices = NO_SERVICES, defaultEdges = NO_EDGES, title, accountId, onDataChange,
  editable = false, selection: selectionProp, defaultSelection = NOTHING_SELECTED, onSelectionChange,
  panelOpen, defaultPanelOpen, onPanelOpenChange, panelPresentation, panelHeader,
  openMachine: openMachineProp, defaultOpenMachine = null, onOpenMachineChange, onAction,
  direction = 'down', density, minimap = 'auto', icon, emptyState, className, style, 'aria-label': ariaLabel = 'Cloudflare services', ...diagram
}: CloudflareDiagramProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* ── The system: controlled by `services` / `edges`, or the diagram's own ── */
  const controlled = servicesProp !== undefined;
  const named = useMemo(() => ({ ...(title !== undefined ? { name: title } : null), ...(accountId !== undefined ? { accountId } : null) }), [title, accountId]);
  const given = useMemo<CloudflareSystem | undefined>(
    () => (controlled ? { services: servicesProp, edges: edgesProp ?? NO_EDGES, ...named } : undefined),
    [controlled, servicesProp, edgesProp, named],
  );
  const [own, setSystem] = useControllableChange<CloudflareSystem, CloudflareDiagramChangeReason>(
    given, { services: defaultServices, edges: defaultEdges }, onDataChange,
  );
  // The name and account are the props', whoever holds the rest.
  const system = useMemo(() => (controlled ? own : { ...own, ...named }), [controlled, own, named]);
  const { services, edges } = system;
  const byId = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

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

  /* ── The board: the preset where anything has a place; laid out by ELK, top to bottom, where nothing has ── */
  const anyPlaced = services.some((s) => s.at);
  const board = useMemo(() => cloudflareBoardProps(anyPlaced ? system : { ...system, services: [], edges: [] }, { icon, issues, editable }), [anyPlaced, system, icon, issues, editable]);
  const draft = useMemo(() => (anyPlaced ? { nodes: [], edges: [] } : cloudflareBoardData(system, { editable })), [anyPlaced, system, editable]);
  // Wrapped to fill the frame, not what its panel leaves of it: the panel opens on a selection, and what was just pressed
  // mustn't move. The view pans to keep it in sight instead (Diagram keeps what's selected in view).
  const frameBoard = useFrameSize(frameRef);
  const laid = useDiagramLayout<CloudflareServiceNodeData, CloudflareServiceEdgeData>(draft, { host: boardRef, direction, density, ...(frameBoard ? { board: frameBoard } : null) });
  // What's wrong goes on after laying out, as it isn't anything to lay out again for.
  const laidBoard = useMemo(() => markProblems({ nodes: laid.nodes, edges: laid.edges }, issues), [laid.nodes, laid.edges, issues]);
  const nodes = anyPlaced ? board.nodes : laidBoard.nodes;
  const shownEdges = anyPlaced ? board.edges : laidBoard.edges;
  const isValidConnection = useMemo(() => catalogConnection(byId), [byId]);

  /* ── Selection, and what's open ── */
  const [selection, setSelection] = useControllableChange<DiagramSelection, DiagramSelectionChangeReason>(selectionProp, defaultSelection, onSelectionChange);
  const select = (next: DiagramSelection) => setSelection(next, { reason: 'imperative' });
  const selectedService = selection.nodes.length === 1 && !selection.edges.length ? byId.get(selection.nodes[0] ?? '') : undefined;
  const selectedId = selection.edges.length === 1 && !selection.nodes.length ? selection.edges[0] ?? '' : '';
  // Where a consumer sends what it gives up on is drawn from the consumer's settings: selecting it is selecting those.
  const selectedEdge = edges.find((e) => e.id === (selectedId.startsWith(DEAD_LETTER) ? selectedId.slice(DEAD_LETTER.length) : selectedId));
  // What's to come into view once it's placed: something added, or both ends of a new connection, which ELK may move.
  const placing: unknown = anyPlaced ? board.nodes : laid.bounds;
  const [toReveal, setToReveal] = useState<Reveal | null>(null);
  const revealed = useCallback(() => setToReveal(null), []);
  const [openId, setOpenId] = useControllableChange<string | null, CloudflareMachineChangeReason>(openMachineProp, defaultOpenMachine, onOpenMachineChange);

  /* ── One history for the board, the panel and the machines, driven by the Diagram's toolbar and ⌘Z. What's undone here
        is what was done here; something new from outside starts over. ── */
  const history = useDiagramHistory<CloudflareSystem>(
    system,
    (to, details) => setSystem(to, { reason: details.reason, event: details.event }),
    { isEqual: sameSystem },
  );
  const send = (next: Partial<CloudflareSystem>, reason: CloudflareDiagramChangeReason, event?: Event) => {
    const after = { ...system, services: [...(next.services ?? services)], edges: [...(next.edges ?? edges)] };
    if (setSystem(after, { reason, event })) history.record(system, after);
  };

  const onDiagramDataChange: NonNullable<DiagramProps<CloudflareServiceNodeData, CloudflareServiceEdgeData>['onDataChange']> = (data, details) => {
    const keepPlaces = details.reason === 'move' || anyPlaced;
    const nextServices = data.nodes.flatMap((n) => {
      const s = byId.get(n.id);
      return s ? [keepPlaces ? { ...s, at: { x: Math.round(n.x), y: Math.round(n.y) } } : s] : [];
    });
    const had = new Set(shownEdges.map((e) => e.id));
    const stillThere = new Set(data.edges.map((e) => e.id));
    const left = new Set(nextServices.map((s) => s.id));
    const kept = edges.filter((e) => stillThere.has(e.id)
      // What the board can't draw isn't its to lose.
      || !byId.has(e.from) || !byId.has(e.to)
      // What carries events stays when its service goes, to say that something's still sending there.
      || (!!e.events?.length && (!left.has(e.from) || !left.has(e.to))))
      // A dead-letter queue's edge that's gone takes the consumer's setting with it.
      .map((e) => (had.has(`${DEAD_LETTER}${e.id}`) && !stillThere.has(`${DEAD_LETTER}${e.id}`) && e.consumer ? { ...e, consumer: { ...e.consumer, deadLetterQueue: undefined } } : e));
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
    send(removeServices(system, [id]), 'delete');
  };
  const addFromCatalog = (product: CatalogProduct) => {
    const { system: next, id } = addService(system, product.id);
    send(next, 'add');
    select({ nodes: [id], edges: [] });
    setToReveal({ ids: [id], after: placing });
  };
  // A service's machine chip opens its machine.
  const onItemAction = (item: DiagramItem, details: Parameters<NonNullable<DiagramProps['onAction']>>[1]) => {
    if (item.kind === 'node' && item.section === 'machine' && byId.get(item.id)?.machine) setOpenId(item.id, { reason: 'press' });
    onAction?.(item, details);
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

  const selectedLink = selectedEdge ? shownEdges.find((e) => e.id === selectedEdge.id)?.data : undefined;
  // The panel's title is what it shows: a service by its name and its product, a connection by its name and its two ends.
  const heading = selectedService ? serviceHeading(selectedService) : selectedEdge ? edgeHeading(selectedEdge, byId, selectedLink?.link ?? null) : null;
  const onBoard = new Set(shownEdges.map((e) => e.id));
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
      ref={frameRef}
      data-cloudflare-diagram=""
      open={panelOpen}
      // Closed until there's something to show: a hint takes a quarter of the board and says nothing about the system.
      defaultOpen={defaultPanelOpen ?? (defaultSelection.nodes.length + defaultSelection.edges.length > 0 || (editable && !services.length))}
      onOpenChange={onPanelOpenChange}
      presentation={panelPresentation}
      className={className}
      style={style}
    >
      <DiagramFrameBoard ref={boardRef}>
        <Diagram<CloudflareServiceNodeData, CloudflareServiceEdgeData>
          {...board}
          // A laid-out board is sized to its measured words already (and a card a layout widened for its edges stays so).
          autoSize={anyPlaced}
          nodes={nodes}
          edges={shownEdges}
          isValidConnection={isValidConnection}
          aria-label={ariaLabel}
          selection={selection}
          onSelectionChange={setSelection}
          onAction={onItemAction}
          emptyState={empty}
          loading={!anyPlaced && services.length > 0 && !laid.nodes.length && laid.status !== 'error'}
          error={!anyPlaced && laid.error ? laid.error.message : undefined}
          {...(editable ? { editable: true, history, onDataChange: onDiagramDataChange } : null)}
          overlay={<DiagramToolbar />}
          minimap={minimap}
          {...diagram}
        >
          <RevealWhenPlaced nodes={nodes} placing={placing} want={toReveal} onDone={revealed} />
        </Diagram>
        <DiagramFrameBar trigger={<DiagramFrameTrigger>{heading ? 'Details' : editable ? 'Add a service' : 'Services'}</DiagramFrameTrigger>}>
          <span data-slot="cloudflare-status" className="min-w-0 truncate">{status}</span>
        </DiagramFrameBar>
        <OpenOnSelection selected={heading?.name ?? ''} />
      </DiagramFrameBoard>
      <DiagramFramePanel title={heading?.title ?? 'Services'} aria-label={heading?.name ?? 'Services'}>
        <div ref={panelRef} data-slot="cloudflare-panel" className="flex flex-col gap-3.5">
          {/* What the panel is about, said as it changes. */}
          <span data-slot="cloudflare-panel-status" role="status" className="sr-only">{heading?.name ?? ''}</span>
          {panelHeader}
          {editable ? <CloudflareServiceSearch onAction={addFromCatalog} /> : null}
          {selectedEdge ? (
            <EdgePanel
              key={selectedEdge.id}
              edge={selectedEdge}
              to={byId.get(selectedEdge.to)}
              link={selectedLink?.link ?? null}
              problem={selectedLink?.problem ?? null}
              eventIssues={issues.filter((i) => i.edge === selectedEdge.id && i.code.startsWith('event-'))}
              receivable={[...new Set(machinesPast(system, selectedEdge).flatMap((m) => machineEvents(m.machine).events))]}
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
              Select a service or a connection to see what it does.{editable ? ' To connect two, drag from the dot at the end of one card’s header to another card: the catalog picks how they connect, or says why they can’t. A handler’s own dot is on its row.' : ''}
            </p>
          )}
          {issues.length ? <IssueList issues={issues} edgesOnBoard={onBoard} editable={editable} onShow={select} onRemoveEdge={removeEdge} /> : null}
          <p data-slot="cloudflare-attribution" className="m-0 text-caption text-foreground/70">
            Names and descriptions from Cloudflare’s docs, CC-BY-4.0. Cloudflare is a trademark of Cloudflare, Inc., and doesn’t endorse this.
          </p>
        </div>
      </DiagramFramePanel>
      {openService?.machine ? (
        <DiagramFrameCover>
          <DiagramFrameCoverHeader data-part="machine-bar" title={`${serviceName(openService)}’s machine`} backLabel="Services" onBack={closeMachine} />
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

/* ── What the panel's about ── */

interface PanelHeading {
  /** What the panel's header shows. */
  title: ReactNode;
  /** The same in words, which names the panel and is announced. */
  name: string;
}

const quiet = (text: string) => <span className="font-normal text-muted-foreground">{text}</span>;

/** A service: its name, then its product where that's something else ("Room · Durable Objects"). */
function serviceHeading(service: CloudflareService): PanelHeading {
  const name = serviceName(service);
  const product = catalogProduct(service.kind)?.name;
  const other = product && product !== name ? product : null;
  return { title: <>{name}{other ? <> {quiet(`· ${other}`)}</> : null}</>, name: other ? `${name}, ${other}` : name };
}

/** A connection: what it's called (its name on `env`, or what it is), then where it goes from and to. */
function edgeHeading(edge: CloudflareEdge, byId: ReadonlyMap<string, CloudflareService>, link: ServiceLink | null): PanelHeading {
  const from = byId.get(edge.from), to = byId.get(edge.to);
  const called = edgeBinding(edge, to) ?? (edge.via === 'queue-consumer' ? 'consumer' : link?.label ?? viaLabel(edge.via));
  const a = from ? serviceName(from) : edge.from, b = to ? serviceName(to) : edge.to;
  return { title: <>{called} {quiet(`· ${a} → ${b}`)}</>, name: `${called}, from ${a} to ${b}` };
}

/** A wrangler key in the catalog's words ("D1 Database" for `d1_databases`), never the raw key where there are words. */
const viaLabel = (via: string) => catalogBinding(via.split('.')[0] ?? '')?.friendlyName ?? via;

/** Opens the panel when something's selected, beside the board or over it, once the press that selected it is over (a
 *  column narrows the board, and nothing should move under a drag). A phone's pushed page waits for its button: a selection
 *  there is often on the way to moving something. The keys stay on the board. */
function OpenOnSelection({ selected }: { selected: string }) {
  const { setOpen, presentation } = useDiagramFrame();
  const was = useRef<string | null>(null);
  const pressing = useRef(false);
  useEffect(() => {
    const down = () => { pressing.current = true; };
    const up = () => { pressing.current = false; };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, []);
  // Again when the way it shows changes (a phone turned into a tablet): with something selected, beside the board.
  const key = `${selected}\0${presentation}`;
  useEffect(() => {
    if (key === was.current) return undefined;
    was.current = key;
    if (!selected || presentation === 'push') return undefined;
    const open = () => setOpen(true, { focus: false });
    if (!pressing.current) { open(); return undefined; }
    const after = () => { window.removeEventListener('pointerup', after); if (was.current === key) open(); };
    window.addEventListener('pointerup', after);
    return () => window.removeEventListener('pointerup', after);
  }, [key, selected, presentation, setOpen]);
  return null;
}

/* ── The catalog search ── */

export interface CloudflareServiceSearchProps {
  /** A product was chosen: pressed in the list, or the highlighted one on Enter. */
  onAction: (product: CatalogProduct, details: { reason: 'item-press' | 'enter-key'; event?: Event }) => void;
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
          const event = details.event as Event | undefined;
          onAction(product, { reason: event?.type === 'keydown' ? 'enter-key' : 'item-press', event });
        }}
        filter={false}
        autoHighlight
      >
        <ComboboxInputGroup size="sm">
          <Icon name="magnifyingglass" size={14} className="ms-2.5 me-1.5 shrink-0 text-muted-foreground" />
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

/** A panel field that changes the system once you're done with it: Enter or leaving it commits, Escape puts it back. A
 *  refusal is its `FieldError`. */
function PanelField({ field, label, value, placeholder, error, onCommit }: { field: string; label: string; value: string; placeholder?: string; error?: string | null; onCommit: (value: string) => void }) {
  return (
    <Field invalid={!!error}>
      <FieldLabel>{label}</FieldLabel>
      <Input data-field={field} size="sm" value={value} placeholder={placeholder} autoCapitalize="off" autoCorrect="off" spellCheck={false} onValueCommit={onCommit} />
      <FieldError data-part="refusal">{error}</FieldError>
    </Field>
  );
}

/** Delete, as the family has it: a secondary button with destructive text, as it can be undone. */
const deleteButton = (onRemove: () => void) => (
  <div><Button data-action="delete" variant="secondary" size="sm" className="text-destructive" onClick={onRemove}>Delete</Button></div>
);

function ServicePanel({ service, problems, editable, onRename, onRemove, onOpenMachine, onAddMachine, onRemoveMachine }: { service: CloudflareService; problems: readonly SystemIssue[]; editable: boolean; onRename: (label: string) => void; onRemove: () => void; onOpenMachine: () => void; onAddMachine: () => void; onRemoveMachine: () => void }) {
  const product = catalogProduct(service.kind);
  const machine = service.machine ? machineEvents(service.machine) : null;
  const remove = editable ? deleteButton(onRemove) : null;
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
        {editable ? <PanelField field="label" label="Called" value={service.label ?? ''} placeholder={product.name} onCommit={onRename} /> : null}
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
      <DiagramFrameSection title={link?.label ?? viaLabel(edge.via)}>
        {problem ? <p data-slot="cloudflare-edge-problem" role="alert" className="m-0 text-footnote text-destructive">{problem}</p> : null}
        {binding?.description ? <p className="m-0 text-footnote text-foreground/70">{binding.description}</p> : null}
        {link?.kind === 'binding' ? (editable
          ? <PanelField field="binding-name" label="On env, as" value={name} error={refused} onCommit={rename} />
          : fact('On env, as', name, 'cloudflare-binding-name')) : null}
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
        {editable ? deleteButton(onRemove) : null}
      </DiagramFrameSection>
      {editable || edge.events?.length ? (
        <DiagramFrameSection title="Machine events it carries">
          {eventIssues.map((issue) => <p key={issue.message} data-slot="cloudflare-event-problem" className={cn('m-0 text-footnote [overflow-wrap:anywhere]', issue.severity === 'error' ? 'text-destructive' : 'text-foreground/70')}>{issue.message}</p>)}
          {editable
            ? <PanelField field="events" label="Their names, with commas between" value={(edge.events ?? []).join(', ')} placeholder="None" onCommit={setEvents} />
            : fact('Carries', (edge.events ?? []).join(', '), 'cloudflare-events')}
          {receivable.length ? fact('A machine past there receives', receivable.join(', '), 'cloudflare-receivable') : null}
        </DiagramFrameSection>
      ) : null}
    </>
  );
}
