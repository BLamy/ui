// @vitest-environment happy-dom
import { useState } from 'react';
import { cleanup, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoTimeline } from '@/components/ui/video-timeline';
import { createPlayback } from '@/lib/playback';
import { findClip, layoutTrack, type Timeline } from '@/lib/video-timeline-model';
import { entry, expectNamed, mount, run } from '../../test/agent-harness';

/* VideoTimeline's primitive (lib/video-timeline-primitive) driven only through the agent bridge: its actions
   `select`, `move`, `trim`, `remove`, `setTrack` and `setZoom` reach the consumer with `source: 'agent'`. */

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

const START: Timeline = {
  tracks: [
    { id: 'titles', kind: 'video', name: 'Titles', clips: [{ id: 't1', media: 't', start: 1, in: 0, out: 2 }] },
    layoutTrack({ id: 'main', kind: 'video', name: 'Main', magnetic: true, clips: [{ id: 'a1', media: 'a', start: 0, in: 0, out: 2 }, { id: 'b1', media: 'b', start: 0, in: 0, out: 4 }] }),
  ],
};
const MEDIA = { a: { duration: 5, kind: 'video', name: 'Alpha' }, b: { duration: 5, kind: 'video', name: 'Bravo' }, t: { duration: Infinity, kind: 'image', name: 'Title' } } as const;

function Editor({ onValueChange, onSelectedClipsChange }: { onValueChange: (v: Timeline, d: { source: string; reason: string }) => void; onSelectedClipsChange: (ids: string[], d: { source: string }) => void }) {
  const [value, setValue] = useState(START);
  const [selected, setSelected] = useState<string[]>([]);
  const [clock] = useState(() => createPlayback({ duration: 10 }));
  return (
    <VideoTimeline aria-label="Edit" value={value} playback={clock} media={MEDIA} fps={10}
      onValueChange={(v, d) => { setValue(v); onValueChange(v, d); }}
      selectedClips={selected} onSelectedClipsChange={(ids, d) => { setSelected(ids); onSelectedClipsChange(ids, d); }} />
  );
}

describe('VideoTimeline is agent-ready', () => {
  it('selects, moves, trims and removes clips, and locks a track, through the bridge', async () => {
    const onValueChange = vi.fn();
    const onSelectedClipsChange = vi.fn();
    await mount(<Editor onValueChange={onValueChange} onSelectedClipsChange={onSelectedClipsChange} />);
    expectNamed(agent.snapshot(), ['Edit']);
    expect(entry(agent.snapshot(), 'Edit')).toMatchObject({ component: 'video-timeline' });

    await run(agent, [{ ref: 'Edit', action: 'select', args: [['b1']] }]);
    expect(onSelectedClipsChange).toHaveBeenLastCalledWith(['b1'], expect.objectContaining({ source: 'agent' }));
    expect(screen.getByRole('button', { name: /^Bravo/ }).getAttribute('aria-pressed')).toBe('true');

    await run(agent, [{ ref: 'Edit', action: 'move', args: ['t1', { start: 3 }] }]);
    let [value, details] = onValueChange.mock.lastCall!;
    expect(findClip(value, 't1')!.clip.start).toBe(3);
    expect(details).toMatchObject({ reason: 'imperative', source: 'agent', id: 't1', action: 'move' });

    await run(agent, [{ ref: 'Edit', action: 'move', args: ['b1', { index: 0 }] }]);
    expect(onValueChange.mock.lastCall![0].tracks[1].clips.map((c: { id: string }) => c.id)).toEqual(['b1', 'a1']);

    await run(agent, [{ ref: 'Edit', action: 'trim', args: ['b1', 'end', 5] }]);
    [value, details] = onValueChange.mock.lastCall!;
    expect(findClip(value, 'b1')!.clip.out).toBe(5);
    expect(details).toMatchObject({ source: 'agent', action: 'resize' });

    await run(agent, [{ ref: 'Edit', action: 'remove', args: [['a1']] }]);
    expect(findClip(onValueChange.mock.lastCall![0], 'a1')).toBeNull();

    await run(agent, [{ ref: 'Edit', action: 'setTrack', args: ['main', { locked: true }] }]);
    [value, details] = onValueChange.mock.lastCall!;
    expect(value.tracks[1].locked).toBe(true);
    expect(details).toMatchObject({ source: 'agent', id: 'main', action: 'track' });

    // A locked track's clips don't move.
    onValueChange.mockClear();
    await run(agent, [{ ref: 'Edit', action: 'trim', args: ['b1', 'end', 4] }]);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
