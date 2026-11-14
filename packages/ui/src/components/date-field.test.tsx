// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateField, DateFieldSegment, TimeField, createDateFieldController } from '@/components/ui/date-field';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const spins = (root: HTMLElement = document.body) => within(root).getAllByRole('spinbutton') as HTMLInputElement[];
const text = (root?: HTMLElement) => spins(root).map((s) => s.value).join(' ');
const focused = () => document.activeElement?.getAttribute('aria-label');

describe('DateField', () => {
  it('splits the date into named spin buttons in the locale order, wired to its Field', async () => {
    const { container } = render(
      <Field>
        <FieldLabel variant="field">Birthday</FieldLabel>
        <DateField locale="en-US" defaultValue="2026-09-09" />
        <FieldDescription>Type it.</FieldDescription>
      </Field>,
    );
    await settle();
    const group = screen.getByRole('group', { name: 'Birthday' });
    expect(spins(group).map((s) => [s.getAttribute('aria-label'), s.getAttribute('aria-valuenow')])).toEqual([['month', '9'], ['day', '9'], ['year', '2026']]);
    expect(text(group)).toBe('09 09 2026');
    expect(document.getElementById(group.getAttribute('aria-describedby')!)?.textContent).toBe('Type it.');
    expect([...container.querySelectorAll('[data-type=literal]')].map((l) => l.textContent)).toEqual(['/', '/']);
    cleanup();
    render(<DateField aria-label="Datum" locale="de-DE" defaultValue="2026-09-09" />);
    await settle();
    expect(spins().map((s) => s.getAttribute('data-type'))).toEqual(['day', 'month', 'year']);
  });

  it('steps a part with the arrow keys and reports the new date and why', async () => {
    const onValueChange = vi.fn();
    render(<DateField aria-label="Due" locale="en-US" defaultValue="2026-09-09" onValueChange={onValueChange} />);
    await settle();
    const [month, day, year] = spins();
    fireEvent.keyDown(day, { key: 'ArrowUp' });
    expect(onValueChange.mock.calls.at(-1)![0]).toBe('2026-09-10');
    expect(onValueChange.mock.calls.at(-1)![1].reason).toBe('step-key');
    fireEvent.keyDown(month, { key: 'ArrowDown' });
    expect(onValueChange.mock.calls.at(-1)![0]).toBe('2026-08-10');
    fireEvent.keyDown(year, { key: 'PageUp' });
    expect(onValueChange.mock.calls.at(-1)![0]).toBe('2031-08-10');
    fireEvent.keyDown(month, { key: 'End' });
    expect(onValueChange.mock.calls.at(-1)![0]).toBe('2031-12-10');
  });

  it('moves between parts with Left and Right, and on by itself once a part is full', async () => {
    const onValueChange = vi.fn();
    render(<DateField aria-label="Due" locale="en-US" defaultValue="2026-09-09" onValueChange={onValueChange} />);
    await settle();
    const [month, day] = spins();
    month.focus();
    fireEvent.keyDown(month, { key: 'ArrowRight' });
    expect(focused()).toBe('day');
    fireEvent.keyDown(day, { key: 'ArrowLeft' });
    expect(focused()).toBe('month');
    day.focus();
    fireEvent.input(day, { target: { value: '2' } });
    await settle();
    expect(focused()).toBe('day');
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.input(day, { target: { value: '21' } });
    await settle();
    expect(focused()).toBe('year');
    expect(onValueChange.mock.calls.at(-1)![0]).toBe('2026-09-21');
    expect(onValueChange.mock.calls.at(-1)![1].reason).toBe('input-change');
  });

  it('is null while a part is empty', async () => {
    const onValueChange = vi.fn();
    const { container } = render(<DateField aria-label="Due" locale="en-US" defaultValue="2026-09-09" onValueChange={onValueChange} />);
    await settle();
    const year = spins()[2];
    fireEvent.keyDown(year, { key: 'Backspace' });
    await settle();
    expect(onValueChange.mock.calls.at(-1)![0]).toBeNull();
    expect(year.hasAttribute('data-empty')).toBe(true);
    expect(year.getAttribute('aria-valuetext')).toBe('Empty');
    expect(container.querySelector<HTMLInputElement>('input[type=hidden]')!.value).toBe('');
  });

  it('adds the time with a granularity, and TimeField edits a time on the locale clock or the one asked for', async () => {
    const a = render(<DateField aria-label="Starts" locale="en-US" granularity="minute" defaultValue="2026-09-09T09:30" />);
    await settle();
    expect(text(a.container)).toBe('09 09 2026 09 30 AM');
    a.unmount();
    const onValueChange = vi.fn();
    const b = render(<TimeField aria-label="Alarm" locale="en-US" defaultValue="09:30" onValueChange={onValueChange} />);
    await settle();
    expect(screen.getByRole('group', { name: 'Alarm' })).toBeTruthy();
    expect(spins(b.container).map((s) => s.getAttribute('aria-label'))).toEqual(['hour', 'minute', 'AM/PM']);
    expect(text(b.container)).toBe('09 30 AM');
    fireEvent.keyDown(spins(b.container)[2], { key: 'ArrowUp' });
    expect(onValueChange.mock.calls.at(-1)![0]).toBe('21:30');
    b.unmount();
    const c = render(<TimeField aria-label="Departure" locale="en-US" hourCycle={24} granularity="second" defaultValue="14:45:10" />);
    await settle();
    expect(text(c.container)).toBe('14 45 10');
  });

  it('carries the size and state classes, and is invalid outside min and max', async () => {
    const { container, rerender } = render(<DateField aria-label="Due" locale="en-US" size="lg" defaultValue="2026-09-09" min="2026-09-01" />);
    await settle();
    const root = () => container.querySelector('[data-slot=date-input]') as HTMLElement;
    expect(root().className).toContain('h-[50px]');
    expect(root().className).toContain('bg-input');
    expect(root().hasAttribute('data-invalid')).toBe(false);
    expect(spins()[0].className).toContain('focus:bg-primary');
    rerender(<DateField aria-label="Due" locale="en-US" variant="bare" value="2026-08-20" min="2026-09-01" className="custom" />);
    await settle();
    expect(root().className).not.toContain('bg-input');
    expect(root().className).toContain('custom');
    expect(root().hasAttribute('data-invalid')).toBe(true);
    expect(spins()[0].getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the Field error while the field is invalid, and cannot be used while disabled', async () => {
    const field = (props: { invalid?: boolean; disabled?: boolean }) => (
      <Field {...props}>
        <FieldLabel>Due</FieldLabel>
        <DateField locale="en-US" defaultValue="2026-09-09" />
        <FieldError>Pick a later date.</FieldError>
      </Field>
    );
    const { container, rerender } = render(field({}));
    await settle();
    expect(container.querySelector('[data-slot=field-error]')).toBeNull();
    rerender(field({ invalid: true }));
    await settle();
    expect(container.querySelector('[data-slot=field-error]')?.textContent).toBe('Pick a later date.');
    const group = screen.getByRole('group', { name: 'Due' });
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(group.hasAttribute('data-invalid')).toBe(true);
    rerender(field({ disabled: true }));
    await settle();
    expect(group.hasAttribute('data-disabled')).toBe(true);
    // A group can't be `disabled` natively: it says so with aria-disabled.
    expect(group.getAttribute('aria-disabled')).toBe('true');
    expect(spins(group).every((s) => s.disabled)).toBe(true);
    rerender(field({}));
    await settle();
    expect(group.hasAttribute('aria-disabled')).toBe(false);
  });

  it('submits the ISO value under its name, requires a value, and goes back to its default on reset', async () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const onValueChange = vi.fn();
    const { container } = render(
      <form onSubmit={onSubmit}>
        <Field name="due">
          <FieldLabel>Due</FieldLabel>
          <DateField locale="en-US" required defaultValue="2026-09-09" onValueChange={onValueChange} />
          <FieldError />
        </Field>
        <button type="submit">Save</button>
        <button type="reset">Reset</button>
      </form>,
    );
    await settle();
    expect(new FormData(container.querySelector('form')!).get('due')).toBe('2026-09-09');
    fireEvent.keyDown(spins()[1], { key: 'Delete' });
    await settle();
    expect(new FormData(container.querySelector('form')!).get('due')).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await settle();
    expect(text()).toBe('09 09 2026');
    expect(onValueChange.mock.calls.at(-1)![1].reason).toBe('reset');
  });

  it('is set, cleared and focused from outside by a controller, and renders custom segments', async () => {
    const controller = createDateFieldController();
    render(
      <DateField aria-label="Due" locale="en-US" controller={controller}>
        {({ segments }) =>
          segments.map((segment) =>
            segment.editable ? <DateFieldSegment key={segment.key} segment={segment} /> : <DateFieldSegment key={segment.key} segment={segment}>-</DateFieldSegment>,
          )
        }
      </DateField>,
    );
    await settle();
    expect(text()).toBe('  ');
    act(() => void controller.setValue('2026-12-25'));
    expect(text()).toBe('12 25 2026');
    expect(screen.getByRole('group', { name: 'Due' }).textContent).toBe('--');
    act(() => controller.focus('year'));
    expect(focused()).toBe('year');
    act(() => void controller.clear());
    expect(controller.getValue()).toBeNull();
  });
});
