import { useMemo, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CloudflareDiagram, cloudflareBoardProps } from '@/components/ui/cloudflare-diagram';
import { Diagram, DiagramToolbar } from '@/components/ui/diagram';
import { placeInLayers } from '@/lib/cloudflare-board';
import { SERVICE_PRODUCTS, type CloudflareEdge, type CloudflareService } from '@/lib/cloudflare-services';
import { readWorkerdConfig } from '@/lib/cloudflare-workerd';
import { BLProvider, type AppearancePreference } from '@/lib/theme';
import { PLATFORM, PLATFORM_EDGES, SMALL, SMALL_EDGES, UPLOAD, UPLOAD_EDGES, WORKERD_CONFIG } from '../stories/cloudflare-systems';

const meta: Meta<typeof CloudflareDiagram> = {
  title: 'Organisms/CloudflareDiagram',
  component: CloudflareDiagram,
  parameters: { layout: 'fullscreen' },
  args: { editable: false, direction: 'down' },
  argTypes: {
    editable: { control: 'boolean' },
    direction: { control: 'inline-radio', options: ['down', 'right', 'up', 'left'] },
    panelPresentation: { control: 'select', options: ['auto', 'column', 'drawer', 'push'] },
  },
};
export default meta;
type Story = StoryObj<typeof CloudflareDiagram>;

/** The story's whole canvas, as an app's page would have it (`layout: 'fullscreen'`), or a phone's or a tablet's width of it. */
function Page({ children, appearance, w }: { children?: ReactNode; appearance?: AppearancePreference; w?: number }) {
  return (
    <div style={{ position: 'relative', width: w ?? '100%', height: '100dvh', overflow: 'hidden' }}>
      <BLProvider appearance={appearance}>{children}</BLProvider>
    </div>
  );
}

/** A small system: a Worker on a route (where requests come in, so it has the entry marker), its KV namespace and its D1
 *  database. Each binding's label is its name on env, then the operations it uses. */
export const Small: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={SMALL} edges={SMALL_EDGES} title="Link shortener" defaultPanelOpen={false} aria-label="A link shortener" /></Page>,
};

/** The upload pipeline: API → R2 → (an event notification) → Queue → consumer → D1, and the consumer's own Durable Object class,
 *  Room, inside it, with a machine. Read-only, the default: a picture to inspect. */
export const ReadOnly: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} title="File upload" aria-label="A file upload" /></Page>,
};

/** A larger one: two environments, a service binding to an entrypoint, a cron trigger, a custom domain, a consumer with a
 *  dead-letter queue, Workers AI (the account's, in no environment) and a Vectorize index. */
export const Larger: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={PLATFORM} edges={PLATFORM_EDGES} title="Docs search" accountId="4f1b9c2e7a" defaultPanelOpen={false} aria-label="Docs search, in production and staging" /></Page>,
};

/** Editing, uncontrolled: each card has dots to connect by, at either end of its header and on its handler rows. Search the catalog to add a service,
 *  drag from `env` to connect, change a connection in the panel, undo and redo. */
export const Editing: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} title="File upload" aria-label="A file upload" /></Page>,
};

export const Dark: Story = {
  render: (args) => <Page appearance="dark"><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} title="File upload" defaultSelection={{ nodes: [], edges: ['api-files'] }} aria-label="A file upload" /></Page>,
};

export const LargerDark: Story = {
  render: (args) => <Page appearance="dark"><CloudflareDiagram {...args} services={PLATFORM} edges={PLATFORM_EDGES} title="Docs search" accountId="4f1b9c2e7a" defaultPanelOpen={false} aria-label="Docs search, in production and staging" /></Page>,
};

/** At a tablet's size the panel is a drawer over the board that doesn't dim it, so the board stays in sight. */
export const Tablet: Story = {
  args: { editable: true },
  render: (args) => <Page w={640}><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultPanelOpen defaultSelection={{ nodes: [], edges: ['api-files'] }} aria-label="A file upload" /></Page>,
};

/** The board half as a Diagram preset: a plain `<Diagram {...cloudflareBoardProps(system)} />`, with no frame or panel. With
 *  no places of their own, the services are placed top to bottom by `placeInLayers`, with no layout engine. */
export const OnAPlainDiagram: Story = {
  render: function Render() {
    const board = useMemo(() => cloudflareBoardProps({ name: 'File upload', services: UPLOAD, edges: UPLOAD_EDGES }), []);
    return <Page><Diagram {...board} aria-label="A file upload" overlay={<DiagramToolbar side="top" />} /></Page>;
  },
};

/** Nothing in it yet: the empty state says how to start, and the panel has the search. */
export const Empty: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={[]} aria-label="A new system" /></Page>,
};

export const EmptyReadOnly: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={[]} aria-label="A system with nothing in it" /></Page>,
};

/** Every service in the catalog, placed by ELK, with what isn't connected packed in rows. */
export const Large: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={SERVICE_PRODUCTS.map((p) => ({ id: p.id, kind: p.id }))} defaultPanelOpen={false} aria-label="Every service in the catalog" /></Page>,
};

/** A connection the catalog says there isn't (R2 can't bind D1): it's drawn as wrong, and selected, the panel says why. Dragging one
 *  on the board is refused with the same reason, before it's made. */
export const RefusedConnection: Story = {
  args: { editable: true },
  render: (args) => (
    <Page>
      <CloudflareDiagram
        {...args}
        defaultServices={[UPLOAD[0] as CloudflareService, UPLOAD[1] as CloudflareService, { id: 'db', kind: 'd1', label: 'Uploads' }]}
        defaultEdges={[UPLOAD_EDGES[0] as CloudflareEdge, { id: 'not-real', from: 'files', to: 'db', via: 'd1_databases', binding: 'DB' }]}
        defaultSelection={{ nodes: [], edges: ['not-real'] }}
      />
    </Page>
  ),
};

/** What's wrong with a system, listed with a way to each: an event nothing receives, a connection to a service that's gone, one
 *  that isn't real, a name used twice, a schedule that isn't one, and a kind that's not in the catalog. */
export const Notes: Story = {
  args: { editable: true },
  render: (args) => (
    <Page>
      <CloudflareDiagram
        {...args}
        defaultServices={[{ ...(UPLOAD[0] as CloudflareService), triggers: [{ kind: 'cron', schedule: 'hourly' }] }, UPLOAD[1] as CloudflareService, { ...(UPLOAD[4] as CloudflareService), host: undefined }, { id: 'other', kind: 'not-in-the-catalog' }]}
        defaultEdges={[
          { id: 'join', from: 'api', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['NOT_RECEIVED'] },
          { id: 'gone', from: 'api', to: 'deleted', via: 'queues', binding: 'JOBS', events: ['WORK'] },
          { id: 'not-real', from: 'files', to: 'room', via: 'r2_buckets' },
          UPLOAD_EDGES[0] as CloudflareEdge,
          { id: 'twice', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES' },
        ]}
      />
    </Page>
  ),
};

/** A service's machine opens in a StateDiagram, over the board, with one history for both. On the board, its card's Machine
 *  chip opens it too. */
export const ItsMachine: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultOpenMachine="room" /></Page>,
};

/** At a phone's size the board is the page, top to bottom, and the panel is a page pushed over it, opened from the bar. */
export const OnAPhone: Story = {
  render: (args) => <Page w={390}><CloudflareDiagram {...args} services={SMALL} edges={SMALL_EDGES} title="Link shortener" aria-label="A link shortener" /></Page>,
};

export const OnAPhoneEditing: Story = {
  args: { editable: true },
  render: (args) => <Page w={390}><CloudflareDiagram {...args} defaultServices={UPLOAD.slice(0, 3)} defaultEdges={UPLOAD_EDGES.slice(0, 2)} defaultSelection={{ nodes: [], edges: ['api-files'] }} /></Page>,
};

export const OnAPhoneWithItsPanel: Story = {
  render: (args) => <Page w={390}><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} defaultPanelOpen defaultSelection={{ nodes: ['room'], edges: [] }} /></Page>,
};

/** With permission of your own, an app can draw its own icons, in the header's glyph's place. These are only letters. */
export const OwnIcons: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={SMALL} edges={SMALL_EDGES} icon={(p) => <span className="text-caption2 font-semibold">{p.name.slice(0, 2)}</span>} /></Page>,
};

const WORKERD = readWorkerdConfig(WORKERD_CONFIG);

/** A workerd config.capnp, read by `readWorkerdConfig` and placed by `placeInLayers`: drawn read-only, at once, with no ELK. Its
 *  socket is where requests come in, and Room is inside the Worker whose class it is. This is what docstream's capnp fence draws. */
export const AWorkerdConfig: Story = {
  render: (args) => {
    const system = WORKERD.ok ? placeInLayers(WORKERD.system) : { services: [], edges: [] };
    return <Page><CloudflareDiagram {...args} services={system.services} edges={system.edges} title="config.capnp" defaultPanelOpen={false} aria-label="config.capnp, as Cloudflare services" /></Page>;
  },
};
