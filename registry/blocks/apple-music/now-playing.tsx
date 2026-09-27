/* The player: ONE element that is the mini player and, expanded, the full Now Playing screen.
   The container springs from the mini bar's frame to the whole block; the artwork inside it springs from the
   mini thumbnail to wherever the full layout's artwork slot is (measured), so the cover you tapped is the cover
   that grows. The mini row fades out, the full controls fade in a beat later, and the album's colors wash in.
   Drag the full player down (or press Esc) and the same element folds back into the bar. */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  Haptics, IconSwap, Slider, SliderThumb, SliderTrack, cn, springCss, useReducedMotion,
} from '@brett_lamy/ui';
import { Artwork } from './artwork';
import { fmt, lyricsFor } from './data';
import { Glyph, type GlyphName } from './glyphs';
import type { Player } from './player';

export interface Rect { left: number; top: number; width: number; height: number }
type Panel = 'none' | 'lyrics' | 'queue';

export function NowPlaying({ player: p, box, mini, phone, expanded, onExpandedChange }: {
  player: Player; box: { width: number; height: number }; mini: Rect; phone: boolean;
  expanded: boolean; onExpandedChange: (open: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const [panel, setPanel] = useState<Panel>('none');
  const [drag, setDrag] = useState(0);
  const dragRef = useRef<{ y: number; on: boolean } | null>(null);
  const full = useRef<HTMLDivElement | null>(null);
  const slot = useRef<HTMLDivElement | null>(null);
  const [slotRect, setSlotRect] = useState<Rect>({ left: 32, top: 80, width: 300, height: 300 });
  const album = p.current.album;

  // Where the full layout wants the artwork, relative to the player's own box.
  useLayoutEffect(() => {
    const el = slot.current, root = full.current;
    if (!el || !root) return;
    const measure = () => {
      const a = el.getBoundingClientRect(), b = root.getBoundingClientRect();
      setSlotRect({ left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [panel, phone, box.width, box.height]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExpandedChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onExpandedChange]);

  const frame: Rect = expanded ? { left: 0, top: 0, width: box.width, height: box.height } : mini;
  const miniArt = mini.height - 16;
  const art: Rect & { radius: number } = expanded
    ? { ...slotRect, radius: panel === 'none' ? 12 : 6 }
    : { left: 8, top: 8, width: miniArt, height: miniArt, radius: 7 };
  const spring = (props: string[], name: 'smooth' | 'snappy' = 'smooth') => (reduced || dragRef.current?.on ? 'none' : springCss(props, name));

  /* Pull-down to dismiss: the container follows the finger, and past 120px (or a flick) folds back up. */
  const onDown = (e: ReactPointerEvent) => {
    if (!expanded || e.button || (e.target as HTMLElement).closest('button,[data-slot^="slider"],[data-scroll]')) return;
    dragRef.current = { y: e.clientY, on: false };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.on && dy > 6) { d.on = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
    if (d.on) setDrag(Math.max(0, dy));
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.on) return;
    if (drag > 120) { Haptics.impact('light'); onExpandedChange(false); }
    setDrag(0);
  };

  const containerStyle: CSSProperties = {
    left: frame.left, top: frame.top, width: frame.width, height: frame.height,
    borderRadius: expanded ? (drag ? 22 : 0) : 14,
    transform: drag ? `translateY(${drag}px)` : undefined,
    transition: spring(['left', 'top', 'width', 'height', 'border-radius', 'transform', 'box-shadow']),
  };

  return (
    <section aria-label="Now Playing" data-expanded={expanded || undefined}
      className={cn('absolute z-[300] overflow-hidden text-foreground', expanded ? 'shadow-[0_-10px_40px_rgba(0,0,0,.3)]' : 'shadow-[0_6px_24px_rgba(0,0,0,.16),0_0_0_.5px_var(--bl-sep)]')}
      style={containerStyle}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {/* Surfaces: the bar's frosted glass, and the album's colors washing in as it grows. */}
      <div aria-hidden="true" className="absolute inset-0 bg-bl-bar backdrop-blur-[24px] backdrop-saturate-[1.8]" />
      <div aria-hidden="true" className="absolute inset-0 transition-opacity duration-spring-smooth ease-spring-smooth"
        style={{
          opacity: expanded ? 1 : 0,
          background: `radial-gradient(120% 80% at 15% 0%, color-mix(in oklab, ${album.colors[1]} 80%, black), transparent 70%), radial-gradient(100% 70% at 90% 100%, color-mix(in oklab, ${album.colors[2]} 75%, black), transparent 70%), color-mix(in oklab, ${album.colors[2]} 50%, #0b0b10)`,
        }}>
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Mini row */}
      <div inert={expanded || undefined} className={cn('absolute inset-x-0 top-0 flex items-center gap-3 pr-2 transition-opacity', expanded ? 'pointer-events-none opacity-0 duration-100' : 'opacity-100 delay-100 duration-200')}
        style={{ height: mini.height, paddingLeft: 8 + miniArt + 12 }}>
        <button type="button" aria-label={`Open Now Playing: ${p.current.track.title}`} onClick={() => { Haptics.impact('light'); onExpandedChange(true); }}
          className="bl-btn absolute inset-0 cursor-pointer border-0 bg-transparent" />
        <div className="pointer-events-none min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium leading-tight">{p.current.track.title}</div>
          <div className="truncate text-[13px] text-muted-foreground">{album.artist}</div>
        </div>
        <RoundButton label={p.playing ? 'Pause' : 'Play'} onPress={p.toggle} className="relative size-10 text-foreground">
          <IconSwap id={p.playing ? 'pause' : 'play'}><Glyph name={p.playing ? 'pause' : 'play'} size={22} /></IconSwap>
        </RoundButton>
        <RoundButton label="Next" onPress={p.next} className="relative size-10 text-foreground"><Glyph name="forward" size={24} /></RoundButton>
      </div>

      {/* Full layout (fixed to the block's size; the container reveals it as it grows) */}
      <div ref={full} aria-hidden={!expanded || undefined} inert={!expanded || undefined}
        className={cn('absolute top-0 left-0 text-white transition-opacity', expanded ? 'opacity-100 delay-75 duration-300' : 'pointer-events-none opacity-0 duration-100')}
        style={{ width: box.width, height: box.height }}>
        <FullLayout p={p} phone={phone} height={box.height} panel={panel} setPanel={setPanel} slot={slot} onClose={() => onExpandedChange(false)} />
      </div>

      {/* The artwork: one element for both states */}
      <div aria-hidden="true" className="pointer-events-none absolute"
        style={{
          left: art.left, top: art.top, width: art.width, height: art.height,
          transform: expanded && panel === 'none' && !p.playing ? 'scale(.86)' : 'none',
          transition: spring(['left', 'top', 'width', 'height', 'transform']),
        }}>
        <Artwork album={album} rounded={art.radius} className="size-full"
          style={{ transition: spring(['border-radius', 'box-shadow']), boxShadow: expanded ? '0 18px 50px rgba(0,0,0,.35)' : undefined }} />
      </div>
    </section>
  );
}

function FullLayout({ p, phone, height, panel, setPanel, slot, onClose }: {
  p: Player; phone: boolean; height: number; panel: Panel; setPanel: (p: Panel) => void; slot: React.RefObject<HTMLDivElement | null>; onClose: () => void;
}) {
  const togglePanel = (k: Panel) => { Haptics.selection(); setPanel(panel === k ? 'none' : k); };
  const compact = panel !== 'none';
  const header = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[19px] font-semibold">{p.current.track.title}</div>
        <div className="truncate text-[17px] text-white/60">{p.current.album.artist} — {p.current.album.title}</div>
      </div>
      <RoundButton label="Love" className="size-8 bg-white/15 text-white"><Glyph name="heart" size={17} sw={2.1} /></RoundButton>
      <RoundButton label="More" className="size-8 bg-white/15 text-white"><Glyph name="more" size={17} /></RoundButton>
    </div>
  );
  const controls = (
    <div className="flex flex-col gap-5">
      <Scrubber p={p} />
      <Transport p={p} />
      <Volume p={p} />
      <div className="flex items-center justify-around px-6">
        <ToggleButton label="Lyrics" icon="lyrics" on={panel === 'lyrics'} onPress={() => togglePanel('lyrics')} />
        <ToggleButton label="AirPlay" icon="airplay" on={false} onPress={() => Haptics.selection()} />
        <ToggleButton label="Playing Next" icon="queue" on={panel === 'queue'} onPress={() => togglePanel('queue')} />
      </div>
    </div>
  );
  const side = panel === 'lyrics' ? <Lyrics p={p} /> : panel === 'queue' ? <Queue p={p} /> : null;

  if (phone) {
    return (
      <div className="flex h-full flex-col px-7 pt-2.5 pb-6">
        <button type="button" aria-label="Close Now Playing" onClick={onClose}
          className="bl-btn mx-auto mb-4 h-5 w-14 shrink-0 cursor-pointer border-0 bg-transparent p-0">
          <span className="mx-auto block h-[5px] w-10 rounded-full bg-white/35" />
        </button>
        {compact ? (
          <>
            <div className="flex shrink-0 items-center gap-3">
              <div ref={slot} className="size-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{p.current.track.title}</div>
                <div className="truncate text-[15px] text-white/60">{p.current.album.artist}</div>
              </div>
              <RoundButton label="More" className="size-8 bg-white/15 text-white"><Glyph name="more" size={17} /></RoundButton>
            </div>
            <div className="relative -mx-7 my-3 min-h-0 flex-1">{side}</div>
          </>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div ref={slot} className="aspect-square w-full max-w-[340px] max-h-full" />
            </div>
            <div className="mt-6 mb-4 shrink-0">{header}</div>
          </>
        )}
        <div className="shrink-0">{controls}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 justify-end px-5 pt-4">
        <RoundButton label="Close Now Playing" onPress={onClose} className="size-9 bg-white/15 text-white"><Glyph name="chevronDown" size={20} sw={2.4} /></RoundButton>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-14 px-14 pb-10">
        <div className="flex w-full max-w-[400px] min-w-[300px] shrink flex-col">
          {/* The artwork gives up height first, so the controls always fit. */}
          <div ref={slot} className="aspect-square w-full self-center" style={{ maxWidth: Math.max(160, height - 440) }} />
          <div className="mt-7 mb-5">{header}</div>
          {controls}
        </div>
        {compact ? <div className="relative h-full max-h-[640px] min-w-0 flex-1 max-w-[560px]">{side}</div> : null}
      </div>
    </div>
  );
}

function Scrubber({ p }: { p: Player }) {
  const dur = p.current.track.dur;
  return (
    <div data-slot="slider-scrubber" className="flex flex-col gap-1.5">
      <Slider aria-label="Playback position" minValue={0} maxValue={dur} step={1} value={Math.floor(p.position)} onChange={(v) => p.seek(v as number)}
        style={{ '--bl-tint': 'rgba(255,255,255,.88)', '--bl-fill2': 'rgba(255,255,255,.22)' } as CSSProperties}>
        <SliderTrack className="mx-[6px] h-5"><SliderThumb className="size-3 shadow-none data-dragging:scale-150" /></SliderTrack>
      </Slider>
      <div className="flex justify-between text-[12px] font-medium tabular-nums text-white/55">
        <span>{fmt(p.position)}</span>
        <span>-{fmt(dur - p.position)}</span>
      </div>
    </div>
  );
}

function Transport({ p }: { p: Player }) {
  return (
    <div className="flex items-center justify-center gap-12">
      <RoundButton label="Previous" onPress={p.prev} className="size-14 text-white"><Glyph name="backward" size={34} /></RoundButton>
      <RoundButton label={p.playing ? 'Pause' : 'Play'} onPress={p.toggle} className="size-16 text-white">
        <IconSwap id={p.playing ? 'pause' : 'play'}><Glyph name={p.playing ? 'pause' : 'play'} size={44} /></IconSwap>
      </RoundButton>
      <RoundButton label="Next" onPress={p.next} className="size-14 text-white"><Glyph name="forward" size={34} /></RoundButton>
    </div>
  );
}

function Volume({ p }: { p: Player }) {
  return (
    <div className="flex items-center gap-2 text-white/55">
      <Glyph name="volLow" size={16} />
      <Slider aria-label="Volume" value={p.volume} onChange={(v) => p.setVolume(v as number)} className="flex-1"
        style={{ '--bl-tint': 'rgba(255,255,255,.88)', '--bl-fill2': 'rgba(255,255,255,.22)' } as CSSProperties}>
        <SliderTrack className="mx-[6px] h-5"><SliderThumb className="size-3 shadow-none data-dragging:scale-150" /></SliderTrack>
      </Slider>
      <Glyph name="volHigh" size={18} />
    </div>
  );
}

function ToggleButton({ label, icon, on, onPress }: { label: string; icon: GlyphName; on: boolean; onPress: () => void }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} onClick={onPress}
      className={cn(
        'bl-btn grid size-10 cursor-pointer place-items-center rounded-full border-0 transition-[background-color,color,scale] duration-spring-snappy ease-spring-snappy active:scale-90',
        on ? 'bg-white/85 text-black/80' : 'bg-transparent text-white/60 hover:text-white',
      )}>
      <Glyph name={icon} size={21} />
    </button>
  );
}

export function RoundButton({ label, onPress, className, children }: { label: string; onPress?: () => void; className?: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={(e) => { e.stopPropagation(); onPress?.(); }}
      className={cn(
        'bl-btn relative grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0',
        'transition-[background-color,scale] duration-spring-snappy ease-spring-snappy hover:bg-white/10 active:scale-[.86] active:bg-white/15',
        className,
      )}>
      {children}
    </button>
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
    <div ref={box} data-scroll="" className="bl-scroll absolute inset-0 overflow-y-auto px-7 py-6 [mask-image:linear-gradient(transparent,#000_12%,#000_85%,transparent)]">
      {lines.map((l, i) => (
        <button key={i} type="button" data-line={i} onClick={() => { Haptics.selection(); p.seek(Math.ceil(l.at)); }}
          className={cn(
            'bl-btn block w-full cursor-pointer border-0 bg-transparent py-2 text-left [font-family:inherit] text-[26px] leading-[1.2] font-bold text-white',
            'transition-[opacity,filter,scale] duration-spring-smooth ease-spring-smooth origin-left',
            i === cur ? 'scale-100 opacity-100' : 'scale-[.97] opacity-35 blur-[.6px] hover:opacity-60',
          )}>
          {l.text}
        </button>
      ))}
      <div className="h-[40%]" />
    </div>
  );
}

function Queue({ p }: { p: Player }) {
  return (
    <div data-scroll="" className="bl-scroll absolute inset-0 overflow-y-auto px-7 py-2">
      <div className="flex items-end justify-between gap-3 pb-2">
        <div>
          <div className="text-[17px] font-semibold">Playing Next</div>
          <div className="text-[13px] text-white/55">From {p.current.album.title}</div>
        </div>
        <div className="flex gap-2">
          <ToggleButton label="Shuffle" icon="shuffle" on={p.shuffle} onPress={p.toggleShuffle} />
          <span className="relative">
            <ToggleButton label={`Repeat: ${p.repeat}`} icon="repeat" on={p.repeat !== 'off'} onPress={p.cycleRepeat} />
            {p.repeat === 'one' ? <span className="pointer-events-none absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-white text-[9px] font-bold text-black">1</span> : null}
          </span>
        </div>
      </div>
      {p.upNext.length === 0 ? <div className="py-8 text-center text-[14px] text-white/55">Nothing up next.</div> : null}
      {p.upNext.map((s, i) => (
        <button key={s.key + i} type="button" onClick={() => p.jump(p.index + 1 + i)}
          className="bl-btn flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-0 bg-transparent px-2 py-2 text-left [font-family:inherit] text-white transition-colors hover:bg-white/10">
          <Artwork album={s.album} size={42} rounded={5} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{s.track.title}</span>
            <span className="block truncate text-[13px] text-white/55">{s.album.artist}</span>
          </span>
          <span className="text-[13px] tabular-nums text-white/45">{fmt(s.track.dur)}</span>
        </button>
      ))}
    </div>
  );
}
