// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePersistentState } from '@/lib/persistent-state';

beforeEach(() => localStorage.clear());
const isNumber = (v: unknown): v is number => typeof v === 'number';

describe('usePersistentState', () => {
  it('starts from the stored value, else the initial one', () => {
    localStorage.setItem('a', '4');
    expect(renderHook(() => usePersistentState('a', 0, isNumber)).result.current[0]).toBe(4);
    expect(renderHook(() => usePersistentState('b', 9, isNumber)).result.current[0]).toBe(9);
  });
  it('ignores a stored value of the wrong shape', () => {
    localStorage.setItem('a', '"nope"');
    expect(renderHook(() => usePersistentState('a', 1, isNumber)).result.current[0]).toBe(1);
  });
  it('writes changes, but not the initial value', () => {
    const { result } = renderHook(() => usePersistentState('a', 0, isNumber));
    expect(localStorage.getItem('a')).toBeNull();
    act(() => result.current[1](3));
    expect(localStorage.getItem('a')).toBe('3');
  });
  it('loads the new key when the key changes, and never overwrites it with the old key’s state', () => {
    localStorage.setItem('a', '1');
    localStorage.setItem('b', '2');
    const { result, rerender } = renderHook(({ k }) => usePersistentState(k, 0, isNumber), { initialProps: { k: 'a' } });
    expect(result.current[0]).toBe(1);
    rerender({ k: 'b' });
    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem('b')).toBe('2');
    expect(localStorage.getItem('a')).toBe('1');
    act(() => result.current[1](5));
    expect(localStorage.getItem('b')).toBe('5');
    expect(localStorage.getItem('a')).toBe('1');
  });
  it('falls back to the initial value for a new key with nothing stored', () => {
    localStorage.setItem('a', '1');
    const { result, rerender } = renderHook(({ k }) => usePersistentState(k, 0, isNumber), { initialProps: { k: 'a' } });
    rerender({ k: 'fresh' });
    expect(result.current[0]).toBe(0);
    expect(localStorage.getItem('fresh')).toBeNull();
  });
  it('is plain state with a null key', () => {
    const { result } = renderHook(() => usePersistentState(null, 0));
    act(() => result.current[1](8));
    expect(result.current[0]).toBe(8);
    expect(localStorage.length).toBe(0);
  });
});
