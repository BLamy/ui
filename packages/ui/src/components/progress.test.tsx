// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from '@/components/ui/progress';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('Progress', () => {
  it('is a progressbar named by its label, with the value as its range and text', () => {
    const { container } = render(<Progress label="Uploading" value={38} />);
    const bar = screen.getByRole('progressbar', { name: 'Uploading' });
    expect(bar.getAttribute('data-slot')).toBe('progress');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('38');
    expect(bar.getAttribute('aria-valuetext')).toBe('38%');
    expect(bar.hasAttribute('data-progressing')).toBe(true);
    const fill = container.querySelector<HTMLElement>('[data-slot="progress-track"] [data-slot="progress-indicator"]')!;
    expect(fill.style.width).toBe('38%');
    // No visible value unless asked for.
    expect(container.querySelector('[data-slot="progress-value"]')).toBeNull();
  });

  it('is named by aria-label when it has no visible label', () => {
    const { container } = render(<Progress aria-label="Storage used" value={64} size="sm" tone="success" />);
    expect(screen.getByRole('progressbar', { name: 'Storage used' })).toBeTruthy();
    expect(container.querySelector('[data-slot="progress-label"]')).toBeNull();
    expect(container.querySelector('[data-slot="progress-track"]')!.className).toContain('h-1');
    expect(container.querySelector('[data-slot="progress-indicator"]')!.className).toContain('bg-success');
  });

  it('shows the percentage, or the value in a format of its own', () => {
    const percent = render(<Progress label="Export" showValue value={25} />);
    // The default percentage is a NumberMorph, whose rolling digits read as one number.
    expect(percent.container.querySelector('[data-slot="progress-value"] [data-slot="number-morph"] .sr-only')!.textContent).toBe('25%');
    percent.unmount();
    const custom = render(<Progress label="Copying" showValue value={3} max={12} format={(value) => `${value} of 12 files`} />);
    expect(custom.container.querySelector('[data-slot="progress-value"]')!.textContent).toBe('3 of 12 files');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('3 of 12 files');
  });

  it('is indeterminate without a value, and complete at the end', () => {
    const { container, rerender } = render(<Progress label="Preparing" showValue />);
    const bar = screen.getByRole('progressbar');
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.hasAttribute('data-indeterminate')).toBe(true);
    const fill = container.querySelector<HTMLElement>('[data-slot="progress-indicator"]')!;
    expect(fill.hasAttribute('data-indeterminate')).toBe(true);
    expect(fill.style.width).toBe('');
    expect(container.querySelector('[data-slot="progress-value"]')!.hasAttribute('data-indeterminate')).toBe(true);
    rerender(<Progress label="Preparing" showValue value={100} />);
    expect(bar.hasAttribute('data-complete')).toBe(true);
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('has a warning tone, and a reduced-motion indeterminate look that is not a partial bar', () => {
    const { container, rerender } = render(<Progress aria-label="Sync" value={40} tone="warning" />);
    expect(container.querySelector('[data-slot="progress-indicator"]')!.className).toContain('bg-warning');
    rerender(<Progress aria-label="Sync" />);
    const cls = container.querySelector('[data-slot="progress-indicator"]')!.className;
    expect(cls).toContain('motion-reduce:data-indeterminate:w-full');
    expect(cls).toContain('motion-reduce:data-indeterminate:opacity-35');
  });

  it('formats the rolling percentage in its locale', () => {
    const { container } = render(<Progress aria-label="Export" showValue value={25} locale="de-DE" />);
    expect(container.querySelector('[data-slot="number-morph"] .sr-only')!.textContent).toBe(new Intl.NumberFormat('de-DE', { style: 'percent' }).format(0.25));
  });

  it('places a value between min and max', () => {
    const { container } = render(<Progress aria-label="Step" value={3} min={1} max={5} />);
    expect(container.querySelector<HTMLElement>('[data-slot="progress-indicator"]')!.style.width).toBe('50%');
  });

  it('takes parts of your own in place of the ones made from its props', () => {
    const { container } = render(
      <Progress value={40}>
        <ProgressLabel>Sync</ProgressLabel>
        <ProgressTrack size="lg"><ProgressIndicator tone="destructive" /></ProgressTrack>
        <ProgressValue />
      </Progress>,
    );
    expect(screen.getByRole('progressbar', { name: 'Sync' })).toBeTruthy();
    expect(container.querySelector('[data-slot="progress-track"]')!.className).toContain('h-2.5');
    expect(container.querySelector('[data-slot="progress-indicator"]')!.className).toContain('bg-destructive');
    expect(container.querySelector('[data-slot="progress"]')!.lastElementChild!.textContent).toBe('40%');
  });
});
