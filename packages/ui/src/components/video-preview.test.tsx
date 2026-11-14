// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VideoPreview, VideoPreviewControls, VideoPreviewTimecode } from '@/components/ui/video-preview';
import { createPlayback } from '@/lib/playback';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('VideoPreviewControls', () => {
  it('is a toolbar named Playback with one tab stop and arrows between its buttons', () => {
    const clock = createPlayback({ duration: 10 });
    render(<VideoPreviewControls playback={clock} />);
    const bar = screen.getByRole('toolbar', { name: 'Playback' });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Go to start', 'Previous frame', 'Play', 'Next frame', 'Go to end']);
    expect(buttons.filter((b) => b.getAttribute('tabindex') === '0')).toHaveLength(1);
    act(() => { buttons[0].focus(); });
    act(() => { fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' }); });
    expect(document.activeElement).toBe(buttons[1]);
    act(() => { fireEvent.keyDown(document.activeElement!, { key: 'End' }); });
    expect(document.activeElement).toBe(buttons[4]);
    expect(bar.contains(document.activeElement)).toBe(true);
  });

  it('steps frames, jumps to the ends, and plays and pauses the clock', () => {
    const clock = createPlayback({ duration: 10 });
    render(<VideoPreviewControls playback={clock} fps={10} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Next frame' })); });
    expect(clock.getState().time).toBeCloseTo(0.1);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Go to end' })); });
    expect(clock.getState().time).toBe(10);
    expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Go to start' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Play' })); });
    expect(clock.getState().playing).toBe(true);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Pause' })); });
    expect(clock.getState().playing).toBe(false);
  });

  it('shows the time as timecode', () => {
    const clock = createPlayback({ duration: 10, time: 1.5 });
    render(<VideoPreviewTimecode playback={clock} fps={10} showDuration />);
    expect(document.body.textContent).toBe('00:00:01:05 / 00:00:10:00');
  });
});

describe('VideoPreview', () => {
  it('is a named group (default "Preview") that passes its props through', () => {
    const playback = createPlayback({ duration: 10 });
    const empty = { tracks: [] };
    const { rerender } = render(<VideoPreview timeline={empty} media={{}} playback={playback} format={{ width: 16, height: 9 }} />);
    expect(screen.getByRole('group', { name: 'Preview' })).toBeTruthy();
    rerender(<VideoPreview timeline={empty} media={{}} playback={playback} format={{ width: 16, height: 9 }} aria-label="Program" id="program" />);
    expect(screen.getByRole('group', { name: 'Program' }).id).toBe('program');
  });
});
