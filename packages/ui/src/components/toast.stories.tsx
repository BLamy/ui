import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toaster, createToastQueue, useToast, type ToastQueue, type ToasterPlacement } from './toast';
import { Button } from './button';
import { Phone } from '../stories/frame';

const meta: Meta<typeof Toaster> = {
  title: 'Molecules/Toast',
  component: Toaster,
};
export default meta;
type Story = StoryObj<typeof Toaster>;

/** A frame with its own queue and an inline Toaster; `seed` shows toasts on mount (no timeout, for screenshots). */
function Frame({ dark, placement = 'bottom', seed, children, h = 420 }: {
  dark?: boolean; placement?: ToasterPlacement; seed?: (q: ToastQueue) => void; children?: ReactNode; h?: number;
}) {
  const [queue] = useState(() => createToastQueue());
  useEffect(() => { seed?.(queue); return () => queue.dismiss(); }, [queue, seed]);
  return (
    <Phone dark={dark} w={420} h={h}>
      <Toaster queue={queue} placement={placement} inline>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-foreground">{children}</div>
      </Toaster>
    </Phone>
  );
}

const hudSeed = (q: ToastQueue) => { q.show({ id: 'hud', variant: 'hud', title: 'Password Copied', tone: 'success' }, { timeout: 0, haptic: 'none' }); };

/** The "Copied" pill. */
export const Hud: Story = { render: () => <Frame seed={hudSeed} /> };

const bannerSeed = (q: ToastQueue) => {
  q.show({ id: 'a', title: 'Uploading 3 photos…', loading: true }, { timeout: 0 });
  q.show({ id: 'b', title: 'Note moved to Trash', action: { label: 'Undo', onAction: () => {} } }, { timeout: 0 });
  q.show({ id: 'c', title: 'Backup complete', description: 'Your iPhone was backed up to iCloud at 9:41.', tone: 'success' }, { timeout: 0, haptic: 'none' });
};

/** Banners stack newest-first nearest the edge; each can carry a description and one action. */
export const Banners: Story = { render: () => <Frame placement="top" seed={bannerSeed} h={460} /> };

export const Dark: Story = {
  render: () => (
    <div className="flex gap-4">
      <Frame dark seed={hudSeed} h={300} />
      <Frame dark placement="top" seed={bannerSeed} h={460} />
    </div>
  ),
};

function Controls() {
  const t = useToast();
  const [n, setN] = useState(0);
  const copies = ['Password Copied', 'User Name Copied', 'Code Copied', 'Website Copied'];
  return (
    <>
      <Button onPress={() => { t.hud(copies[n % copies.length], { tone: 'success' }); setN(n + 1); }}>Copy something</Button>
      <Button variant="secondary" onPress={() => t('Message sent', { description: 'Delivered to Amelia.', icon: 'paperplane' })}>Banner</Button>
      <Button variant="secondary" onPress={() => {
        const id = t.loading('Uploading…');
        setTimeout(() => t.update(id, { title: 'Uploaded', tone: 'success', description: '12 MB in 2 files' }), 1500);
      }}>Loading → done</Button>
      <Button variant="secondary" onPress={() => t.error('Couldn’t connect', { description: 'Check your connection and try again.', action: { label: 'Retry', onAction: () => {} } })}>Error</Button>
      <p className="m-0 max-w-[300px] text-center text-[13px] text-muted-foreground">
        Copy repeatedly: the HUD stays and its label morphs. Swipe a banner sideways to dismiss it; hovering pauses the timers.
      </p>
    </>
  );
}

/** Press the buttons. */
export const Playground: Story = { render: () => <Frame placement="bottom"><Controls /></Frame> };
