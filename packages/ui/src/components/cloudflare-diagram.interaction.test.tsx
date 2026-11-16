// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudflareDiagram, type CloudflareDiagramProps } from '@/components/ui/cloudflare-diagram';
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services';
import type { CloudflareSystem } from '@/lib/cloudflare-system';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
// The Combobox reads change events, as its tests do; a kit Input reads input events.
const type = async (input: HTMLElement, text: string) => { fireEvent.change(input, { target: { value: text } }); await settle(); };
const write = async (input: HTMLElement, text: string) => { fireEvent.input(input, { target: { value: text } }); await settle(); };
const commit = async (input: HTMLElement, text: string) => {
  await write(input, text);
  fireEvent.keyDown(input, { key: 'Enter' });
  await settle();
};

const SERVICES: CloudflareService[] = [
  { id: 'api', kind: 'workers', label: 'API', at: { x: 0, y: 0 } },
  { id: 'files', kind: 'r2', label: 'Files', at: { x: 340, y: 0 } },
];
const EDGES: CloudflareEdge[] = [{ id: 'up', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put'] }];

/** The panel as a column, open, so it's there without a layout to measure (happy-dom has none). */
const shown = (props: Partial<CloudflareDiagramProps>) =>
  render(<div style={{ position: 'relative', width: 1200, height: 600 }}><CloudflareDiagram panelPresentation="column" defaultPanelOpen {...props} /></div>);
const panel = () => document.querySelector<HTMLElement>('[data-slot=cloudflare-panel]')!;
const field = (name: string) => document.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;

describe('CloudflareDiagram, read-only', () => {
  it('is a picture with a panel that only reads: no search, no fields, nothing to delete or undo', async () => {
    shown({ services: SERVICES, edges: EDGES, defaultSelection: { nodes: [], edges: ['up'] } });
    await settle();
    expect(screen.getByRole('group', { name: 'Cloudflare services' })).toBeTruthy();
    expect(panel()).toBeTruthy();
    expect(within(panel()).queryByRole('combobox')).toBeNull();
    expect(within(panel()).queryByRole('textbox')).toBeNull();
    expect(within(panel()).queryByRole('checkbox')).toBeNull();
    expect(within(panel()).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    // What it uses is still said, and what it is, in words.
    expect(panel().querySelector('[data-slot=cloudflare-binding-name]')?.textContent).toContain('FILES');
    expect(panel().querySelector('[data-operation=put]')?.getAttribute('data-used')).toBe('');
    expect(panel().textContent).toContain('CC-BY-4.0');
  });

  it('says how to start when there is nothing in it', async () => {
    shown({ services: [] });
    await settle();
    expect(screen.getByText('No services yet')).toBeTruthy();
    expect(screen.getByText('This system has no services to draw.')).toBeTruthy();
  });
});

describe('CloudflareDiagram, editable', () => {
  it('renames a service in the panel, with onDataChange(system, details), and undoes it', async () => {
    const onDataChange = vi.fn();
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: ['files'], edges: [] }, onDataChange });
    await settle();
    await commit(field('label'), 'Uploads');
    expect(onDataChange).toHaveBeenCalledTimes(1);
    const [system, details] = onDataChange.mock.calls[0] as [CloudflareSystem, { reason: string }];
    expect(details.reason).toBe('edit');
    expect(system.services.find((s) => s.id === 'files')?.label).toBe('Uploads');
    expect(document.querySelector('[data-node=files] [data-slot=cloudflare-service-name]')?.textContent).toBe('Uploads');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    expect(onDataChange.mock.calls[1]?.[1].reason).toBe('undo');
    expect(document.querySelector('[data-node=files] [data-slot=cloudflare-service-name]')?.textContent).toBe('Files');
    expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).hasAttribute('data-disabled')).toBe(false);
  });

  it('keeps what it has when a change is canceled', async () => {
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: ['files'], edges: [] }, onDataChange: (_, details) => details.cancel() });
    await settle();
    await commit(field('label'), 'Uploads');
    expect(document.querySelector('[data-node=files] [data-slot=cloudflare-service-name]')?.textContent).toBe('Files');
  });

  it('refuses a binding name that can’t be on env, and says why', async () => {
    const onDataChange = vi.fn();
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: [], edges: ['up'] }, onDataChange });
    await settle();
    await commit(field('binding-name'), '1 bad');
    expect(onDataChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('can’t be a name on env');
    await commit(field('binding-name'), 'UPLOADS');
    expect(onDataChange.mock.calls[0]?.[0].edges[0].binding).toBe('UPLOADS');
  });

  it('chooses operations in the catalog’s order, whatever order they were checked in', async () => {
    const onDataChange = vi.fn();
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: [], edges: ['up'] }, onDataChange });
    await settle();
    fireEvent.click(within(panel()).getByRole('checkbox', { name: /^get\(/ }));
    await settle();
    const ops = (onDataChange.mock.calls.at(-1)?.[0] as CloudflareSystem).edges[0]?.operations ?? [];
    expect([...ops].sort()).toEqual(['get', 'put']);
    expect(ops.indexOf('get')).toBeLessThan(ops.indexOf('put'));
  });

  it('adds a service from a search of the catalog, selects it, and empties the search', async () => {
    const onDataChange = vi.fn();
    function Controlled() {
      const [system, setSystem] = useState<CloudflareSystem>({ services: SERVICES, edges: EDGES });
      return <CloudflareDiagram editable panelPresentation="column" defaultPanelOpen services={system.services} edges={system.edges} onDataChange={(next, details) => { onDataChange(next, details); setSystem(next); }} />;
    }
    render(<div style={{ position: 'relative', width: 1200, height: 600 }}><Controlled /></div>);
    await settle();
    const search = screen.getByRole('combobox', { name: 'Search Cloudflare’s services' }) as HTMLInputElement;
    await type(search, 'd1');
    const option = screen.getAllByRole('option').find((o) => o.getAttribute('data-kind') === 'd1');
    expect(option).toBeTruthy();
    fireEvent.click(option!);
    await settle();
    expect(onDataChange.mock.calls[0]?.[1].reason).toBe('add');
    expect((onDataChange.mock.calls[0]?.[0] as CloudflareSystem).services.map((s) => s.kind)).toEqual(['workers', 'r2', 'd1']);
    expect(search.value).toBe('');
    expect(panel().querySelector('[data-slot=cloudflare-description]')).toBeTruthy();
  });

  it('lists what’s wrong, with a way to each, and a connection the catalog says there isn’t is drawn as wrong', async () => {
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: [{ id: 'bad', from: 'files', to: 'api', via: 'r2_buckets' }] });
    await settle();
    const issue = panel().querySelector('[data-slot=cloudflare-issue][data-edge=bad]')!;
    expect(issue.getAttribute('data-severity')).toBe('error');
    expect(document.querySelector('[data-slot=diagram-edge][data-edge=bad]')?.getAttribute('data-kind')).toBe('problem');
    fireEvent.click(within(issue as HTMLElement).getByRole('button', { name: 'Show it' }));
    await settle();
    expect(panel().querySelector('[data-slot=cloudflare-edge-problem]')?.textContent).toBeTruthy();
  });
});
