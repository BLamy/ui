// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { parseDate, parseDateTime, Time, type CalendarDate } from '@internationalized/date';
import { DateField, DateInput, TimeField } from '@/components/ui/date-field';
import { DatePicker, DatePickerContent, DatePickerField, DateRangePicker, DateRangePickerContent, DateRangePickerField } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { FieldDescription, FieldError } from '@/components/ui/text-field';

afterEach(cleanup);

const en = (ui: React.ReactNode) => render(<I18nProvider locale="en-US">{ui}</I18nProvider>);
const segments = (root: HTMLElement) => [...root.querySelectorAll('[data-slot=date-segment]')].filter((s) => s.getAttribute('data-type') !== 'literal');
const text = (root: HTMLElement) => segments(root).map((s) => s.textContent).join(' ');

describe('DateField', () => {
  it('splits the date into labelled spin buttons in locale order', () => {
    const { container } = en(
      <DateField defaultValue={parseDate('2026-09-09')}>
        <Label variant="field">Birthday</Label>
        <DateInput />
        <FieldDescription>Type it.</FieldDescription>
      </DateField>,
    );
    expect(text(container)).toBe('9 9 2026');
    const group = screen.getByRole('group', { name: /Birthday/ });
    expect(within(group).getAllByRole('spinbutton').map((s) => s.getAttribute('aria-valuenow'))).toEqual(['9', '9', '2026']);
    expect(container.querySelector('[data-slot=field-description]')?.textContent).toBe('Type it.');
  });

  it('steps a segment with the arrow keys and reports the new date', () => {
    const onChange = vi.fn();
    en(
      <DateField aria-label="Due" defaultValue={parseDate('2026-09-09')} onChange={onChange}>
        <DateInput />
      </DateField>,
    );
    const [month, day] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(day, { key: 'ArrowUp' });
    expect((onChange.mock.calls.at(-1)![0] as CalendarDate).toString()).toBe('2026-09-10');
    fireEvent.keyDown(month, { key: 'ArrowDown' });
    expect((onChange.mock.calls.at(-1)![0] as CalendarDate).toString()).toBe('2026-08-10');
  });

  it('shows the error only while invalid, and the size and state classes', () => {
    const { container, rerender } = en(
      <DateField aria-label="Due" defaultValue={parseDate('2026-09-09')}>
        <DateInput size="lg" />
        <FieldError>Pick a later date.</FieldError>
      </DateField>,
    );
    expect(container.querySelector('[data-slot=field-error]')).toBeNull();
    expect((container.querySelector('[data-slot=date-input]') as HTMLElement).className).toContain('h-[50px]');
    rerender(
      <I18nProvider locale="en-US">
        <DateField aria-label="Due" isInvalid defaultValue={parseDate('2026-09-09')}>
          <DateInput />
          <FieldError>Pick a later date.</FieldError>
        </DateField>
      </I18nProvider>,
    );
    expect(container.querySelector('[data-slot=field-error]')?.textContent).toBe('Pick a later date.');
    expect(container.querySelector('[data-slot=date-input]')?.hasAttribute('data-invalid')).toBe(true);
  });

  it('adds time segments at minute granularity, and TimeField has hour and minute only', () => {
    const a = en(
      <DateField aria-label="Starts" granularity="minute" defaultValue={parseDateTime('2026-09-09T09:30')}>
        <DateInput />
      </DateField>,
    );
    expect(text(a.container)).toBe('9 9 2026 9 30 AM');
    a.unmount();
    const b = en(
      <TimeField aria-label="Alarm" defaultValue={new Time(9, 30)}>
        <DateInput />
      </TimeField>,
    );
    expect(text(b.container)).toBe('9 30 AM');
  });
});

describe('DatePicker', () => {
  const picker = (props: Partial<React.ComponentProps<typeof DatePicker<CalendarDate>>> = {}) => (
    <DatePicker aria-label="Date" defaultValue={parseDate('2026-09-09')} {...props}>
      <DatePickerField />
      <DatePickerContent />
    </DatePicker>
  );

  it('shows the date in the field, with the calendar closed until the button is pressed', () => {
    const { container } = en(picker());
    expect(text(container)).toBe('9 9 2026');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /calendar/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('application', { name: /September 2026/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /^Wednesday, September 9, 2026 selected$/ })).toBeTruthy();
  });

  it('picks a day from the calendar: the field follows, onChange fires and the popover closes', () => {
    const onChange = vi.fn();
    const { container } = en(picker({ onChange }));
    fireEvent.click(screen.getByRole('button', { name: /calendar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Friday, September 18, 2026$/ }));
    expect((onChange.mock.calls[0][0] as CalendarDate).toString()).toBe('2026-09-18');
    expect(text(container)).toBe('9 18 2026');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on its own with defaultOpen, and Escape closes it', () => {
    en(picker({ defaultOpen: true }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not open while disabled', () => {
    en(picker({ isDisabled: true }));
    fireEvent.click(screen.getByRole('button', { name: /calendar/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DateRangePicker', () => {
  it('has a start and an end field and picks a range from the calendar', () => {
    const onChange = vi.fn();
    const { container } = en(
      <DateRangePicker aria-label="Stay" defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }} onChange={onChange}>
        <DateRangePickerField />
        <DateRangePickerContent />
      </DateRangePicker>,
    );
    expect(text(container)).toBe('9 8 2026 9 13 2026');
    fireEvent.click(screen.getByRole('button', { name: /calendar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Monday, September 21, 2026$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Thursday, September 24, 2026$/ }));
    const { start, end } = onChange.mock.calls.at(-1)![0] as { start: CalendarDate; end: CalendarDate };
    expect([start.toString(), end.toString()]).toEqual(['2026-09-21', '2026-09-24']);
    expect(text(container)).toBe('9 21 2026 9 24 2026');
  });
});
