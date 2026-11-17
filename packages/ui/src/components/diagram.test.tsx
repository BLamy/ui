import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useCanvas } from '@/components/ui/canvas';
import { Diagram, DiagramNodeBody, diagramEdgeVariants } from '@/components/ui/diagram';
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model';
import { UPLOAD_EDGES, UPLOAD_NODES } from '../stories/diagram-machine';

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('Diagram', () => {
  const html = renderToString(<Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} />);

  it('draws everything in the 33-state machine', () => {
    expect(count(html, /data-slot="diagram-node"/g)).toBe(40);
    expect(count(html, /data-kind="marker"/g)).toBe(7);
    expect(count(html, /data-variant="strong"/g)).toBe(7); // the edges from the markers
    expect(count(html, /data-slot="diagram-edge"/g)).toBe(43);
    expect(count(html, /data-slot="diagram-edge-label"/g)).toBe(36);
    expect(count(html, /data-slot="diagram-divider"/g)).toBe(2);
    expect(UPLOAD_NODES.filter((n) => n.kind !== 'marker')).toHaveLength(33);
    expect(UPLOAD_EDGES.filter((e) => e.variant !== 'strong')).toHaveLength(36);
  });

  it('puts an arrowhead on every edge, from a marker that exists', () => {
    const id = /<marker id="([^"]+)"/.exec(html)![1];
    expect(count(html, new RegExp(`marker-end="url\\(#${id}(-strong)?\\)"`, 'g'))).toBe(43);
    expect(html).toContain(`<marker id="${id}-strong"`);
  });

  it('draws what holds things under the lines, and the rest over them', () => {
    const edges = html.indexOf('data-slot="diagram-edges"');
    expect(html.indexOf('data-node="upload.worker"')).toBeLessThan(edges);
    expect(html.indexOf('data-node="upload.processing.scan"')).toBeLessThan(edges);
    expect(html.indexOf('data-node="upload.worker.streaming"')).toBeGreaterThan(edges);
    expect(html.indexOf('data-slot="diagram-edge-label"')).toBeGreaterThan(html.indexOf('data-node="upload.worker.streaming"'));
    // An outer container draws first, whatever order they were listed in.
    const shuffled = renderToString(<Diagram nodes={[{ id: 'inner', parent: 'outer', kind: 'group', x: 0, y: 0, w: 1, h: 1 }, { id: 'outer', kind: 'group', x: 0, y: 0, w: 1, h: 1 }]} />);
    expect(shuffled.indexOf('data-node="outer"')).toBeLessThan(shuffled.indexOf('data-node="inner"'));
  });

  it('has a data-slot on the root and each part, and merges className and style last', () => {
    for (const slot of ['diagram', 'canvas', 'canvas-board', 'diagram-layer', 'diagram-node', 'diagram-node-body', 'diagram-node-header', 'diagram-node-title', 'diagram-node-description', 'diagram-edges', 'diagram-edge', 'diagram-edge-label', 'diagram-divider']) {
      expect(html).toContain(`data-slot="${slot}"`);
    }
    const root = renderToString(<Diagram nodes={[]} className="absolute-not inset-4 mine" style={{ opacity: 0.5 }} />);
    const tag = /<div[^>]*data-slot="diagram"[^>]*>/.exec(root)![0];
    expect(tag).toContain('mine');
    // tailwind-merge drops the default it replaces.
    expect(tag).toContain('inset-4');
    expect(tag).not.toContain('inset-0');
    expect(tag).toContain('opacity:0.5');
  });

  it('names the diagram, and its board after it', () => {
    const plain = renderToString(<Diagram nodes={[]} />);
    expect(plain).toMatch(/role="group"[^>]*aria-label="Diagram"|aria-label="Diagram"[^>]*role="group"/);
    expect(plain).toContain('aria-roledescription="diagram"');
    expect(plain).toContain('aria-label="Diagram board"');
    expect(renderToString(<Diagram nodes={[]} aria-label="A machine" />)).toContain('aria-label="A machine board"');
  });

  it('keeps an edge whose end is missing out of the picture, rather than failing', () => {
    const out = renderToString(<Diagram nodes={[{ id: 'a', x: 0, y: 0, w: 10, h: 10 }]} edges={[{ id: 'e', from: 'a', to: 'gone', title: 'lost' }]} />);
    expect(count(out, /data-slot="diagram-edge"/g)).toBe(0);
    expect(out).not.toContain('lost');
  });

  it('places a label it was given, and works one out when it wasn’t', () => {
    const nodes: DiagramNode[] = [{ id: 'a', x: 0, y: 0, w: 100, h: 40 }, { id: 'b', x: 300, y: 0, w: 100, h: 40 }];
    const given: DiagramEdge = { id: 'e', from: 'a', to: 'b', title: 'SUBMIT', labelBox: { x: 170, y: 7, w: 40, h: 11 } };
    expect(renderToString(<Diagram nodes={nodes} edges={[given]} />)).toMatch(/left:170px;top:7px/);
    // A place given on top of a node isn't kept: the label goes where it can be read.
    const onNode = renderToString(<Diagram nodes={nodes} edges={[{ ...given, labelBox: { x: 7, y: 9, w: 40, h: 11 } }]} />);
    expect(onNode).not.toMatch(/left:7px;top:9px/);
    const found = renderToString(<Diagram nodes={nodes} edges={[{ id: 'e', from: 'a', to: 'b', title: 'SUBMIT' }]} />);
    const m = /data-slot="diagram-edge-label"[^>]*style="left:([\d.]+)px;top:([\d.]+)px;width:([\d.]+)px;height:([\d.]+)px"/.exec(found)!;
    // On the line, which runs along y = 20, in the middle of the gap: a pill the edge runs into and out of.
    expect(Number(m[2]) + Number(m[4]) / 2).toBe(20);
    expect(Number(m[1]) + Number(m[3]) / 2).toBe(200);
    expect(found).toContain('data-shape="pill"');
  });

  it('draws custom nodes, gives children the canvas, and hides nothing in the data', () => {
    function Readout() {
      const { zoom } = useCanvas();
      return <span data-testid="readout">{zoom}</span>;
    }
    const custom = renderToString(
      <Diagram nodes={[{ id: 'a', title: 'hi', x: 0, y: 0, w: 10, h: 10, data: { n: 7 } }]} defaultViewport={{ x: 0, y: 0, zoom: 2 }} renderNode={(n) => <i data-custom={(n.data as { n: number }).n}><DiagramNodeBody node={n} /></i>}>
        <Readout />
      </Diagram>,
    );
    expect(custom).toContain('data-custom="7"');
    expect(custom).toContain('data-slot="diagram-node-body"');
    expect(custom).toMatch(/data-testid="readout">2</);
  });

  it('says when text has to hide, by zoom', () => {
    const at = (z: number) => /data-zoom="(\w+)"/.exec(renderToString(<Diagram nodes={[]} defaultViewport={{ x: 0, y: 0, zoom: z }} />))![1];
    expect(at(1)).toBe('near');
    expect(at(0.4)).toBe('near');
    expect(at(0.39)).toBe('mid');
    expect(at(0.25)).toBe('mid');
    expect(at(0.24)).toBe('far');
    expect(at(0.02)).toBe('far');
    expect(at(4)).toBe('near');
  });

  it('feeds the zoom to the lines', () => {
    expect(renderToString(<Diagram nodes={[]} defaultViewport={{ x: 0, y: 0, zoom: 0.5 }} />)).toMatch(/data-slot="diagram-edges"[^>]*--diagram-z:0\.5/);
    // In steps of about 9%, so that most frames of a zoom don't restyle every line.
    const lines = (z: number) => Number(/data-slot="diagram-edges"[^>]*--diagram-z:([\d.]+)/.exec(renderToString(<Diagram nodes={[]} defaultViewport={{ x: 0, y: 0, zoom: z }} />))![1]);
    expect(lines(0.5)).toBe(lines(0.51));
    expect(lines(0.5)).not.toBe(lines(0.55));
    for (const z of [0.02, 0.1, 0.33, 0.7, 1, 1.7, 2.9, 4]) expect(Math.abs(lines(z) / z - 1)).toBeLessThan(0.05);
    expect(diagramEdgeVariants({})).toContain('calc(1.25px/var(--diagram-z))');
  });

  it('gives the zoom only to what needs it, so a zoom doesn’t restyle every node', () => {
    const out = renderToString(<Diagram nodes={[{ id: 'a', title: 'hi', x: 0, y: 0, w: 10, h: 10 }]} defaultViewport={{ x: 0, y: 0, zoom: 0.5 }} />);
    expect(/data-slot="diagram-layer"[^>]*--diagram-z/.test(out)).toBe(false);
    expect(/data-slot="canvas-board"[^>]*--diagram-z/.test(out)).toBe(false);
    expect(/data-slot="diagram-node"[^>]*--diagram-z/.test(out)).toBe(false);
    expect(out.match(/--diagram-z:/g)).toHaveLength(1);
  });

  it('rings what’s selected, in a layer of its own', () => {
    const out = renderToString(<Diagram defaultNodes={[{ id: 'a', title: 'hi', x: 1, y: 2, w: 10, h: 10 }, { id: 'b', x: 50, y: 0, w: 10, h: 10 }]} editable defaultSelection={{ nodes: ['a'], edges: [] }} defaultViewport={{ x: 0, y: 0, zoom: 0.5 }} />);
    expect(out.match(/data-slot="diagram-ring"/g)).toHaveLength(1);
    expect(out).toContain('data-ring-of="a"');
    expect(out).toMatch(/data-slot="diagram-rings"[^>]*--diagram-z:0\.5/);
    expect(renderToString(<Diagram defaultNodes={[{ id: 'a', x: 1, y: 2, w: 10, h: 10 }]} editable />)).not.toContain('diagram-rings');
  });

  it('fits its content when no view is given, and honors one that is', () => {
    function Zoom() {
      return <output data-testid="zoom">{useCanvas().zoom}</output>;
    }
    const zoom = (html: string) => Number(/data-testid="zoom">([\d.]+)</.exec(html)![1]);
    const nodes: DiagramNode[] = [{ id: 'a', x: 0, y: 0, w: 2000, h: 100 }];
    // The size before anything's measured is 1000 x 700, with 24 px of air: (1000 - 48) / 2000.
    expect(zoom(renderToString(<Diagram nodes={nodes}><Zoom /></Diagram>))).toBeCloseTo(0.476);
    expect(zoom(renderToString(<Diagram nodes={nodes} defaultViewport={{ x: 1, y: 2, zoom: 3 }}><Zoom /></Diagram>))).toBe(3);
    expect(zoom(renderToString(<Diagram nodes={nodes} viewport={{ x: 1, y: 2, zoom: 0.75 }}><Zoom /></Diagram>))).toBe(0.75);
  });

  it('marks the minimap with everything but the root, which would be one solid block', () => {
    const out = renderToString(<Diagram nodes={[{ id: 'r', kind: 'root', x: 0, y: 0, w: 500, h: 500 }, { id: 'a', parent: 'r', x: 10, y: 10, w: 50, h: 50 }, { id: 'b', parent: 'r', x: 100, y: 10, w: 50, h: 50 }]} minimap />);
    expect(out).toContain('data-slot="canvas-minimap"');
    expect(count(out, /fill-muted-foreground\/35/g)).toBe(2);
    expect(renderToString(<Diagram nodes={[]} />)).not.toContain('canvas-minimap');
  });

  describe('drawing only what’s near the view', () => {
    const far = (id: string, x: number): DiagramNode => ({ id, title: id, x, y: 0, w: 100, h: 40 });
    const nodes = [far('left', -5000), far('here', 100), far('right', 5000)];
    const crossing: DiagramEdge = { id: 'across', from: 'left', to: 'right', title: 'far', points: [{ x: -4900, y: 20 }, { x: 5000, y: 20 }], labelBox: { x: 4000, y: 0, w: 20, h: 11 } };
    const at = { x: 0, y: 0, zoom: 1 };

    it('leaves out what’s far away, when asked', () => {
      const out = renderToString(<Diagram nodes={nodes} cull defaultViewport={at} />);
      expect(out).toContain('data-node="here"');
      expect(out).not.toContain('data-node="left"');
      expect(out).not.toContain('data-node="right"');
    });

    it('draws an edge with both ends out of view, when it crosses the view', () => {
      const out = renderToString(<Diagram nodes={nodes} edges={[crossing]} cull defaultViewport={at} />);
      expect(out).toContain('data-edge="across"');
      expect(out).not.toContain('data-node="left"');
      // Its label's a long way off, so that isn't drawn.
      expect(out).not.toContain('data-slot="diagram-edge-label"');
      const missing = renderToString(<Diagram nodes={nodes} edges={[{ ...crossing, points: [{ x: 4000, y: 20 }, { x: 5000, y: 20 }] }]} cull defaultViewport={at} />);
      expect(missing).not.toContain('data-edge="across"');
    });

    it('draws what’s just past the view, so a pan has somewhere to go', () => {
      // The view's 1000 wide before it's measured, and half of that again is drawn each way.
      const out = renderToString(<Diagram nodes={[far('near', 1400), far('beyond', 1600)]} cull defaultViewport={at} />);
      expect(out).toContain('data-node="near"');
      expect(out).not.toContain('data-node="beyond"');
    });

    it('draws everything when told to, and below the size where it starts', () => {
      expect(renderToString(<Diagram nodes={nodes} defaultViewport={at} />)).toContain('data-node="left"');
      expect(renderToString(<Diagram nodes={nodes} cull={false} defaultViewport={at} />)).toContain('data-node="left"');
    });

    it('starts on its own above 200 nodes and edges', () => {
      const many = Array.from({ length: 201 }, (_, i) => far(`n${i}`, i * 300));
      const out = renderToString(<Diagram nodes={many} defaultViewport={at} />);
      expect(out).toContain('data-node="n0"');
      expect(out).not.toContain('data-node="n200"');
      expect(count(renderToString(<Diagram nodes={many.slice(0, 200)} defaultViewport={at} />), /data-slot="diagram-node"/g)).toBe(200);
    });

    it('draws what holds something in view, even with its walls out of view', () => {
      const out = renderToString(<Diagram nodes={[{ id: 'box', kind: 'group', x: -5000, y: -5000, w: 10000, h: 10000 }, far('here', 100)]} cull defaultViewport={at} />);
      expect(out).toContain('data-node="box"');
    });

    it('leaves out ports that are far away', () => {
      const ported = nodes.map((n) => ({ ...n, ports: [{ id: 'p', side: 'right' as const }] }));
      const out = renderToString(<Diagram nodes={ported} cull defaultViewport={at} />);
      expect(out).toContain('data-port-of="here"');
      expect(out).not.toContain('data-port-of="left"');
      expect(renderToString(<Diagram nodes={ported} defaultViewport={at} />)).toContain('data-port-of="left"');
    });

    it('goes by the zoom', () => {
      const out = renderToString(<Diagram nodes={nodes} cull defaultViewport={{ x: 500, y: 300, zoom: 0.05 }} />);
      expect(out).toContain('data-node="left"');
      expect(out).toContain('data-node="right"');
    });
  });
});
