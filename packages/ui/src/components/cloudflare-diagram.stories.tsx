import type { Meta, StoryObj } from '@storybook/react-vite';
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram';
import { SERVICE_PRODUCTS, type CloudflareEdge, type CloudflareService } from '@/lib/cloudflare-services';
import { Phone } from '../stories/frame';

const meta: Meta<typeof CloudflareDiagram> = {
  title: 'Organisms/CloudflareDiagram',
  component: CloudflareDiagram,
};
export default meta;
type Story = StoryObj<typeof CloudflareDiagram>;

const UPLOAD: CloudflareService[] = [
  { id: 'api', kind: 'workers', label: 'API' },
  { id: 'files', kind: 'r2', label: 'Files' },
  { id: 'db', kind: 'd1' },
  { id: 'jobs', kind: 'queues' },
  { id: 'consumer', kind: 'workers', label: 'Consumer' },
  { id: 'room', kind: 'durable-objects', label: 'Room' },
];
const UPLOAD_EDGES: CloudflareEdge[] = [
  { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
  { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
  { id: 'files-jobs', from: 'files', to: 'jobs', via: 'events', operations: ['object-create'] },
  { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer' },
  { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
  { id: 'consumer-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM' },
];

/** A system's services, with what each can call and receive as ports, and what each connection uses on it. No Cloudflare artwork. */
export const Services: Story = {
  render: () => <Phone w={1360} h={640}><CloudflareDiagram services={UPLOAD} edges={UPLOAD_EDGES} aria-label="A file upload" /></Phone>,
};

export const ServicesDark: Story = {
  render: () => <Phone w={1360} h={640} dark><CloudflareDiagram services={UPLOAD} edges={UPLOAD_EDGES} aria-label="A file upload" /></Phone>,
};

/** A connection, with what's on offer across it, from the types. */
export const AConnection: Story = {
  render: () => <Phone w={1360} h={640}><CloudflareDiagram services={UPLOAD} edges={UPLOAD_EDGES} defaultSelection={{ nodes: [], edges: ['api-files'] }} /></Phone>,
};

export const AService: Story = {
  render: () => <Phone w={1360} h={640}><CloudflareDiagram services={UPLOAD} edges={UPLOAD_EDGES} defaultSelection={{ nodes: ['api'], edges: [] }} /></Phone>,
};

/** Two buckets, and one of them bound twice, under names of their own. */
export const TwoOfTheSame: Story = {
  render: () => (
    <Phone w={1100} h={420}>
      <CloudflareDiagram
        services={[{ id: 'api', kind: 'workers' }, { id: 'a', kind: 'r2', label: 'Originals' }, { id: 'b', kind: 'r2', label: 'Thumbnails' }]}
        edges={[
          { id: 'one', from: 'api', to: 'a', via: 'r2_buckets', binding: 'ORIGINALS' },
          { id: 'two', from: 'api', to: 'b', via: 'r2_buckets', binding: 'THUMBNAILS' },
          { id: 'three', from: 'api', to: 'b', via: 'r2_buckets', binding: 'THUMBNAILS_RO', operations: ['get'] },
        ]}
      />
    </Phone>
  ),
};

/** What has no binding or handler can still be on the diagram: it just has no ports. So can a kind the catalog doesn't know. */
export const NothingToConnect: Story = {
  render: () => (
    <Phone w={900} h={360}>
      <CloudflareDiagram services={[{ id: 'dlp', kind: 'dlp' }, { id: 'turn', kind: 'realtime-turn' }, { id: 'rule', kind: 'firewall' }, { id: 'new', kind: 'not-yet-in-the-catalog' }]} defaultSelection={{ nodes: ['dlp'], edges: [] }} />
    </Phone>
  ),
};

/** Every service in the catalog, placed by ELK. */
export const EveryService: Story = {
  render: () => <Phone w={1360} h={800}><CloudflareDiagram services={SERVICE_PRODUCTS.map((p) => ({ id: p.id, kind: p.id }))} defaultPanelOpen={false} /></Phone>,
};

/** At a phone's size, the panel's a tray under the board. */
export const OnAPhone: Story = {
  render: () => <Phone w={390} h={760}><CloudflareDiagram services={UPLOAD.slice(0, 3)} edges={UPLOAD_EDGES.slice(0, 1)} direction="DOWN" defaultPanelOpen defaultSelection={{ nodes: [], edges: ['api-files'] }} /></Phone>,
};

/** With permission of your own, an app can draw its own icons. These are only letters. */
export const OwnIcons: Story = {
  render: () => <Phone w={900} h={360}><CloudflareDiagram services={UPLOAD.slice(0, 2)} edges={UPLOAD_EDGES.slice(0, 1)} icon={(p) => <span className="text-caption font-semibold">{p.name.slice(0, 2)}</span>} /></Phone>,
};
