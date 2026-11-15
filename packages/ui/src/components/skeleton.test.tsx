// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Skeleton, SkeletonText, skeletonVariants } from '@/components/ui/skeleton';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('Skeleton', () => {
  it('is a hidden block with its shape, size and classes', () => {
    const { container } = render(<Skeleton shape="circle" width={40} height="2rem" className="custom" />);
    const el = container.querySelector<HTMLElement>('[data-slot=skeleton]')!;
    expect(el.tagName).toBe('DIV');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.dataset.shape).toBe('circle');
    expect(el.style.width).toBe('40px');
    expect(el.style.height).toBe('2rem');
    expect(el.className).toContain('custom');
  });

  it('renders another element with `render`, for phrasing content', () => {
    const { container } = render(<p><Skeleton shape="text" render={<span />} /></p>);
    expect(container.querySelector('p > span[data-slot=skeleton]')).not.toBeNull();
  });

  it('sweeps a sheen lighter than the bar in both appearances', () => {
    const recipe = skeletonVariants();
    expect(recipe).toContain('var(--skeleton-sheen)');
    expect(recipe).toContain('dark:[--skeleton-sheen:color-mix(in_oklab,var(--foreground)_8%,transparent)]');
  });

  it('stacks text lines with a shorter last line', () => {
    const { container } = render(<SkeletonText lines={3} lastLineWidth="50%" />);
    const lines = container.querySelectorAll<HTMLElement>('[data-slot=skeleton]');
    expect(lines).toHaveLength(3);
    expect(lines[2].style.width).toBe('50%');
  });
});
