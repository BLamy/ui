// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useControllableChange } from '@/lib/controllable-state';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

describe('useControllableChange', () => {
  it('reports the change with details first, then moves an uncontrolled value', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableChange<number, 'add'>(undefined, 1, onChange));
    let moved = false;
    act(() => {
      moved = result.current[1]((n) => n + 1, { reason: 'add' });
    });
    expect(moved).toBe(true);
    expect(result.current[0]).toBe(2);
    const [next, details] = onChange.mock.calls[0];
    expect(next).toBe(2);
    expect(details).toMatchObject({ reason: 'add', source: 'programmatic', canceled: false });
  });
  it('keeps an uncontrolled value when the consumer cancels', () => {
    const { result } = renderHook(() =>
      useControllableChange<number, 'add'>(undefined, 1, (_next, details) => details.cancel()),
    );
    let moved = true;
    act(() => {
      moved = result.current[1](5, { reason: 'add' });
    });
    expect(moved).toBe(false);
    expect(result.current[0]).toBe(1);
  });
  it('defaults the reason to imperative and skips a change to the same value', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableChange<number, 'imperative'>(undefined, 3, onChange));
    act(() => {
      expect(result.current[1](3)).toBe(false);
      result.current[1](4);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][1].reason).toBe('imperative');
  });
  it('never writes a controlled value: later updaters start from what the parent passed back', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableChange<string[], 'remove'>(['a', 'b'], [], onChange));
    act(() => {
      result.current[1]((list) => list.filter((x) => x !== 'a'), { reason: 'remove' });
    });
    expect(result.current[0]).toEqual(['a', 'b']); // the parent refused
    act(() => {
      result.current[1]((list) => list.filter((x) => x !== 'b'), { reason: 'remove' });
    });
    expect(onChange.mock.calls.map(([next]) => next)).toEqual([['b'], ['a']]);
  });
  it('passes the event through and reads its source', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableChange<boolean, 'press'>(undefined, false, onChange));
    const event = new MouseEvent('click');
    act(() => {
      result.current[1](true, { reason: 'press', event, source: 'keyboard' });
    });
    expect(onChange.mock.calls[0][1]).toMatchObject({ event, source: 'keyboard' });
  });
});
