import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CloudflareDiagram } from './cloudflare-diagram';

const placed = [{ id: 'w', kind: 'workers', at: { x: 0, y: 0 } }, { id: 'r', kind: 'r2', label: 'Files', at: { x: 300, y: 0 } }];
const edges = [{ id: 'e', from: 'w', to: 'r', via: 'r2_buckets', binding: 'FILES', operations: ['get', 'put', 'list', 'head'] }];

describe('CloudflareDiagram, on a server', () => {
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
