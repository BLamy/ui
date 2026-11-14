// @vitest-environment happy-dom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnterExit, usePresence, usePresenceList, type PresenceEntry } from './presence';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
afterEach(cleanup);

/* happy-dom runs no CSS transitions, so every exit would finish at once. Give each element a 30 ms transition, as a
   browser would report it, so the tests see the exit while it plays. */
function fakeTransitions() {
  const style = document.createElement('style');
  style.textContent = '* { transition-duration: 0.03s; transition-delay: 0s; animation-duration: 0s; animation-delay: 0s; animation-iteration-count: 1 }';
  document.head.append(style);
  const original = HTMLElement.prototype.getAnimations;
  HTMLElement.prototype.getAnimations = function () {
    const finished = new Promise<void>((resolve) => setTimeout(resolve, 30));
    return [{ transitionProperty: 'opacity', finished, finish: () => undefined, effect: { getComputedTiming: () => ({ endTime: 30, localTime: 0 }) } }] as unknown as Animation[];
  };
  return () => {
    HTMLElement.prototype.getAnimations = original;
    style.remove();
  };
}
let restore: () => void = () => {};
beforeEach(() => {
  restore = fakeTransitions();
});
afterEach(() => restore());

/** Lets UI SDK's presence take its frames (it waits a frame and a task before reading animations). */
const frames = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });

function Toast({ shown, appear, instant }: { shown: boolean; appear?: boolean; instant?: boolean }) {
  const presence = usePresence<HTMLDivElement>(shown, { appear, instant });
  return presence.mounted ? <div ref={presence.ref} data-testid="toast" data-leaving={presence.leaving || undefined} /> : null;
}

describe('usePresence', () => {
  it('plays nothing on first paint, an enter when it appears later, and an exit before it unmounts', async () => {
    const { rerender } = render(<Toast shown />);
    expect(screen.getByTestId('toast').hasAttribute('data-starting-style')).toBe(false);
    rerender(<Toast shown={false} />);
    const leaving = screen.getByTestId('toast');
    // Still mounted, playing its exit: UI SDK's data-ending-style and inert.
    expect(leaving.hasAttribute('data-ending-style')).toBe(true);
    expect(leaving.hasAttribute('data-leaving')).toBe(true);
    expect(leaving.inert).toBe(true);
    await frames();
    expect(screen.queryByTestId('toast')).toBeNull();
    rerender(<Toast shown />);
    expect(screen.getByTestId('toast').hasAttribute('data-starting-style')).toBe(true);
    await frames();
    expect(screen.getByTestId('toast').hasAttribute('data-starting-style')).toBe(false);
  });

  it('plays the enter on first paint with appear', () => {
    render(<Toast shown appear />);
    expect(screen.getByTestId('toast').hasAttribute('data-starting-style')).toBe(true);
  });

  it('comes back without unmounting when shown again mid-exit', async () => {
    const { rerender } = render(<Toast shown />);
    const el = screen.getByTestId('toast');
    rerender(<Toast shown={false} />);
    rerender(<Toast shown />);
    await frames();
    expect(screen.getByTestId('toast')).toBe(el);
    expect(el.hasAttribute('data-ending-style')).toBe(false);
    expect(el.inert).toBe(false);
  });

  it('plays the appear enter under Strict Mode too, through its re-run', async () => {
    render(
      <React.StrictMode>
        <Toast shown appear />
      </React.StrictMode>,
    );
    const toast = screen.getByTestId('toast');
    // The re-run kept the enter the first run started rather than stopping it.
    expect(toast.hasAttribute('data-starting-style')).toBe(true);
    await frames();
    expect(toast.hasAttribute('data-starting-style')).toBe(false);
  });

  it('a real change still stops what is playing: shown again mid-enter, then hidden, it exits', async () => {
    const { rerender } = render(<React.StrictMode><Toast shown={false} /></React.StrictMode>);
    rerender(<React.StrictMode><Toast shown /></React.StrictMode>);
    const toast = screen.getByTestId('toast');
    expect(toast.hasAttribute('data-starting-style')).toBe(true);
    rerender(<React.StrictMode><Toast shown={false} /></React.StrictMode>);
    expect(toast.hasAttribute('data-starting-style')).toBe(false);
    expect(toast.hasAttribute('data-ending-style')).toBe(true);
    await frames();
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('with instant, comes and goes at once and plays nothing', () => {
    const { rerender } = render(<Toast shown instant />);
    rerender(<Toast shown={false} instant />);
    expect(screen.queryByTestId('toast')).toBeNull();
    rerender(<Toast shown instant />);
    expect(screen.getByTestId('toast').hasAttribute('data-starting-style')).toBe(false);
    // Once it isn't instant any more, changes play again.
    rerender(<Toast shown={false} />);
    expect(screen.getByTestId('toast').hasAttribute('data-ending-style')).toBe(true);
  });

  it('does not take a Strict Mode re-run of the first paint for an appearance', () => {
    render(
      <React.StrictMode>
        <Toast shown />
      </React.StrictMode>,
    );
    expect(screen.getByTestId('toast').hasAttribute('data-starting-style')).toBe(false);
  });
});

function Row({ entry, onExited }: { entry: PresenceEntry<string>; onExited: (key: string) => void }) {
  const ref = React.useRef<HTMLLIElement>(null);
  useEnterExit(ref, entry.present, {
    appear: entry.appear,
    exited: () => {
      onExited(entry.key);
      entry.exited();
    },
  });
  return (
    <li ref={ref} data-present={entry.present || undefined}>
      {entry.item}
    </li>
  );
}

function Rows({ items, onExited = () => {} }: { items: string[]; onExited?: (key: string) => void }) {
  const entries = usePresenceList(items, (item) => item);
  return (
    <ul>
      {entries.map((entry) => (
        <Row key={entry.key} entry={entry} onExited={onExited} />
      ))}
    </ul>
  );
}

const texts = () => Array.from(document.querySelectorAll('li')).map((li) => li.textContent);

describe('usePresenceList', () => {
  it('keeps a removed item where it stood until its exit has played', async () => {
    const onExited = vi.fn();
    const { rerender } = render(<Rows items={['a', 'b', 'c']} onExited={onExited} />);
    rerender(<Rows items={['a', 'c']} onExited={onExited} />);
    expect(texts()).toEqual(['a', 'b', 'c']);
    const b = screen.getByText('b');
    expect(b.hasAttribute('data-present')).toBe(false);
    expect(b.hasAttribute('data-ending-style')).toBe(true);
    await frames();
    expect(onExited).toHaveBeenCalledWith('b');
    expect(texts()).toEqual(['a', 'c']);
  });

  it('plays the enter only for items that arrive after the first paint', () => {
    const { rerender } = render(<Rows items={['a']} />);
    expect(screen.getByText('a').hasAttribute('data-starting-style')).toBe(false);
    rerender(<Rows items={['a', 'b']} />);
    expect(screen.getByText('b').hasAttribute('data-starting-style')).toBe(true);
  });

  it('brings a leaving item back when its key returns', async () => {
    const { rerender } = render(<Rows items={['a', 'b']} />);
    const b = screen.getByText('b');
    rerender(<Rows items={['a']} />);
    rerender(<Rows items={['a', 'b']} />);
    await frames();
    expect(screen.getByText('b')).toBe(b);
    expect(b.hasAttribute('data-present')).toBe(true);
    expect(texts()).toEqual(['a', 'b']);
  });
});
