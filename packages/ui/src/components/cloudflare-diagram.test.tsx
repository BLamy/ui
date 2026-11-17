import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Diagram } from './diagram';
import { CloudflareDiagram, cloudflareBoardProps } from './cloudflare-diagram';

const placed = [{ id: 'w', kind: 'workers', at: { x: 0, y: 0 } }, { id: 'r', kind: 'r2', label: 'Files', at: { x: 300, y: 0 } }];
const edges = [{ id: 'e', from: 'w', to: 'r', via: 'r2_buckets', binding: 'FILES', operations: ['get', 'put', 'list', 'head'] }];
/** The words on an edge's label, in order: its title, then its chips. */
const labelOf = (html: string, id: string) => {
  const at = html.indexOf(`data-slot="diagram-edge-label" data-edge="${id}"`);
  // To where something that isn't a part of a label starts.
  const rest = html.slice(at + 1);
  const end = rest.search(/data-slot="(diagram-edge-label|diagram-node|diagram-edge|diagram-port|diagram-frame[\w-]*|[\w-]*toolbar[\w-]*)"/);
  return [...rest.slice(0, end < 0 ? undefined : end).matchAll(/>([^<>]+)</g)].map((m) => m[1]!.trim()).filter(Boolean);
};

describe('CloudflareDiagram, on a server', () => {
  it('a service is a card: its name, what it is, and a section for each thing it has to say', () => {
    const html = renderToString(<CloudflareDiagram services={[{ ...placed[0]!, label: 'API', triggers: [{ kind: 'cron', schedule: '0 * * * *' }], settings: { compatibilityDate: '2026-11-01' } }, placed[1]!]} edges={edges} />);
    expect(html).toMatch(/data-slot="diagram-node-title"[^>]*>API</);
    expect(html).toMatch(/data-slot="diagram-node-trailing"[^>]*>Workers</);
    // It's called Files here, and says what it is.
    expect(html).toMatch(/data-slot="diagram-node-trailing"[^>]*>R2</);
    for (const section of ['handlers', 'triggers', 'settings']) expect(html).toContain(`data-owner="w" data-section="${section}"`);
    expect(html).toContain('data-item="handler:scheduled"');
    expect(html).toContain('data-item="cron:0 * * * *"');
    // Where a schedule comes in, there's an entry marker.
    expect(html.match(/data-slot="diagram-entry"/g)).toHaveLength(1);
  });

  it('read-only, it’s cards and labelled edges, with no ports', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={edges} />);
    expect(html).not.toContain('data-slot="diagram-port"');
    expect(html).not.toContain('data-section="connect"');
  });

  it('editable, each card has its ports, on the rows of its Connect section', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={edges} editable />);
    expect(html).toContain('data-owner="w" data-section="connect" data-item="env"');
    expect(html).toContain('data-owner="r" data-section="connect" data-item="binding:r2_buckets"');
    expect(html).toMatch(/data-slot="diagram-port" data-port-of="w" data-port="env"/);
  });

  it('says which have a machine, and draws what’s wrong as wrong', () => {
    const machine = { initial: 'a', states: { a: { on: { HELLO: 'a' } } } };
    const html = renderToString(<CloudflareDiagram services={[placed[0]!, { ...placed[1]!, machine }, { id: 'gone-to', kind: 'not-in-the-catalog', at: { x: 0, y: 300 } }]} edges={[{ id: 'bad', from: 'r', to: 'w', via: 'r2_buckets' }, { id: 'dangling', from: 'w', to: 'nowhere', via: 'r2_buckets', binding: 'X' }]} />);
    expect(html.match(/data-slot="diagram-section" data-section="machine"/g)).toHaveLength(1);
    expect(html).toMatch(/data-slot="diagram-edge" data-edge="bad"[^>]*data-tone="destructive"/);
    // It has nowhere to go, so it isn't drawn, and it's said.
    expect(html).not.toContain('data-slot="diagram-edge" data-edge="dangling"');
    expect(html).toContain('data-slot="cloudflare-issue" data-severity="error" data-code="edge-end" data-edge="dangling"');
  });

  it('keeps apart the labels of two edges on one line', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={[edges[0]!, { ...edges[0]!, id: 'e2', binding: 'OTHER', operations: undefined }]} />);
    const box = (id: string) => {
      const style = new RegExp(`data-slot="diagram-edge-label" data-edge="${id}"[^>]*?style="([^"]*)"`).exec(html)?.[1] ?? '';
      const n = (k: string) => Number(new RegExp(`${k}:\\s*(-?[\\d.]+)px`).exec(style)?.[1] ?? 0);
      return { x: n('left'), y: n('top'), w: n('width'), h: n('height') };
    };
    const a = box('e'), b = box('e2');
    const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    expect(apart).toBe(true);
  });

  it('a binding’s label is its name on env, then what it uses as chips; with nothing used, a pill', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={edges} />);
    expect(labelOf(html, 'e')).toEqual(['FILES', 'get', 'put', 'list', 'head']);
    expect(html).toMatch(/data-slot="diagram-edge-label" data-edge="e" data-shape="card"/);
    const bare = renderToString(<CloudflareDiagram services={placed} edges={[{ ...edges[0]!, operations: [] }]} />);
    expect(bare).toMatch(/data-slot="diagram-edge-label" data-edge="e" data-shape="pill"/);
    expect(labelOf(renderToString(<CloudflareDiagram services={placed} edges={[{ ...edges[0]!, operations: undefined, binding: undefined }]} />), 'e')).toEqual(['R2 Bucket']);
  });

  it('goes by what a service is bound as, on an edge with no name', () => {
    const html = renderToString(<CloudflareDiagram services={[placed[0]!, { ...placed[1]!, binding: 'UPLOADS' }]} edges={[{ id: 'e', from: 'w', to: 'r', via: 'r2_buckets', operations: ['get'] }]} />);
    expect(labelOf(html, 'e')).toEqual(['UPLOADS', 'get']);
  });

  it('the system is a container with its name and what’s account-wide; a Worker holds its classes; an environment its services', () => {
    const html = renderToString(
      <CloudflareDiagram
        title="Uploads"
        accountId="acc-1"
        services={[{ ...placed[0]!, migrations: [{ tag: 'v1', newSqliteClasses: ['Room'] }] }, { id: 'room', kind: 'durable-objects', label: 'Room', resource: 'Room', host: 'w', at: { x: 20, y: 200 } }, { ...placed[1]!, environment: 'staging' }]}
        edges={[{ id: 'b', from: 'w', to: 'room', via: 'durable_objects', binding: 'ROOM' }]}
      />,
    );
    expect(html).toMatch(/data-node="cloudflare:system" data-kind="root"/);
    expect(html).toMatch(/data-slot="diagram-node-title"[^>]*>Uploads</);
    expect(html).toContain('data-owner="cloudflare:system" data-section="account" data-item="account:acc-1"');
    expect(html).toMatch(/data-node="w" data-kind="group"/);
    expect(html).toMatch(/data-node="cloudflare:env:staging" data-kind="group"/);
    expect(html).toContain('data-item="storage:SQLite storage"');
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

  it('draws an edge that isn’t real, as it might be in a file', () => {
    const html = renderToString(<CloudflareDiagram services={placed} edges={[{ id: 'bad', from: 'r', to: 'w', via: 'nope' }]} />);
    expect(html).toContain('data-edge="bad"');
  });

  it('puts one with no place to the right of those that have one', () => {
    const html = renderToString(<CloudflareDiagram services={[placed[0]!, { id: 'new', kind: 'd1' }]} />);
    const left = (id: string) => Number(new RegExp(`data-node="${id}"[^>]*style="[^"]*left:\\s*(-?[\\d.]+)px`).exec(html)?.[1] ?? 0);
    const width = Number(/data-node="w"[^>]*style="[^"]*width:\s*([\d.]+)px/.exec(html)?.[1]);
    expect(left('new')).toBeGreaterThanOrEqual(width + 40);
  });

  it('credits the docs its words come from', () => {
    expect(renderToString(<CloudflareDiagram services={placed} defaultPanelOpen />)).toContain('CC-BY-4.0');
  });

  it('draws a system on a plain Diagram with cloudflareBoardProps: top to bottom, labels, the catalog’s rule and what’s wrong', () => {
    const system = { services: [{ id: 'w', kind: 'workers', label: 'API' }, { id: 'r', kind: 'r2', label: 'Files' }, { id: 'q', kind: 'queues' }], edges: [{ id: 'e', from: 'w', to: 'r', via: 'r2_buckets', binding: 'FILES', operations: ['get'] }, { id: 'bad', from: 'r', to: 'q', via: 'r2_buckets' }] };
    const board = cloudflareBoardProps(system);
    // None said where it is, so each is given a place, top to bottom by what reaches what.
    const y = (id: string) => board.nodes.find((n) => n.id === id)!.y;
    expect(y('r')).toBeGreaterThan(y('w'));
    expect(y('q')).toBeGreaterThan(y('r'));
    expect(board).toMatchObject({ background: 'grid', portsOnly: true, autoSize: true });
    expect(board.isValidConnection({ from: 'r', fromPort: undefined, to: 'w', toPort: 'env' } as never)).toEqual(expect.any(String));
    const html = renderToString(<Diagram {...board} aria-label="A system" />);
    expect(html.match(/data-slot="diagram-node" data-node="(w|r|q)"/g)).toHaveLength(3);
    expect(labelOf(html, 'e')).toEqual(['FILES', 'get']);
    expect(html).toMatch(/data-slot="diagram-edge" data-edge="bad"[^>]*data-tone="destructive"/);
    expect(html).toContain('API, service');
  });
});
