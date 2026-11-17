// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { fitVideoTimelineZoom, videoTimelineMediaType, VideoTimeline, type VideoTimelineDropDetails, type VideoTimelineChangeDetails } from '@/components/ui/video-timeline';
import { createPlayback } from '@/lib/playback';
import { findClip, layoutTrack, type Timeline } from '@/lib/video-timeline-model';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const MEDIA = {
  a: { duration: 10, kind: 'video', name: 'Alpha' },
  b: { duration: 10, kind: 'video', name: 'Bravo' },
  c: { duration: 10, kind: 'video', name: 'Charlie' },
  t: { duration: Infinity, kind: 'image', name: 'Title' },
  s: { duration: 6, kind: 'audio', name: 'Song' },
} as const;

const START: Timeline = {
  tracks: [
    { id: 'titles', kind: 'video', name: 'Titles', clips: [{ id: 't1', media: 't', start: 1, in: 0, out: 2 }, { id: 't2', media: 't', start: 5, in: 0, out: 1 }] },
    layoutTrack({
      id: 'main', kind: 'video', name: 'Main', magnetic: true,
      clips: [{ id: 'a1', media: 'a', start: 0, in: 0, out: 2 }, { id: 'b1', media: 'b', start: 0, in: 0, out: 2 }, { id: 'c1', media: 'c', start: 0, in: 0, out: 2 }],
    }),
    { id: 'music', kind: 'audio', name: 'Music', clips: [{ id: 's1', media: 's', start: 0, in: 0, out: 4 }] },
  ],
};

function Editor({ onValueChange, onSelectedClipsChange, readOnly, initial = START }: {
  onValueChange?: (value: Timeline, details: VideoTimelineChangeDetails) => void;
  onSelectedClipsChange?: (ids: string[]) => void;
  readOnly?: boolean;
  initial?: Timeline;
}) {
  const [value, setValue] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [clock] = useState(() => createPlayback({ duration: 10 }));
  return (
    <VideoTimeline value={value} playback={clock} media={MEDIA} fps={10} readOnly={readOnly}
      onValueChange={(v, d) => { onValueChange?.(v, d); setValue(v); }}
      selectedClips={selected} onSelectedClipsChange={(ids) => { onSelectedClipsChange?.(ids); setSelected(ids); }} />
  );
}

const clip = (name: RegExp | string) => screen.getByRole('button', { name: typeof name === 'string' ? new RegExp(`^${name},`) : name });
const key = (el: Element, k: string, mods: Partial<KeyboardEventInit> = {}) => act(() => { fireEvent.keyDown(el, { key: k, ...mods }); });
const focus = (el: HTMLElement) => act(() => { el.focus(); });

describe('VideoTimeline', () => {
  it('names the timeline, its tracks and clips, and gives the clips one tab stop', () => {
    render(<Editor />);
    expect(screen.getByRole('group', { name: 'Timeline' })).toBeTruthy();
    for (const name of ['Titles', 'Main', 'Music']) expect(screen.getAllByRole('group', { name }).length).toBeGreaterThan(0);
    const clips = screen.getAllByRole('button').filter((b) => b.closest('[data-slot=video-timeline-track]'));
    expect(clips).toHaveLength(6);
    expect(clips.filter((c) => c.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(clip('Alpha').getAttribute('aria-label')).toBe('Alpha, 0:00.0 to 0:02.0');
    expect(clip('Alpha').getAttribute('aria-pressed')).toBe('false');
  });

  it('moves focus between clips with ⌥ + arrows, and Home/End along a track', () => {
    render(<Editor />);
    const a = clip('Alpha');
    focus(a);
    key(a, 'ArrowRight', { altKey: true });
    expect(document.activeElement).toBe(clip('Bravo'));
    expect(clip('Bravo').getAttribute('tabindex')).toBe('0');
    key(document.activeElement!, 'End');
    expect(document.activeElement).toBe(clip('Charlie'));
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(clip('Alpha'));
    key(document.activeElement!, 'ArrowDown', { altKey: true });
    expect(document.activeElement).toBe(clip('Song'));
    key(document.activeElement!, 'ArrowUp', { altKey: true });
    key(document.activeElement!, 'ArrowUp', { altKey: true });
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Title, 0:01\.0/);
  });

  it('nudges a clip on a free track a frame, and moves its end and start from the keyboard', () => {
    const onValueChange = vi.fn();
    render(<Editor onValueChange={onValueChange} />);
    const t = screen.getAllByRole('button', { name: /^Title, 0:01/ })[0];
    focus(t);
    key(t, 'ArrowRight');
    let [value, details] = onValueChange.mock.lastCall!;
    expect(findClip(value, 't1')!.clip.start).toBeCloseTo(1.1);
    expect(details).toMatchObject({ reason: 'move-key', id: 't1', action: 'move' });
    expect(details.event).toBeInstanceOf(KeyboardEvent);
    key(document.activeElement!, 'ArrowRight', { shiftKey: true });
    [value, details] = onValueChange.mock.lastCall!;
    expect(findClip(value, 't1')!.clip.out).toBeCloseTo(2.1);
    expect(details).toMatchObject({ reason: 'move-key', action: 'resize' });
    key(document.activeElement!, 'ArrowRight', { shiftKey: true, altKey: true });
    [value, details] = onValueChange.mock.lastCall!;
    const c = findClip(value, 't1')!.clip;
    expect(c.start).toBeCloseTo(1.2);
    expect(c.in).toBeCloseTo(0.1);
    expect(c.out).toBeCloseTo(2.1);
    // The media starts at `in` 0: the start can't go back past where the clip first was.
    onValueChange.mockClear();
    key(document.activeElement!, 'ArrowLeft', { shiftKey: true, altKey: true });
    key(document.activeElement!, 'ArrowLeft', { shiftKey: true, altKey: true });
    expect(findClip(onValueChange.mock.lastCall![0], 't1')!.clip.in).toBeCloseTo(0);
    expect(details).toMatchObject({ reason: 'move-key', action: 'resize' });
  });

  it('steps a magnetic clip past its neighbour, keeping focus on it', async () => {
    const onValueChange = vi.fn();
    render(<Editor onValueChange={onValueChange} />);
    const a = clip('Alpha');
    focus(a);
    key(a, 'ArrowRight');
    const [value, details] = onValueChange.mock.lastCall!;
    expect(value.tracks[1].clips.map((c: { id: string }) => c.id)).toEqual(['b1', 'a1', 'c1']);
    expect(details).toMatchObject({ reason: 'move-key', id: 'a1', action: 'move' });
    await tick();
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Alpha, 0:02\.0 to 0:04\.0/);
  });

  it('moves a clip to the next track of its kind with ↑/↓, never onto another kind', async () => {
    const onValueChange = vi.fn();
    render(<Editor onValueChange={onValueChange} />);
    const t = screen.getAllByRole('button', { name: /^Title, 0:05/ })[0];
    focus(t);
    key(t, 'ArrowDown');
    const [value, details] = onValueChange.mock.lastCall!;
    expect(findClip(value, 't2')!.track.id).toBe('main');
    expect(details).toMatchObject({ reason: 'move-key', id: 't2', action: 'move' });
    await tick();
    const moved = screen.getAllByRole('button', { name: /^Title, / }).find((el) => el === document.activeElement);
    expect(moved).toBeTruthy();
    onValueChange.mockClear();
    key(document.activeElement!, 'ArrowDown');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('selects with Enter (⇧ adds), clears with Escape, and Delete removes the selection', () => {
    const onValueChange = vi.fn();
    const onSelectedClipsChange = vi.fn();
    render(<Editor onValueChange={onValueChange} onSelectedClipsChange={onSelectedClipsChange} />);
    const a = clip('Alpha');
    focus(a);
    act(() => { fireEvent.keyDown(a, { key: 'Enter' }); fireEvent.keyUp(a, { key: 'Enter' }); fireEvent.click(a, { detail: 0 }); });
    expect(onSelectedClipsChange).toHaveBeenLastCalledWith(['a1']);
    expect(clip('Alpha').getAttribute('aria-pressed')).toBe('true');
    const c = clip('Charlie');
    act(() => { fireEvent.click(c, { shiftKey: true }); });
    expect(onSelectedClipsChange).toHaveBeenLastCalledWith(['a1', 'c1']);
    key(clip('Alpha'), 'Escape');
    expect(onSelectedClipsChange).toHaveBeenLastCalledWith([]);
    act(() => { fireEvent.click(clip('Alpha')); });
    act(() => { fireEvent.click(clip('Charlie'), { shiftKey: true }); });
    key(clip('Charlie'), 'Delete');
    const [value, details] = onValueChange.mock.lastCall!;
    expect(value.tracks[1].clips.map((x: { id: string }) => x.id)).toEqual(['b1']);
    expect(details).toMatchObject({ reason: 'remove-press', action: 'delete' });
    expect(onSelectedClipsChange).toHaveBeenLastCalledWith([]);
  });

  it('changes nothing on a locked track or when read-only', () => {
    const onValueChange = vi.fn();
    const locked: Timeline = { tracks: START.tracks.map((t) => (t.id === 'main' ? { ...t, locked: true } : t)) };
    const { unmount } = render(<Editor onValueChange={onValueChange} initial={locked} />);
    const a = clip('Alpha');
    focus(a);
    key(a, 'ArrowRight');
    key(a, 'ArrowRight', { shiftKey: true });
    key(a, 'Delete');
    expect(onValueChange).not.toHaveBeenCalled();
    unmount();
    render(<Editor onValueChange={onValueChange} readOnly />);
    focus(clip('Song'));
    key(clip('Song'), 'ArrowRight');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Mute Titles' })); });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('reports a track header toggle as a press on that track', () => {
    const onValueChange = vi.fn();
    render(<Editor onValueChange={onValueChange} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Lock Music' })); });
    const [value, details] = onValueChange.mock.lastCall!;
    expect(value.tracks[2].locked).toBe(true);
    expect(details).toMatchObject({ reason: 'press', id: 'music', action: 'track' });
  });

  it('names each header toggle after its track, and passes a div\'s props and ref to the root', () => {
    let root: HTMLDivElement | null = null;
    const clock = createPlayback({ duration: 10 });
    render(<VideoTimeline defaultValue={START} playback={clock} media={MEDIA} id="tl" data-testid="timeline" ref={(el) => { root = el; }} />);
    for (const name of ['Hide Titles', 'Mute Titles', 'Lock Titles', 'Hide Main', 'Mute Music', 'Lock Music']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(root).toBe(document.getElementById('tl'));
    expect((root as unknown as HTMLElement).dataset.testid).toBe('timeline');
  });

  it('draws the slashed glyph while a track is muted', () => {
    render(<Editor />);
    const mute = screen.getByRole('button', { name: 'Mute Music' });
    const before = mute.innerHTML;
    act(() => { fireEvent.click(mute); });
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    expect(mute.innerHTML).not.toBe(before);
  });

  it('takes its header width, and fitVideoTimelineZoom fits the lanes beside it', () => {
    const clock = createPlayback({ duration: 10 });
    const { container } = render(<VideoTimeline value={START} playback={clock} media={MEDIA} headerWidth={80} />);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--header')).toBe('80px');
    expect(fitVideoTimelineZoom(10, 1000, { headerWidth: 80 })).toBeCloseTo((1000 - 80 - 24) / 10);
    expect(fitVideoTimelineZoom(10, 1000)).toBeCloseTo((1000 - 132 - 24) / 10);
  });

  it('announces a keyboard edit', async () => {
    render(<Editor />);
    const t = screen.getAllByRole('button', { name: /^Title, 0:01/ })[0];
    focus(t);
    key(t, 'ArrowRight');
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    expect(document.querySelector('[data-ui-sdk-announcer=""]')?.textContent).toBe('Title, Titles, 0:01.1 to 0:03.1.');
  });

  describe('with a pointer', () => {
    // happy-dom lays nothing out: each lane is 1400 px wide from the left edge, 50 px tall, so with the lanes running
    // the timeline and its tail (6 + 8 s) a pixel is 0.01 s.
    const layOut = () => {
      document.querySelectorAll<HTMLElement>('[data-slot=video-timeline-track]').forEach((el, i) => {
        el.getBoundingClientRect = () => ({ left: 0, right: 1400, width: 1400, top: i * 50, bottom: i * 50 + 50, height: 50, x: 0, y: i * 50, toJSON: () => ({}) });
      });
    };
    const drag = (el: Element, from: { x: number; y: number }, to: { x: number; y: number }, mods: { altKey?: boolean } = {}) => {
      act(() => { fireEvent.pointerDown(el, { button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', clientX: from.x, clientY: from.y, isPrimary: true }); });
      act(() => { fireEvent.pointerMove(el, { buttons: 1, pointerId: 1, pointerType: 'mouse', clientX: (from.x + to.x) / 2, clientY: (from.y + to.y) / 2, ...mods }); });
      act(() => { fireEvent.pointerMove(el, { buttons: 1, pointerId: 1, pointerType: 'mouse', clientX: to.x, clientY: to.y, ...mods }); });
    };
    const drop = (el: Element, at: { x: number; y: number }) => act(() => { fireEvent.pointerUp(el, { pointerId: 1, pointerType: 'mouse', clientX: at.x, clientY: at.y }); });

    it('drags a clip along its track, frame by frame, as one change', () => {
      const onValueChange = vi.fn();
      render(<Editor onValueChange={onValueChange} />);
      layOut();
      const t2 = screen.getAllByRole('button', { name: /^Title, 0:05/ })[0];
      drag(t2, { x: 550, y: 25 }, { x: 693, y: 25 }, { altKey: true });
      expect(onValueChange).not.toHaveBeenCalled();
      drop(t2, { x: 693, y: 25 });
      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [value, details] = onValueChange.mock.lastCall!;
      expect(findClip(value, 't2')!.clip.start).toBeCloseTo(6.4);
      expect(details).toMatchObject({ reason: 'drag', id: 't2', action: 'move' });
    });

    it('snaps a dragged clip to another clip\'s edge, unless ⌥ is held', () => {
      const onValueChange = vi.fn();
      render(<Editor onValueChange={onValueChange} />);
      layOut();
      const t2 = screen.getAllByRole('button', { name: /^Title, 0:05/ })[0];
      // From 5 s to 6.05 s: 6 s, where the main track ends, is within 8 px at 60 px a second.
      drag(t2, { x: 550, y: 25 }, { x: 655, y: 25 });
      drop(t2, { x: 655, y: 25 });
      expect(findClip(onValueChange.mock.lastCall![0], 't2')!.clip.start).toBeCloseTo(6);
    });

    it('drags a magnetic clip among the others, which make room', () => {
      const onValueChange = vi.fn();
      render(<Editor onValueChange={onValueChange} />);
      layOut();
      const a = clip('Alpha');
      drag(a, { x: 100, y: 75 }, { x: 520, y: 75 });
      drop(a, { x: 520, y: 75 });
      const [value, details] = onValueChange.mock.lastCall!;
      expect(value.tracks[1].clips.map((c: { id: string }) => c.id)).toEqual(['b1', 'c1', 'a1']);
      expect(value.tracks[1].clips.map((c: { start: number }) => c.start)).toEqual([0, 2, 4]);
      expect(details).toMatchObject({ reason: 'drag', id: 'a1', action: 'move' });
    });

    it('puts a clip back when Escape cancels the drag', () => {
      const onValueChange = vi.fn();
      render(<Editor onValueChange={onValueChange} />);
      layOut();
      const t2 = screen.getAllByRole('button', { name: /^Title, 0:05/ })[0];
      drag(t2, { x: 550, y: 25 }, { x: 700, y: 25 });
      act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
      drop(t2, { x: 700, y: 25 });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('trims an edge no further than the media lasts, and keeps a clip off a track of another kind', () => {
      const onValueChange = vi.fn();
      render(<Editor onValueChange={onValueChange} />);
      layOut();
      const song = clip('Song');
      const end = song.querySelector('[data-span-edge=end]')!;
      drag(end, { x: 400, y: 125 }, { x: 1300, y: 125 });
      drop(end, { x: 1300, y: 125 });
      let [value, details] = onValueChange.mock.lastCall!;
      expect(findClip(value, 's1')!.clip.out).toBeCloseTo(6);
      expect(details).toMatchObject({ reason: 'drag', id: 's1', action: 'resize' });
      onValueChange.mockClear();
      // A video clip dragged down over the music lane stays on a video track.
      const t1 = screen.getAllByRole('button', { name: /^Title, 0:01/ })[0];
      drag(t1, { x: 150, y: 25 }, { x: 250, y: 125 }, { altKey: true });
      drop(t1, { x: 250, y: 125 });
      [value, details] = onValueChange.mock.lastCall!;
      expect(findClip(value, 't1')!.track.kind).toBe('video');
      expect(findClip(value, 't1')!.clip.start).toBeCloseTo(2);
    });
  });

  it('makes the ruler a slider for the playhead', () => {
    let clock!: ReturnType<typeof createPlayback>;
    function Ruler() {
      const [c] = useState(() => createPlayback({ duration: 10 }));
      clock = c;
      return <VideoTimeline value={START} playback={c} media={MEDIA} fps={10} />;
    }
    render(<Ruler />);
    const playhead = screen.getByRole('slider', { name: 'Playhead' });
    expect(playhead.getAttribute('aria-valuetext')).toBe('00:00:00:00');
    act(() => { playhead.focus(); });
    key(playhead, 'ArrowRight');
    expect(clock.getState().time).toBeCloseTo(0.1);
    key(playhead, 'ArrowRight', { shiftKey: true });
    expect(clock.getState().time).toBeCloseTo(1.1);
    expect(screen.getByRole('slider', { name: 'Playhead' }).getAttribute('aria-valuetext')).toBe('00:00:01:01');
  });
});

describe('VideoTimeline zoom and drops', () => {
  // The scroller sits at the page's origin with its 132 px header; a lane starts there less the scroll.
  const HEADER = 132;
  let spy: { mockRestore: () => void } | null = null;
  afterEach(() => { spy?.mockRestore(); spy = null; });
  const laneRects = () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-slot') === 'video-timeline-track') {
        const sc = this.closest('[data-slot="video-timeline-scroller"]') as HTMLElement;
        return { left: HEADER - sc.scrollLeft, top: 0, right: 2000, bottom: 40, width: 2000, height: 40, x: HEADER - sc.scrollLeft, y: 0, toJSON: () => ({}) } as DOMRect;
      }
      return original.call(this);
    });
  };
  function Zoomed({ accept, onZoomChange, external }: { accept: boolean; onZoomChange: (zoom: number, details: { reason: string; event?: Event }) => void; external?: number }) {
    const [own, setZoom] = useState(60);
    const zoom = external ?? own;
    const [clock] = useState(() => createPlayback({ duration: 10 }));
    return (
      <VideoTimeline value={START} playback={clock} media={MEDIA} fps={10} zoom={zoom}
        onZoomChange={(z, d) => { onZoomChange(z, d); if (accept) setZoom(z); }} />
    );
  }
  const scroller = () => document.querySelector<HTMLElement>('[data-slot="video-timeline-scroller"]')!;
  const wheel = (deltaY: number, clientX: number, mods: Partial<WheelEventInit> = { ctrlKey: true }) => {
    const event = new WheelEvent('wheel', { deltaY, clientX, cancelable: true, bubbles: true });
    // happy-dom's WheelEvent leaves out the modifier keys and the pointer's position.
    Object.defineProperties(event, { ctrlKey: { value: !!mods.ctrlKey }, clientX: { value: clientX } });
    act(() => { scroller().dispatchEvent(event); });
    return event;
  };

  it('zooms with ⌘/Ctrl + wheel around the pointer, as reason wheel', () => {
    laneRects();
    const onZoomChange = vi.fn();
    render(<Zoomed accept onZoomChange={onZoomChange} />);
    scroller().scrollLeft = 120;
    // 180 px into the lanes' view at 120 px of scroll and 60 px/s: 5 s is under the pointer.
    const event = wheel(-10, HEADER + 180);
    expect(event.defaultPrevented).toBe(true);
    const [zoom, details] = onZoomChange.mock.lastCall!;
    expect(details.reason).toBe('wheel');
    expect(details.event).toBe(event);
    expect(zoom).toBeCloseTo(60 * Math.exp(0.1));
    // 5 s is still 180 px into the view.
    expect(scroller().scrollLeft).toBeCloseTo(5 * zoom - 180);
    // A plain wheel scrolls, as it would anyway.
    onZoomChange.mockClear();
    expect(wheel(-10, HEADER + 180, {}).defaultPrevented).toBe(false);
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it('leaves the scroll alone when a controlled host refuses the zoom, and later zooms keep no stale anchor', () => {
    laneRects();
    const onZoomChange = vi.fn();
    const { rerender } = render(<Zoomed accept={false} onZoomChange={onZoomChange} />);
    scroller().scrollLeft = 120;
    wheel(-10, HEADER + 180);
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(scroller().scrollLeft).toBe(120);
    // A zoom from somewhere else (a zoom slider) isn't the refused wheel's: the view doesn't jump to its anchor.
    rerender(<Zoomed accept={false} onZoomChange={onZoomChange} external={90} />);
    expect(scroller().scrollLeft).toBe(120);
  });

  it('reports media dropped on a lane with UI SDK details, and a canceled drop is not taken', () => {
    laneRects();
    const drops: [string, VideoTimelineDropDetails][] = [];
    let refuse = false;
    function Drops() {
      const [clock] = useState(() => createPlayback({ duration: 10 }));
      return (
        <VideoTimeline value={START} playback={clock} media={MEDIA} fps={10} zoom={60}
          onDropMedia={(id, details) => { drops.push([id, details]); if (refuse) details.cancel(); }} />
      );
    }
    render(<Drops />);
    const lane = document.querySelector('[data-slot="video-timeline-track"]')!;
    const dataTransfer = { types: [videoTimelineMediaType], getData: (type: string) => (type === videoTimelineMediaType ? 'b' : ''), dropEffect: 'none' };
    const dropAt = (clientX: number) => {
      const event = new Event('drop', { bubbles: true, cancelable: true });
      Object.assign(event, { dataTransfer, clientX });
      act(() => { lane.dispatchEvent(event); });
      return event;
    };
    // 90 px into the Titles lane at 60 px/s: 1.5 s.
    const taken = dropAt(HEADER + 90);
    expect(taken.defaultPrevented).toBe(true);
    const [id, details] = drops[0];
    expect(id).toBe('b');
    expect(details).toMatchObject({ reason: 'drop', source: 'programmatic', trackId: 'titles', time: 1.5, index: undefined });
    expect(details.event).toBe(taken);
    refuse = true;
    expect(dropAt(HEADER + 90).defaultPrevented).toBe(false);
    expect(drops[1][1].canceled).toBe(true);
  });
});
