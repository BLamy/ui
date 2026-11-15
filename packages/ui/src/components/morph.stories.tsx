import { useRef, useState } from 'react';
import { DialogContent } from '@ui-sdk/react/dialog';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { Morph, MorphGroup, MorphPresence } from '@/components/ui/morph';
import { NowPlayingBars } from '@/components/ui/now-playing-bars';
import { Slider } from '@/components/ui/slider';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { Phone } from '../stories/frame';

const meta: Meta<typeof MorphGroup> = {
  title: 'Molecules/Morph',
  component: MorphGroup,
};
export default meta;
type Story = StoryObj<typeof MorphGroup>;

const ART = 'linear-gradient(135deg,#ff7a59 0%,#ff3d7f 45%,#7b3dff 100%)';

/* The canonical composition (as on the docs page): the full player is a Dialog's content rendered as a Morph, so
   the Dialog moves focus in, closes on Escape and returns focus to the bar; Morph adds the morph and drag-to-dismiss.
   The transport controls are real, named buttons. */
function Player({ initial = false, dark }: { initial?: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(initial);
  const [playing, setPlaying] = useState(true);
  const bar = useRef<HTMLElement>(null);
  const transport = 'text-white hover:not-data-disabled:bg-white/15 hover:not-data-disabled:text-white';
  return (
    <Phone w={390} h={700} dark={dark}>
      <div className="absolute inset-0 overflow-hidden [contain:layout]" data-layer-host="">
        <div className="absolute inset-0 bg-background p-5 text-foreground">
          <div className="text-[30px] font-bold tracking-[-.4px]">Listen Now</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-xl bg-secondary" />)}
          </div>
        </div>
        <MorphGroup>
          <MorphPresence>
            {open ? null : (
              <Morph key="mini" ref={bar} layoutId="player" radius={14} render={<button type="button" />} onClick={() => setOpen(true)} aria-label="Open Now Playing"
                className="absolute right-3 bottom-3 left-3 z-10 flex h-16 cursor-pointer items-center gap-3 overflow-hidden border-0 text-start [font:inherit] bg-bar pr-4 pl-2 text-foreground shadow-[0_6px_24px_rgba(0,0,0,.16),0_0_0_.5px_var(--border)] backdrop-blur-xl">
                <Morph layoutId="art" radius={8} className="size-12 shrink-0" style={{ background: ART }} />
                <Morph layoutId="title" layout="position" className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">Golden Hour</div>
                  <div className="truncate text-[13px] text-muted-foreground">The Weekend Ensemble</div>
                </Morph>
                <NowPlayingBars playing={playing} className="text-primary" />
              </Morph>
            )}
          </MorphPresence>
          <Dialog open={open} onOpenChange={setOpen} presentation="dialog">
            <DialogContent
              render={<Morph layoutId="player" radius={0} dragToDismiss onDismiss={() => setOpen(false)} />}
              finalFocus={() => bar.current}
              className="absolute inset-0 z-10 flex flex-col overflow-hidden px-7 pt-3 pb-8 text-white outline-none"
              style={{ background: 'linear-gradient(180deg,#5a2748,#1e1030)' }}
            >
              <DialogTitle className="sr-only">Now Playing</DialogTitle>
              <button type="button" aria-label="Close Now Playing" onClick={() => setOpen(false)}
                className="bl-btn mx-auto mb-6 h-5 w-14 cursor-pointer border-0 bg-transparent p-0">
                <span className="mx-auto block h-[5px] w-10 rounded-full bg-white/40" />
              </button>
              <Morph layoutId="art" radius={14} className="aspect-square w-full shadow-[0_18px_50px_rgba(0,0,0,.35)]" style={{ background: ART }} />
              <Morph layoutId="title" layout="position" className="mt-8">
                <div className="text-[21px] font-semibold">Golden Hour</div>
                <div className="text-[17px] text-white/60">The Weekend Ensemble</div>
              </Morph>
              <Morph layoutId="controls-full" fade className="mt-6 flex flex-col gap-6">
                <Slider aria-label="Position" data-no-drag variant="overlay" appearance="dark" size="sm" defaultValue={32} />
                <div data-no-drag className="flex items-center justify-center gap-8">
                  <Button variant="ghost" size="icon-lg" aria-label="Previous" className={transport}><Icon name="backward" size={30} /></Button>
                  <Button variant="ghost" size="icon" aria-label={playing ? 'Pause' : 'Play'} className={cn(transport, 'size-14')} onClick={() => setPlaying(!playing)}>
                    <Icon name={playing ? 'pause' : 'play'} size={40} />
                  </Button>
                  <Button variant="ghost" size="icon-lg" aria-label="Next" className={transport}><Icon name="forward" size={30} /></Button>
                </div>
              </Morph>
            </DialogContent>
          </Dialog>
        </MorphGroup>
      </div>
    </Phone>
  );
}

/** Tap the mini player: the bar grows into the full player and the artwork flies to its slot. Drag the full player
    down (or tap the grabber) and it folds back. */
export const MiniToFull: Story = { render: () => <Player /> };

/** The expanded state (for review). */
export const Expanded: Story = { render: () => <Player initial /> };

export const Dark: Story = { render: () => <Player dark /> };

function Cards() {
  const [sel, setSel] = useState<number | null>(null);
  const colors = ['#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2'];
  return (
    <Phone w={390} h={520}>
      <MorphGroup spring="tray">
        <div className="absolute inset-0 grid grid-cols-2 content-start gap-3 bg-background p-5">
          {colors.map((c, i) => (sel === i ? <div key={i} className="aspect-square" /> : (
            <Morph key={i} layoutId={`card-${i}`} radius={18} render={<button type="button" />} onClick={() => setSel(i)} aria-label={`Open card ${i + 1}`}
              className="bl-btn aspect-square cursor-pointer border-0" style={{ background: c }} />
          )))}
        </div>
        {sel != null ? (
          <Morph layoutId={`card-${sel}`} radius={28} dragToDismiss onDismiss={() => setSel(null)}
            className="absolute inset-x-4 top-16 bottom-16 z-10 flex items-end p-6 text-[24px] font-bold text-white" style={{ background: colors[sel] }}>
            <button type="button" onClick={() => setSel(null)} className="bl-btn cursor-pointer border-0 bg-white/25 px-4 py-2 text-[15px] font-semibold text-white" style={{ borderRadius: 99 }}>
              Close
            </button>
          </Morph>
        ) : null}
      </MorphGroup>
    </Phone>
  );
}

/** A grid of cards; each opens into a sheet and closes back into its cell. */
export const CardToSheet: Story = { render: () => <Cards /> };
