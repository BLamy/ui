// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeInput, type TimeInputChange } from '@/components/ui/time-input';
import { resetGpuTime } from '@/lib/gpu-time';

/* TimeInput with the real gpu-time package (CPU backend), a fixed reference and zone so the answers are exact. */

const REF = '2026-09-09T12:00:00+06:00'; // a Wednesday in Dhaka
const base = { reference: REF, timeZone: 'Asia/Dhaka', locale: 'en-US', debounceMs: 5, label: 'When' } as const;

afterEach(() => {
  cleanup();
  resetGpuTime();
});

const field = () => screen.getByRole('textbox', { name: 'When' }) as HTMLInputElement;
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });
const preview = () => document.querySelector('[data-slot=time-input-preview]') as HTMLElement | null;
const rows = (slot: string) => [...document.querySelectorAll(`[data-slot=${slot}] li`)].map((li) => li.textContent);

describe('TimeInput', () => {
  it('renders a labelled text field with a description and no preview while empty', () => {
    render(<TimeInput {...base} description="Read as Dhaka time." data-testid="x" />);
    expect(field()).toBeTruthy();
    expect(screen.getByText('Read as Dhaka time.')).toBeTruthy();
    expect(field().getAttribute('aria-describedby')).toMatch(/\S/);
    expect(preview()).toBeNull();
    expect(document.querySelector('[data-slot=time-input]')).toBeTruthy();
  });

  it('falls back to an aria-label when there is no visible label', () => {
    render(<TimeInput {...base} label={undefined} />);
    expect(screen.getByRole('textbox', { name: 'Date or time' })).toBeTruthy();
  });

  it('lists the resolved occurrences in the zone and highlights what it recognised', async () => {
    render(<TimeInput {...base} />);
    type('Sat Sun 1pm-8pm Mon 10pm-12am');
    await waitFor(() => expect(preview()).not.toBeNull());
    const items = rows('time-input-occurrences');
    expect(items).toHaveLength(3);
    expect(items[0]).toMatch(/^Sat, Sep 12, 2026,? 1:00\s?[–-]\s?8:00\s?PM$/);
    expect(items[2]).toMatch(/^Mon, Sep 14, 2026,? 10:00\sPM\s?[–-]\s?Tue, Sep 15, 2026,? 12:00\sAM$/);
    expect(document.querySelector('[data-slot=time-input-recognized] mark')?.textContent).toBe('Sat Sun 1pm-8pm Mon 10pm-12am');
    expect(preview()?.textContent).toContain('Times in Asia/Dhaka');
    expect(preview()?.hasAttribute('data-stale')).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('3 dates found.');
  });

  it('marks only the recognised words, leaving the rest plain', async () => {
    render(<TimeInput {...base} />);
    type('meet me thurs 2-3pm ok');
    await waitFor(() => expect(document.querySelector('[data-slot=time-input-recognized] mark')).not.toBeNull());
    const line = document.querySelector('[data-slot=time-input-recognized]') as HTMLElement;
    expect(line.querySelector('mark')?.textContent).toBe('thurs 2-3pm');
    expect(line.textContent).toBe('Recognized: meet me thurs 2-3pm ok');
  });

  it('shows a Repeats chip in words for a recurrence, with the raw rule as its title', async () => {
    render(<TimeInput {...base} />);
    type('every weekday at 9am');
    await waitFor(() => expect(document.querySelector('[data-slot=time-input-repeats]')).not.toBeNull());
    const chip = document.querySelector('[data-slot=time-input-repeats] [data-slot=badge]') as HTMLElement;
    expect(chip.textContent).toMatch(/^RepeatsEvery weekday at 9:00\sAM$/);
    expect(chip.getAttribute('title')).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR');
    expect(rows('time-input-occurrences')).toHaveLength(6); // five upcoming + "and more"
    expect(rows('time-input-occurrences')[5]).toBe('and more');
  });

  it('limits the preview with maxOccurrences', async () => {
    render(<TimeInput {...base} maxOccurrences={2} />);
    type('every weekday at 9am');
    await waitFor(() => expect(rows('time-input-occurrences')).toHaveLength(3));
  });

  it('shows the model\'s diagnostics, with the words they point at, and dots low-confidence spans', async () => {
    render(<TimeInput {...base} />);
    type('1-3pm');
    await waitFor(() => expect(document.querySelector('[data-slot=time-input-diagnostics]')).not.toBeNull());
    const note = document.querySelector('[data-slot=time-input-diagnostics] li') as HTMLElement;
    expect(note.getAttribute('data-severity')).toBe('warning');
    expect(note.textContent).toContain('The model is uncertain about this expression.');
    expect(note.querySelector('q')?.textContent).toBe('1');
    expect(document.querySelector('mark')?.getAttribute('data-confidence')).toBe('low');
  });

  it('says so when nothing is recognised', async () => {
    render(<TimeInput {...base} />);
    type('gibberish xyz');
    await waitFor(() => expect(preview()?.textContent).toContain('No date or time found in that text.'));
    expect(document.querySelector('[data-slot=time-input-occurrences]')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('No date or time recognized.');
  });

  it('parses a defaultValue on mount', async () => {
    render(<TimeInput {...base} defaultValue="tomorrow at 3pm" />);
    expect(field().value).toBe('tomorrow at 3pm');
    await waitFor(() => expect(rows('time-input-occurrences')).toHaveLength(1));
    expect(rows('time-input-occurrences')[0]).toMatch(/^Thu, Sep 10, 2026,? 3:00\sPM$/);
  });

  it('reads day-month-year dates when dateOrder is DMY', async () => {
    render(<TimeInput {...base} dateOrder="DMY" defaultValue="dinner on 3/4" />);
    await waitFor(() => expect(rows('time-input-occurrences')[0]).toBe('Sat, Apr 3, 2027'));
  });

  it('reports a bad time zone as the field error', async () => {
    render(<TimeInput {...base} timeZone="Not/AZone" defaultValue="tomorrow" />);
    await waitFor(() => expect(field().getAttribute('aria-invalid')).toBe('true'));
    expect(document.querySelector('[data-slot=field-error]')?.textContent).toMatch(/time zone/i);
    expect(preview()).toBeNull();
  });

  it('marks the field invalid with the given message', () => {
    render(<TimeInput {...base} isInvalid errorMessage="Pick a time in the future." />);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Pick a time in the future.')).toBeTruthy();
  });

  it('shows the backend only when asked', async () => {
    const { rerender } = render(<TimeInput {...base} defaultValue="noon" />);
    await waitFor(() => expect(preview()).not.toBeNull());
    expect(preview()?.querySelector('[data-backend-label]')).toBeNull();
    expect(document.querySelector('[data-slot=time-input]')?.getAttribute('data-backend')).toBe('cpu');
    rerender(<TimeInput {...base} defaultValue="noon" showBackend />);
    expect(preview()?.querySelector('[data-backend-label]')?.textContent).toBe('CPU');
  });

  it('calls onValueChange for each keystroke, then with the result once it settles', async () => {
    const calls: TimeInputChange[] = [];
    render(<TimeInput {...base} onValueChange={(c) => calls.push(c)} />);
    type('tomorrow');
    expect(calls).toEqual([{ text: 'tomorrow', result: null, pending: true, error: null }]);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toMatchObject({ text: 'tomorrow', pending: false, error: null });
    expect(calls[1].result?.occurrences[0].start).toBe('2026-09-10T00:00:00+06:00');
    type('');
    expect(calls[calls.length - 1]).toEqual({ text: '', result: null, pending: false, error: null });
    expect(preview()).toBeNull();
  });

  it('works controlled: the field follows `value`', async () => {
    const seen: string[] = [];
    const { rerender } = render(<TimeInput {...base} value="noon" onChange={(t) => seen.push(t)} />);
    expect(field().value).toBe('noon');
    type('midnight');
    expect(seen).toEqual(['midnight']);
    expect(field().value).toBe('noon'); // not updated until the parent says so
    rerender(<TimeInput {...base} value="midnight" onChange={(t) => seen.push(t)} />);
    expect(field().value).toBe('midnight');
    await waitFor(() => expect(rows('time-input-occurrences')).toHaveLength(1));
  });

  it('keeps showing the previous answer, dimmed, while a new one is pending', async () => {
    render(<TimeInput {...base} debounceMs={50} defaultValue="noon" />);
    await waitFor(() => expect(preview()).not.toBeNull());
    type('midnight');
    expect(preview()?.hasAttribute('data-stale')).toBe(true);
    expect(preview()?.getAttribute('aria-busy')).toBe('true');
    expect(document.querySelector('[data-slot=time-input-recognized]')).toBeNull(); // offsets belong to the old text
    await waitFor(() => expect(preview()?.hasAttribute('data-stale')).toBe(false));
  });

  it('does not parse while disabled', async () => {
    render(<TimeInput {...base} isDisabled defaultValue="noon" />);
    await new Promise((r) => setTimeout(r, 60));
    expect(preview()).toBeNull();
    expect(field().disabled).toBe(true);
  });

  it('merges className and style onto the root and forwards the field props', () => {
    render(<TimeInput {...base} className="custom" style={{ maxWidth: 300 }} name="when" />);
    const root = document.querySelector('[data-slot=time-input]') as HTMLElement;
    expect(root.className).toContain('custom');
    expect(root.style.maxWidth).toBe('300px');
    expect(field().name).toBe('when');
  });

  it('renders on the server without parsing or touching window', () => {
    const html = renderToString(<TimeInput {...base} defaultValue="tomorrow" />);
    expect(html).toContain('data-slot="time-input"');
    expect(html).toContain('value="tomorrow"');
    expect(html).not.toContain('data-slot="time-input-preview"');
  });

  it('does not report React warnings', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<TimeInput {...base} />);
    type('every weekday at 9am');
    await waitFor(() => expect(preview()).not.toBeNull());
    expect(within(preview() as HTMLElement).getAllByRole('listitem').length).toBeGreaterThan(1);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
