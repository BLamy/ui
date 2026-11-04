import type { Meta, StoryObj } from '@storybook/react-vite';
import { useCanvas } from '@/components/ui/canvas';
import { Diagram, DiagramNodeBody } from '@/components/ui/diagram';
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model';
import { UPLOAD_EDGES, UPLOAD_NODES } from '../stories/diagram-machine';
import { Phone } from '../stories/frame';

const meta: Meta<typeof Diagram> = {
  title: 'Organisms/Diagram',
  component: Diagram,
};
export default meta;
type Story = StoryObj<typeof Diagram>;

/* The file-upload machine: 33 states, 36 transitions, compound and parallel states and self-loops, laid out ahead of time. */
export const Machine: Story = {
  render: () => <Phone w={1360} h={560}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} aria-label="File upload" /></Phone>,
};

export const MachineDark: Story = {
  render: () => <Phone w={1360} h={560} dark><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} aria-label="File upload" /></Phone>,
};

/** Close enough to read: the parallel state and its regions. */
export const MachineCloseUp: Story = {
  render: () => <Phone w={1000} h={700}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultCamera={{ x: -1680, y: -210, z: 1.05 }} aria-label="File upload" /></Phone>,
};

export const MachineCloseUpDark: Story = {
  render: () => <Phone w={1000} h={700} dark><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultCamera={{ x: -1680, y: -210, z: 1.05 }} aria-label="File upload" /></Phone>,
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
  render: () => <Phone w={1000} h={500} dark><Diagram nodes={KINDS} /></Phone>,
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
  render: () => <Phone w={1200} h={640} dark><Diagram nodes={EDGE_NODES} edges={EDGES} /></Phone>,
};

/** At the smallest zoom: lines keep their thickness, and the text is gone. */
export const ZoomMin: Story = {
  render: () => <Phone w={800} h={360}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultCamera={{ x: 370, y: 170, z: 0.02 }} aria-label="File upload" /></Phone>,
};

/** Below the point where an edge's label could be read, a node's can still be made out. */
export const ZoomMiddle: Story = {
  render: () => <Phone w={1200} h={360}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultCamera={{ x: 20, y: 80, z: 0.3 }} aria-label="File upload" /></Phone>,
};

/** At the largest zoom: lines keep their thickness, and the text is big. */
export const ZoomMax: Story = {
  render: () => <Phone w={800} h={360}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} defaultCamera={{ x: -7836, y: -1224, z: 4 }} aria-label="File upload" /></Phone>,
};

/** `CanvasMiniMap`, with the root left out so it isn't one solid block. */
export const WithMiniMap: Story = {
  render: () => <Phone w={1000} h={500}><Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} minimap defaultCamera={{ x: -1600, y: -100, z: 0.9 }} aria-label="File upload" /></Phone>,
};

function ZoomReadout() {
  const { zoom } = useCanvas();
  return <div data-slot="zoom-readout" className="absolute rounded-ctl bg-primary px-2 py-1 text-caption text-primary-foreground" style={{ left: 20, top: 90 }}>useCanvas sees {Math.round(zoom * 100)}%</div>;
}

/** Children are in the board layer, and `useCanvas` works there. */
export const WithChildren: Story = {
  render: () => <Phone w={500} h={240}><Diagram nodes={EDGE_NODES.slice(0, 2)} edges={EDGES.slice(0, 1)} defaultCamera={{ x: 30, y: 30, z: 1 }}><ZoomReadout /></Diagram></Phone>,
};

const renderCustom = (node: DiagramNode) => <DiagramNodeBody node={node} className="border-primary bg-primary/10" />;

/** A custom node is whatever you draw in its box. Here, the usual body, with another color. */
export const CustomNode: Story = {
  render: () => <Phone w={500} h={160}><Diagram nodes={EDGE_NODES.slice(0, 2)} edges={EDGES.slice(0, 1)} renderNode={renderCustom} defaultCamera={{ x: 30, y: 50, z: 1 }} /></Phone>,
};

/** Nothing to draw: it's an empty canvas, centered on the origin. */
export const Empty: Story = {
  render: () => <Phone w={400} h={240}><Diagram nodes={[]} /></Phone>,
};
