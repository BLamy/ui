import {
  announce, createChange, createRovingFocus, createSpans, definePrimitive, keepFocus, spansMessage,
  type ChangeDetails, type Span, type SpanAction, type SpansDraft, type SpansReason,
} from '@ui-sdk/core';
import type { Playback } from '@/lib/playback';
import {
  clipEnd, findClip, formatTimecode, magneticIndex, moveClip, quantize, removeClips, snapTargets, snapTime,
  timelineDuration, trimClip, updateTrack,
  type Timeline, type TimelineClip, type TimelineTrack,
} from '@/lib/video-timeline-model';

/* ══ videoTimeline — the editing behavior of a lib/video-timeline-model Timeline ══
   Clips are UI SDK spans (`createSpans`) on their tracks: drag a clip to move it along its track or onto another track
   of its kind, drag a `data-span-edge="start|end"` handle to trim it, all frame by frame, snapping to clip edges, the
   playhead and 0 (hold ⌥/Alt to place freely), with announcements and edge auto-scroll. The model stays the authority
   on what an edit does: a magnetic track's clips make room for the one moving among them and ripple when one is
   trimmed, a trim never runs past the media, and a drag that lands where it started is no edit.

   The clips are one Tab stop (`createRovingFocus`). On a clip: ←/→ move it a frame (on a magnetic track, past its
   neighbour), ⇧←/→ move its end, ⌥⇧←/→ its start, ↑/↓ move it to the next track of its kind; ⌥ with an arrow moves
   focus to the clip beside it, or on the track above or below; Home/End reach the track's first and last clip.
   Enter or Space selects it (⇧ adds it), Escape clears the selection, Delete or Backspace removes the selection.

   ⌘/Ctrl + wheel (a trackpad pinch) over the `scroller` zooms around the pointer: the time under it stays under it.

   `value` / `onValueChange(value, details)` once per gesture or key, with `details.id` (the clip or track) and
   `details.action`; `selectedClips` / `onSelectedClipsChange`; `zoom` (pixels per second) / `onZoomChange`.
   No React in here: render it with `createParts(videoTimeline, { root: 'div', scroller: 'div', track: 'div', clip: 'div' })`. ══ */

/** Why the timeline changed: a drag, a key, Delete or Backspace, a track header toggle, or a call from code. */
export type VideoTimelineChangeReason = SpansReason | 'press';
/** What changed: a clip moved, trimmed (`resize`) or deleted, or a track's hide, mute or lock. */
export type VideoTimelineAction = Exclude<SpanAction, 'draw'> | 'track';
export type VideoTimelineChangeDetails = ChangeDetails<VideoTimelineChangeReason> & {
  /** The clip (or, for `track`, the track) the change is about. */
  id: string;
  action: VideoTimelineAction;
};
/** Why the selection changed: a press on a clip (or Enter or Space), a press on an empty stretch of track, Escape,
 *  a removal, or a call from code. */
export type VideoTimelineSelectionReason = 'item-press' | 'track-press' | 'escape-key' | 'remove-press' | 'imperative';
/** Why the zoom changed: ⌘/Ctrl + wheel or a pinch, or a call from code. */
export type VideoTimelineZoomReason = 'wheel' | 'imperative';

export interface TimelineMediaInfo {
  /** Seconds (trim limit); ignored for stills. */
  duration: number;
  kind: 'video' | 'audio' | 'image';
  /** The clip label when the clip has none. */
  name?: string;
}

export const timelineZoomRange = { min: 2, max: 600 } as const;
export const clampTimelineZoom = (z: number) => Math.max(timelineZoomRange.min, Math.min(timelineZoomRange.max, z));

/** Seconds of empty track the lanes run past the last clip. */
export const TIMELINE_TAIL = 8;
/** How close, in pixels, a dragged edge snaps to a target. */
const SNAP_PX = 8;

export interface VideoTimelineOptions {
  value?: Timeline;
  defaultValue?: Timeline;
  onValueChange?: (value: Timeline, details: VideoTimelineChangeDetails) => void;
  selectedClips?: string[];
  defaultSelectedClips?: string[];
  onSelectedClipsChange?: (selectedClips: string[], details: ChangeDetails<VideoTimelineSelectionReason>) => void;
  /** Pixels per second. */
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (zoom: number, details: ChangeDetails<VideoTimelineZoomReason>) => void;
  /** The clock the playhead follows: a trim shows the frame at the edge, and a drag pauses it. */
  playback: Pick<Playback, 'getState' | 'seek' | 'pause'>;
  /** Media lengths (trim limits) and names (clip labels), by media id. */
  media?: Record<string, TimelineMediaInfo | undefined>;
  /** Frames per second: edits land on frames. Default 30. */
  fps?: number;
  /** Snap to clip edges, the playhead and 0. Default true. */
  snap?: boolean;
  /** Shows the timeline without letting anything change it. */
  readOnly?: boolean;
}

/** A clip as a span: its track, and where it starts and ends on the timeline. */
export type ClipSpan = Span;

interface VideoTimelineState {
  value: Timeline;
  selectedClips: string[];
  zoom: number;
  /** The clip being dragged, as a span where the pointer has it. */
  draft: SpansDraft<ClipSpan> | null;
  /** The timeline as the drag would leave it. */
  preview: Timeline | null;
  /** The time a snap guide shows. */
  guide: number | null;
  /** The clip with the Tab stop. */
  focused: string | null;
  readOnly: boolean;
}

/** A track's name: its own, else "Main" for a magnetic track and "Video n" / "Audio n" for the others. */
export function timelineTrackName(track: TimelineTrack, index: number): string {
  return track.name ?? (track.kind === 'audio' ? `Audio ${index + 1}` : track.magnetic ? 'Main' : `Video ${index + 1}`);
}

/** A clip's name: its label, else its media's name, else the media id. */
export function timelineClipName(clip: TimelineClip, media: VideoTimelineOptions['media'] = {}): string {
  return clip.label ?? media[clip.media]?.name ?? clip.media;
}

const spansOf = (tl: Timeline): ClipSpan[] =>
  tl.tracks.flatMap((track) => track.clips.map((clip) => ({ id: clip.id, track: track.id, start: clip.start, end: clipEnd(clip) })));

const same = (a: Timeline, b: Timeline) => a === b || JSON.stringify(a) === JSON.stringify(b);

export const videoTimeline = definePrimitive({
  name: 'video-timeline',
  options: {
    value: 'value', defaultValue: 'value', onValueChange: 'callback',
    selectedClips: 'list', defaultSelectedClips: 'list', onSelectedClipsChange: 'callback',
    zoom: 'number', defaultZoom: 'number', onZoomChange: 'callback',
    playback: 'value', media: 'value', fps: 'number', snap: 'boolean', readOnly: 'boolean',
  },
  controlled: ['value', 'selectedClips', 'zoom'],
  state: (options: VideoTimelineOptions): VideoTimelineState => ({
    value: options.value ?? options.defaultValue ?? { tracks: [] },
    selectedClips: [...(options.selectedClips ?? options.defaultSelectedClips ?? [])],
    zoom: options.zoom ?? options.defaultZoom ?? 60,
    draft: null,
    preview: null,
    guide: null,
    focused: null,
    readOnly: !!options.readOnly,
  }),
  sync: (options) => ({
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.selectedClips === undefined ? {} : { selectedClips: [...options.selectedClips] }),
    ...(options.zoom === undefined ? {} : { zoom: options.zoom }),
    readOnly: !!options.readOnly,
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const fps = () => context.options().fps ?? 30;
    const frame = () => 1 / Math.max(1, fps());
    const media = () => context.options().media ?? {};
    const limits = (clip: TimelineClip) => {
      const m = media()[clip.media];
      return { mediaDuration: m && m.kind !== 'image' ? m.duration : Infinity, minDuration: frame() };
    };
    const trackOf = (tl: Timeline, id: string) => tl.tracks.find((t) => t.id === id);
    const frozen = (track: TimelineTrack | undefined) => !track || track.locked || store.get().readOnly;
    const label = (span: ClipSpan, tl: Timeline = store.get().preview ?? store.get().value) => {
      const at = findClip(tl, span.id);
      const name = at ? timelineClipName(at.clip, media()) : span.id;
      const index = tl.tracks.findIndex((t) => t.id === span.track);
      const track = index >= 0 ? `, ${timelineTrackName(tl.tracks[index], index)}` : '';
      return `${name}${track}, ${formatTimecode(span.start)} to ${formatTimecode(span.end)}`;
    };
    // What screen readers hear after an edit createSpans didn't make itself, about the clip in `tl`.
    const say = (type: SpanAction, id: string, tl: Timeline) => {
      const span = spansOf(tl).find((s) => s.id === id);
      if (span) announce(spansMessage({ type, span, label: label(span, tl) }));
    };

    /* ── The value as createSpans sees it: the clips as spans, worked out from the timeline ── */
    let viewOf: { state: VideoTimelineState; view: VideoTimelineState & { spans: ClipSpan[] } } | null = null;
    const spansValue = { state: null as Timeline | null, spans: [] as ClipSpan[] };
    const viewed = (state: VideoTimelineState) => {
      if (viewOf?.state === state) return viewOf.view;
      if (spansValue.state !== state.value) Object.assign(spansValue, { state: state.value, spans: spansOf(state.value) });
      viewOf = { state, view: { ...state, spans: spansValue.spans } };
      return viewOf.view;
    };

    /* ── A drag in progress, as the model would have it ── */
    // Where the pointer took hold of the clip, which edge, and whether ⌥/Alt is held (to place freely).
    let grab: { id: string; offset: number; edge: 'start' | 'end' | null } | null = null;
    let free = false;
    let lastFixed: ClipSpan | null = null;
    const fix = (draft: SpansDraft<ClipSpan> | null): Partial<VideoTimelineState> => {
      if (!draft) { lastFixed = null; return { draft: null, preview: null, guide: null }; }
      const { value: tl, zoom } = store.get();
      const at = findClip(tl, draft.id);
      const span = draft.spans.find((s) => s.id === draft.id);
      if (!at || !span) return { draft };
      const { clip, track: from } = at;
      // Not moved yet (or back where it was): the timeline as it is.
      if (span.track === from.id && span.start === clip.start && span.end === clipEnd(clip)) {
        lastFixed = null;
        return { draft, preview: tl, guide: null };
      }
      const snapping = (context.options().snap ?? true) && !free;
      const targets = snapping ? snapTargets(tl, { exclude: [clip.id], extra: [context.options().playback.getState().time] }) : [];
      const threshold = SNAP_PX / zoom;
      let preview: Timeline;
      let guide: number | null = null;
      let fixed: ClipSpan;
      if (draft.action === 'resize') {
        const edge = grab?.edge ?? (span.end !== clipEnd(clip) ? 'end' : 'start');
        let time = edge === 'start' ? span.start : span.end;
        if (snapping) {
          const r = snapTime(time, targets, threshold);
          if (r.snapped) { time = r.time; guide = r.time; }
        }
        preview = trimClip(tl, clip.id, edge, quantize(time, fps()), limits(clip));
        const c = findClip(preview, clip.id)?.clip ?? clip;
        fixed = { ...span, track: from.id, start: c.start, end: clipEnd(c) };
      } else {
        // A clip only goes to an unlocked track of its own kind; elsewhere it stays on the last one it could take.
        const over = trackOf(tl, span.track);
        const before = lastFixed?.id === span.id ? lastFixed.track : from.id;
        const target = over && over.kind === from.kind && !over.locked ? over : trackOf(tl, before) ?? from;
        const size = span.end - span.start;
        let start = span.start;
        if (target.magnetic) {
          preview = moveClip(tl, clip.id, { trackId: target.id, index: magneticIndex(target, start + (grab?.offset ?? size / 2), clip.id) });
        } else {
          if (snapping && span !== lastFixed) {
            const a = snapTime(start, targets, threshold), b = snapTime(start + size, targets, threshold);
            if (a.snapped && (!b.snapped || Math.abs(a.time - start) <= Math.abs(b.time - start - size))) { start = a.time; guide = a.time; }
            else if (b.snapped) { start = b.time - size; guide = b.time; }
          }
          start = Math.max(0, quantize(start, fps()));
          preview = moveClip(tl, clip.id, { trackId: target.id, start });
        }
        fixed = { ...span, track: target.id, start, end: start + size };
      }
      if (fixed.track === span.track && fixed.start === span.start && fixed.end === span.end) fixed = span;
      lastFixed = fixed;
      return { draft: fixed === span ? draft : { ...draft, spans: draft.spans.map((s) => (s.id === draft.id ? fixed : s)) }, preview, guide };
    };

    // createSpans reads and writes the store through this view: it sees the clips as spans, and every draft it
    // writes is put where the model would have the clip.
    const view = Object.assign(Object.create(store) as typeof store, {
      get: () => viewed(store.get()),
      set: (patch: Partial<VideoTimelineState>, delivered?: boolean) => {
        if (!('draft' in patch)) return store.set(patch, delivered);
        const starting = !store.get().draft && !!patch.draft;
        const next = { ...patch, ...fix(patch.draft ?? null) };
        store.set(next, delivered);
        const clock = context.options().playback;
        if (starting) clock.pause();
        // A trim shows the frame at the edge it moves.
        const c = next.draft?.action === 'resize' && next.preview ? findClip(next.preview, next.draft.id)?.clip : undefined;
        if (c) clock.seek(grab?.edge === 'start' ? c.start : Math.max(c.start, clipEnd(c) - frame()));
      },
    });

    const commit = (next: Timeline, details: { reason: VideoTimelineChangeReason; event?: Event; id: string; action: VideoTimelineAction }) => {
      const { value } = store.get();
      if (same(next, value)) return false;
      return change('value', next, details);
    };

    // The span createSpans proposes, as an edit of the timeline.
    const edit = (spans: ClipSpan[], details: { reason: SpansReason; event?: Event; id: string; action: SpanAction }) => {
      const { value: tl, preview } = store.get();
      if (details.action === 'draw') return false;
      if (details.reason === 'drag') return preview ? commit(preview, { ...details, action: details.action }) : false;
      const at = findClip(tl, details.id);
      if (!at) return false;
      if (details.action === 'delete') return commit(removeClips(tl, [details.id]), { ...details, action: 'delete' });
      const span = spans.find((s) => s.id === details.id);
      const target = span && trackOf(tl, span.track);
      if (!span || !target || target.kind !== at.track.kind || frozen(target)) return false;
      let next = tl;
      if (details.action === 'resize' || details.reason === 'imperative') {
        if (span.start !== at.clip.start && !at.track.magnetic) next = trimClip(next, details.id, 'start', quantize(span.start, fps()), limits(at.clip));
        if (span.end !== clipEnd(at.clip)) next = trimClip(next, details.id, 'end', quantize(span.end, fps()), limits(at.clip));
        if (details.action === 'resize') return commit(next, { ...details, action: 'resize' });
      }
      next = target.magnetic
        ? moveClip(next, details.id, { trackId: target.id, index: target.id === at.track.id ? at.index : magneticIndex(target, span.start) })
        : moveClip(next, details.id, { trackId: target.id, start: Math.max(0, quantize(span.start, fps())) });
      return commit(next, { ...details, action: 'move' });
    };

    // The tracks ↑/↓ go through from the clip being moved: the unlocked ones of its kind.
    let keyed: string | null = null;
    const spans = createSpans<VideoTimelineState & { spans: ClipSpan[] }, ClipSpan>(
      { store: view as never, onDestroy: context.onDestroy },
      {
        key: 'spans',
        draft: 'draft',
        set: edit,
        axis: 'x',
        min: () => 0,
        max: () => {
          // The lanes run the timeline's length and a tail, or the width they fill, whichever is longer.
          const lane = context.element('track');
          const { value, zoom } = store.get();
          const drawn = lane ? lane.clientWidth / zoom : 0;
          return drawn > 0 ? drawn : timelineDuration(value) + TIMELINE_TAIL;
        },
        step: frame,
        minSize: frame,
        overlap: true,
        tracks: () => {
          const tl = store.get().value;
          const kind = keyed ? findClip(tl, keyed)?.track.kind : undefined;
          return tl.tracks.filter((t) => !t.locked && (!kind || t.kind === kind)).map((t) => t.id);
        },
        disabled: (span) => frozen(trackOf(store.get().value, span.track)),
        label,
      },
    );

    // The clip ⌥ + an arrow goes to: the one before or after on its track, or the nearest in time on the closest
    // track above or below that has clips. The roving group leaves ⌥ combinations alone, so this asks it to focus.
    const neighbour = (from: string, key: string, items: readonly { key: string }[]) => {
      const tl = store.get().value;
      const at = findClip(tl, from);
      if (!at) return undefined;
      const onTrack = (t: TimelineTrack) => items.filter((i) => t.clips.some((c) => c.id === i.key));
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const here = onTrack(at.track);
        return here[here.findIndex((x) => x.key === from) + (key === 'ArrowRight' ? 1 : -1)]?.key;
      }
      const dir = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
      for (let ti = at.trackIndex + dir; dir && ti >= 0 && ti < tl.tracks.length; ti += dir) {
        const there = onTrack(tl.tracks[ti]);
        if (!there.length) continue;
        const time = (k: string) => findClip(tl, k)?.clip.start ?? 0;
        return there.reduce((best, x) => (Math.abs(time(x.key) - at.clip.start) < Math.abs(time(best.key) - at.clip.start) ? x : best)).key;
      }
      return undefined;
    };

    const roving = createRovingFocus<VideoTimelineState, { value: string }>(context, {
      slot: 'clip',
      key: 'focused',
      preferred: (item) => store.get().selectedClips.includes(item.key),
      // The arrows are the clips' own (they move them); Home and End reach the ends of the track.
      move: (event, { from, items }) => {
        if (event.ctrlKey || event.metaKey || (event.key !== 'Home' && event.key !== 'End')) return undefined;
        const track = findClip(store.get().value, from.key)?.track;
        const here = items.filter((i) => track?.clips.some((c) => c.id === i.key));
        return (event.key === 'Home' ? here[0] : here[here.length - 1])?.key;
      },
    });

    const select = (ids: string[], details: { reason: VideoTimelineSelectionReason; event?: Event }) =>
      change('selectedClips', ids, details);

    const remove = (ids: readonly string[], details: { reason: 'remove-press' | 'imperative'; event?: Event }) => {
      const tl = store.get().value;
      const removable = ids.filter((id) => !frozen(findClip(tl, id)?.track));
      if (!removable.length) return false;
      const done = commit(removeClips(tl, removable), { ...details, id: removable[0], action: 'delete' });
      if (done) {
        removable.forEach((id) => say('delete', id, tl));
        select(store.get().selectedClips.filter((id) => !removable.includes(id)), details);
      }
      return done;
    };

    // Where the last wheel zoom had the pointer: the time under it, and how far it was into the lanes' view. It holds
    // for the zoom that wheel asked for, and only once that zoom is the one rendered (`zoomScroll`).
    let anchor: { zoom: number; time: number; x: number } | null = null;
    const wheel = (event: WheelEvent, scroller: HTMLElement) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // A pinch must not zoom the page.
      event.preventDefault();
      const lane = context.element('track');
      const { zoom } = store.get();
      if (!lane) return;
      // A lane scrolls with the content, so where it would start unscrolled is where the lanes' view starts (past the
      // sticky header).
      const viewLeft = lane.getBoundingClientRect().left + scroller.scrollLeft;
      const x = Math.max(0, event.clientX - viewLeft);
      const next = clampTimelineZoom(zoom * Math.exp(-event.deltaY * 0.01));
      const at = { zoom: next, time: (scroller.scrollLeft + x) / zoom, x };
      if (change('zoom', next, { reason: 'wheel', event })) anchor = at;
    };
    // A controlled host that didn't take the zoom renders without it: the anchor is for nothing now.
    context.onOptions(() => {
      if (anchor && store.get().zoom !== anchor.zoom) anchor = null;
    });

    const api = {
      spans,
      roving,
      /** Selects clips (all others deselect). */
      select: (ids: string[]) => select([...ids], { reason: 'imperative' }),
      /** Moves a clip: along a free track to `start`, to `index` among a magnetic track's clips, or to `trackId`. */
      move: (id: string, place: { trackId?: string; start?: number; index?: number }) => {
        const tl = store.get().value;
        const at = findClip(tl, id);
        const target = trackOf(tl, place.trackId ?? at?.track.id ?? '');
        if (!at || !target || target.kind !== at.track.kind || frozen(at.track) || frozen(target)) return false;
        const start = place.start === undefined ? undefined : Math.max(0, quantize(place.start, fps()));
        return commit(moveClip(tl, id, { ...place, start }), { reason: 'imperative', id, action: 'move' });
      },
      /** Moves a clip's start or end edge to timeline time `at`. */
      trim: (id: string, edge: 'start' | 'end', at: number) => {
        const tl = store.get().value;
        const found = findClip(tl, id);
        if (!found || frozen(found.track)) return false;
        return commit(trimClip(tl, id, edge, quantize(at, fps()), limits(found.clip)), { reason: 'imperative', id, action: 'resize' });
      },
      /** Removes clips. */
      remove: (ids: string[]) => remove(ids, { reason: 'imperative' }),
      /** Hides, mutes or locks a track. */
      setTrack: (id: string, patch: Pick<Partial<TimelineTrack>, 'hidden' | 'muted' | 'locked'>, details: { reason: 'press' | 'imperative'; event?: Event } = { reason: 'imperative' }) => {
        if (store.get().readOnly) return false;
        return commit(updateTrack(store.get().value, id, patch), { ...details, id, action: 'track' });
      },
      /** Sets the zoom, in pixels per second (held within `timelineZoomRange`). */
      setZoom: (zoom: number, details: { reason: VideoTimelineZoomReason; event?: Event } = { reason: 'imperative' }) =>
        change('zoom', clampTimelineZoom(zoom), details),
      /** The scroll position that keeps a wheel zoom's anchor still, once `zoom` is the zoom rendered; then forgets it.
       *  Undefined when no wheel asked for this zoom (a controlled host refused it, or the zoom came from elsewhere). */
      zoomScroll: (zoom: number) => {
        const a = anchor;
        anchor = null;
        return a && a.zoom === zoom ? Math.max(0, a.time * zoom - a.x) : undefined;
      },
      /** Ends a drag and puts its clip back. */
      cancel: () => spans.cancel(),
      internal: { wheel },
      clipPointerdown(event: PointerEvent, id: string) {
        if (event.button !== 0) return;
        const { selectedClips, value } = store.get();
        if (!(event.shiftKey || event.metaKey || event.ctrlKey) && !selectedClips.includes(id)) select([id], { reason: 'item-press', event });
        const at = findClip(value, id);
        if (!at) return;
        const edge = (event.target as Element | null)?.closest<HTMLElement>('[data-span-edge]')?.dataset.spanEdge;
        grab = {
          id,
          offset: spans.valueAt(at.track.id, event.clientX, event.clientY) - at.clip.start,
          edge: edge === 'start' || edge === 'end' ? edge : null,
        };
        free = event.altKey;
        spans.spanPointerdown(event, id);
      },
      clipPointermove(event: PointerEvent) {
        free = event.altKey;
      },
      clipPress(id: string, event?: Event) {
        const { selectedClips } = store.get();
        const e = event as MouseEvent | KeyboardEvent | undefined;
        const additive = !!e && (e.shiftKey || ('metaKey' in e && (e.metaKey || e.ctrlKey)));
        const next = additive
          ? (selectedClips.includes(id) && e && !(e instanceof KeyboardEvent) ? selectedClips.filter((x) => x !== id) : [...new Set([...selectedClips, id])])
          : [id];
        select(next, { reason: 'item-press', event });
      },
      clipKeydown(event: KeyboardEvent, el: HTMLElement, id: string) {
        const tl = store.get().value;
        const at = findClip(tl, id);
        if (!at || event.defaultPrevented) return;
        if (event.key === 'Escape' && !store.get().draft) {
          if (store.get().selectedClips.length) { event.preventDefault(); select([], { reason: 'escape-key', event }); }
          return;
        }
        const editable = !frozen(at.track);
        if (editable && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault();
          const { selectedClips } = store.get();
          remove(selectedClips.includes(id) ? selectedClips : [id], { reason: 'remove-press', event });
          return;
        }
        const along = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
        const by = event.key === 'ArrowRight' ? 1 : -1;
        if (editable && along && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
          // The start edge (UI SDK's spans move only the end from the keyboard).
          event.preventDefault();
          const next = trimClip(tl, id, 'start', quantize(at.clip.start + by * frame(), fps()), limits(at.clip));
          if (commit(next, { reason: 'move-key', event, id, action: 'resize' })) say('resize', id, next);
          return;
        }
        if (editable && along && at.track.magnetic && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
          // Among a magnetic track's clips, a move is a step past the neighbour.
          event.preventDefault();
          const index = Math.max(0, Math.min(at.track.clips.length - 1, at.index + by));
          const next = moveClip(tl, id, { index });
          if (index !== at.index && commit(next, { reason: 'move-key', event, id, action: 'move' })) {
            say('move', id, next);
            keepFocus(() => context.element('clip', id));
          }
          return;
        }
        if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey && event.key.startsWith('Arrow')) {
          event.preventDefault();
          const to = neighbour(id, event.key, roving.items());
          if (to) roving.focus(to);
          return;
        }
        keyed = id;
        try {
          if (spans.keydown(event, id)) return;
        } finally {
          keyed = null;
        }
        roving.keydown(event, el);
      },
      trackPointerdown(event: PointerEvent, trackId: string, el: HTMLElement) {
        if (event.button !== 0 || event.target !== el) return;
        select([], { reason: 'track-press', event });
        context.options().playback.seek(spans.valueAt(trackId, event.clientX, event.clientY));
      },
    };
    return api;
  },
  slots: (slot) => ({
    root: slot<object, { value: Timeline; selectedClips: string[]; zoom: number; guide: number | null; lifted: { id: string; span: ClipSpan } | null; readOnly: boolean }>({
      state: (state) => {
        const span = state.draft?.action === 'move' ? state.draft.spans.find((s) => s.id === state.draft?.id) : undefined;
        return {
          value: state.preview ?? state.value,
          selectedClips: state.selectedClips,
          zoom: state.zoom,
          guide: state.guide,
          lifted: span ? { id: span.id, span } : null,
          readOnly: state.readOnly,
        };
      },
      role: 'group',
      attrs: (state) => ({ 'data-readonly': state.readOnly ? '' : undefined }),
    }),
    // What scrolls the lanes: ⌘/Ctrl + wheel over it zooms (core attaches the wheel to the element, so it can cancel).
    scroller: slot({
      on: {
        wheel: (event, { el, api }) => {
          if (el) api.internal.wheel(event, el);
        },
      },
    }),
    track: slot<{ value: string }>({
      props: { value: 'string' },
      role: 'group',
      attrs: (state, { key }) => ({
        'data-locked': state.value.tracks.find((t) => t.id === key)?.locked ? '' : undefined,
      }),
      on: {
        pointerdown: (event, { api, key, el }) => el && api.trackPointerdown(event as PointerEvent, key, el),
      },
      bind: (el, { api, key }) => api.spans.bindTrack(el, key),
    }),
    clip: slot<{ value: string }, { selected: boolean }>({
      props: { value: 'string' },
      role: 'button',
      focus: 'roving',
      press: ({ api, key }, event) => api.clipPress(key, event),
      state: (state, { key }) => ({ selected: state.selectedClips.includes(key) }),
      attrs: (state, part) => {
        const selected = state.selectedClips.includes(part.key);
        return {
          tabindex: part.api.roving.tabIndex(state, part),
          'aria-pressed': String(selected),
          'data-selected': selected ? '' : undefined,
          ...part.api.spans.spanAttrs(state as never, part.key),
        };
      },
      on: {
        pointerdown: (event, { api, key }) => api.clipPointerdown(event as PointerEvent, key),
        pointermove: (event, { api }) => api.clipPointermove(event as PointerEvent),
        keydown: (event, { api, key, el }) => el && api.clipKeydown(event as KeyboardEvent, el, key),
      },
      bind: (el, part) => {
        const a = part.api.spans.bindSpan(el, part.key);
        const b = part.api.roving.bind(el, part);
        return () => { a(); b(); };
      },
    }),
  }),
  agent: { actions: ['select', 'move', 'trim', 'remove', 'setTrack', 'setZoom'] },
});
