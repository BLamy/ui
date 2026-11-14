import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToastRegion, createHud, createToaster, type Hud as HudQueue, type ToastRegionProps } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Phone } from '../stories/frame';

const meta: Meta<typeof ToastRegion> = {
  title: 'Molecules/Toast',
  component: ToastRegion,
};
export default meta;
type Story = StoryObj<typeof ToastRegion>;

type Queue = ReturnType<typeof createToaster>;
interface Queues { toast: Queue; hud: HudQueue }

/** A phone frame with queues of its own and a region for each; `seed` shows toasts on mount (they stay, for screenshots). */
function Frame({ dark, side = 'bottom', expanded, seed, children, h = 420 }: {
  dark?: boolean; side?: ToastRegionProps['side']; expanded?: boolean; seed?: (queues: Queues) => void;
  children?: (queues: Queues) => ReactNode; h?: number;
}) {
  const [queues] = useState<Queues>(() => ({ toast: createToaster(), hud: createHud() }));
  useEffect(() => {
    seed?.(queues);
    return () => { queues.toast.dismiss(); queues.hud.toaster.dismiss(); };
  }, [queues, seed]);
  return (
    <Phone dark={dark} w={420} h={h}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-foreground">{children?.(queues)}</div>
      <ToastRegion toaster={queues.toast} side={side} expanded={expanded} />
      <ToastRegion variant="hud" toaster={queues.hud.toaster} />
    </Phone>
  );
}

const hudSeed = ({ hud }: Queues) => { hud('Password Copied', { type: 'success', duration: Infinity }); };

/** The "Copied" pill. */
export const Hud: Story = { render: () => <Frame seed={hudSeed} /> };

const bannerSeed = ({ toast }: Queues) => {
  toast.loading('Uploading 3 photos…', { id: 'a' });
  toast('Note moved to Trash', { id: 'b', duration: Infinity, action: { label: 'Undo', onAction: () => {} } });
  toast.success('Backup complete', { id: 'c', duration: Infinity, description: 'Your iPhone was backed up to iCloud at 9:41.' });
};

/** Banners pile up newest-first at the edge, the older ones peeking out behind; hover or focus spreads them. */
export const Banners: Story = { render: () => <Frame side="top" seed={bannerSeed} h={460} /> };

/** From the bottom edge the pile grows upward. */
export const BannersBottom: Story = { render: () => <Frame side="bottom" seed={bannerSeed} h={460} /> };

/** `expanded` keeps the list spread out, with no pile. */
export const Spread: Story = { render: () => <Frame side="top" expanded seed={bannerSeed} h={460} /> };

export const Dark: Story = {
  render: () => (
    <div className="flex gap-4">
      <Frame dark seed={hudSeed} h={300} />
      <Frame dark side="top" seed={bannerSeed} h={460} />
    </div>
  ),
};

function Controls({ toast, hud }: Queues) {
  const [n, setN] = useState(0);
  const copies = ['Password Copied', 'User Name Copied', 'Code Copied', 'Website Copied'];
  const upload = () => new Promise<string>((resolve) => { setTimeout(() => resolve('12 MB in 2 files'), 1500); });
  return (
    <>
      <Button onClick={() => { hud(copies[n % copies.length], { type: 'success' }); setN(n + 1); }}>Copy something</Button>
      <Button variant="secondary" onClick={() => toast('Message sent', { description: 'Delivered to Amelia.', data: { icon: 'paperplane' } })}>Banner</Button>
      <Button variant="secondary" onClick={() => {
        toast.promise(upload, { loading: 'Uploading…', success: (size: string) => ({ title: 'Uploaded', description: size }), error: 'Couldn’t upload' });
      }}>Loading → done</Button>
      <Button variant="secondary" onClick={() => toast.error('Couldn’t connect', { description: 'Check your connection and try again.', action: { label: 'Retry', onAction: () => {} } })}>Error</Button>
      <p className="m-0 max-w-[300px] text-center text-footnote text-muted-foreground">
        Copy repeatedly: the HUD stays and its label morphs. Swipe a banner toward the edge to dismiss it; hovering pauses the timers.
      </p>
    </>
  );
}

/** Press the buttons. */
export const Playground: Story = { render: () => <Frame side="bottom">{(queues) => <Controls {...queues} />}</Frame> };
