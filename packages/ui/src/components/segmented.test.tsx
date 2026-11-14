// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  Segmented, SegmentedItem, createSegmentedControlController, segmentIndicatorVariants, segmentItemVariants, segmentTrackVariants,
} from '@/components/ui/segmented';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle';

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

  it('takes a size, down to its segments and card', () => {
    const { container } = render(<Range size="sm" defaultValue="week" />);
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('data-size')).toBe('sm');
    expect(group.className).toContain('rounded-lg');
    expect(screen.getByRole('radio', { name: 'Day' }).className).toContain('h-7');
    expect(container.querySelector('[data-slot="segmented-control-indicator"]')!.className).toContain('rounded-[calc(var(--radius-lg)-2px)]');
    cleanup();
    render(<Range defaultValue="week" />);
    expect(screen.getByRole('radio', { name: 'Day' }).className).toContain('h-8');
  });
});

/** Tabs `segmented` and ToggleGroup `filled` are drawn by the same recipes, so the three are pixel-alike. */
describe('the segment track', () => {
  const has = (el: Element, recipe: string) => recipe.split(' ').every((c) => el.className.split(' ').includes(c));

  it('draws Segmented, segmented Tabs and a filled ToggleGroup with the same track, segments and card', () => {
    const { container } = render(
      <>
        <Range defaultValue="week" />
        <Tabs defaultValue="week">
          <TabsList aria-label="Range tabs">
            <TabsTab value="day">Day</TabsTab>
            <TabsTab value="week">Week</TabsTab>
          </TabsList>
        </Tabs>
        <ToggleGroup variant="filled" aria-label="Range toggles" defaultValue={['week']}>
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
        </ToggleGroup>
      </>,
    );
    const track = segmentTrackVariants();
    expect(has(screen.getByRole('radiogroup'), track)).toBe(true);
    expect(has(screen.getByRole('tablist'), track)).toBe(true);
    expect(has(screen.getByRole('group', { name: 'Range toggles' }), track)).toBe(true);
    // Ignore the background: a pressed toggle's merged classes drop `bg-transparent` for nothing else.
    const item = segmentItemVariants().replace('bg-transparent ', '');
    expect(has(screen.getByRole('radio', { name: 'Day' }), item)).toBe(true);
    expect(has(screen.getByRole('tab', { name: 'Day' }), item)).toBe(true);
    expect(has(screen.getByRole('button', { name: 'Day' }), item)).toBe(true);
    const card = segmentIndicatorVariants();
    expect(has(container.querySelector('[data-slot="segmented-control-indicator"]')!, card)).toBe(true);
    expect(has(container.querySelector('[data-slot="tabs-indicator"] > span')!, card)).toBe(true);
    expect(has(container.querySelector('[data-slot="selection-indicator"]')!, card)).toBe(true);
  });
});
