import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TextField } from '@/components/ui/text-field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Icon } from '@/lib/icon';
import type { Playback } from '@/lib/playback';
import { cn } from '@/lib/utils';
import {
  clipDuration, findClip, formatTimecode, timelineDuration, timelineLooks, updateClip,
  type ClipFrame, type TimelineClip, type TimelineLook, type TimelineTrack,
} from '@/lib/video-timeline';
import { useActions } from './actions';
import { useEditor } from './store';
import { isTitle, titleData, titleStyles, type TitleStyle } from './titles';

/* The inspector: the project's settings with nothing selected; with one clip, everything about it: its title text,
   volume, speed, fades, the dissolve into it (main track), its look, how it fills the frame, and where it sits when
   it's over the main track (picture in picture). Slider drags fold into one undo step. */

export const FORMATS = [
  { id: '1280x720', label: '16:9', detail: '1280 × 720', width: 1280, height: 720 },
  { id: '1920x1080', label: '16:9 HD', detail: '1920 × 1080', width: 1920, height: 1080 },
  { id: '1080x1920', label: '9:16', detail: '1080 × 1920', width: 1080, height: 1920 },
  { id: '1080x1080', label: '1:1', detail: '1080 × 1080', width: 1080, height: 1080 },
] as const;

const SPEEDS = [0.5, 1, 1.5, 2];
/** Picture-in-picture spots, as frames at the chosen size. */
const SPOTS = ['full', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
type Spot = (typeof SPOTS)[number];
const SPOT_LABEL: Record<Spot, string> = { full: 'Full', 'top-left': 'Top left', 'top-right': 'Top right', 'bottom-left': 'Bottom left', 'bottom-right': 'Bottom right' };
const MARGIN = 0.04;

function spotOf(frame: ClipFrame | undefined): Spot {
  if (!frame) return 'full';
  const left = frame.x < 0.5 - frame.width / 2, top = frame.y < 0.5 - frame.height / 2;
  return `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}` as Spot;
}
function frameAt(spot: Spot, size: number): ClipFrame | undefined {
  if (spot === 'full') return undefined;
  const x = spot.endsWith('left') ? MARGIN : 1 - MARGIN - size;
  const y = spot.startsWith('top') ? MARGIN : 1 - MARGIN - size;
  return { x, y, width: size, height: size };
}

/** The one key of a single-selection change (react-aria hands over a Set, or 'all'). */
const one = (keys: 'all' | Set<string | number>) => (keys === 'all' ? undefined : String([...keys][0] ?? ''));
const seconds: Intl.NumberFormatOptions = { style: 'unit', unit: 'second', unitDisplay: 'narrow', maximumFractionDigits: 1 };

function Section({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      {title ? <h3 className="m-0 text-caption font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3> : null}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-footnote text-foreground">{label}</span>
      {children}
    </div>
  );
}

export function Inspector({ clock, className }: { clock: Playback; className?: string }) {
  const ed = useEditor();
  const found = ed.selection.map((id) => findClip(ed.project.timeline, id)).filter((x) => !!x);
  return (
    <aside aria-label="Inspector" className={cn('bl-scroll flex min-h-0 flex-col overflow-y-auto', className)}>
      {found.length === 1 ? <ClipInspector key={found[0].clip.id} clip={found[0].clip} track={found[0].track} index={found[0].index} clock={clock} />
        : found.length > 1 ? <Many count={found.length} clock={clock} />
          : <ProjectInspector />}
    </aside>
  );
}

function ProjectInspector() {
  const ed = useEditor();
  const p = ed.project;
  const current = FORMATS.find((f) => f.width === p.format.width && f.height === p.format.height)?.id ?? '';
  const clips = p.timeline.tracks.reduce((n, t) => n + t.clips.length, 0);
  return (
    <>
      <Section title="Project">
        <TextField value={p.name} onChange={(name) => ed.commit({ ...p, name }, 'name')} aria-label="Project name">
          <Input />
        </TextField>
        <p className="m-0 text-caption text-muted-foreground tabular-nums">
          {clips} {clips === 1 ? 'clip' : 'clips'} · {formatTimecode(timelineDuration(p.timeline), p.format.fps)}
        </p>
      </Section>
      <Section title="Format">
        <ToggleGroup aria-label="Frame size" variant="filled" size="sm" selectionMode="single" disallowEmptySelection className="w-full flex-wrap"
          selectedKeys={current ? [current] : []}
          onSelectionChange={(keys) => {
            const f = FORMATS.find((x) => x.id === one(keys));
            if (f) ed.commit({ ...p, format: { ...p.format, width: f.width, height: f.height } });
          }}>
          {FORMATS.map((f) => <ToggleGroupItem key={f.id} id={f.id} className="flex-1" aria-label={`${f.label}, ${f.detail}`}>{f.label}</ToggleGroupItem>)}
        </ToggleGroup>
        <p className="m-0 text-caption text-muted-foreground tabular-nums">{p.format.width} × {p.format.height} pixels</p>
        <Row label="Frame rate">
          <ToggleGroup aria-label="Frame rate" variant="filled" size="sm" selectionMode="single" disallowEmptySelection
            selectedKeys={[String(p.format.fps)]}
            onSelectionChange={(keys) => { const fps = Number(one(keys)); if (fps) ed.commit({ ...p, format: { ...p.format, fps } }); }}>
            {[24, 25, 30, 60].map((f) => <ToggleGroupItem key={f} id={String(f)}>{f}</ToggleGroupItem>)}
          </ToggleGroup>
        </Row>
      </Section>
      <Section>
        <p className="m-0 text-caption leading-relaxed text-muted-foreground">
          Select a clip to change it. Space plays, S splits at the playhead, ⌫ deletes, ⌘Z undoes; drag clip edges to trim
          and hold ⌥ to place without snapping.
        </p>
      </Section>
    </>
  );
}

function Many({ count, clock }: { count: number; clock: Playback }) {
  const act = useActions(clock);
  return (
    <Section title={`${count} clips`}>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onPress={act.duplicate}>Duplicate</Button>
        <Button variant="secondary" size="sm" className="text-destructive" onPress={act.remove}>Delete</Button>
      </div>
    </Section>
  );
}

function ClipInspector({ clip, track, index, clock }: { clip: TimelineClip; track: TimelineTrack; index: number; clock: Playback }) {
  const ed = useEditor();
  const act = useActions(clock);
  const m = ed.media[clip.media];
  const title = isTitle(clip);
  const picture = track.kind === 'video' && (title || m?.kind !== 'audio');
  const sound = !title && !!m?.hasAudio && m.kind !== 'image';
  const locked = !!track.locked;
  const set = (patch: Partial<TimelineClip>, key?: string) => {
    if (!locked) ed.edit((t) => updateClip(t, clip.id, patch), key && `${key}:${clip.id}`);
  };
  const d = clipDuration(clip);
  const name = clip.label ?? (title ? 'Title' : m?.name ?? 'Clip');
  const spot = spotOf(clip.frame);
  const pipSize = clip.frame?.width ?? 0.35;
  return (
    <>
      <Section>
        <div className="flex items-center gap-2">
          <Icon name={title ? 'textformat' : m?.kind === 'audio' ? 'waveform' : m?.kind === 'image' ? 'photo' : 'video'} size={16} className="shrink-0 text-muted-foreground" />
          <h2 className="m-0 min-w-0 flex-1 truncate text-subhead font-semibold">{name}</h2>
          {locked ? <Icon name="lock" size={14} aria-label="Locked track" className="text-muted-foreground" /> : null}
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption tabular-nums">
          <dt className="text-muted-foreground">On timeline</dt>
          <dd className="m-0 text-right font-mono">{formatTimecode(clip.start, ed.project.format.fps)}</dd>
          <dt className="text-muted-foreground">Length</dt>
          <dd className="m-0 text-right font-mono">{formatTimecode(d, ed.project.format.fps)}</dd>
          {!title && m?.kind !== 'image' ? (
            <>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="m-0 text-right font-mono">{formatTimecode(clip.in)} – {formatTimecode(clip.out)}</dd>
            </>
          ) : null}
        </dl>
      </Section>
        {title ? (
          <Section title="Title">
            <TextField value={titleData(clip).text} isDisabled={locked} aria-label="Title text"
              onChange={(text) => set({ data: { ...clip.data, text } }, 'text')}>
              <Textarea rows={2} />
            </TextField>
            <ToggleGroup aria-label="Title style" variant="filled" size="sm" selectionMode="single" disallowEmptySelection className="w-full" isDisabled={locked}
              selectedKeys={[titleData(clip).style]}
              onSelectionChange={(keys) => { const style = one(keys) as TitleStyle | undefined; if (style) set({ data: { ...clip.data, style } }); }}>
              {titleStyles.map((s) => <ToggleGroupItem key={s.id} id={s.id} className="flex-1">{s.label}</ToggleGroupItem>)}
            </ToggleGroup>
          </Section>
        ) : null}
        {sound ? (
          <Section title="Audio">
            <Slider label="Volume" showValue minValue={0} maxValue={2} step={0.05} formatOptions={{ style: 'percent' }} isDisabled={locked || clip.muted}
              value={clip.volume ?? 1} onChange={(v) => set({ volume: v as number }, 'volume')} />
            <Row label="Mute">
              <Switch checked={!!clip.muted} onChange={(muted) => set({ muted })} aria-label="Mute clip" />
            </Row>
          </Section>
        ) : null}
        {!title && m?.kind !== 'image' ? (
          <Section title="Speed">
            <ToggleGroup aria-label="Speed" variant="filled" size="sm" selectionMode="single" disallowEmptySelection className="w-full" isDisabled={locked}
              selectedKeys={[String(clip.speed ?? 1)]}
              onSelectionChange={(keys) => { const s = Number(one(keys)); if (s) set({ speed: s === 1 ? undefined : s }); }}>
              {SPEEDS.map((s) => <ToggleGroupItem key={s} id={String(s)} className="flex-1">{s}×</ToggleGroupItem>)}
            </ToggleGroup>
          </Section>
        ) : null}
        <Section title="Fades">
          <Slider label="Fade in" showValue minValue={0} maxValue={Math.min(3, d / 2)} step={0.1} formatOptions={seconds} isDisabled={locked}
            value={Math.min(clip.fadeIn ?? 0, d / 2)} onChange={(v) => set({ fadeIn: (v as number) || undefined }, 'fadeIn')} />
          <Slider label="Fade out" showValue minValue={0} maxValue={Math.min(3, d / 2)} step={0.1} formatOptions={seconds} isDisabled={locked}
            value={Math.min(clip.fadeOut ?? 0, d / 2)} onChange={(v) => set({ fadeOut: (v as number) || undefined }, 'fadeOut')} />
          {track.magnetic && index > 0 ? (
            <Slider label="Dissolve from previous" showValue minValue={0} maxValue={2} step={0.1} formatOptions={seconds} isDisabled={locked}
              value={clip.transition ?? 0} onChange={(v) => set({ transition: (v as number) || undefined }, 'transition')} />
          ) : null}
        </Section>
        {picture && !title ? (
          <Section title="Look">
            <ToggleGroup aria-label="Look" size="sm" selectionMode="single" disallowEmptySelection className="w-full flex-wrap" isDisabled={locked}
              selectedKeys={[clip.look ?? 'none']}
              onSelectionChange={(keys) => { const look = one(keys) as TimelineLook | undefined; if (look) set({ look: look === 'none' ? undefined : look }); }}>
              {timelineLooks.map((l) => <ToggleGroupItem key={l.id} id={l.id} variant="outline" className="rounded-md">{l.label}</ToggleGroupItem>)}
            </ToggleGroup>
            <Row label="Fill the frame">
              <Switch checked={clip.fit === 'cover'} onChange={(on) => set({ fit: on ? 'cover' : undefined })} aria-label="Fill the frame (crop)" />
            </Row>
          </Section>
        ) : null}
        {picture && !track.magnetic ? (
          <Section title="Position">
            <ToggleGroup aria-label="Position" size="sm" selectionMode="single" disallowEmptySelection className="w-full flex-wrap" isDisabled={locked}
              selectedKeys={[spot]}
              onSelectionChange={(keys) => { const s = one(keys) as Spot | undefined; if (s) set({ frame: frameAt(s, pipSize) }); }}>
              {SPOTS.map((s) => <ToggleGroupItem key={s} id={s} variant="outline" className="rounded-md">{SPOT_LABEL[s]}</ToggleGroupItem>)}
            </ToggleGroup>
            {spot !== 'full' ? (
              <Slider label="Size" showValue minValue={0.15} maxValue={0.7} step={0.01} formatOptions={{ style: 'percent' }} isDisabled={locked}
                value={pipSize} onChange={(v) => set({ frame: frameAt(spot, v as number) }, 'pip')} />
            ) : null}
          </Section>
        ) : null}
      <Section>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" isDisabled={locked} onPress={act.split}>Split at playhead</Button>
          <Button variant="secondary" size="sm" isDisabled={locked} onPress={act.duplicate}>Duplicate</Button>
          <Button variant="secondary" size="sm" isDisabled={locked} className="text-destructive" onPress={act.remove}>Delete</Button>
        </div>
      </Section>
    </>
  );
}

