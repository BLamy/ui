// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useControllableState } from '@/lib/controllable-state';

describe('useControllableState', () => {
  it('holds its own state when uncontrolled, starting at the default', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState<boolean>(undefined, true, onChange));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });
  it('leaves the decision to the parent when controlled', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(({ v }) => useControllableState<boolean>(v, true, onChange), { initialProps: { v: false } });
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(result.current[0]).toBe(false); // the parent has not passed the new value yet
    rerender({ v: true });
    expect(result.current[0]).toBe(true);
  });
  it('treats a controlled falsy value as controlled, not as missing', () => {
    const { result } = renderHook(() => useControllableState<number | null>(null, 5));
    expect(result.current[0]).toBeNull();
    act(() => result.current[1](7));
    expect(result.current[0]).toBeNull();
  });
});
