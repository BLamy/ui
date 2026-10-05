import type { TimelineDrop } from '@/components/ui/video-timeline';
import type { Playback } from '@/lib/playback';
import {
  clipEnd, findClip, insertClip, quantize, removeClips, splitClip, timelineDuration, timelineId,
  type Timeline, type TimelineClip, type TimelineTrack,
} from '@/lib/video-timeline';
import { STILL_SECONDS } from './media';
import { useEditor } from './store';
import { TITLE_MEDIA } from './titles';

/* The editor's verbs, shared by the toolbar, the panels, the timeline and the keyboard. Each is one undo step and
   selects what it made. */

const firstOf = (tl: Timeline, test: (t: TimelineTrack) => boolean) => tl.tracks.find(test);

export function useActions(clock: Playback) {
  const ed = useEditor();
  const fps = ed.project.format.fps;
  const now = () => quantize(clock.getState().time, fps);
  const place = (clip: TimelineClip, trackId: string, at: { time?: number; index?: number }) => {
    ed.edit((cur) => insertClip(cur, trackId, clip, { start: at.time, index: at.index }));
    ed.select([clip.id]);
  };
  return {
    /** Puts a library item on the timeline: where it was dropped, else pictures at the end of the main track and sound
     *  at the playhead on the first audio track. */
    addMedia(mediaId: string, drop?: TimelineDrop) {
      const m = ed.media[mediaId];
      if (!m || m.status !== 'ready') return;
      const tl = ed.project.timeline;
      const clip: TimelineClip = { id: timelineId(), media: mediaId, start: 0, in: 0, out: m.kind === 'image' ? STILL_SECONDS : m.duration };
      const dropped = drop && tl.tracks.find((t) => t.id === drop.trackId);
      if (m.kind === 'audio' || dropped?.kind === 'audio') {
        const track = dropped?.kind === 'audio' ? dropped : firstOf(tl, (t) => t.kind === 'audio' && !t.locked);
        if (track) place(clip, track.id, { time: drop?.time ?? now() });
        return;
      }
      const track = dropped ?? firstOf(tl, (t) => t.kind === 'video' && !!t.magnetic) ?? firstOf(tl, (t) => t.kind === 'video');
      if (!track || track.locked) return;
      place(clip, track.id, track.magnetic ? { index: drop?.index } : { time: drop?.time ?? now() });
    },
    /** A title at the playhead, on the top video track that isn't the main one. */
    addTitle(text = 'Title') {
      const tl = ed.project.timeline;
      const track = firstOf(tl, (t) => t.kind === 'video' && !t.magnetic && !t.locked);
      if (!track) return;
      place({ id: timelineId(), media: TITLE_MEDIA, label: 'Title', start: 0, in: 0, out: 3, fadeIn: 0.3, fadeOut: 0.3, data: { text, style: 'lower-third' } }, track.id, { time: now() });
    },
    /** Cuts at the playhead: the selected clips under it, else every unlocked clip under it. */
    split() {
      const t = now();
      const tl = ed.project.timeline;
      const under = tl.tracks.filter((tr) => !tr.locked).flatMap((tr) => tr.clips.filter((c) => c.start < t && t < clipEnd(c)));
      const picked = under.filter((c) => ed.selection.includes(c.id));
      const targets = picked.length ? picked : under;
      if (!targets.length) return;
      const made: string[] = [];
      ed.edit((cur) => targets.reduce((acc, c) => {
        const id = timelineId();
        made.push(id);
        return splitClip(acc, c.id, t, id);
      }, cur));
      ed.select(made);
    },
    /** A copy of each selected clip: right after it on the main track, at the playhead elsewhere. */
    duplicate() {
      const tl = ed.project.timeline;
      const copies: string[] = [];
      let next = tl;
      for (const id of ed.selection) {
        const at = findClip(next, id);
        if (!at || at.track.locked) continue;
        const copy = { ...at.clip, id: timelineId() };
        delete copy.transition;
        copies.push(copy.id);
        next = at.track.magnetic ? insertClip(next, at.track.id, copy, { index: at.index + 1 }) : insertClip(next, at.track.id, copy, { start: clipEnd(at.clip) });
      }
      if (!copies.length) return;
      ed.edit(() => next);
      ed.select(copies);
    },
    /** Removes the selected clips (the main track closes up). */
    remove() {
      const tl = ed.project.timeline;
      const ids = ed.selection.filter((id) => { const at = findClip(tl, id); return at && !at.track.locked; });
      if (!ids.length) return;
      ed.edit((cur) => removeClips(cur, ids));
      ed.select([]);
    },
    /** Selects every clip. */
    selectAll() {
      ed.select(ed.project.timeline.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    },
    duration: () => timelineDuration(ed.project.timeline),
  };
}
