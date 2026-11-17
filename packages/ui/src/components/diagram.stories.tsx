import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useRef } from 'react';
import { useCanvas } from '@/components/ui/canvas';
import { Diagram, DiagramNodeBody, DiagramToolbar } from '@/components/ui/diagram';
import { DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFramePanel } from '@/components/ui/diagram-frame';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/lib/icon';
import type { DiagramDraft } from '@/lib/diagram-layout';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model';
import { STATECHART_LIKE, SYSTEM_LIKE } from '../stories/diagram-anatomy';
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
  { id: 'root', kind: 'root', title: 'A root, which holds everything', x: 0, y: 0, w: 900, h: 420 },
  { id: 'plain', kind: 'node', parent: 'root', title: 'A node', x: 40, y: 56, w: 120, h: 36 },
  { id: 'detail', kind: 'node', parent: 'root', title: 'With a detail', description: 'invoke fetchUser', x: 200, y: 50, w: 150, h: 50 },
  { id: 'final', variant: 'double', parent: 'root', title: 'Double', x: 400, y: 56, w: 110, h: 36 },
  { id: 'initial', kind: 'marker', parent: 'root', title: 'Start', x: 560, y: 66, w: 12, h: 12 },
  { id: 'compound', kind: 'group', parent: 'root', title: 'A group', x: 40, y: 140, w: 320, h: 240 },
  { id: 'inner', kind: 'node', parent: 'compound', title: 'Inside', x: 90, y: 200, w: 110, h: 36 },
  { id: 'parallel', kind: 'group', variant: 'dashed', parent: 'root', title: 'A dashed group', description: 'of regions', x: 400, y: 140, w: 460, h: 240 },
  { id: 'r1', kind: 'region', parent: 'parallel', title: 'A region', x: 412, y: 204, w: 436, h: 80 },
  { id: 'r2', kind: 'region', parent: 'parallel', title: 'Another', x: 412, y: 292, w: 436, h: 80 },
  { id: 'r1a', kind: 'node', parent: 'r1', title: 'One', x: 560, y: 228, w: 100, h: 36 },
  { id: 'r2a', kind: 'node', parent: 'r2', title: 'Two', x: 560, y: 316, w: 100, h: 36 },
];

/** Every kind of node (`node`, `group`, `region`, `root`, `marker`) and border (`default`, `dashed`, `double`). */
export const NodeKinds: Story = {
  render: () => <Phone w={1000} h={500}><Diagram nodes={KINDS} /></Phone>,
};

export const NodeKindsDark: Story = {
  render: () => <Phone w={1000} h={500} appearance="dark"><Diagram nodes={KINDS} /></Phone>,
};

const EDGE_NODES: DiagramNode[] = [
  { id: 'a', title: 'default', x: 0, y: 0, w: 110, h: 36 },
  { id: 'a2', title: 'target', x: 300, y: 0, w: 110, h: 36 },
  { id: 'b', title: 'dashed', x: 0, y: 70, w: 110, h: 36 },
  { id: 'b2', title: 'target', x: 300, y: 70, w: 110, h: 36 },
  { id: 'c', title: 'dotted', x: 0, y: 140, w: 110, h: 36 },
  { id: 'c2', title: 'target', x: 300, y: 140, w: 110, h: 36 },
  { id: 'd', title: 'strong', x: 0, y: 210, w: 110, h: 36 },
  { id: 'd2', title: 'target', x: 300, y: 210, w: 110, h: 36 },
  { id: 'e', title: 'destructive', x: 0, y: 280, w: 110, h: 36 },
  { id: 'e2', title: 'target', x: 300, y: 280, w: 110, h: 36 },
  { id: 'dot', kind: 'marker', x: 49, y: 350, w: 12, h: 12 },
  { id: 'f2', title: 'from a marker', x: 300, y: 338, w: 110, h: 36 },
  { id: 's', title: 'straight', x: 520, y: 0, w: 110, h: 36 },
  { id: 's2', title: 'target', x: 800, y: 90, w: 110, h: 36 },
  { id: 'el', title: 'elbow', x: 520, y: 100, w: 110, h: 36 },
  { id: 'el2', title: 'target', x: 800, y: 190, w: 110, h: 36 },
  { id: 'cu', title: 'curve', x: 520, y: 200, w: 110, h: 36 },
  { id: 'cu2', title: 'target', x: 800, y: 290, w: 110, h: 36 },
  { id: 'loop', title: 'self-loops', x: 600, y: 470, w: 130, h: 36 },
  { id: 'p', title: 'parallel', x: 560, y: 340, w: 110, h: 90 },
  { id: 'p2', title: 'edges', x: 850, y: 340, w: 110, h: 90 },
  { id: 'box', kind: 'group', title: 'to and from its own child', x: 0, y: 420, w: 420, h: 120 },
  { id: 'kid', parent: 'box', title: 'child', x: 120, y: 470, w: 110, h: 36 },
];
const EDGES: DiagramEdge[] = [
  { id: 'ev', from: 'a', to: 'a2', title: 'SUBMIT' },
  { id: 'al', from: 'b', to: 'b2', variant: 'dashed', title: 'always [isValid]' },
  { id: 'af', from: 'c', to: 'c2', variant: 'dotted', title: 'after 5000' },
  { id: 'do', from: 'd', to: 'd2', variant: 'strong', title: 'strong' },
  { id: 'in', from: 'e', to: 'e2', tone: 'destructive', title: 'can’t' },
  { id: 'it', from: 'dot', to: 'f2', variant: 'strong' },
  { id: 'r1', from: 's', to: 's2', route: 'straight', title: 'a straight route' },
  { id: 'r2', from: 'el', to: 'el2', route: 'elbow', title: 'an elbow route' },
  { id: 'r3', from: 'cu', to: 'cu2', route: 'curve', title: 'a curved route' },
  { id: 'l1', from: 'loop', to: 'loop', title: 'RETRY' },
  { id: 'l2', from: 'loop', to: 'loop', title: 'PING', variant: 'dotted' },
  { id: 'p1', from: 'p', to: 'p2', title: 'one' },
  { id: 'p2', from: 'p', to: 'p2', title: 'two' },
  { id: 'p3', from: 'p', to: 'p2', title: 'three' },
  { id: 'wall', from: 'box', to: 'kid', title: 'enter' },
  { id: 'wall2', from: 'kid', to: 'box', route: 'curve' },
];

/** Every edge line (`default`, `dashed`, `dotted`, `strong`) and the `destructive` tone, routes with no layout behind
 *  them, self-loops, parallel edges, and an edge to its own child. */
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
  { id: 'short', title: 'idle', x: 0, y: 0, w: 1, h: 1 },
  { id: 'detail', title: 'checkingQuota', description: 'invoke verifyTokenAndQuota', x: 240, y: 0, w: 1, h: 1 },
  { id: 'long', title: 'A very long state name that goes on for a good deal longer than any node should', x: 0, y: 90, w: 1, h: 1 },
  { id: 'nospaces', title: 'aVeryLongStateNameWithNoSpacesInItAtAllThatHasToBreakSomewhereOrItWillRunOutOfItsBox', x: 280, y: 90, w: 1, h: 1 },
  { id: 'cjk', title: '認証を確認しています', description: 'アップロードを待っています', x: 0, y: 190, w: 1, h: 1 },
  { id: 'cjklong', title: 'これはとても長い状態の名前で、折り返さなければ箱からはみ出してしまいます', x: 280, y: 190, w: 1, h: 1 },
  { id: 'final', variant: 'double', title: 'quarantined', x: 0, y: 280, w: 1, h: 1 },
  { id: 'emoji', title: '🚀 launching 🌕', x: 280, y: 280, w: 1, h: 1 },
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
  { id: 'a', title: 'One selected', x: 0, y: 0, w: 130, h: 36 },
  { id: 'b', title: 'And another', x: 220, y: 0, w: 130, h: 36 },
  { id: 'c', title: 'Not this one', x: 110, y: 90, w: 130, h: 36 },
  { id: 'box', kind: 'group', title: 'A selected compound', x: 0, y: 170, w: 350, h: 90 },
  { id: 'd', parent: 'box', title: 'Inside it', x: 110, y: 205, w: 130, h: 36 },
];
const SELECTABLE_EDGES: DiagramEdge[] = [
  { id: 'ab', from: 'a', to: 'b', title: 'selected' },
  { id: 'ac', from: 'a', to: 'c' },
  { id: 'bc', from: 'b', to: 'c' },
];

/** What's selected gets a tint and a line on its edge (a group, only the line), and an edge the theme's primary color,
 *  thicker. All stay the same thickness on screen at any zoom. */
export const Selected: Story = {
  render: () => <Phone w={500} h={320}><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: ['a', 'b', 'box'], edges: ['ab'] }} /></Phone>,
};

export const SelectedDark: Story = {
  render: () => <Phone w={500} h={320} appearance="dark"><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: ['a', 'b', 'box'], edges: ['ab'] }} /></Phone>,
};

const PORTED: DiagramNode[] = [
  { id: 'w', title: 'Worker', x: 0, y: 40, w: 130, h: 80, ports: [{ id: 'db', side: 'right', at: 0.25, kind: 'sql' }, { id: 'files', side: 'right', at: 0.75, kind: 'files' }, { id: 'in', side: 'left', direction: 'in' }] },
  { id: 'd1', title: 'D1', x: 260, y: 0, w: 110, h: 50, ports: [{ id: 'in', side: 'left', kind: 'sql', direction: 'in' }] },
  { id: 'r2', title: 'R2', x: 260, y: 110, w: 110, h: 50, ports: [{ id: 'in', side: 'left', kind: 'files', direction: 'in' }] },
];
const PORTED_EDGES: DiagramEdge[] = [
  { id: 'a', from: 'w', fromPort: 'db', to: 'd1', toPort: 'in', title: 'prepare' },
  { id: 'b', from: 'w', fromPort: 'files', to: 'r2', toPort: 'in', title: 'put' },
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

/** Read-only: nothing moves, connects or is deleted, but you can select and read; the keys go everywhere, and Enter calls
 *  `onAction`. Ports are quiet. */
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

/** Phone-sized, edge to edge: the toolbar at the top, the minimap off, and the whole machine fitted clear of the toolbar
 *  until you move it. */
export const Phone390: Story = {
  name: 'Phone',
  parameters: { layout: 'fullscreen' },
  render: () => <Phone w={390} h={844}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} aria-label="File upload" overlay={<DiagramToolbar side="top" />} /></Phone>,
};

/** In a DiagramFrame on a phone: the toolbar goes to the top by itself, and the first fit leaves room for it and for the
 *  frame's bar at the foot. Ports shrink with a board fitted this far out, rather than crowding their nodes. */
export const PhoneInFrame: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <Phone w={390} h={844}>
      <DiagramFrame>
        <DiagramFrameBoard>
          <Diagram nodes={SERVICES} edges={SERVICE_EDGES} renderNode={renderService} aria-label="Services" overlay={<DiagramToolbar />} />
          <DiagramFrameBar>4 services</DiagramFrameBar>
        </DiagramFrameBoard>
        <DiagramFramePanel title="Services"><p className="m-0">Nothing selected.</p></DiagramFramePanel>
      </DiagramFrame>
    </Phone>
  ),
};

export const PhoneInFrameDark: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <Phone w={390} h={844} appearance="dark">
      <DiagramFrame>
        <DiagramFrameBoard>
          <Diagram nodes={SERVICES} edges={SERVICE_EDGES} renderNode={renderService} aria-label="Services" overlay={<DiagramToolbar />} defaultSelection={{ nodes: ['queue'], edges: [] }} />
          <DiagramFrameBar>4 services</DiagramFrameBar>
        </DiagramFrameBoard>
        <DiagramFramePanel title="Services"><p className="m-0">Jobs is selected.</p></DiagramFramePanel>
      </DiagramFrame>
    </Phone>
  ),
};

/* Cards with their ports' names written inside them, as a system of services draws them. The R2 → Queue edge leaves on
   the right and arrives on the left of a card to its left, and the Queue → Consumer label would sit on the consumer's
   port names if it went where a label goes by default. */
const SERVICES: DiagramNode[] = [
  { id: 'files', title: 'Files', description: 'R2', x: 0, y: 0, w: 200, h: 90, ports: [{ id: 'events', side: 'right', at: 0.5, label: 'events', direction: 'out' }] },
  { id: 'queue', title: 'Jobs', description: 'Queue', x: 0, y: 170, w: 200, h: 90, ports: [{ id: 'events', side: 'left', at: 0.35, label: 'events', direction: 'in' }, { id: 'batch', side: 'right', at: 0.5, label: 'batch', direction: 'out' }] },
  { id: 'consumer', title: 'Consumer', description: 'Worker', x: 400, y: 140, w: 200, h: 150, ports: [{ id: 'queue', side: 'left', at: 0.32, label: 'queue', direction: 'in' }, { id: 'email', side: 'left', at: 0.5, label: 'email', direction: 'in' }, { id: 'env', side: 'right', at: 0.5, label: 'env', direction: 'out' }] },
  { id: 'db', title: 'Uploads', description: 'D1', x: 720, y: 160, w: 200, h: 90, ports: [{ id: 'in', side: 'left', at: 0.5, label: 'queries', direction: 'in' }] },
];
const SERVICE_EDGES: DiagramEdge[] = [
  { id: 'r2-queue', from: 'files', fromPort: 'events', to: 'queue', toPort: 'events', title: 'events' },
  { id: 'queue-consumer', from: 'queue', fromPort: 'batch', to: 'consumer', toPort: 'queue', title: 'message batch from a Queue' },
  { id: 'consumer-db', from: 'consumer', fromPort: 'env', to: 'db', toPort: 'in', title: 'env.DB' },
];
const renderService = (node: DiagramNode) => (
  <DiagramNodeBody node={node} className="items-stretch justify-start gap-0.5 text-start">
    {(node.ports ?? []).map((p) => (
      <span key={p.id} className="absolute text-caption text-muted-foreground" style={{ top: `calc(${(p.at ?? 0.5) * 100}% - 0.5lh)`, ...(p.side === 'left' ? { left: 10 } : { right: 10 }) }}>{p.label}</span>
    ))}
  </DiagramNodeBody>
);

/** Labels keep off the cards and their ports' names, and a route whose ends face away from each other goes around the
 *  cards rather than behind them. At 100%. */
export const LabelsClearOfNodes: Story = {
  render: () => <Phone w={900} h={380}><Diagram nodes={SERVICES} edges={SERVICE_EDGES} renderNode={renderService} defaultViewport={{ x: 40, y: 50, zoom: 1 }} aria-label="Services" /></Phone>,
};

export const LabelsClearOfNodesDark: Story = {
  render: () => <Phone w={900} h={380} appearance="dark"><Diagram nodes={SERVICES} edges={SERVICE_EDGES} renderNode={renderService} defaultViewport={{ x: 40, y: 50, zoom: 1 }} aria-label="Services" /></Phone>,
};

/** `error`: why the diagram can't be drawn, under the toolbar's row, in place of the empty state. */
export const WithError: Story = {
  render: () => <Phone w={500} h={240}><Diagram nodes={[]} error="This machine can’t be drawn: “open” targets a state that doesn’t exist." overlay={<DiagramToolbar side="top" />} /></Phone>,
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

/** Focus on a node: a ring outside it, past a gap, the view following. */
export const Focused: Story = {
  render: () => <Phone w={500} h={320}><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable /></Phone>,
  play: press(['Home', 'ArrowRight']),
};

/** Focused and selected, beside selected only and focused only: a selection is a fill and a line on its edge, focus a
 *  ring past a gap, and both is both, so they don't rely on the two being different colors (they're one blue). */
export const FocusedAndSelected: Story = {
  render: () => <Phone w={500} h={320}><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: ['a', 'b'], edges: [] }} /></Phone>,
  play: press(['Home']),
};

export const FocusedAndSelectedDark: Story = {
  render: () => <Phone w={500} h={320} appearance="dark"><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: ['a', 'b'], edges: [] }} /></Phone>,
  play: press(['Home']),
};

/** Focus on an edge: a wide band under the line, apart from a selected edge's color. */
export const FocusedEdge: Story = {
  render: () => <Phone w={500} h={320}><Diagram defaultNodes={SELECTABLE} defaultEdges={SELECTABLE_EDGES} editable defaultSelection={{ nodes: [], edges: ['ab'] }} /></Phone>,
  play: press(['Home', ']']),
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

/* ── The anatomy: everything a statechart and a system of services say, with nothing but the generic parts ── */

/** A draft laid out by ELK, top to bottom, on the lined board. */
function Anatomy({ draft, editable = false, label }: { draft: DiagramDraft; editable?: boolean; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const laid = useDiagramLayout(draft, { host });
  return (
    <div ref={host} className="absolute inset-0">
      <Diagram nodes={laid.nodes} edges={laid.edges} loading={laid.status === 'pending'} background="grid" editable={editable} movable={false} connectable={false} onAction={editable ? () => undefined : undefined} overlay={<DiagramToolbar />} aria-label={label} />
    </div>
  );
}

/** The XState visualizer's "Audio Player", drawn with Diagram's generic parts: compare with the reference at 800 × 1000. */
export const StatechartLike: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <Phone w={800} h={1000}><Anatomy draft={STATECHART_LIKE} label="Audio Player" /></Phone>,
};
export const StatechartLikeDark: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <Phone w={800} h={1000} appearance="dark"><Anatomy draft={STATECHART_LIKE} label="Audio Player" /></Phone>,
};
/** Editable: the items are pressable chips (hover them), reached by keyboard with Alt+↓. */
export const StatechartLikeEditable: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <Phone w={800} h={1000}><Anatomy draft={STATECHART_LIKE} editable label="Audio Player" /></Phone>,
};
export const StatechartLikePhone: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <Phone w={390} h={844} appearance="dark"><Anatomy draft={STATECHART_LIKE} label="Audio Player" /></Phone>,
};
/** A system of services, with the same parts: product badges, sections, a Worker holding its Durable Object, the entry
 *  point's marker, binding labels as cards. */
export const SystemLike: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <Phone w={800} h={1000}><Anatomy draft={SYSTEM_LIKE} label="Uploads" /></Phone>,
};
export const SystemLikeDark: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <Phone w={800} h={1000} appearance="dark"><Anatomy draft={SYSTEM_LIKE} label="Uploads" /></Phone>,
};

const PARTS: DiagramNode[] = [
  { id: 'plain', title: 'Only a title', x: 0, y: 0, w: 1, h: 1 },
  { id: 'glyph', title: 'Final', icon: 'stop', x: 160, y: 0, w: 1, h: 1 },
  { id: 'hist', title: 'History', icon: { text: 'H*' }, x: 300, y: 0, w: 1, h: 1 },
  { id: 'badge', title: 'api', icon: 'cube', trailing: 'Worker', entry: true, x: 0, y: 90, w: 1, h: 1, description: 'Takes uploads.', sections: [{ title: 'Exposes', items: [{ title: 'fetch', icon: 'globe' }, { title: 'queue', icon: 'tray', tone: 'warning' }] }] },
  { id: 'list', title: 'Lists', tone: 'destructive', x: 220, y: 90, w: 1, h: 1, sections: [{ title: 'Context', variant: 'code', items: [{ title: 'count:', description: 'number' }] }, { title: 'Triggers', variant: 'list', items: [{ title: '*/5 * * * *', icon: 'clock' }] }] },
];
const PART_EDGES: DiagramEdge[] = [
  { id: 'pill', from: 'plain', to: 'glyph', title: 'next' },
  { id: 'card', from: 'badge', to: 'list', title: 'FILES', sections: [{ items: [{ title: 'put' }, { title: 'get' }] }] },
  { id: 'delay', from: 'glyph', to: 'hist', title: 'after 500ms', icon: 'clock', variant: 'dotted' },
];

/** Every part, hand-placed (no layout) and sized to its content with `autoSize`: headers with glyphs and badges, tones,
 *  chips, list and code rows, a description, the entry marker, a pill and a card on their routes. */
export const Parts: Story = {
  render: () => <Phone w={700} h={420}><Diagram nodes={PARTS} edges={PART_EDGES} autoSize background="grid" aria-label="Parts" /></Phone>,
};
export const PartsDark: Story = {
  render: () => <Phone w={700} h={420} appearance="dark"><Diagram nodes={PARTS} edges={PART_EDGES} autoSize background="grid" aria-label="Parts" /></Phone>,
};
/** An edge's label selected (it's part of its edge), and a chip with the keyboard's ring. */
export const PartsSelected: Story = {
  render: () => <Phone w={700} h={420}><Diagram nodes={PARTS} edges={PART_EDGES} autoSize defaultSelection={{ nodes: ['badge'], edges: ['card'] }} aria-label="Parts" /></Phone>,
};
