import { useRef, useState } from 'react'
import { DialogContent } from '@ui-sdk/react/dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Morph, MorphGroup, MorphPresence } from '@/components/ui/morph'
import { NowPlayingBars } from '@/components/ui/now-playing-bars'
import { Slider } from '@/components/ui/slider'
import { Icon } from '@/lib/icon'

const transport = 'text-white hover:not-data-disabled:bg-white/15 hover:not-data-disabled:text-white'
const art = 'bg-[linear-gradient(135deg,#ff7a59_0%,#ff3d7f_45%,#7b3dff_100%)]'

// One player, two layouts. The mini bar and the full player are both
// <Morph layoutId="player"> (the artwork and the title inside have their own
// layoutIds), so opening springs the same element from the bar's frame to the
// whole frame. The full player is a Dialog's content (`render={<Morph … />}`):
// the Dialog moves focus in, closes on Escape and returns focus to the bar; Morph
// adds the morph and drag-to-dismiss.
export default function MiniPlayer() {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(true)
  const bar = useRef<HTMLElement>(null)
  return (
    <div className="relative mx-auto h-[560px] max-w-[380px] overflow-hidden rounded-sheet bg-background shadow-hairline [contain:layout]" data-layer-host="">
      <div className="p-5">
        <div className="text-[28px] font-bold tracking-tight text-foreground">Listen Now</div>
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-card bg-secondary" />
          ))}
        </div>
      </div>
      <MorphGroup>
        <MorphPresence>
          {open ? null : (
            <Morph
              key="mini"
              ref={bar}
              layoutId="player"
              radius={14}
              render={<button type="button" />}
              onClick={() => setOpen(true)}
              aria-label="Open Now Playing"
              className="absolute inset-x-2.5 bottom-2.5 z-2 flex h-16 cursor-pointer items-center gap-3 border-0 bg-bar py-0 pr-4 pl-2 text-start text-foreground shadow-hairline backdrop-blur-xl [font:inherit]"
            >
              <Morph layoutId="art" radius={8} className={`size-12 shrink-0 ${art}`} />
              <Morph layoutId="title" layout="position" className="min-w-0 flex-1">
                <div className="text-subhead font-medium">Golden Hour</div>
                <div className="text-footnote text-muted-foreground">The Weekend Ensemble</div>
              </Morph>
              <NowPlayingBars playing={playing} className="text-primary" />
            </Morph>
          )}
        </MorphPresence>
        <Dialog open={open} onOpenChange={setOpen} presentation="dialog">
          <DialogContent
            render={<Morph layoutId="player" radius={22} dragToDismiss onDismiss={() => setOpen(false)} />}
            finalFocus={() => bar.current}
            className="absolute inset-0 z-2 flex flex-col overflow-hidden bg-[linear-gradient(180deg,#5a2748,#1e1030)] px-6.5 pt-2.5 pb-6.5 text-white outline-none"
          >
            <DialogTitle className="sr-only">Now Playing</DialogTitle>
            <button
              type="button"
              aria-label="Close Now Playing"
              onClick={() => setOpen(false)}
              className="mx-auto mb-3.5 h-5 w-14 cursor-pointer border-0 bg-transparent p-0"
            >
              <span className="mx-auto block h-[5px] w-10 rounded-full bg-white/40" />
            </button>
            <Morph layoutId="art" radius={14} className={`aspect-square w-full shadow-xl ${art}`} />
            <Morph layoutId="title" layout="position" className="mt-6">
              <div className="text-title font-semibold">Golden Hour</div>
              <div className="text-callout text-white/60">The Weekend Ensemble</div>
            </Morph>
            <Morph layoutId="controls" fade className="mt-4.5 grid gap-4">
              <Slider aria-label="Position" data-no-drag variant="overlay" appearance="dark" size="sm" defaultValue={32} />
              <div data-no-drag className="flex items-center justify-center gap-8">
                <Button variant="ghost" size="icon-lg" aria-label="Previous" className={transport}>
                  <Icon name="backward" size={30} />
                </Button>
                <Button variant="ghost" size="icon" aria-label={playing ? 'Pause' : 'Play'} className={`${transport} size-14`} onClick={() => setPlaying(!playing)}>
                  <Icon name={playing ? 'pause' : 'play'} size={40} />
                </Button>
                <Button variant="ghost" size="icon-lg" aria-label="Next" className={transport}>
                  <Icon name="forward" size={30} />
                </Button>
              </div>
            </Morph>
          </DialogContent>
        </Dialog>
      </MorphGroup>
    </div>
  )
}
