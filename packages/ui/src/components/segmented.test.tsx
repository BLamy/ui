// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Segmented, SegmentedItem, createSegmentedControlController } from '@/components/ui/segmented';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const checked = () => screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent);

function Range(props: Partial<React.ComponentProps<typeof Segmented>>) {
  return (
    <Segmented aria-label="Range" {...props}>
      <SegmentedItem value="day">Day</SegmentedItem>
      <SegmentedItem value="week">Week</SegmentedItem>
      <SegmentedItem value="month">Month</SegmentedItem>
    </Segmented>
  );
}

describe('Segmented', () => {
  it('is a named radio group with one tab stop, on the checked segment', () => {
    render(<Range defaultValue="week" />);
    const group = screen.getByRole('radiogroup', { name: 'Range' });
    expect(group.getAttribute('data-slot')).toBe('segmented-control');
    expect(checked()).toEqual(['Week']);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(screen.getByRole('radio', { name: 'Week' }).hasAttribute('data-checked')).toBe(true);
  });

  it('checks a segment on press, and says why', () => {
    const onValueChange = vi.fn();
    render(<Range defaultValue="day" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(checked()).toEqual(['Month']);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('month', expect.objectContaining({ reason: 'item-press' }));
    // Pressing the checked segment again changes nothing.
    fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('moves and checks with the arrow keys, wrapping at the ends', () => {
    const onValueChange = vi.fn();
    render(<Range defaultValue="day" onValueChange={onValueChange} />);
    const [day, week, month] = screen.getAllByRole('radio');
    day.focus();
    fireEvent.keyDown(day, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(week);
    expect(checked()).toEqual(['Week']);
    expect(onValueChange).toHaveBeenLastCalledWith('week', expect.objectContaining({ reason: 'list-navigation' }));
    fireEvent.keyDown(week, { key: 'ArrowLeft' });
    fireEvent.keyDown(day, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(month);
    expect(checked()).toEqual(['Month']);
  });

  it('skips a disabled segment', () => {
    render(
      <Segmented aria-label="Plan" defaultValue="monthly">
        <SegmentedItem value="monthly">Monthly</SegmentedItem>
        <SegmentedItem value="yearly" disabled>Yearly</SegmentedItem>
        <SegmentedItem value="lifetime">Lifetime</SegmentedItem>
      </Segmented>,
    );
    const [monthly, yearly, lifetime] = screen.getAllByRole('radio');
    expect(yearly.hasAttribute('data-disabled')).toBe(true);
    fireEvent.click(yearly);
    expect(checked()).toEqual(['Monthly']);
    monthly.focus();
    fireEvent.keyDown(monthly, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(lifetime);
  });

  it('follows a controlled value, and a controller checks a segment', () => {
    const controller = createSegmentedControlController();
    const onValueChange = vi.fn();
    render(<Range value="day" onValueChange={onValueChange} controller={controller} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Week' }));
    expect(onValueChange).toHaveBeenLastCalledWith('week', expect.anything());
    expect(checked()).toEqual(['Day']);
    act(() => { controller.setValue('month'); });
    expect(onValueChange).toHaveBeenLastCalledWith('month', expect.objectContaining({ reason: 'imperative' }));
  });

  it('renders the sliding card itself, behind the segments', () => {
    const { container } = render(<Range defaultValue="week" />);
    const indicators = container.querySelectorAll('[data-slot="segmented-control-indicator"]');
    expect(indicators).toHaveLength(1);
    expect(indicators[0].parentElement).toBe(screen.getByRole('radiogroup'));
    expect(indicators[0].getAttribute('role')).toBe('presentation');
    expect(indicators[0].className).toContain('top-(--segmented-control-indicator-top)');
  });

  it('submits its value with a form', () => {
    render(<form data-testid="form"><Range name="range" defaultValue="week" /></form>);
    expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('range')).toBe('week');
  });
});
