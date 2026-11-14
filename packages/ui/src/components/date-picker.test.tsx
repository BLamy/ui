// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarGrid, CalendarHeader } from '@/components/ui/calendar';
import {
  DatePicker,
  DatePickerClear,
  DatePickerContent,
  DatePickerField,
  DatePickerHint,
  DatePickerInput,
  DatePickerPreset,
  DatePickerTrigger,
  createDatePickerController,
  type DatePickerProps,
} from '@/components/ui/date-picker';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const input = (name = 'Date') => screen.getByRole('textbox', { name }) as HTMLInputElement;
const trigger = () => screen.getByRole('button', { name: /^Choose dates?/ });
const dialog = () => screen.queryByRole('dialog');
const open = async () => {
  fireEvent.click(trigger());
  await settle();
  return screen.getByRole('dialog');
};
const pick = async (name: string) => {
  fireEvent.click(screen.getByRole('gridcell', { name }));
  await settle();
};

/** The default composition: the field (an input and the calendar button) and the popup. */
const picker = (props: DatePickerProps = {}) => (
  <DatePicker locale="en-US" defaultValue="2026-09-09" {...props}>
    <DatePickerField />
    <DatePickerContent />
  </DatePicker>
);

describe('DatePicker', () => {
  it('shows the date in the input, with the calendar closed until its named button is pressed', async () => {
    render(picker());
    await settle();
    expect(input().value).toBe('09/09/2026');
    expect(dialog()).toBeNull();
    expect(trigger().getAttribute('aria-label')).toBe('Choose date, Wednesday, September 9, 2026');
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    const popup = await open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(within(popup).getByRole('grid', { name: 'September 2026' })).toBeTruthy();
    expect(within(popup).getByRole('gridcell', { name: 'Wednesday, September 9, 2026' }).getAttribute('aria-selected')).toBe('true');
    expect(within(popup).getByRole('button', { name: 'Next month' })).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-09-09');
  });

  it('picks a day from the calendar: the input follows, the change says why, the popup closes and focus returns', async () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(picker({ onValueChange, onOpenChange }));
    await settle();
    trigger().focus();
    await open();
    await pick('Friday, September 18, 2026');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe('2026-09-18');
    expect(onValueChange.mock.calls[0][1].reason).toBe('item-press');
    expect(input().value).toBe('09/18/2026');
    expect(dialog()).toBeNull();
    expect(onOpenChange.mock.calls.map(([isOpen, details]) => [isOpen, details.reason])).toEqual([[true, 'trigger-press'], [false, 'item-press']]);
    expect(document.activeElement).toBe(trigger());
  });

  it('reads a typed date on Enter, and keeps the value while the text is not a date', async () => {
    const onValueChange = vi.fn();
    const { container } = render(picker({ onValueChange }));
    await settle();
    input().focus();
    fireEvent.input(input(), { target: { value: '9/18/2026' } });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input(), { key: 'Enter' });
    await settle();
    expect(onValueChange.mock.calls[0][0]).toBe('2026-09-18');
    expect(onValueChange.mock.calls[0][1].reason).toBe('input-commit');
    expect(input().value).toBe('09/18/2026');
    fireEvent.input(input(), { target: { value: 'not a date' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    await settle();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('[data-slot=date-picker]')?.hasAttribute('data-invalid')).toBe(true);
  });

  it('opens from the input with Alt+Down, moves through the days with the arrows, and Escape closes it', async () => {
    const onOpenChange = vi.fn();
    render(picker({ onOpenChange }));
    await settle();
    input().focus();
    fireEvent.keyDown(input(), { key: 'ArrowDown', altKey: true });
    await settle();
    expect(dialog()).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    await settle();
    expect(document.activeElement?.getAttribute('data-value')).toBe('2026-09-10');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(dialog()).toBeNull();
    expect(onOpenChange.mock.calls.at(-1)![1].reason).toBe('escape-key');
    expect(input().value).toBe('09/09/2026');
  });

  it('opens on its own with defaultOpen, and stays shut while disabled', async () => {
    const a = render(picker({ defaultOpen: true }));
    await settle();
    expect(dialog()).toBeTruthy();
    a.unmount();
    const { container } = render(picker({ disabled: true }));
    await settle();
    expect(input().disabled).toBe(true);
    fireEvent.click(trigger());
    await settle();
    expect(dialog()).toBeNull();
    expect(container.querySelector('[data-slot=date-picker]')?.hasAttribute('data-disabled')).toBe(true);
  });

  it('takes its name, description and error from a Field, and submits the ISO date', async () => {
    const { container } = render(
      <form onSubmit={(event) => event.preventDefault()}>
        <Field name="due">
          <FieldLabel>Due date</FieldLabel>
          <DatePicker locale="en-US" required>
            <DatePickerField size="lg" />
            <DatePickerHint />
            <DatePickerContent />
          </DatePicker>
          <FieldDescription>Required.</FieldDescription>
          <FieldError match="valueMissing">Choose a due date.</FieldError>
        </Field>
        <button type="submit">Save</button>
      </form>,
    );
    await settle();
    const field = input('Due date');
    expect(field.required).toBe(true);
    const described = field.getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(expect.arrayContaining(['MM/DD/YYYY', 'Required.']));
    expect((container.querySelector('[data-slot=date-picker-field]') as HTMLElement).className).toContain('h-[50px]');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();
    expect(container.querySelector('[data-slot=field-error]')?.textContent).toBe('Choose a due date.');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    field.focus();
    fireEvent.input(field, { target: { value: '9/18/2026' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await settle();
    expect(container.querySelector('[data-slot=field-error]')).toBeNull();
    expect(new FormData(container.querySelector('form')!).get('due')).toBe('2026-09-18');
  });

  it('clears with the Clear button, selects a preset, and is driven by a controller', async () => {
    const controller = createDatePickerController();
    const onValueChange = vi.fn();
    render(
      <DatePicker locale="en-US" defaultValue="2026-09-09" controller={controller} onValueChange={onValueChange}>
        <DatePickerField>
          <DatePickerInput aria-label="Due date" />
          <DatePickerClear />
          <DatePickerTrigger />
        </DatePickerField>
        <DatePickerContent>
          <CalendarHeader />
          <CalendarGrid />
          <DatePickerPreset value="2026-12-25">Christmas</DatePickerPreset>
        </DatePickerContent>
      </DatePicker>,
    );
    await settle();
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Christmas' }));
    await settle();
    expect(onValueChange.mock.calls.at(-1)![0]).toBe('2026-12-25');
    expect(onValueChange.mock.calls.at(-1)![1].reason).toBe('preset-press');
    expect(dialog()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await settle();
    expect(onValueChange.mock.calls.at(-1)![0]).toBeNull();
    expect(onValueChange.mock.calls.at(-1)![1].reason).toBe('clear-press');
    expect(input('Due date').value).toBe('');
    expect(document.activeElement).toBe(input('Due date'));
    expect(screen.getByRole('button', { name: 'Clear', hidden: true }).hasAttribute('data-empty')).toBe(true);
    act(() => void controller.setValue('2026-10-01'));
    expect(input('Due date').value).toBe('10/01/2026');
    act(() => void controller.setOpen(true));
    await settle();
    expect(within(screen.getByRole('dialog')).getByRole('grid', { name: 'October 2026' })).toBeTruthy();
  });

  /** A required picker in a Field, submitted empty so its error shows, then given a day from the calendar. */
  const requiredThenPicked = async () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const { container } = render(
      <form onSubmit={onSubmit}>
        <Field name="due">
          <FieldLabel>Due date</FieldLabel>
          <DatePicker locale="en-US" required defaultMonth="2026-09">
            <DatePickerField />
            <DatePickerContent />
          </DatePicker>
          <FieldError match="valueMissing">Choose a due date.</FieldError>
        </Field>
        <button type="submit">Save</button>
      </form>,
    );
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.querySelector('[data-slot=field-error]')?.textContent).toBe('Choose a due date.');
    await open();
    await pick('Friday, September 18, 2026');
    return { container, onSubmit };
  };

  it('blocks an empty required picker, then submits a day picked from the calendar', async () => {
    const { container, onSubmit } = await requiredThenPicked();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(new FormData(container.querySelector('form')!).get('due')).toBe('2026-09-18');
  });

  // UI SDK gap (gaps/dates.md #1), worked around in the kit: the picker tells the Field its value changed.
  it('clears the Field error as soon as a day is picked', async () => {
    const { container } = await requiredThenPicked();
    expect(container.querySelector('[data-slot=field-error]')).toBeNull();
    expect(input('Due date').getAttribute('aria-invalid')).toBeNull();
  });

  it('clears the Field error when a controlled owner takes the picked day, or a controller writes one', async () => {
    const controller = createDatePickerController();
    function Due() {
      const [due, setDue] = useState<string | null>(null);
      return (
        <form onSubmit={(event) => event.preventDefault()}>
          <Field name="due">
            <FieldLabel>Due date</FieldLabel>
            <DatePicker locale="en-US" required defaultMonth="2026-09" value={due} onValueChange={setDue} controller={controller}>
              <DatePickerField />
              <DatePickerContent />
            </DatePicker>
            <FieldError match="valueMissing">Choose a due date.</FieldError>
          </Field>
          <button type="submit">Save</button>
        </form>
      );
    }
    const { container } = render(<Due />);
    await settle();
    const error = () => container.querySelector('[data-slot=field-error]');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();
    expect(error()).toBeTruthy();
    await open();
    await pick('Friday, September 18, 2026');
    expect(error()).toBeNull();
    act(() => void controller.setValue(null));
    await settle();
    expect(error()).toBeTruthy();
    act(() => void controller.setValue('2026-10-01'));
    await settle();
    expect(error()).toBeNull();
  });
});

describe('DatePicker mode="range"', () => {
  it('has a named input for each end and picks a range: open after the start, closed after the end', async () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <DatePicker mode="range" locale="en-US" defaultValue={['2026-09-08', '2026-09-13']} startName="from" endName="to" onValueChange={onValueChange}>
        <form>
          <DatePickerField />
        </form>
        <DatePickerContent />
      </DatePicker>,
    );
    await settle();
    expect([input('Start date').value, input('End date').value]).toEqual(['09/08/2026', '09/13/2026']);
    expect(trigger().getAttribute('aria-label')).toBe('Choose dates, Tuesday, September 8, 2026 to Sunday, September 13, 2026');
    expect(container.querySelector<HTMLInputElement>('input[name=from]')!.value).toBe('2026-09-08');
    expect(container.querySelector<HTMLInputElement>('input[name=to]')!.value).toBe('2026-09-13');
    const popup = await open();
    expect(within(popup).getByRole('grid').getAttribute('aria-multiselectable')).toBe('true');
    await pick('Monday, September 21, 2026');
    expect(dialog()).toBeTruthy();
    expect(onValueChange).not.toHaveBeenCalled();
    await pick('Thursday, September 24, 2026');
    expect(dialog()).toBeNull();
    expect(onValueChange.mock.calls[0][0]).toEqual(['2026-09-21', '2026-09-24']);
    expect([input('Start date').value, input('End date').value]).toEqual(['09/21/2026', '09/24/2026']);
  });

  it('shows a grid per month with `months`, and renders the default field and popup when it has no children', async () => {
    render(<DatePicker mode="range" months={2} locale="en-US" defaultValue={['2026-09-24', '2026-10-06']} />);
    await settle();
    expect(input('Start date')).toBeTruthy();
    const popup = await open();
    expect(within(popup).getAllByRole('grid').map((grid) => grid.getAttribute('aria-label'))).toEqual(['September 2026', 'October 2026']);
    expect(within(popup).getByRole('heading').textContent).toBe('September – October 2026');
  });

  it('sizes its default field from the root, and a DatePickerField\'s own size wins', async () => {
    const { unmount } = render(<DatePicker size="sm" locale="en-US" />);
    const field = () => document.querySelector<HTMLElement>('[data-slot=date-picker-field]')!;
    expect(field().dataset.size).toBe('sm');
    expect(field().className).toContain('h-8');
    unmount();
    render(
      <DatePicker size="sm" locale="en-US">
        <DatePickerField size="lg" />
      </DatePicker>,
    );
    expect(field().dataset.size).toBe('lg');
  });
});
