import { describe, expect, it } from 'vitest';
import {
  clipDuration, clipEnd, clipsAt, formatTimecode, insertClip, layoutTrack, lookCss, lookFfmpeg, magneticIndex, moveClip,
  parseTimecode, quantize, removeClips, sliceTimeline, snapTargets, snapTime, splitClip, timelineDuration, timelineLooks,
  trimClip,
  type Timeline, type TimelineClip, type TimelineTrack,
} from '@/lib/video-timeline';

/** A 4-second clip of media `a`, unless told otherwise. */
const clip = (id: string, p: Partial<TimelineClip> = {}): TimelineClip => ({ id, media: 'a', start: 0, in: 0, out: 4, ...p });
const track = (id: string, clips: TimelineClip[], p: Partial<TimelineTrack> = {}): TimelineTrack => ({ id, kind: 'video', clips, ...p });
const magnetic = (id: string, clips: TimelineClip[]) => track(id, clips, { magnetic: true });
/** A timeline laid out the way edits leave it. */
const timeline = (...tracks: TimelineTrack[]): Timeline => ({ tracks: tracks.map(layoutTrack) });

function trackOf(tl: Timeline, id: string): TimelineTrack {
  const found = tl.tracks.find((t) => t.id === id);
  if (!found) throw new Error(`No track ${id}`);
  return found;
}
function clipOf(tl: Timeline, id: string): TimelineClip {
  const found = tl.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
  if (!found) throw new Error(`No clip ${id}`);
  return found;
}
/** A track's clips as [id, start, end]. */
const spans = (t: TimelineTrack) => t.clips.map((c) => [c.id, c.start, clipEnd(c)]);

describe('clipDuration', () => {
  it('is the source length divided by the speed', () => {
    expect(clipDuration(clip('a', { in: 2, out: 10 }))).toBe(8);
    expect(clipDuration(clip('a', { in: 2, out: 10, speed: 2 }))).toBe(4);
    expect(clipDuration(clip('a', { in: 2, out: 10, speed: 0.5 }))).toBe(16);
    expect(clipEnd(clip('a', { start: 3, in: 2, out: 10, speed: 2 }))).toBe(7);
  });
  it('reads a speed of 0 as 1 and never goes below 0', () => {
    expect(clipDuration(clip('a', { out: 6, speed: 0 }))).toBe(6);
    expect(clipDuration(clip('a', { in: 5, out: 3 }))).toBe(0);
  });
});

describe('layoutTrack', () => {
  it("butts a magnetic track's clips end to end from 0, whatever their starts said", () => {
    const t = layoutTrack(magnetic('main', [clip('a', { start: 7 }), clip('b', { start: 1, out: 6 }), clip('c', { in: 2, out: 6, speed: 2 })]));
    expect(spans(t)).toEqual([['a', 0, 4], ['b', 4, 10], ['c', 10, 12]]);
  });
  it('overlaps a clip with the one before by its transition', () => {
    const t = layoutTrack(magnetic('main', [clip('a'), clip('b', { out: 6, transition: 1 })]));
    expect(spans(t)).toEqual([['a', 0, 4], ['b', 3, 9]]);
    expect(t.clips[1].transition).toBe(1);
  });
  it('keeps a dissolve within its clip and off the dissolve before it: never three clips at once', () => {
    // b lasts 2 s, so it dissolves in for at most 2 s; that uses all of b, so c can't dissolve in over it.
    const t = layoutTrack(magnetic('main', [clip('a', { out: 8 }), clip('b', { out: 2, transition: 3 }), clip('c', { out: 10, transition: 5 })]));
    expect(t.clips.map((c) => c.transition)).toEqual([undefined, 2, undefined]);
    expect(spans(t)).toEqual([['a', 0, 8], ['b', 6, 8], ['c', 8, 18]]);
    // With room left in b, c dissolves for as much as there is.
    const roomy = layoutTrack(magnetic('main', [clip('a', { out: 8 }), clip('b', { out: 4, transition: 1 }), clip('c', { out: 10, transition: 5 })]));
    expect(roomy.clips.map((c) => c.transition)).toEqual([undefined, 1, 3]);
  });
  it("drops the first clip's transition: there is nothing to dissolve from", () => {
    const [first, second] = layoutTrack(magnetic('main', [clip('a', { transition: 1 }), clip('b')])).clips;
    expect(first).not.toHaveProperty('transition');
    expect(first.start).toBe(0);
    expect(second.start).toBe(4);
  });
  it('sorts a free track by start and keeps its times, without touching the input', () => {
    const input = track('titles', [clip('b', { start: 5 }), clip('a', { start: 1 }), clip('c', { start: 3 })]);
    expect(spans(layoutTrack(input))).toEqual([['a', 1, 5], ['c', 3, 7], ['b', 5, 9]]);
    expect(input.clips.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('splitClip', () => {
  // 2–6 on the timeline: 8 s of source at double speed.
  const tl = timeline(track('v', [clip('a', { start: 2, in: 1, out: 9, speed: 2, fadeIn: 0.5, fadeOut: 0.5, volume: 0.8 })]));

  it('cuts a clip in two at a timeline time; the source cut honours the speed', () => {
    const [first, second] = trackOf(splitClip(tl, 'a', 4, 'a2'), 'v').clips;
    expect(first).toMatchObject({ id: 'a', start: 2, in: 1, out: 5, speed: 2, volume: 0.8 });
    expect(second).toMatchObject({ id: 'a2', media: 'a', start: 4, in: 5, out: 9, speed: 2, volume: 0.8 });
    expect(clipEnd(first)).toBe(4);
    expect(clipEnd(second)).toBe(6);
  });
  it('keeps the fade in on the first half and the fade out on the second', () => {
    const [first, second] = trackOf(splitClip(tl, 'a', 4, 'a2'), 'v').clips;
    expect(first.fadeIn).toBe(0.5);
    expect(first).not.toHaveProperty('fadeOut');
    expect(second).not.toHaveProperty('fadeIn');
    expect(second.fadeOut).toBe(0.5);
  });
  it('leaves a magnetic clip’s transition on the first half', () => {
    // b dissolves in over a from 3 to 4.
    const main = timeline(magnetic('main', [clip('a'), clip('b', { out: 6, transition: 1 })]));
    const out = splitClip(main, 'b', 6, 'b2');
    expect(spans(trackOf(out, 'main'))).toEqual([['a', 0, 4], ['b', 3, 6], ['b2', 6, 9]]);
    expect(clipOf(out, 'b').transition).toBe(1);
    expect(clipOf(out, 'b2')).not.toHaveProperty('transition');
  });
  it('does nothing at the clip’s edges, outside it, or for an unknown clip', () => {
    for (const at of [1, 2, 6, 7]) expect(splitClip(tl, 'a', at, 'a2')).toBe(tl);
    expect(splitClip(tl, 'nope', 4)).toBe(tl);
  });
  it('gives the second half a fresh id by default', () => {
    const [first, second] = trackOf(splitClip(tl, 'a', 4), 'v').clips;
    expect(first.id).toBe('a');
    expect(second.id).toMatch(/^clip-./);
  });

  it('leaves the edit in place when it cuts a clip shortly after its dissolve', () => {
    const main = timeline(magnetic('main', [clip('a'), clip('b', { out: 6, transition: 1 })]));
    const out = splitClip(main, 'b', 4.5, 'b2');
    expect(clipOf(out, 'b2').start).toBe(4.5);
    expect(timelineDuration(out)).toBe(timelineDuration(main));
  });
  it('refuses a cut inside a dissolve, which would move the edit', () => {
    // b dissolves in over a from 3 to 4.
    const main = timeline(magnetic('main', [clip('a'), clip('b', { out: 6, transition: 1 })]));
    expect(splitClip(main, 'b', 3.5, 'b2')).toBe(main);
    expect(splitClip(main, 'a', 3.5, 'a2')).toBe(main);
    expect(spans(trackOf(splitClip(main, 'a', 2, 'a2'), 'main'))).toEqual([['a', 0, 2], ['a2', 2, 4], ['b', 3, 9]]);
  });
});

describe('trimClip', () => {
  const free = timeline(track('v', [clip('a', { start: 2, in: 1, out: 5 })])); // 2–6
  const main = timeline(magnetic('main', [clip('a'), clip('b', { in: 2, out: 8 })])); // a 0–4, b 4–10

  it('moves the end edge: out follows, the start stays', () => {
    expect(clipOf(trimClip(free, 'a', 'end', 5), 'a')).toMatchObject({ start: 2, in: 1, out: 4 });
  });
  it('moves the start edge of a free clip: in and start move together and the end stays', () => {
    const c = clipOf(trimClip(free, 'a', 'start', 3), 'a');
    expect(c).toMatchObject({ start: 3, in: 2, out: 5 });
    expect(clipEnd(c)).toBe(6);
  });
  it('measures the trim in source time at the clip’s speed', () => {
    const fast = timeline(track('v', [clip('a', { start: 2, in: 2, out: 10, speed: 2 })])); // 2–6
    const c = clipOf(trimClip(fast, 'a', 'start', 3), 'a');
    expect(c).toMatchObject({ start: 3, in: 4, out: 10 });
    expect(clipEnd(c)).toBe(6);
    expect(clipOf(trimClip(fast, 'a', 'end', 5), 'a').out).toBe(8);
  });
  it('clamps out to the media’s length and to the shortest clip', () => {
    expect(clipOf(trimClip(free, 'a', 'end', 20, { mediaDuration: 7 }), 'a').out).toBe(7);
    expect(clipOf(trimClip(free, 'a', 'end', 0), 'a').out).toBeCloseTo(1.1); // 0.1 s by default
    expect(clipOf(trimClip(free, 'a', 'end', 0, { minDuration: 1 }), 'a').out).toBe(2);
  });
  it('clamps in to 0, to the shortest clip, and a free clip’s start to timeline 0', () => {
    expect(clipOf(trimClip(free, 'a', 'start', 0), 'a')).toMatchObject({ start: 1, in: 0, out: 5 });
    expect(clipOf(trimClip(free, 'a', 'start', 10, { minDuration: 1 }), 'a')).toMatchObject({ start: 5, in: 4, out: 5 });
    const late = timeline(track('v', [clip('a', { start: 1, in: 5, out: 8 })]));
    expect(clipOf(trimClip(late, 'a', 'start', -3), 'a')).toMatchObject({ start: 0, in: 4, out: 8 });
  });
  it('keeps a magnetic clip in place on a start trim, and the clips after it ripple', () => {
    const out = trimClip(main, 'a', 'start', 1);
    expect(clipOf(out, 'a')).toMatchObject({ start: 0, in: 1, out: 4 });
    expect(spans(trackOf(out, 'main'))).toEqual([['a', 0, 3], ['b', 3, 9]]);
  });
  it('ripples on an end trim too', () => {
    expect(spans(trackOf(trimClip(main, 'a', 'end', 2.5), 'main'))).toEqual([['a', 0, 2.5], ['b', 2.5, 8.5]]);
  });
  it('lets a magnetic clip’s start edge reach back to the start of its media', () => {
    expect(clipOf(trimClip(main, 'b', 'start', 0), 'b')).toMatchObject({ start: 4, in: 0, out: 8 });
  });
  it('does nothing for an unknown clip', () => {
    expect(trimClip(main, 'nope', 'end', 1)).toBe(main);
  });
});

describe('moveClip', () => {
  const tl = timeline(
    track('titles', [clip('t1', { start: 1, out: 2 }), clip('t2', { start: 6, out: 2, transition: 0.5 })]),
    magnetic('main', [clip('a'), clip('b', { out: 6 }), clip('c', { out: 2 })]), // a 0–4, b 4–10, c 10–12
  );

  it('moves a clip along a free track, but not before 0', () => {
    expect(spans(trackOf(moveClip(tl, 't1', { start: 8 }), 'titles'))).toEqual([['t2', 6, 8], ['t1', 8, 10]]);
    expect(clipOf(moveClip(tl, 't2', { start: -3 }), 't2').start).toBe(0);
  });
  it('reorders a magnetic track by index', () => {
    expect(spans(trackOf(moveClip(tl, 'c', { index: 0 }), 'main'))).toEqual([['c', 0, 2], ['a', 2, 6], ['b', 6, 12]]);
    expect(spans(trackOf(moveClip(tl, 'a', { index: 2 }), 'main'))).toEqual([['b', 0, 6], ['c', 6, 8], ['a', 8, 12]]);
  });
  it('reorders a magnetic track by where the clip is dropped', () => {
    expect(trackOf(moveClip(tl, 'c', { start: 1 }), 'main').clips.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });
  it('keeps a transition when the clip moves along its own magnetic track', () => {
    const dissolving = timeline(magnetic('main', [clip('a'), clip('b', { out: 6, transition: 1 }), clip('c', { out: 2 })]));
    const out = moveClip(dissolving, 'b', { index: 2 });
    expect(spans(trackOf(out, 'main'))).toEqual([['a', 0, 4], ['c', 4, 6], ['b', 5, 11]]);
    expect(clipOf(out, 'b').transition).toBe(1);
  });
  it('moves a clip onto a magnetic track from elsewhere without its transition', () => {
    const out = moveClip(tl, 't2', { trackId: 'main', index: 1 });
    expect(trackOf(out, 'titles').clips.map((c) => c.id)).toEqual(['t1']);
    expect(spans(trackOf(out, 'main'))).toEqual([['a', 0, 4], ['t2', 4, 6], ['b', 6, 12], ['c', 12, 14]]);
    expect(clipOf(out, 't2')).not.toHaveProperty('transition');
  });
  it('moves a clip off a magnetic track to a time on a free one, and the storyline closes up', () => {
    const out = moveClip(tl, 'b', { trackId: 'titles', start: 3 });
    expect(spans(trackOf(out, 'main'))).toEqual([['a', 0, 4], ['c', 4, 6]]);
    expect(spans(trackOf(out, 'titles'))).toEqual([['t1', 1, 3], ['b', 3, 9], ['t2', 6, 8]]);
  });
  it('does nothing for an unknown clip or track', () => {
    expect(moveClip(tl, 'nope', { start: 1 })).toBe(tl);
    expect(moveClip(tl, 'a', { trackId: 'nope' })).toBe(tl);
  });
});

describe('insertClip', () => {
  const tl = timeline(
    magnetic('main', [clip('a'), clip('b', { out: 6 })]), // a 0–4, b 4–10
    track('music', [clip('m', { start: 2, out: 8 })], { kind: 'audio' }),
  );
  const x = clip('x', { start: 99, out: 2 });

  it('puts a clip at an index on a magnetic track', () => {
    expect(spans(trackOf(insertClip(tl, 'main', x, { index: 1 }), 'main'))).toEqual([['a', 0, 4], ['x', 4, 6], ['b', 6, 12]]);
    expect(trackOf(insertClip(tl, 'main', x, { index: 0 }), 'main').clips[0].id).toBe('x');
  });
  it('puts it by time on a magnetic track: before the first clip whose middle is later, else at the end', () => {
    const main = trackOf(tl, 'main');
    expect([1, 3, 8].map((t) => magneticIndex(main, t))).toEqual([0, 1, 2]);
    expect(spans(trackOf(insertClip(tl, 'main', x, { start: 3 }), 'main'))).toEqual([['a', 0, 4], ['x', 4, 6], ['b', 6, 12]]);
    expect(spans(trackOf(insertClip(tl, 'main', x), 'main')).at(-1)).toEqual(['x', 10, 12]);
  });
  it('puts it at its start on a free track, not before 0, in order', () => {
    expect(spans(trackOf(insertClip(tl, 'music', clip('n', { out: 1 }), { start: 12 }), 'music'))).toEqual([['m', 2, 10], ['n', 12, 13]]);
    expect(spans(trackOf(insertClip(tl, 'music', clip('n', { start: 0.5, out: 1 })), 'music'))).toEqual([['n', 0.5, 1.5], ['m', 2, 10]]);
    expect(clipOf(insertClip(tl, 'music', clip('n', { out: 1 }), { start: -5 }), 'n').start).toBe(0);
  });
});

describe('removeClips', () => {
  const tl = timeline(
    magnetic('main', [clip('a'), clip('b', { out: 6 }), clip('c', { out: 2 })]),
    track('titles', [clip('t1', { start: 1, out: 2 }), clip('t2', { start: 6, out: 2 })]),
    track('music', [clip('m', { out: 8 })], { kind: 'audio' }),
  );

  it('closes the gap on a magnetic track; clips on a free track keep their times', () => {
    const out = removeClips(tl, ['b', 't1']);
    expect(spans(trackOf(out, 'main'))).toEqual([['a', 0, 4], ['c', 4, 6]]);
    expect(spans(trackOf(out, 'titles'))).toEqual([['t2', 6, 8]]);
  });
  it('leaves the other tracks as they were', () => {
    expect(trackOf(removeClips(tl, ['b']), 'music')).toBe(trackOf(tl, 'music'));
  });
});

describe('sliceTimeline', () => {
  const tl = timeline(
    // a 0–4 (8 s of source at double speed), b 4–10
    magnetic('main', [clip('a', { in: 1, out: 9, speed: 2, fadeIn: 0.5, fadeOut: 0.5 }), clip('b', { out: 6, fadeIn: 1, fadeOut: 1 })]),
    track('titles', [clip('t', { start: 11, out: 2 })]),
  );

  it('cuts clips at the range edges at their speed, drops the fades there, and moves the range to 0', () => {
    const out = sliceTimeline(tl, 2, 8);
    expect(trackOf(out, 'main').clips).toEqual([
      { id: 'a', media: 'a', start: 0, in: 5, out: 9, speed: 2, fadeOut: 0.5 },
      { id: 'b', media: 'a', start: 2, in: 0, out: 4, fadeIn: 1 },
    ]);
    expect(trackOf(out, 'main').magnetic).toBe(true);
    expect(trackOf(out, 'titles').clips).toEqual([]);
    expect(timelineDuration(out)).toBe(6);
  });
  it('cuts a clip that spans the whole range at both ends', () => {
    const long = timeline(track('v', [clip('l', { in: 0, out: 20, speed: 2, fadeIn: 1, fadeOut: 1 })])); // 0–10
    expect(clipOf(sliceTimeline(long, 2, 6), 'l')).toEqual({ id: 'l', media: 'a', start: 0, in: 4, out: 12, speed: 2 });
  });
  it('drops a transition the range starts inside, and keeps one wholly in the range', () => {
    const main = timeline(magnetic('main', [clip('a'), clip('b', { out: 6, transition: 1 })])); // b dissolves in 3–4
    expect(clipOf(sliceTimeline(main, 3.5, 9), 'b')).not.toHaveProperty('transition');
    expect(clipOf(sliceTimeline(main, 2, 9), 'b')).toMatchObject({ start: 1, transition: 1 });
  });
});

describe('snapping', () => {
  const tl = timeline(track('v', [clip('a', { start: 1, out: 2 }), clip('b', { start: 5, out: 3 })])); // 1–3, 5–8

  it('collects 0, every clip edge and the extra times, sorted and once each', () => {
    expect(snapTargets(tl)).toEqual([0, 1, 3, 5, 8]);
    expect(snapTargets(tl, { exclude: ['b'], extra: [4.5, 1] })).toEqual([0, 1, 3, 4.5]);
  });
  it('snaps to the nearest target within the threshold, else stays', () => {
    const targets = snapTargets(tl);
    expect(snapTime(2.8, targets, 0.25)).toEqual({ time: 3, snapped: true });
    expect(snapTime(4.2, targets, 1.5)).toEqual({ time: 5, snapped: true }); // 3 is in reach too, but further
    expect(snapTime(3.5, [3], 0.5)).toEqual({ time: 3, snapped: true });
    expect(snapTime(2, targets, 0.5)).toEqual({ time: 2, snapped: false });
  });
});

describe('clipsAt', () => {
  it('lists what plays at a time, top track first; a clip covers its start but not its end', () => {
    const tl = timeline(
      track('titles', [clip('t', { start: 2, out: 2 })]),
      magnetic('main', [clip('a'), clip('b', { out: 6 })]),
    );
    const at = (t: number) => clipsAt(tl, t).map(({ track: tr, clip: c }) => `${tr.id}/${c.id}`);
    expect(at(0)).toEqual(['main/a']);
    expect(at(3)).toEqual(['titles/t', 'main/a']);
    expect(at(4)).toEqual(['main/b']);
    expect(at(10)).toEqual([]);
  });
});

describe('timecode', () => {
  it('formats minutes, seconds and tenths', () => {
    expect(formatTimecode(62.5)).toBe('1:02.5');
    expect(formatTimecode(0)).toBe('0:00.0');
    expect(formatTimecode(59.99)).toBe('0:59.9'); // tenths are cut, not rounded up
    expect(formatTimecode(3600)).toBe('60:00.0');
    expect(formatTimecode(-62.5)).toBe('-1:02.5');
  });
  it('formats hours:minutes:seconds:frames with fps', () => {
    expect(formatTimecode(62.5, 30)).toBe('00:01:02:15');
    expect(formatTimecode(3725.24, 25)).toBe('01:02:05:06');
    expect(formatTimecode(29 / 30, 30)).toBe('00:00:00:29');
    expect(formatTimecode(-62.5, 30)).toBe('-00:01:02:15');
  });
  it('reads timecode back into seconds', () => {
    expect(parseTimecode('1:02.5')).toBe(62.5);
    expect(parseTimecode('62.5')).toBe(62.5);
    expect(parseTimecode(' 1:02:03 ')).toBe(3723);
    expect(parseTimecode('00:01:02:15', 30)).toBe(62.5);
  });
  it('round-trips what formatTimecode writes', () => {
    for (const t of [0, 0.5, 62.5, 3599.9]) expect(parseTimecode(formatTimecode(t))).toBeCloseTo(t);
    for (const t of [0, 62.5, 3725.24]) expect(parseTimecode(formatTimecode(t, 25), 25)).toBeCloseTo(quantize(t, 25));
  });
  it('is NaN for what it cannot read, and for frames without fps', () => {
    for (const text of ['', '   ', 'abc', '1::02', '1:02x', '5.', '1:-2']) expect(parseTimecode(text), text).toBeNaN();
    expect(parseTimecode('00:01:02:15')).toBeNaN();
  });

  it('round-trips at a fractional frame rate (non-drop-frame) and with a sign', () => {
    expect(parseTimecode(formatTimecode(1000, 29.97), 29.97)).toBeCloseTo(1000, 1);
    expect(parseTimecode(formatTimecode(-62.5))).toBeCloseTo(-62.5);
    expect(parseTimecode(formatTimecode(-62.5, 30), 30)).toBeCloseTo(-62.5);
  });
});

describe('looks', () => {
  it('none is no filter at all', () => {
    for (const look of ['none', undefined] as const) {
      expect(lookCss(look)).toBe('');
      expect(lookFfmpeg(look)).toBe('');
    }
  });
  it('mono desaturates', () => {
    expect(lookCss('mono')).toBe('saturate(0)');
    expect(lookFfmpeg('mono')).toContain('hue=s=0');
  });
  it('sepia mixes the channels with the CSS sepia matrix, blended with the identity when partial', () => {
    expect(lookCss('sepia')).toBe('sepia(1)');
    expect(lookFfmpeg('sepia')).toBe('colorchannelmixer=rr=0.393:rg=0.769:rb=0.189:gr=0.349:gg=0.686:gb=0.168:br=0.272:bg=0.534:bb=0.131');
    expect(lookFfmpeg('vintage')).toMatch(/^colorchannelmixer=rr=0\.757:rg=0\.308:rb=0\.076:gr=0\.14:gg=0\.874:gb=0\.067:br=0\.109:bg=0\.214:bb=0\.652,/);
  });
  it('turns CSS contrast into a pchip curve: clipped through mid grey above 1, lifted ends below', () => {
    expect(lookCss('noir')).toBe('saturate(0) contrast(1.35) brightness(0.95)');
    expect(lookFfmpeg('noir')).toBe("hue=s=0,curves=all='0/0 0.13/0 0.87/1 1/1':interp=pchip,colorchannelmixer=rr=0.95:gg=0.95:bb=0.95");
    expect(lookFfmpeg('fade')).toContain("curves=all='0/0.075 1/0.925':interp=pchip");
  });
  it('gives every listed look both forms', () => {
    for (const { id } of timelineLooks) {
      expect(lookCss(id) !== '', id).toBe(id !== 'none');
      expect(lookFfmpeg(id) !== '', id).toBe(id !== 'none');
    }
  });
});
