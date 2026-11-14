/* The player: the mini bar and the full Now Playing screen are two layouts of ONE element (`<Morph layoutId="player">`),
   and the artwork inside is one element too (`<Morph layoutId="art">`). Tap the bar and it springs open to the whole
   block while the cover flies from the thumbnail to its slot; the mini row fades out, the full controls fade in
   and the album's colors wash in. Drag the full player down (or press Esc) and it folds back into the bar.
   Render <MiniPlayer> where the bar belongs and <FullPlayer> inside a controlled <Dialog> over the block, all inside
   one <MorphGroup>. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DialogTitle } from '@/components/ui/dialog';
import { Swap } from '@/components/ui/swap';
import { Morph } from '@/components/ui/morph';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle';
import { Slider } from '@/components/ui/slider';
import { Icon, type IconName } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { DialogContent } from '@ui-sdk/react/dialog';
import { Artwork } from './artwork';
import { fmt, lyricsFor, type Album } from './data';
import type { Player } from './player';

type Panel = 'none' | 'lyrics' | 'queue';

/** The bar above the tab bar (phone) or floating over the detail column (wide). Position it with `className`. */
export function MiniPlayer({ player: p, phone, onOpen, className, style }: {
  player: Player; phone: boolean; onOpen: () => void; className?: string; style?: CSSProperties;
}) {
  const art = phone ? 40 : 48;
  return (
    <Morph layoutId="player" radius={14}
      className={cn('absolute z-[300] flex items-center gap-3 overflow-hidden bg-bar pr-2 pl-2 text-foreground backdrop-blur-[24px] backdrop-saturate-[1.8] shadow-[0_6px_24px_black] ring-[.5px] shadow-black/16 ring-border', phone ? 'h-14' : 'h-16', className)} style={style}>
      <SdkButton data-now-playing-open="" aria-label={`Open Now Playing: ${p.current.track.title}`} onClick={() => onOpen()}
        className="bl-btn absolute inset-0 cursor-pointer border-0 bg-transparent" />
      <Morph layoutId="art" radius={7} className="pointer-events-none shrink-0 overflow-hidden" style={{ width: art, height: art }}>
        <Artwork album={p.current.album} rounded={0} className="size-full" />
      </Morph>
      <Morph layoutId="mini-row" fade layout="position" className="pointer-events-none flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-subhead font-medium leading-tight">{p.current.track.title}</div>
          <div className="truncate text-footnote text-muted-foreground">{p.current.album.artist}</div>
        </div>
        <RoundButton label={p.playing ? 'Pause' : 'Play'} onClick={p.toggle} className="pointer-events-auto size-10 text-foreground">
          <Swap effect="pop" value={p.playing ? 'pause' : 'play'}><Icon name={p.playing ? 'pause' : 'play'} size={22} /></Swap>
        </RoundButton>
        <RoundButton label="Next" onClick={p.next} className="pointer-events-auto size-10 text-foreground"><Icon name="forward" size={24} /></RoundButton>
      </Morph>
    </Morph>
  );
}

/** The album's colors, washed dark enough for white text: a 20% black veil over two radial glows of the artwork's
    colors on its accent mixed into near-black (fixed, like the artwork itself). */
const WASH_VEIL = 'rgba(0,0,0,.2)';
const WASH_BASE = '#0b0b10';
const wash = (a: Album) =>
  `linear-gradient(${WASH_VEIL}, ${WASH_VEIL}), radial-gradient(120% 80% at 15% 0%, color-mix(in oklab, ${a.colors[1]} 80%, black), transparent 70%), radial-gradient(100% 70% at 90% 100%, color-mix(in oklab, ${a.colors[2]} 75%, black), transparent 70%), color-mix(in oklab, ${a.colors[2]} 50%, ${WASH_BASE})`;

/** The full player: a Dialog's content (render it inside a `<Dialog open>`), so the Dialog owns focus, Esc and the
    inert app behind, while the content itself is the `<Morph layoutId="player">` that grows out of the mini bar. */
export function FullPlayer({ player: p, phone, height, onClose, finalFocus }: {
  player: Player; phone: boolean; height: number; onClose: () => void;
  /** Where focus goes when it closes (the mini player's button, which mounts again as this leaves). */
  finalFocus?: () => HTMLElement | null;
}) {
  const [panel, setPanel] = useState<Panel>('none');
  const togglePanel = (k: Panel) => setPanel(panel === k ? 'none' : k);
  const compact = panel !== 'none';

  // The cover: one element for both layouts. It rests a little smaller while paused, as on iOS.
  const art = (className: string, style?: CSSProperties) => (
    <div className={cn('transition-[scale] duration-spring-smooth ease-spring-smooth', !compact && !p.playing && 'scale-[.86]', className)} style={style}>
      <Morph layoutId="art" radius={compact ? 6 : 12} className="size-full overflow-hidden shadow-[0_18px_50px_black] shadow-black/35">
        <Artwork album={p.current.album} rounded={0} className="size-full" />
      </Morph>
    </div>
  );
  const header = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[19px] font-semibold">{p.current.track.title}</div>
        <div className="truncate text-body text-white/60">{p.current.album.artist} — {p.current.album.title}</div>
      </div>
      <RoundButton label="Love" className="size-8 bg-white/15 text-white"><Icon name="heart" size={17} weight="medium" /></RoundButton>
      <RoundButton label="More" className="size-8 bg-white/15 text-white"><Icon name="ellipsis" size={17} /></RoundButton>
    </div>
  );
  const controls = (
    <Morph layoutId="np-controls" fade className="flex shrink-0 flex-col gap-5">
      <Scrubber p={p} />
      <Transport p={p} />
      <div className="flex items-center gap-2 text-white/55">
        <Icon name="speaker-low-fill" size={16} />
        <Slider aria-label="Volume" tone="onDark" size="sm" value={p.volume} onValueChange={p.setVolume} className="flex-1" />
        <Icon name="speaker-high-fill" size={18} />
      </div>
      <div className="flex items-center justify-around px-6">
        <ToggleButton label="Lyrics" icon="quote-bubble" on={panel === 'lyrics'} onClick={() => togglePanel('lyrics')} />
        <ToggleButton label="AirPlay" icon="airplay" on={false} />
        <ToggleButton label="Playing Next" icon="queue" on={panel === 'queue'} onClick={() => togglePanel('queue')} />
      </div>
    </Morph>
  );
  const side = panel === 'lyrics' ? <Lyrics p={p} /> : panel === 'queue' ? <Queue p={p} /> : null;

  return (
    <DialogContent render={<Morph layoutId="player" radius={0} dragToDismiss onDismiss={onClose} />} finalFocus={finalFocus}
      className={cn(
        'absolute inset-0 flex flex-col overflow-hidden text-white shadow-[0_-10px_40px_black] shadow-black/30 outline-none',
        // Leaving, it fades while the mini bar morphs out of its frame.
        'data-ending-style:opacity-0 data-ending-style:transition-opacity data-ending-style:duration-exit data-ending-style:ease-exit',
        phone ? 'px-7 pt-2.5 pb-6' : 'px-5 pt-4',
      )}
      style={{ background: wash(p.current.album) }}>
      <DialogTitle className="sr-only">Now Playing</DialogTitle>
      {phone ? (
        <>
          <Morph layoutId="np-grabber" fade render={<button type="button" />} aria-label="Close Now Playing" onClick={onClose}
            className="bl-btn mx-auto mb-4 h-5 w-14 shrink-0 cursor-pointer border-0 bg-transparent p-0">
            <span className="mx-auto block h-[5px] w-10 rounded-full bg-white/35" />
          </Morph>
          {compact ? (
            <>
              <div className="flex shrink-0 items-center gap-3">
                {art('size-16 shrink-0')}
                <Morph layoutId="np-title-small" fade className="min-w-0 flex-1">
                  <div className="truncate text-callout font-semibold">{p.current.track.title}</div>
                  <div className="truncate text-subhead text-white/60">{p.current.album.artist}</div>
                </Morph>
                <RoundButton label="More" className="size-8 bg-white/15 text-white"><Icon name="ellipsis" size={17} /></RoundButton>
              </div>
              <div className="relative -mx-7 my-3 min-h-0 flex-1">{side}</div>
            </>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 items-center justify-center">{art('aspect-square w-full max-w-[340px] max-h-full')}</div>
              <Morph layoutId="np-header" fade className="mt-6 mb-4 shrink-0">{header}</Morph>
            </>
          )}
          {controls}
        </>
      ) : (
        <>
          <Morph layoutId="np-close" fade className="flex shrink-0 justify-end">
            <RoundButton label="Close Now Playing" onClick={onClose} className="size-9 bg-white/15 text-white"><Icon name="chevron-down" size={20} weight="bold" /></RoundButton>
          </Morph>
          <div className="flex min-h-0 flex-1 items-center justify-center gap-14 px-9 pb-10">
            <div className="flex w-full max-w-[400px] min-w-[300px] shrink flex-col">
              {/* The artwork gives up height first, so the controls always fit. */}
              {art('aspect-square w-full self-center', { maxWidth: Math.max(160, height - 440) })}
              <Morph layoutId="np-header" fade className="mt-7 mb-5">{header}</Morph>
              {controls}
            </div>
            {compact ? <div className="relative h-full max-h-[640px] min-w-0 flex-1 max-w-[560px]">{side}</div> : null}
          </div>
        </>
      )}
    </DialogContent>
  );
}

function Scrubber({ p }: { p: Player }) {
  const dur = p.current.track.dur;
  return (
    <div className="flex flex-col gap-1.5">
      <Slider aria-label="Playback position" tone="onDark" size="sm" min={0} max={dur} step={1}
        value={Math.floor(p.position)} onValueChange={(v) => p.seek(v)} />
      <div className="flex justify-between text-caption font-medium tabular-nums text-white/55">
        <span>{fmt(p.position)}</span>
        <span>-{fmt(dur - p.position)}</span>
      </div>
    </div>
  );
}

function Transport({ p }: { p: Player }) {
  return (
    <div className="flex items-center justify-center gap-12">
      <RoundButton label="Previous" onClick={p.prev} className="size-14 text-white"><Icon name="backward" size={34} /></RoundButton>
      <RoundButton label={p.playing ? 'Pause' : 'Play'} onClick={p.toggle} className="size-16 text-white">
        <Swap effect="pop" value={p.playing ? 'pause' : 'play'}><Icon name={p.playing ? 'pause' : 'play'} size={44} /></Swap>
      </RoundButton>
      <RoundButton label="Next" onClick={p.next} className="size-14 text-white"><Icon name="forward" size={34} /></RoundButton>
    </div>
  );
}

/** A round toggle (Lyrics, Playing Next, Shuffle, Repeat): filled while on. */
function ToggleButton({ label, icon, on, onClick }: { label: string; icon: IconName; on: boolean; onClick?: () => void }) {
  return (
    <SdkToggle aria-label={label} pressed={on} onPressedChange={() => onClick?.()}
      className="bl-btn grid size-10 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-white/60 transition-[background-color,color,scale] duration-spring-snappy ease-spring-snappy not-data-pressed:hover:text-white active:scale-90 data-pressed:bg-white/85 data-pressed:text-black/80">
      <Icon name={icon} size={21} />
    </SdkToggle>
  );
}

function RoundButton({ label, onClick, className, children }: { label: string; onClick?: () => void; className?: string; children: ReactNode }) {
  return (
    <SdkButton aria-label={label} onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={cn(
        'bl-btn relative grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0',
        'transition-[background-color,scale] duration-spring-snappy ease-spring-snappy hover:bg-white/10 active:scale-[.86] active:bg-white/15',
        className,
      )}>
      {children}
    </SdkButton>
  );
}

function Lyrics({ p }: { p: Player }) {
  const lines = lyricsFor(p.current);
  const cur = lines.reduce((n, l, i) => (p.position >= l.at ? i : n), -1);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-line="${Math.max(0, cur)}"]`);
    if (el && box.current) box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight * 0.28, behavior: 'smooth' });
  }, [cur, p.current.key]);
  return (
    <div ref={box} className="bl-scroll absolute inset-0 overflow-y-auto px-7 py-6 [mask-image:linear-gradient(transparent,#000_12%,#000_85%,transparent)]">
      {lines.map((l, i) => (
        <SdkButton key={i} data-line={i} onClick={() => p.seek(Math.ceil(l.at))}
          className={cn(
            'bl-btn block w-full cursor-pointer border-0 bg-transparent py-2 text-left [font-family:inherit] text-[26px] leading-[1.2] font-bold text-white',
            'transition-[opacity,filter,scale] duration-spring-smooth ease-spring-smooth origin-left',
            i === cur ? 'scale-100 opacity-100' : 'scale-[.97] opacity-35 blur-[.6px] hover:opacity-60',
          )}>
          {l.text}
        </SdkButton>
      ))}
      <div className="h-[40%]" />
    </div>
  );
}

function Queue({ p }: { p: Player }) {
  return (
    <div className="bl-scroll absolute inset-0 overflow-y-auto px-7 py-2">
      <div className="flex items-end justify-between gap-3 pb-2">
        <div>
          <div className="text-body font-semibold">Playing Next</div>
          <div className="text-footnote text-white/55">From {p.current.album.title}</div>
        </div>
        <div className="flex gap-2">
          <ToggleButton label="Shuffle" icon="shuffle" on={p.shuffle} onClick={p.toggleShuffle} />
          <ToggleButton label={`Repeat: ${p.repeat}`} icon={p.repeat === 'one' ? 'repeat-1' : 'repeat'} on={p.repeat !== 'off'} onClick={p.cycleRepeat} />
        </div>
      </div>
      {p.upNext.length === 0 ? <div className="py-8 text-center text-detail text-white/55">Nothing up next.</div> : null}
      {p.upNext.map((s, i) => (
        <SdkButton key={s.key + i} onClick={() => p.jump(p.index + 1 + i)}
          className="bl-btn flex w-full cursor-pointer items-center gap-3 rounded-ctl border-0 bg-transparent px-2 py-2 text-left [font-family:inherit] text-white transition-colors hover:bg-white/10">
          <Artwork album={s.album} size={42} rounded={5} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-subhead">{s.track.title}</span>
            <span className="block truncate text-footnote text-white/55">{s.album.artist}</span>
          </span>
          <span className="text-footnote tabular-nums text-white/45">{fmt(s.track.dur)}</span>
        </SdkButton>
      ))}
    </div>
  );
}
