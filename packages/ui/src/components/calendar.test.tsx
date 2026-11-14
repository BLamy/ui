// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Calendar,
  CalendarDay,
  CalendarGrid,
  CalendarHeader,
  CalendarHeading,
  CalendarMonthSelect,
  CalendarWeeks,
  CalendarYearSelect,
  createCalendarController,
} from '@/components/ui/calendar';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

/* Every calendar is pinned to en-US and September 2026, so names and grids are the same on any day. */
const en = { locale: 'en-US', defaultMonth: '2026-09' } as const;
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const day = (name: string) => screen.getByRole('gridcell', { name });
const cell = (date: string) => document.querySelector<HTMLElement>(`[data-slot=calendar-day][data-value="${date}"]`)!;
const heading = () => screen.getByRole('heading').textContent;

describe('Calendar', () => {
  it('shows the month of the value: a heading, a grid named by its month and one cell per day', async () => {
    const { container } = render(<Calendar locale="en-US" defaultValue="2026-09-09" />);
    await settle();
    expect(heading()).toBe('September 2026');
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((h) => h.getAttribute('aria-label'))).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    expect(screen.getAllByRole('gridcell', { name: /September \d+, 2026/ })).toHaveLength(30);
    expect(day('Wednesday, September 9, 2026').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-slot=calendar]')?.getAttribute('data-mode')).toBe('single');
  });

  it('reports the day that is pressed, with the reason, and moves the selection', async () => {
    const onValueChange = vi.fn();
    render(<Calendar {...en} defaultValue="2026-09-09" onValueChange={onValueChange} />);
    await settle();
    fireEvent.click(day('Friday, September 18, 2026'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe('2026-09-18');
    expect(onValueChange.mock.calls[0][1].reason).toBe('item-press');
    expect(day('Friday, September 18, 2026').hasAttribute('data-selected')).toBe(true);
    expect(day('Wednesday, September 9, 2026').getAttribute('aria-selected')).toBe('false');
  });

  it('keeps the value when the change is canceled, and follows a controlled value', async () => {
    const { rerender } = render(<Calendar {...en} defaultValue="2026-09-09" onValueChange={(_, details) => details.cancel()} />);
    await settle();
    fireEvent.click(day('Friday, September 18, 2026'));
    expect(cell('2026-09-09').hasAttribute('data-selected')).toBe(true);
    rerender(<Calendar {...en} value="2026-09-21" />);
    expect(cell('2026-09-21').hasAttribute('data-selected')).toBe(true);
    fireEvent.click(day('Friday, September 18, 2026'));
    expect(cell('2026-09-21').hasAttribute('data-selected')).toBe(true);
  });

  it('steps between months with the named previous and next buttons', async () => {
    const onMonthChange = vi.fn();
    render(<Calendar {...en} onMonthChange={onMonthChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(heading()).toBe('October 2026');
    expect(onMonthChange.mock.calls[0][0]).toBe('2026-10');
    expect(onMonthChange.mock.calls[0][1].reason).toBe('next-press');
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(heading()).toBe('August 2026');
  });

  it('has one tab stop and moves it with the arrow keys, Home, End and Page Down', async () => {
    const onValueChange = vi.fn();
    const { container } = render(<Calendar {...en} defaultValue="2026-09-09" onValueChange={onValueChange} />);
    await settle();
    expect([...container.querySelectorAll('[tabindex="0"]')].map((el) => el.getAttribute('data-value'))).toEqual(['2026-09-09']);
    const press = async (key: string) => {
      fireEvent.keyDown(document.activeElement!, { key });
      await settle();
      return document.activeElement?.getAttribute('data-value');
    };
    cell('2026-09-09').focus();
    expect(await press('ArrowRight')).toBe('2026-09-10');
    expect(await press('ArrowDown')).toBe('2026-09-17');
    expect(await press('ArrowLeft')).toBe('2026-09-16');
    expect(await press('ArrowUp')).toBe('2026-09-09');
    expect(await press('Home')).toBe('2026-09-06');
    expect(await press('End')).toBe('2026-09-12');
    expect([...container.querySelectorAll('[tabindex="0"]')].map((el) => el.getAttribute('data-value'))).toEqual(['2026-09-12']);
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onValueChange.mock.calls.at(-1)![0]).toBe('2026-09-12');
    expect(await press('PageDown')).toBe('2026-10-12');
    expect(heading()).toBe('October 2026');
  });

  it('does not select dates outside min and max or unavailable ones, and stops the keys at the bounds', async () => {
    const onValueChange = vi.fn();
    render(<Calendar {...en} defaultValue="2026-09-09" min="2026-09-08" max="2026-09-24" unavailable={['2026-09-15', { weekday: [0, 6] }]} onValueChange={onValueChange} />);
    await settle();
    fireEvent.click(day('Monday, September 7, 2026'));
    fireEvent.click(day('Friday, September 25, 2026'));
    fireEvent.click(day('Tuesday, September 15, 2026'));
    fireEvent.click(day('Saturday, September 12, 2026'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(cell('2026-09-07').getAttribute('aria-disabled')).toBe('true');
    expect(cell('2026-09-07').hasAttribute('data-unavailable')).toBe(false);
    expect(cell('2026-09-15').hasAttribute('data-unavailable')).toBe(true);
    expect(screen.getByRole('button', { name: 'Previous month' }).hasAttribute('data-disabled')).toBe(true);
    // An unavailable day can still be reached with the keys; a day before `min` cannot.
    cell('2026-09-09').focus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    await settle();
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-09-08');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    await settle();
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-09-08');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    await settle();
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-09-15');
    fireEvent.click(day('Wednesday, September 16, 2026'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('shows each month only, unless the days around are asked for', async () => {
    const { container, rerender } = render(<Calendar {...en} />);
    await settle();
    expect(container.querySelectorAll('[data-slot=calendar-day]')).toHaveLength(30);
    expect(container.querySelector('[data-outside]')).toBeNull();
    rerender(<Calendar {...en} showOutsideDays />);
    expect(cell('2026-08-31').hasAttribute('data-outside')).toBe(true);
  });

  it('marks today for assistive technology and tints it, selected or not', async () => {
    render(<Calendar {...en} today="2026-09-16" defaultValue="2026-09-09" />);
    await settle();
    expect(cell('2026-09-16').getAttribute('aria-current')).toBe('date');
    expect(cell('2026-09-16').firstElementChild!.className).toContain('font-semibold text-primary');
    expect(cell('2026-09-09').hasAttribute('aria-current')).toBe(false);
    fireEvent.click(cell('2026-09-16'));
    // tailwind-merge keeps one text color: the fill's, over today's tint.
    expect(cell('2026-09-16').firstElementChild!.className).toContain('font-semibold bg-primary text-primary-foreground');
  });

  it('shows several months side by side with `months`', async () => {
    render(<Calendar {...en} months={2} />);
    await settle();
    expect(screen.getAllByRole('grid').map((grid) => grid.getAttribute('aria-label'))).toEqual(['September 2026', 'October 2026']);
    expect(heading()).toBe('September – October 2026');
    expect(screen.getByRole('gridcell', { name: 'Thursday, October 1, 2026' })).toBeTruthy();
  });

  it('cannot be focused or picked while disabled', async () => {
    const onValueChange = vi.fn();
    const { container } = render(<Calendar {...en} disabled defaultValue="2026-09-09" onValueChange={onValueChange} />);
    await settle();
    expect(container.querySelector('[data-slot=calendar]')?.hasAttribute('data-disabled')).toBe(true);
    expect(container.querySelector('[tabindex="0"]')).toBeNull();
    fireEvent.click(day('Friday, September 18, 2026'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('takes the card variant, a class from the state, and its own parts as children', async () => {
    const { container } = render(
      <Calendar {...en} variant="card" defaultValue="2026-09-09" className={(state) => (state.value ? 'has-value' : 'empty')}>
        <CalendarHeader>
          <CalendarHeading className="sr-only" />
          <CalendarMonthSelect />
          <CalendarYearSelect />
        </CalendarHeader>
        <CalendarGrid>
          <CalendarWeeks>{(cell) => <CalendarDay value={cell.date}>{(state) => `${state.label}!`}</CalendarDay>}</CalendarWeeks>
        </CalendarGrid>
      </Calendar>,
    );
    await settle();
    const root = container.querySelector('[data-slot=calendar]') as HTMLElement;
    expect(root.className).toContain('bg-secondary');
    expect(root.className).toContain('has-value');
    expect(root.querySelector('[data-slot=calendar-header]')).toBeTruthy();
    expect(cell('2026-09-09').textContent).toBe('9!');
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value: '12' } });
    await settle();
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Year' }) as HTMLSelectElement).value).toBe('2026');
  });

  it('is driven from outside by a controller', async () => {
    const controller = createCalendarController();
    const onValueChange = vi.fn();
    render(<Calendar {...en} controller={controller} onValueChange={onValueChange} />);
    await settle();
    act(() => void controller.setValue('2026-12-25'));
    expect(onValueChange.mock.calls[0][1].reason).toBe('imperative');
    expect(controller.getValue()).toBe('2026-12-25');
    act(() => controller.focus('2026-12-25'));
    await settle();
    expect(heading()).toBe('December 2026');
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-12-25');
  });
});

describe('Calendar mode="multiple"', () => {
  it('toggles each day and keeps the list sorted', async () => {
    const onValueChange = vi.fn();
    render(<Calendar {...en} mode="multiple" defaultValue={['2026-09-09']} onValueChange={onValueChange} />);
    await settle();
    expect(screen.getByRole('grid').getAttribute('aria-multiselectable')).toBe('true');
    fireEvent.click(day('Wednesday, September 2, 2026'));
    expect(onValueChange.mock.calls.at(-1)![0]).toEqual(['2026-09-02', '2026-09-09']);
    fireEvent.click(day('Wednesday, September 9, 2026'));
    expect(onValueChange.mock.calls.at(-1)![0]).toEqual(['2026-09-02']);
  });
});

describe('Calendar mode="range"', () => {
  it('picks a start and an end and reports the range once', async () => {
    const onValueChange = vi.fn();
    const onAnchorChange = vi.fn();
    render(<Calendar {...en} mode="range" onValueChange={onValueChange} onAnchorChange={onAnchorChange} />);
    await settle();
    fireEvent.click(day('Tuesday, September 8, 2026'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onAnchorChange.mock.calls[0][0]).toBe('2026-09-08');
    fireEvent.click(day('Sunday, September 13, 2026'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toEqual(['2026-09-08', '2026-09-13']);
  });

  it('takes an end before the start as the new start, and Escape drops a range that is half picked', async () => {
    const onValueChange = vi.fn();
    const onAnchorChange = vi.fn();
    render(<Calendar {...en} mode="range" onValueChange={onValueChange} onAnchorChange={onAnchorChange} />);
    await settle();
    fireEvent.click(day('Sunday, September 13, 2026'));
    fireEvent.click(day('Tuesday, September 8, 2026'));
    expect(onValueChange.mock.calls[0][0]).toEqual(['2026-09-08', '2026-09-13']);
    fireEvent.click(day('Monday, September 21, 2026'));
    cell('2026-09-21').focus();
    fireEvent.keyDown(cell('2026-09-21'), { key: 'Escape' });
    await settle();
    expect(onAnchorChange.mock.calls.at(-1)![0]).toBeNull();
    expect(onAnchorChange.mock.calls.at(-1)![1].reason).toBe('escape-key');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(cell('2026-09-08').hasAttribute('data-range-start')).toBe(true);
  });

  it('marks the ends and the days between: the ends are filled, the days between only carry the band', async () => {
    const { container } = render(<Calendar {...en} mode="range" defaultValue={['2026-09-08', '2026-09-13']} />);
    await settle();
    const selected = [...container.querySelectorAll<HTMLElement>('[data-slot=calendar-day][data-selected]')];
    expect(selected).toHaveLength(6);
    expect(selected.filter((c) => c.hasAttribute('data-range-start')).map((c) => c.dataset.value)).toEqual(['2026-09-08']);
    expect(selected.filter((c) => c.hasAttribute('data-range-end')).map((c) => c.dataset.value)).toEqual(['2026-09-13']);
    expect(selected.filter((c) => c.hasAttribute('data-range-middle'))).toHaveLength(4);
    for (const c of selected) expect(c.className).toContain('before:bg-primary/15');
    expect(cell('2026-09-08').firstElementChild!.className).toContain('bg-primary text-primary-foreground');
    expect(cell('2026-09-13').firstElementChild!.className).toContain('bg-primary text-primary-foreground');
    expect(cell('2026-09-10').firstElementChild!.className).not.toContain('bg-primary text-primary-foreground');
  });

  it('fills a single selected day and gives it no band attributes', async () => {
    render(<Calendar {...en} defaultValue="2026-09-09" />);
    await settle();
    const selected = cell('2026-09-09');
    expect(selected.firstElementChild!.className).toContain('bg-primary text-primary-foreground');
    for (const attribute of ['data-range-start', 'data-range-middle', 'data-range-end']) expect(selected.hasAttribute(attribute)).toBe(false);
  });
});
