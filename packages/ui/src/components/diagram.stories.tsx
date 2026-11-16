import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useRef } from 'react';
import { useCanvas } from '@/components/ui/canvas';
import { Diagram, DiagramNodeBody, DiagramToolbar } from '@/components/ui/diagram';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/lib/icon';
import type { DiagramDraft } from '@/lib/diagram-layout';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model';
import { UPLOAD_EDGES, UPLOAD_NODES } from '../stories/diagram-machine';
import { Phone } from '../stories/frame';

const meta: Meta<typeof Diagram> = {
  title: 'Organisms/Diagram',
  component: Diagram,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Diagram>;

/* The file-upload machine: 33 states, 36 transitions, compound and parallel states and self-loops, laid out ahead of time. */
export const Machine: Story = {
  render: () => <Phone w={1360} h={560}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} aria-label="File upload" /></Phone>,
};

export const MachineDark: Story = {
  render: () => <Phone w={1360} h={560} appearance="dark"><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} aria-label="File upload" /></Phone>,
};

/** Close enough to read: the parallel state and its regions. */
export const MachineCloseUp: Story = {
  render: () => <Phone w={1000} h={700}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultViewport={{ x: -1680, y: -210, zoom: 1.05 }} aria-label="File upload" /></Phone>,
};

export const MachineCloseUpDark: Story = {
  render: () => <Phone w={1000} h={700} appearance="dark"><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultViewport={{ x: -1680, y: -210, zoom: 1.05 }} aria-label="File upload" /></Phone>,
};

const KINDS: DiagramNode[] = [
  { id: 'root', kind: 'root', label: 'A root, which holds everything', x: 0, y: 0, w: 900, h: 420 },
  { id: 'plain', kind: 'node', parent: 'root', label: 'A node', x: 40, y: 56, w: 120, h: 36 },
  { id: 'detail', kind: 'node', parent: 'root', label: 'With a detail', detail: 'invoke fetchUser', x: 200, y: 50, w: 150, h: 50 },
  { id: 'final', kind: 'final', parent: 'root', label: 'Final', x: 400, y: 56, w: 110, h: 36 },
  { id: 'initial', kind: 'initial', parent: 'root', x: 560, y: 66, w: 12, h: 12 },
  { id: 'compound', kind: 'compound', parent: 'root', label: 'Compound', x: 40, y: 140, w: 320, h: 240 },
  { id: 'inner', kind: 'node', parent: 'compound', label: 'Inside', x: 90, y: 200, w: 110, h: 36 },
  { id: 'parallel', kind: 'parallel', parent: 'root', label: 'Parallel', detail: 'parallel', x: 400, y: 140, w: 460, h: 240 },
  { id: 'r1', kind: 'region', parent: 'parallel', label: 'A region', x: 412, y: 170, w: 436, h: 90 },
  { id: 'r2', kind: 'region', parent: 'parallel', label: 'Another', x: 412, y: 276, w: 436, h: 90 },
  { id: 'r1a', kind: 'node', parent: 'r1', label: 'One', x: 560, y: 195, w: 100, h: 36 },
  { id: 'r2a', kind: 'node', parent: 'r2', label: 'Two', x: 560, y: 300, w: 100, h: 36 },
];

/** Every kind of node. */
export const NodeKinds: Story = {
  render: () => <Phone w={1000} h={500}><Diagram nodes={KINDS} /></Phone>,
};

export const NodeKindsDark: Story = {
  render: () => <Phone w={1000} h={500} appearance="dark"><Diagram nodes={KINDS} /></Phone>,
};

const EDGE_NODES: DiagramNode[] = [
  { id: 'a', label: 'event', x: 0, y: 0, w: 110, h: 36 },
  { id: 'a2', label: 'target', x: 300, y: 0, w: 110, h: 36 },
  { id: 'b', label: 'always', x: 0, y: 70, w: 110, h: 36 },
  { id: 'b2', label: 'target', x: 300, y: 70, w: 110, h: 36 },
  { id: 'c', label: 'after', x: 0, y: 140, w: 110, h: 36 },
  { id: 'c2', label: 'target', x: 300, y: 140, w: 110, h: 36 },
  { id: 'd', label: 'done', x: 0, y: 210, w: 110, h: 36 },
  { id: 'd2', label: 'target', x: 300, y: 210, w: 110, h: 36 },
  { id: 'e', label: 'invoke', x: 0, y: 280, w: 110, h: 36 },
  { id: 'e2', label: 'target', x: 300, y: 280, w: 110, h: 36 },
  { id: 'dot', kind: 'initial', x: 49, y: 350, w: 12, h: 12 },
  { id: 'f2', label: 'initial', x: 300, y: 338, w: 110, h: 36 },
  { id: 's', label: 'straight', x: 520, y: 0, w: 110, h: 36 },
  { id: 's2', label: 'target', x: 800, y: 90, w: 110, h: 36 },
  { id: 'el', label: 'elbow', x: 520, y: 100, w: 110, h: 36 },
  { id: 'el2', label: 'target', x: 800, y: 190, w: 110, h: 36 },
  { id: 'cu', label: 'curve', x: 520, y: 200, w: 110, h: 36 },
  { id: 'cu2', label: 'target', x: 800, y: 290, w: 110, h: 36 },
  { id: 'loop', label: 'self-loops', x: 540, y: 340, w: 130, h: 36 },
  { id: 'p', label: 'parallel', x: 730, y: 370, w: 110, h: 90 },
  { id: 'p2', label: 'edges', x: 950, y: 370, w: 110, h: 90 },
  { id: 'box', kind: 'compound', label: 'to and from its own child', x: 0, y: 420, w: 420, h: 120 },
  { id: 'kid', parent: 'box', label: 'child', x: 120, y: 470, w: 110, h: 36 },
];
const EDGES: DiagramEdge[] = [
  { id: 'ev', from: 'a', to: 'a2', kind: 'event', label: 'SUBMIT' },
  { id: 'al', from: 'b', to: 'b2', kind: 'always', label: 'always [isValid]' },
  { id: 'af', from: 'c', to: 'c2', kind: 'after', label: 'after 5000' },
  { id: 'do', from: 'd', to: 'd2', kind: 'done', label: 'done' },
  { id: 'in', from: 'e', to: 'e2', kind: 'invoke', label: 'done: fetchUser' },
  { id: 'it', from: 'dot', to: 'f2', kind: 'initial' },
  { id: 'r1', from: 's', to: 's2', route: 'straight', label: 'a straight route' },
  { id: 'r2', from: 'el', to: 'el2', route: 'elbow', label: 'an elbow route' },
  { id: 'r3', from: 'cu', to: 'cu2', route: 'curve', label: 'a curved route' },
  { id: 'l1', from: 'loop', to: 'loop', label: 'RETRY' },
  { id: 'l2', from: 'loop', to: 'loop', label: 'PING', kind: 'after' },
  { id: 'p1', from: 'p', to: 'p2', label: 'one' },
  { id: 'p2', from: 'p', to: 'p2', label: 'two' },
  { id: 'p3', from: 'p', to: 'p2', label: 'three' },
  { id: 'wall', from: 'box', to: 'kid', label: 'enter' },
  { id: 'wall2', from: 'kid', to: 'box', route: 'curve' },
];

/** Every kind of edge, routes with no layout behind them, self-loops, parallel edges, and an edge to its own child. */
export const EdgeKinds: Story = {
  render: () => <Phone w={1200} h={640}><Diagram nodes={EDGE_NODES} edges={EDGES} /></Phone>,
};

export const EdgeKindsDark: Story = {
  render: () => <Phone w={1200} h={640} appearance="dark"><Diagram nodes={EDGE_NODES} edges={EDGES} /></Phone>,
};

/** At the smallest zoom: lines keep their thickness, and the text is gone. */
export const ZoomMin: Story = {
  render: () => <Phone w={800} h={360}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultViewport={{ x: 370, y: 170, zoom: 0.02 }} aria-label="File upload" /></Phone>,
};

/** Below the point where an edge's label could be read, a node's can still be made out. */
export const ZoomMiddle: Story = {
  render: () => <Phone w={1200} h={360}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultViewport={{ x: 20, y: 80, zoom: 0.3 }} aria-label="File upload" /></Phone>,
};

/** At the largest zoom: lines keep their thickness, and the text is big. */
export const ZoomMax: Story = {
  render: () => <Phone w={800} h={360}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultViewport={{ x: -7836, y: -1224, zoom: 4 }} aria-label="File upload" /></Phone>,
};

/** `CanvasMiniMap`, with the root left out so it isn't one solid block. */
export const WithMiniMap: Story = {
  render: () => <Phone w={1000} h={500}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} minimap defaultViewport={{ x: -1600, y: -100, zoom: 0.9 }} aria-label="File upload" /></Phone>,
};

function ZoomReadout() {
  const { zoom } = useCanvas();
  return <div data-slot="zoom-readout" className="absolute rounded-ctl bg-primary px-2 py-1 text-caption text-primary-foreground" style={{ left: 20, top: 90 }}>useCanvas sees {Math.round(zoom * 100)}%</div>;
}

/** Children are in the board layer, and `useCanvas` works there. */
export const WithChildren: Story = {
  render: () => <Phone w={500} h={240}><Diagram nodes={EDGE_NODES.slice(0, 2)} edges={EDGES.slice(0, 1)} defaultViewport={{ x: 30, y: 30, zoom: 1 }}><ZoomReadout /></Diagram></Phone>,
};

const renderCustom = (node: DiagramNode) => <DiagramNodeBody node={node} className="border-primary bg-primary/10" />;

/** A custom node is whatever you draw in its box. Here, the usual body, with another color. */
export const CustomNode: Story = {
  render: () => <Phone w={500} h={160}><Diagram nodes={EDGE_NODES.slice(0, 2)} edges={EDGES.slice(0, 1)} renderNode={renderCustom} defaultViewport={{ x: 30, y: 50, zoom: 1 }} /></Phone>,
};

const WORDY: DiagramNode[] = [
  { id: 'short', label: 'idle', x: 0, y: 0, w: 1, h: 1 },
  { id: 'detail', label: 'checkingQuota', detail: 'invoke verifyTokenAndQuota', x: 240, y: 0, w: 1, h: 1 },
  { id: 'long', label: 'A very long state name that goes on for a good deal longer than any node should', x: 0, y: 90, w: 1, h: 1 },
  { id: 'nospaces', label: 'aVeryLongStateNameWithNoSpacesInItAtAllThatHasToBreakSomewhereOrItWillRunOutOfItsBox', x: 280, y: 90, w: 1, h: 1 },
  { id: 'cjk', label: '認証を確認しています', detail: 'アップロードを待っています', x: 0, y: 190, w: 1, h: 1 },
  { id: 'cjklong', label: 'これはとても長い状態の名前で、折り返さなければ箱からはみ出してしまいます', x: 280, y: 190, w: 1, h: 1 },
  { id: 'final', kind: 'final', label: 'quarantined', x: 0, y: 280, w: 1, h: 1 },
  { id: 'emoji', label: '🚀 launching 🌕', x: 280, y: 280, w: 1, h: 1 },
];

/** With `autoSize`, a node's as big as its words, in the real font: short ones, long ones, ones with no spaces, and CJK. */
export const SizedToText: Story = {
  render: () => <Phone w={700} h={400}><Diagram nodes={WORDY} autoSize /></Phone>,
};

export const SizedToTextDark: Story = {
  render: () => <Phone w={700} h={400} appearance="dark"><Diagram nodes={WORDY} autoSize /></Phone>,
};

/** The same machine with no positions at all: its words are measured, and ELK places it in a worker. */
function LaidOutMachine() {
  const draft = useMemo<DiagramDraft>(() => ({
    nodes: UPLOAD_NODES.map(({ x: _x, y: _y, w: _w, h: _h, ...n }) => n),
    edges: UPLOAD_EDGES.map(({ points: _p, labelBox: _l, ...e }) => e),
  }), []);
  const host = useRef<HTMLDivElement>(null);
  const laid = useDiagramLayout(draft, { host });
  return <div ref={host} className="absolute inset-0"><Diagram nodes={laid.nodes} edges={laid.edges} loading={laid.status === 'pending'} aria-label="File upload" /></div>;
}

export const LaidOut: Story = {
  render: () => <Phone w={1360} h={560}><LaidOutMachine /></Phone>,
};

export const LaidOutDark: Story = {
  render: () => <Phone w={1360} h={560} appearance="dark"><LaidOutMachine /></Phone>,
};

const SELECTABLE: DiagramNode[] = [
  { id: 'a', label: 'One selected', x: 0, y: 0, w: 130, h: 36 },
  { id: 'b', label: 'And another', x: 220, y: 0, w: 130, h: 36 },
  { id: 'c', label: 'Not this one', x: 110, y: 90, w: 130, h: 36 },
  { id: 'box', kind: 'compound', label: 'A selected compound', x: 0, y: 170, w: 350, h: 90 },
  { id: 'd', parent: 'box', label: 'Inside it', x: 110, y: 205, w: 130, h: 36 },
];
const SELECTABLE_EDGES: DiagramEdge[] = [
  { id: 'ab', from: 'a', to: 'b', label: 'selected' },
  { id: 'ac', from: 'a', to: 'c' },
  { id: 'bc', from: 'b', to: 'c' },
];

/** What's selected gets a ring, and an edge the theme's primary color. Both stay the same thickness on screen at any zoom. */
export const Selected: Story = {
  render: () => <Phone w={500} h={320}><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: ['a', 'b', 'box'], edges: ['ab'] }} /></Phone>,
};

export const SelectedDark: Story = {
  render: () => <Phone w={500} h={320} appearance="dark"><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: ['a', 'b', 'box'], edges: ['ab'] }} /></Phone>,
};

const PORTED: DiagramNode[] = [
  { id: 'w', label: 'Worker', x: 0, y: 40, w: 130, h: 80, ports: [{ id: 'db', side: 'r', at: 0.25, kind: 'sql' }, { id: 'files', side: 'r', at: 0.75, kind: 'files' }, { id: 'in', side: 'l', direction: 'in' }] },
  { id: 'd1', label: 'D1', x: 260, y: 0, w: 110, h: 50, ports: [{ id: 'in', side: 'l', kind: 'sql', direction: 'in' }] },
  { id: 'r2', label: 'R2', x: 260, y: 110, w: 110, h: 50, ports: [{ id: 'in', side: 'l', kind: 'files', direction: 'in' }] },
];
const PORTED_EDGES: DiagramEdge[] = [
  { id: 'a', from: 'w', fromPort: 'db', to: 'd1', toPort: 'in', label: 'prepare' },
  { id: 'b', from: 'w', fromPort: 'files', to: 'r2', toPort: 'in', label: 'put' },
];

/** Named ports, on their sides, with edges from one to another. They're quieter where nothing can be connected. */
export const Ports: Story = {
  render: () => <Phone w={500} h={240}><Diagram nodes={PORTED} edges={PORTED_EDGES} /></Phone>,
};

export const PortsConnectable: Story = {
  render: () => <Phone w={500} h={240}><Diagram defaultNodes={PORTED} defaultEdges={PORTED_EDGES} editable /></Phone>,
};

export const PortsConnectableDark: Story = {
  render: () => <Phone w={500} h={240} appearance="dark"><Diagram defaultNodes={PORTED} defaultEdges={PORTED_EDGES} editable /></Phone>,
};

/** Selected, a node with no ports of its own has one on each side, and an edge has a handle on each end. */
export const ConnectHandles: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Phone w={500} h={160}><Diagram defaultNodes={SELECTABLE.slice(0, 3)} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: ['c'], edges: [] }} /></Phone>
      <Phone w={500} h={160}><Diagram defaultNodes={SELECTABLE.slice(0, 3)} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: [], edges: ['ab'] }} /></Phone>
    </div>
  ),
};

/** Nothing to draw: the shared EmptyState, over an empty board centered on the origin. */
export const Empty: Story = {
  render: () => <Phone w={400} h={240}><Diagram nodes={[]} /></Phone>,
};

/** An empty state of your own, with something to do about it. */
export const EmptyWithAction: Story = {
  render: () => (
    <Phone w={400} h={280}>
      <Diagram nodes={[]} editable emptyState={<EmptyState icon={<Icon name="grid-fill" size={28} />} title="No services yet" description="Add one from the catalog to start." action={<Button size="sm">Add a service</Button>} />} />
    </Phone>
  ),
};

/** `loading`: the data isn't here yet (a layout's running). No empty state, and a status says why. */
export const Loading: Story = {
  render: () => <Phone w={400} h={240}><Diagram nodes={[]} loading /></Phone>,
};

export const LoadingDark: Story = {
  render: () => <Phone w={400} h={240} appearance="dark"><Diagram nodes={[]} loading /></Phone>,
};

/** Read-only: nothing selects, moves or connects; the keys still go everywhere, and Enter calls `onAction`. Ports are quiet. */
export const ReadOnly: Story = {
  render: () => <Phone w={500} h={240}><Diagram nodes={PORTED} edges={PORTED_EDGES} aria-label="Read-only services" onAction={() => undefined} /></Phone>,
};

/** `DiagramToolbar` in the overlay: zoom out, zoom in, fit, and undo and redo for an editable diagram. Tooltips name the keys. */
export const WithToolbar: Story = {
  render: () => <Phone w={600} h={320}><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable overlay={<DiagramToolbar />} minimap={{ side: 'bottom', align: 'end' }} /></Phone>,
};

export const WithToolbarDark: Story = {
  render: () => <Phone w={600} h={320} appearance="dark"><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable overlay={<DiagramToolbar />} minimap={{ side: 'bottom', align: 'end' }} /></Phone>,
};

/** Phone-sized: the toolbar at the top, the minimap off, and the whole machine fitted until you move it. */
export const Phone390: Story = {
  name: 'Phone',
  render: () => <Phone w={390} h={720}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} aria-label="File upload" overlay={<DiagramToolbar side="top" />} /></Phone>,
};

/** Keys sent by the story: focus the board, go to a node, press Enter, then C and an arrow. */
const press = (keys: string[]) => async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const board = canvasElement.querySelector<HTMLElement>('[data-slot=canvas]');
  board?.focus();
  for (const key of keys) {
    (document.activeElement ?? board)?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 30));
  }
};

/** Focus on a node: the ring in the focus color, the view following. */
export const Focused: Story = {
  render: () => <Phone w={500} h={320}><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable /></Phone>,
  play: press(['Home', 'ArrowRight']),
};

/** Connecting by keyboard (C, then an arrow): the dashed route to what's offered, which is allowed. */
export const Connecting: Story = {
  render: () => <Phone w={500} h={240}><Diagram defaultNodes={PORTED} defaultEdges={PORTED_EDGES} editable /></Phone>,
  play: press(['Home', 'c', 'ArrowRight']),
};

/** A connection `isValidConnection` refuses: the route and the target in the destructive color, dashed, and why, read out. */
export const InvalidConnection: Story = {
  render: () => <Phone w={500} h={240}><Diagram defaultNodes={PORTED} defaultEdges={PORTED_EDGES} editable isValidConnection={(c) => (c.to === 'd1' ? 'D1 takes queries from one Worker only.' : true)} /></Phone>,
  play: press(['Home', 'c', 'ArrowUp']),
};

export const InvalidConnectionDark: Story = {
  render: () => <Phone w={500} h={240} appearance="dark"><Diagram defaultNodes={PORTED} defaultEdges={PORTED_EDGES} editable isValidConnection={(c) => (c.to === 'd1' ? 'D1 takes queries from one Worker only.' : true)} /></Phone>,
  play: press(['Home', 'c', 'ArrowUp']),
};

/** What's current (a machine's state, the edge it just took), apart from what's selected. */
export const Current: Story = {
  render: () => <Phone w={500} h={320}><Diagram nodes={SELECTABLE} edges={SELECTABLE_EDGES} current={{ nodes: ['b'], edges: ['ab'] }} /></Phone>,
};

/** 2,400 nodes and 2,350 edges: above 200, only what's near the view is drawn, so a pan or a zoom stays smooth. */
const GRID = 60;
const MANY_NODES: DiagramNode[] = Array.from({ length: 2400 }, (_, i) => ({ id: `n${i}`, label: `State ${i + 1}`, x: (i % GRID) * 180, y: Math.floor(i / GRID) * 90, w: 120, h: 40 }));
const MANY_EDGES: DiagramEdge[] = MANY_NODES.flatMap((n, i) => (i % GRID === GRID - 1 ? [] : [{ id: `e${i}`, from: n.id, to: `n${i + 1}`, label: i % 7 ? undefined : 'NEXT' }]));

export const Large: Story = {
  name: '2,400 nodes',
  render: () => <Phone w={1000} h={600}><Diagram nodes={MANY_NODES} edges={MANY_EDGES} minimap overlay={<DiagramToolbar />} defaultViewport={{ x: 20, y: 20, zoom: 0.6 }} aria-label="A large machine" /></Phone>,
};
