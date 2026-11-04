import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CloudflareDiagram } from './cloudflare-diagram';

const placed = [{ id: 'w', kind: 'workers', at: { x: 0, y: 0 } }, { id: 'r', kind: 'r2', label: 'Files', at: { x: 300, y: 0 } }];
const edges = [{ id: 'e', from: 'w', to: 'r', via: 'r2_buckets', binding: 'FILES', operations: ['get', 'put', 'list', 'head'] }];

describe('CloudflareDiagram, on a server', () => {
  it('says which have a machine, and draws what’s wrong as wrong', () => {
    const machine = { initial: 'a', states: { a: { on: { HELLO: 'a' } } } };
    const html = renderToString(<CloudflareDiagram services={[placed[0]!, { ...placed[1]!, machine }, { id: 'gone-to', kind: 'not-in-the-catalog', at: { x: 0, y: 300 } }]} edges={[{ id: 'bad', from: 'r', to: 'w', via: 'r2_buckets' }, { id: 'dangling', from: 'w', to: 'nowhere', via: 'r2_buckets', binding: 'X' }]} />);
    expect(html.match(/data-slot="cloudflare-service-machine"/g)).toHaveLength(1);
    expect(html).toContain('data-slot="diagram-edge" data-edge="bad" data-kind="problem"');
    // It has nowhere to go, so it isn't drawn, and it's said.
    expect(html).not.toContain('data-slot="diagram-edge" data-edge="dangling"');
    expect(html).toContain('data-slot="cloudflare-issue" data-severity="error" data-code="edge-end" data-edge="dangling"');
  });

  it('keeps apart the labels of two edges on one line', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={[edges[0]!, { ...edges[0]!, id: 'e2', binding: 'OTHER', operations: undefined }]} />);
    const top = (id: string) => Number(new RegExp(`data-slot="diagram-edge-label" data-edge="${id}"[^>]*?top:\\s*(-?[\\d.]+)px`).exec(html)?.[1]);
    expect(top('e')).not.toBeNaN();
    expect(top('e2')).toBeLessThan(top('e') - 5);
  });

  it('goes by what a service is bound as, on an edge with no name', () => {
    const html = renderToString(<CloudflareDiagram services={[placed[0]!, { ...placed[1]!, binding: 'UPLOADS' }]} edges={[{ id: 'e', from: 'w', to: 'r', via: 'r2_buckets', operations: ['get'] }]} />);
    expect(html).toContain('UPLOADS: get');
  });

  it('draws what it’s given in words, with its ports named', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={edges} />);
    expect(html).toContain('Workers');
    expect(html).toContain('Files');
    // It's called Files here, and says what it is.
    expect(html).toContain('R2');
    expect(html).toContain('R2 Bucket');
    expect(html).toContain('>env<');
    expect(html).toContain('data-kind="r2"');
  });

  it('says what an edge uses, up to a point', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={edges} />);
    expect(html).toContain('FILES: get, put, list +1');
    expect(renderToString(<CloudflareDiagram services={placed} edges={[{ ...edges[0]!, operations: [] }]} />)).toContain('>FILES<');
    expect(renderToString(<CloudflareDiagram services={placed} edges={[{ ...edges[0]!, operations: undefined, binding: undefined }]} />)).toContain('R2 Bucket</div>');
  });

  it('uses the library’s own icons, unless it’s given one', () => {
    const own = renderToString(<CloudflareDiagram services={placed} />);
    expect(own).toContain('<svg');
    const given = renderToString(<CloudflareDiagram services={placed} icon={(p) => <i data-given={p.id} />} />);
    expect(given).toContain('data-given="workers"');
    expect(given).toContain('data-given="r2"');
  });

  it('never has a product’s own image', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={edges} />);
    expect(html).not.toMatch(/<img\b|<image\b|\.(svg|png)\b/);
  });

  it('draws a kind it doesn’t know, and says so', () => {
    const html = renderToString(<CloudflareDiagram services={[{ id: 'x', kind: 'not-a-thing', at: { x: 0, y: 0 } }]} />);
    expect(html).toContain('not-a-thing');
    expect(html).toContain('not in the catalog');
  });

  it('draws an edge that isn’t real, as it might be in a file, without its ports', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={[{ id: 'bad', from: 'r', to: 'w', via: 'nope' }]} />);
    expect(html).toContain('data-edge="bad"');
  });

  it('puts one with no place to the right of those that have one', () => {
    const html = renderToString(<CloudflareDiagram services={[placed[0]!, { id: 'new', kind: 'd1' }]} />);
    expect(html).toMatch(/data-node="new"[^>]*style="[^"]*left:\s*(2[7-9]\d|3\d\d)px/);
  });

  it('credits the docs its words come from', () => {
    expect(renderToString(<CloudflareDiagram services={placed} defaultPanelOpen />)).toContain('CC-BY-4.0');
  });
});
