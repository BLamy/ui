// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NowPlayingBars } from '@/components/ui/now-playing-bars';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const durations = (root: Element) => Array.from(root.children).map((bar) => (bar as HTMLElement).style.getPropertyValue('--bl-eq-dur'));

describe('NowPlayingBars', () => {
  it('is hidden from assistive tech unless named, and an image when named', () => {
    const { container, rerender } = render(<NowPlayingBars />);
    expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
    rerender(<NowPlayingBars aria-label="Now playing" />);
    expect(screen.getByRole('img', { name: 'Now playing' }).getAttribute('data-playing')).toBe('true');
    rerender(<NowPlayingBars aria-label="Paused" playing={false} />);
    expect(screen.getByRole('img', { name: 'Paused' }).hasAttribute('data-playing')).toBe(false);
  });

  it('treats speed as a multiplier: 2 is twice as fast', () => {
    const { container, rerender } = render(<NowPlayingBars bars={2} />);
    expect(durations(container.firstElementChild!)).toEqual(['0.7s', '0.83s']);
    rerender(<NowPlayingBars bars={2} speed={2} />);
    expect(durations(container.firstElementChild!)).toEqual(['0.35s', '0.415s']);
  });

  it('passes DOM props through', () => {
    render(<NowPlayingBars id="eq" data-testid="eq" title="Playing" />);
    const root = screen.getByTestId('eq');
    expect(root.id).toBe('eq');
    expect(root.getAttribute('title')).toBe('Playing');
  });
});
