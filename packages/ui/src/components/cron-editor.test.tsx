// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CronEditor, CRON_PRESETS } from '@/components/ui/cron-editor';
import { resetGpuCron } from '@/lib/gpu-cron';

/* CronEditor: the local half (validation, description, next runs, presets) runs for real, the natural-language half
   against a mocked gpu-cron, with `navigator.gpu` stubbed in and out. */

const mocks = vi.hoisted(() => ({ isAvailable: vi.fn(), parse: vi.fn(), loads: 0 }));
vi.mock('gpu-cron', () => {
  mocks.loads += 1;
  return { isAvailable: mocks.isAvailable, parse: mocks.parse };
});

const FROM = '2026-10-02T10:00:00Z'; // a Friday
const base = { from: FROM, timeZone: 'UTC', locale: 'en-US', debounceMs: 5 } as const;

const setWebGPU = (on: boolean) => {
  if (on) Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
  else delete (navigator as unknown as Record<string, unknown>).gpu;
};

beforeEach(() => {
  resetGpuCron();
  setWebGPU(false);
  mocks.isAvailable.mockReset().mockResolvedValue(true);
  mocks.parse.mockReset().mockImplementation(async () => ({ expression: '0 9 * * 1-5', next: [] }));
});
afterEach(() => {
  cleanup();
  setWebGPU(false);
});

const expressionField = () => screen.getByRole('textbox', { name: 'Cron expression' }) as HTMLInputElement;
const type = (value: string) => fireEvent.change(expressionField(), { target: { value } });
const cell = (name: string) => document.querySelector(`[data-field=${name}]`) as HTMLElement;
const runs = () => [...document.querySelectorAll('[data-slot=cron-editor-next] li')].map((li) => li.textContent);
const description = () => document.querySelector('[data-slot=cron-editor-description]')?.textContent;

describe('CronEditor (raw expression)', () => {
  it('shows the expression with its five labelled fields', () => {
    render(<CronEditor {...base} defaultValue="*/15 9-17 1,15 jan-jun mon-fri" naturalLanguage={false} />);
    expect(expressionField().value).toBe('*/15 9-17 1,15 jan-jun mon-fri');
    const names = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
    expect(names.map((n) => cell(n).querySelector('dt')?.textContent)).toEqual(['minute', 'hour', 'day of month', 'month', 'day of week']);
    expect(names.map((n) => cell(n).querySelector('dd')?.textContent)).toEqual(['*/15', '9-17', '1,15', 'jan-jun', 'mon-fri']);
    expect(document.querySelector('[data-invalid]')).toBeNull();
  });

  it('describes the expression in English once cronstrue has loaded', async () => {
    render(<CronEditor {...base} defaultValue="0 9 * * 1-5" naturalLanguage={false} />);
    await waitFor(() => expect(description()).toBe('At 09:00 AM, Monday through Friday'));
  });

  it('lists the next runs in the zone, counting from `from`', async () => {
    render(<CronEditor {...base} defaultValue="0 9 * * 1-5" naturalLanguage={false} />);
    await waitFor(() => expect(runs()).toHaveLength(5));
    expect(runs().map((r) => r?.replace(/\u202f/g, ' '))).toEqual([
      'Mon, Oct 5, 2026, 9:00 AM', 'Tue, Oct 6, 2026, 9:00 AM', 'Wed, Oct 7, 2026, 9:00 AM', 'Thu, Oct 8, 2026, 9:00 AM', 'Fri, Oct 9, 2026, 9:00 AM',
    ]);
    expect(document.querySelector('[data-slot=cron-editor-next] time')?.getAttribute('datetime')).toBe('2026-10-05T09:00:00.000Z');
    expect(document.querySelector('[data-slot=cron-editor-next]')?.textContent).toContain('Times in UTC.');
  });

  it('reads the expression in the time zone given, and says when it is the device zone', () => {
    const { unmount } = render(<CronEditor {...base} timeZone="Asia/Dhaka" defaultValue="0 9 * * *" naturalLanguage={false} />);
    // 09:00 in Dhaka (UTC+6) is 03:00Z; 2026-10-02T10:00Z is past today's, so the next is Saturday.
    expect(runs()[0]?.replace(/\u202f/g, ' ')).toBe('Sat, Oct 3, 2026, 9:00 AM');
    unmount();
    render(<CronEditor from={FROM} locale="en-US" defaultValue="0 9 * * *" naturalLanguage={false} />);
    expect(document.querySelector('[data-slot=cron-editor-next]')?.textContent).toContain('this device’s time zone');
  });

  it('respects nextRunCount', () => {
    render(<CronEditor {...base} nextRunCount={2} defaultValue="* * * * *" naturalLanguage={false} />);
    expect(runs()).toHaveLength(2);
  });

  it('says what is wrong with each bad field, and marks it', () => {
    render(<CronEditor {...base} defaultValue="60 24 * 13 funday" naturalLanguage={false} />);
    expect(expressionField().getAttribute('aria-invalid')).toBe('true');
    const error = document.querySelector('[data-slot=field-error]') as HTMLElement;
    expect(error.textContent).toContain('Minute: 60 is out of range (0–59)');
    expect(error.textContent).toContain('Hour: 24 is out of range (0–23)');
    expect(error.textContent).toContain('Month: 13 is out of range (1–12)');
    expect(error.textContent).toContain('Day of week: "funday" is not a number or weekday name');
    expect(['minute', 'hour', 'month', 'dayOfWeek'].every((n) => cell(n).hasAttribute('data-invalid'))).toBe(true);
    expect(cell('dayOfMonth').hasAttribute('data-invalid')).toBe(false);
    expect(runs()).toEqual([]);
    expect(document.querySelector('[data-slot=cron-editor-next]')?.textContent).toContain('Fix the expression to see when it runs.');
    expect(description()).toBe('');
  });

  it('asks for five fields while fewer are typed, marking the missing ones', () => {
    render(<CronEditor {...base} defaultValue="0 9" naturalLanguage={false} />);
    expect((document.querySelector('[data-slot=field-error]') as HTMLElement).textContent).toContain('Cron needs 5 fields; 2 given. Missing: day of month, month, day of week.');
    expect(cell('dayOfMonth').querySelector('dd')?.textContent).toBe('–');
  });

  it('shows no error for an empty expression, only a prompt', () => {
    render(<CronEditor {...base} naturalLanguage={false} />);
    expect(expressionField().getAttribute('aria-invalid')).toBeNull();
    expect(document.querySelector('[data-slot=field-error]')).toBeNull();
    expect(document.querySelector('[data-slot=cron-editor-next]')?.textContent).toContain('Enter an expression to see when it runs.');
  });

  it('explains an expression that never matches a date', () => {
    render(<CronEditor {...base} defaultValue="0 0 30 2 *" naturalLanguage={false} />);
    expect(document.querySelector('[data-slot=cron-editor-next]')?.textContent).toContain('never matches a real date');
  });

  it('reports an unknown time zone in place of the runs', () => {
    render(<CronEditor {...base} timeZone="Not/AZone" defaultValue="0 9 * * *" naturalLanguage={false} />);
    expect(document.querySelector('[data-slot=cron-editor-next]')?.textContent).toContain('“Not/AZone” is not a time zone this browser knows.');
  });

  it('follows the caret across the fields', () => {
    render(<CronEditor {...base} defaultValue="0 9 * * 1-5" naturalLanguage={false} />);
    const input = expressionField();
    const select = (at: number) => {
      input.setSelectionRange(at, at);
      fireEvent.select(input);
    };
    select(0);
    expect(cell('minute').hasAttribute('data-active')).toBe(true);
    select(3);
    expect(cell('hour').hasAttribute('data-active')).toBe(true);
    expect(cell('minute').hasAttribute('data-active')).toBe(false);
    select(11);
    expect(cell('dayOfWeek').hasAttribute('data-active')).toBe(true);
    fireEvent.blur(input);
    expect(document.querySelector('[data-active]')).toBeNull();
  });

  it('works controlled and calls onValueChange for each edit', () => {
    const seen: string[] = [];
    const { rerender } = render(<CronEditor {...base} value="* * * * *" onValueChange={(v) => seen.push(v)} naturalLanguage={false} />);
    type('0 * * * *');
    expect(seen).toEqual(['0 * * * *']);
    expect(expressionField().value).toBe('* * * * *');
    rerender(<CronEditor {...base} value="0 * * * *" onValueChange={(v) => seen.push(v)} naturalLanguage={false} />);
    expect(expressionField().value).toBe('0 * * * *');
    expect(cell('minute').querySelector('dd')?.textContent).toBe('0');
  });

  it('applies presets, and marks the one that matches', () => {
    const seen: string[] = [];
    render(<CronEditor {...base} defaultValue="" onValueChange={(v) => seen.push(v)} naturalLanguage={false} />);
    const weekdays = screen.getByRole('button', { name: 'Weekdays at 9:00' });
    expect(weekdays.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(weekdays);
    expect(seen).toEqual(['0 9 * * 1-5']);
    expect(expressionField().value).toBe('0 9 * * 1-5');
    expect(screen.getByRole('button', { name: 'Weekdays at 9:00' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Hourly' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getAllByRole('button')).toHaveLength(CRON_PRESETS.length);
  });

  it('takes custom presets, or none', () => {
    const { unmount } = render(<CronEditor {...base} presets={[{ label: 'Nightly', value: '0 2 * * *' }]} naturalLanguage={false} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Nightly']);
    unmount();
    render(<CronEditor {...base} presets={false} naturalLanguage={false} />);
    expect(document.querySelector('[data-slot=cron-editor-presets]')).toBeNull();
  });

  it('merges className, forwards div props and sets the form name', () => {
    render(<CronEditor {...base} className="custom" id="the-editor" name="schedule" naturalLanguage={false} />);
    const root = document.querySelector('[data-slot=cron-editor]') as HTMLElement;
    expect(root.className).toContain('custom');
    expect(root.id).toBe('the-editor');
    expect(expressionField().name).toBe('schedule');
  });

  it('uses the monospace font on the expression, not the inherited one', () => {
    render(<CronEditor {...base} naturalLanguage={false} />);
    expect(expressionField().className).toContain('[font-family:var(--font-mono)]');
    expect(expressionField().className).not.toContain('[font-family:inherit]');
  });

  it('disables everything', () => {
    render(<CronEditor {...base} isDisabled defaultValue="0 9 * * *" />);
    expect(expressionField().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Hourly' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders on the server without next runs (they depend on the clock)', () => {
    const html = renderToString(<CronEditor defaultValue="0 9 * * 1-5" naturalLanguage={false} />);
    expect(html).toContain('data-slot="cron-editor"');
    expect(html).toContain('value="0 9 * * 1-5"');
    expect(html).not.toContain('<time');
  });
});

describe('CronEditor (natural language)', () => {
  it('leaves the box out, with a note, when the browser has no WebGPU — and never loads gpu-cron', async () => {
    const loads = mocks.loads;
    render(<CronEditor {...base} />);
    await waitFor(() => expect(document.querySelector('[data-slot=cron-editor-note]')).not.toBeNull());
    expect(document.querySelector('[data-slot=cron-editor-note]')?.textContent).toContain('needs WebGPU');
    expect(screen.queryByRole('textbox', { name: 'Describe the schedule' })).toBeNull();
    expect(mocks.isAvailable).not.toHaveBeenCalled();
    expect(mocks.loads).toBe(loads);
    expect(expressionField()).toBeTruthy(); // the raw editor is still there
  });

  it('leaves the box out, with the note, when WebGPU exists but there is no adapter', async () => {
    setWebGPU(true);
    mocks.isAvailable.mockResolvedValue(false);
    render(<CronEditor {...base} />);
    await waitFor(() => expect(document.querySelector('[data-slot=cron-editor-note]')).not.toBeNull());
    expect(screen.queryByRole('textbox', { name: 'Describe the schedule' })).toBeNull();
  });

  it('does not offer the box (or the note) with naturalLanguage={false}', async () => {
    setWebGPU(true);
    render(<CronEditor {...base} naturalLanguage={false} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-slot=cron-editor-natural]')).toBeNull();
    expect(document.querySelector('[data-slot=cron-editor-note]')).toBeNull();
    expect(mocks.isAvailable).not.toHaveBeenCalled();
  });

  it('offers the box where WebGPU works, disabled until the check settles', async () => {
    setWebGPU(true);
    render(<CronEditor {...base} />);
    const box = screen.getByRole('textbox', { name: 'Describe the schedule' }) as HTMLInputElement;
    expect(box.disabled).toBe(true);
    expect(box.placeholder).toBe('Checking for WebGPU…');
    await waitFor(() => expect(box.disabled).toBe(false));
    expect(box.placeholder).toMatch(/every weekday/);
  });

  it('is the only input where WebGPU works: no expression field, fields, description or presets', async () => {
    setWebGPU(true);
    render(<CronEditor {...base} />);
    const box = screen.getByRole('textbox', { name: 'Describe the schedule' }) as HTMLInputElement;
    await waitFor(() => expect(box.disabled).toBe(false));
    expect(screen.queryByRole('textbox', { name: 'Cron expression' })).toBeNull();
    expect(document.querySelector('[data-slot=cron-editor-fields]')).toBeNull();
    expect(document.querySelector('[data-slot=cron-editor-description]')).toBeNull();
    expect(document.querySelector('[data-slot=cron-editor-presets]')).toBeNull();
    expect(document.querySelector('[data-slot=cron-editor-next]')).not.toBeNull();
  });

  it('applies each answer as the value while you type, and the next runs follow', async () => {
    setWebGPU(true);
    const seen: string[] = [];
    render(<CronEditor {...base} onValueChange={(v) => seen.push(v)} />);
    mocks.parse.mockImplementation(async (text: string) => ({ expression: text.includes('15') ? '*/15 * * * *' : '0 9 * * 1-5', next: [] }));
    const box = screen.getByRole('textbox', { name: 'Describe the schedule' }) as HTMLInputElement;
    await waitFor(() => expect(box.disabled).toBe(false));
    fireEvent.change(box, { target: { value: 'every weekday at 9am' } });
    await waitFor(() => expect(seen).toEqual(['0 9 * * 1-5']));
    await waitFor(() => expect(runs()).toHaveLength(5));
    fireEvent.change(box, { target: { value: 'every 15 minutes' } });
    await waitFor(() => expect(seen.at(-1)).toBe('*/15 * * * *'));
  });

  it('does not re-send an answer that is already the value, and shows the error when the model throws', async () => {
    setWebGPU(true);
    const seen: string[] = [];
    render(<CronEditor {...base} defaultValue="0 9 * * 1-5" onValueChange={(v) => seen.push(v)} />);
    const box = screen.getByRole('textbox', { name: 'Describe the schedule' }) as HTMLInputElement;
    await waitFor(() => expect(box.disabled).toBe(false));
    fireEvent.change(box, { target: { value: 'weekdays at nine' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(seen).toEqual([]);

    mocks.parse.mockRejectedValueOnce(new Error('prompt is 900 characters; the model fits 200 alongside its answer'));
    fireEvent.change(box, { target: { value: 'a very long description' } });
    await waitFor(() => expect(document.querySelector('[data-slot=cron-editor-natural] [data-slot=field-error]')?.textContent).toMatch(/too long/));
  });
});
