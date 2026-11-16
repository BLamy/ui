import type { Meta, StoryObj } from '@storybook/react-vite';
import { replayDemoEvents } from '@brett_lamy/ui/docstream/replay/demo';
import { ReplayPreview, type ReplayMarker } from '@/components/ui/replay-preview';
import { Panel } from '../stories/primitive-frame';
import { Phone } from '../stories/frame';

const meta: Meta<typeof ReplayPreview> = {
  title: 'Organisms/ReplayPreview',
  component: ReplayPreview,
  decorators: [
    (Story, ctx) =>
      ctx.parameters.phone ? (
        <Phone appearance={ctx.parameters.dark ? 'dark' : 'light'}>
          <div className="absolute inset-0 p-3"><Story /></div>
        </Phone>
      ) : (
        <Panel w={800} dark={ctx.parameters.dark}><Story /></Panel>
      ),
  ],
};
export default meta;
type Story = StoryObj<typeof ReplayPreview>;

/* The bundled demo recording (docstream's, 58 events): a shopper whose checkout fails with a promo code. Paused at a fixed
   time, so each story is a still frame. `mounted` mounts the player at once instead of when it nears the viewport. */
const paused = { events: replayDemoEvents, mounted: true } as const;

/** The browser frame, paused just before checkout fails. */
export const Default: Story = { args: { ...paused, initialTime: 6400 } };

export const Dark: Story = { args: { ...paused, initialTime: 6400 }, parameters: { dark: true } };

/** The recording's own moments on a rail above the seek bar: clicks, the failed request, the error, navigations. */
export const Markers: Story = { args: { ...paused, initialTime: 6400, markers: true } };

const findings: ReplayMarker[] = [
  { id: 'finding-1', time: 2250, kind: 'custom', label: 'Promo field accepts any text' },
  { id: 'finding-2', time: 8400, kind: 'error', label: 'Checkout throws on a promo code' },
];

/** Your own markers (an agent's findings), with a fixed URL and no window buttons. */
export const CustomMarkers: Story = { args: { ...paused, initialTime: 8400, markers: findings, url: 'https://shop.example/checkout', trafficLights: false } };

/** The DevTools panel open on the Network tab, cut at the playhead. */
export const DevtoolsOpen: Story = { args: { ...paused, initialTime: 8600, defaultDevtoolsTab: 'network' } };

/** `chrome="minimal"`: a card, no browser frame. */
export const Minimal: Story = { args: { ...paused, initialTime: 6400, chrome: 'minimal' } };

/** Before the player mounts (`mounted={false}`): the same frame with the page-shaped skeleton at the recording's
 *  aspect ratio. */
export const Poster: Story = { args: { events: replayDemoEvents, mounted: false } };

/** DevTools open in the dark: the panel's bars and rows are opaque, so the page doesn't show through. */
export const DevtoolsDark: Story = { args: { ...paused, initialTime: 8600, defaultDevtoolsTab: 'network' }, parameters: { dark: true } };

export const PhoneFrame: Story = { args: { ...paused, initialTime: 6400 }, parameters: { phone: true } };
