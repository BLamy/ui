// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion } from '@/lib/reduced-motion';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

const media = (reduce: boolean) => (query: string) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' }) as MediaQueryList;

afterEach(() => vi.unstubAllGlobals());

describe('prefersReducedMotion', () => {
  it('reads the global window by default', () => {
    vi.stubGlobal('matchMedia', media(true));
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('matchMedia', media(false));
    expect(prefersReducedMotion()).toBe(false);
  });

  it("reads the window it is given (an element's own, in a frame)", () => {
    vi.stubGlobal('matchMedia', media(false));
    expect(prefersReducedMotion({ matchMedia: media(true) })).toBe(true);
  });

  it('is false where there is no matchMedia (the server)', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});
