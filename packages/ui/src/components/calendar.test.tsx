// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, type DateValue } from 'react-aria-components';
import { parseDate, type CalendarDate } from '@internationalized/date';
import { Calendar, RangeCalendar } from '@/components/ui/calendar';

afterEach(cleanup);

const en = (ui: React.ReactNode) => render(<I18nProvider locale="en-US">{ui}</I18nProvider>);
const day = (name: RegExp | string) => screen.getByRole('button', { name });
/** The header's own buttons (react-aria also renders visually hidden ones beside the heading). */
const nav = (container: HTMLElement, name: 'Previous' | 'Next') => within(container.querySelector('[data-slot=calendar-header]') as HTMLElement).getByRole('button', { name });

const title = (container: HTMLElement) => container.querySelector('[data-slot=calendar-header] h2')?.textContent;

describe('Calendar', () => {
  it('shows the month of the value, with a heading and one button per day', () => {
    const { container } = en(<Calendar aria-label="Appointment" defaultValue={parseDate('2026-09-09')} />);
    expect(screen.getByRole('application', { name: /September 2026/ })).toBeTruthy();
    expect(title(container)).toBe('September 2026');
    expect(screen.getAllByRole('button', { name: /September \d+, 2026/ })).toHaveLength(30);
    expect(day(/^Wednesday, September 9, 2026 selected$/)).toBeTruthy();
  });

  it('reports the day that is pressed, and moves the selection', () => {
    const onChange = vi.fn();
    en(<Calendar aria-label="Appointment" defaultValue={parseDate('2026-09-09')} onChange={onChange} />);
    fireEvent.click(day(/^Friday, September 18, 2026$/));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as CalendarDate).toString()).toBe('2026-09-18');
    expect(day(/^Friday, September 18, 2026 selected$/)).toBeTruthy();
  });

  it('steps between months with the previous and next buttons', () => {
    const { container } = en(<Calendar aria-label="Appointment" defaultValue={parseDate('2026-09-09')} />);
    fireEvent.click(nav(container, 'Next'));
    expect(title(container)).toBe('October 2026');
    fireEvent.click(nav(container, 'Previous'));
    fireEvent.click(nav(container, 'Previous'));
    expect(title(container)).toBe('August 2026');
  });

  it('does not select dates outside min and max or unavailable ones', () => {
    const onChange = vi.fn();
    en(
      <Calendar
        aria-label="Appointment"
        defaultFocusedValue={parseDate('2026-09-09')}
        minValue={parseDate('2026-09-08')}
        maxValue={parseDate('2026-09-24')}
        isDateUnavailable={(d: DateValue) => d.day === 15}
        onChange={onChange}
      />,
    );
    fireEvent.click(day(/^Monday, September 7, 2026$/));
    fireEvent.click(day(/^Friday, September 25, 2026$/));
    fireEvent.click(day(/^Tuesday, September 15, 2026$/));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(day(/^Wednesday, September 16, 2026$/));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows several months side by side with visibleMonths', () => {
    en(<Calendar aria-label="Appointment" visibleMonths={2} defaultFocusedValue={parseDate('2026-09-09')} />);
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /October \d+, 2026/ }).length).toBeGreaterThan(0);
  });

  it('takes the card variant and the slots', () => {
    const { container } = en(<Calendar aria-label="A" variant="card" defaultFocusedValue={parseDate('2026-09-09')} />);
    const root = container.querySelector('[data-slot=calendar]') as HTMLElement;
    expect(root.className).toContain('bg-secondary');
    expect(root.querySelector('[data-slot=calendar-header]')).toBeTruthy();
    expect(root.querySelector('[data-slot=calendar-grid]')).toBeTruthy();
  });
});

describe('RangeCalendar', () => {
  it('picks a start and an end and reports the range', () => {
    const onChange = vi.fn();
    en(<RangeCalendar aria-label="Stay" defaultFocusedValue={parseDate('2026-09-09')} onChange={onChange} />);
    fireEvent.click(day(/^Tuesday, September 8, 2026$/));
    fireEvent.click(day(/^Sunday, September 13, 2026$/));
    expect(onChange).toHaveBeenCalledTimes(1);
    const { start, end } = onChange.mock.calls[0][0] as { start: CalendarDate; end: CalendarDate };
    expect([start.toString(), end.toString()]).toEqual(['2026-09-08', '2026-09-13']);
  });

  it('marks the ends and the days between, which carry the band', () => {
    const { container } = en(
      <RangeCalendar aria-label="Stay" defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }} />,
    );
    const cells = [...container.querySelectorAll<HTMLElement>('[data-slot=calendar-cell]')];
    const selected = cells.filter((c) => c.hasAttribute('data-selected'));
    expect(selected).toHaveLength(6);
    expect(selected.filter((c) => c.hasAttribute('data-selection-start'))).toHaveLength(1);
    expect(selected.filter((c) => c.hasAttribute('data-selection-end'))).toHaveLength(1);
    // The band is drawn only in a RangeCalendar; the ends fill their number, the days between do not.
    for (const c of selected) expect(c.className).toContain('before:bg-primary/15');
    const between = selected.find((c) => !c.hasAttribute('data-selection-start') && !c.hasAttribute('data-selection-end'))!;
    expect(between.firstElementChild!.className).not.toContain('group-data-selected/cell:bg-primary');
  });

  it('does not draw a band in a single Calendar', () => {
    const { container } = en(<Calendar aria-label="A" defaultValue={parseDate('2026-09-09')} />);
    const cell = container.querySelector<HTMLElement>('[data-slot=calendar-cell][data-selected]')!;
    expect(cell.className).not.toContain('before:bg-primary/15');
    expect(within(cell).getByText('9').className).toContain('group-data-selected/cell:bg-primary');
  });
});
