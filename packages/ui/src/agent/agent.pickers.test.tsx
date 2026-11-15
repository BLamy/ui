// @vitest-environment happy-dom
import { cleanup, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorPicker, ColorPickerContent, ColorPickerTrigger } from '@/components/ui/color-picker';
import { DatePicker, DatePickerContent, DatePickerInputGroup } from '@/components/ui/date-picker';
import { Field, FieldLabel } from '@/components/ui/field';
import { FileUpload } from '@/components/ui/file-upload';
import { Popover } from '@/components/ui/popover';
import { actOn, entry, expectNamed, mount, run, settle } from '../../test/agent-harness';

afterEach(cleanup);

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

type Details = { source?: string };
const spy = () => vi.fn<(value: any, details: Details) => void>();

describe('DatePicker is agent-ready', () => {
  it('takes an ISO date, and moves its month', async () => {
    const onValueChange = spy();
    await mount(
      <Field>
        <FieldLabel>Due date</FieldLabel>
        <DatePicker locale="en-US" defaultMonth="2026-09" onValueChange={onValueChange}>
          <DatePickerInputGroup />
          <DatePickerContent />
        </DatePicker>
      </Field>,
    );
    const snapshot = agent.snapshot();
    expectNamed(snapshot, ['Due date']);
    expect(entry(snapshot, 'Due date')).toMatchObject({ component: 'date-picker', value: null, month: '2026-09', open: false });

    await run(agent, [{ ref: 'Due date', action: 'setValue', args: ['2026-09-14'] }]);
    expect(onValueChange).toHaveBeenLastCalledWith('2026-09-14', expect.objectContaining({ source: 'agent' }));
    expect((screen.getByRole('textbox', { name: 'Due date' }) as HTMLInputElement).value).toContain('14');
    await run(agent, [{ ref: 'Due date', action: 'next' }]);
    expect(entry(agent.snapshot(), 'Due date').month).toBe('2026-10');
  });

  // setValue with a date in words returns ok: true and changes nothing (only YYYY-MM-DD is taken), so an agent can't tell.
  it.fails('applies or refuses a date written in words', async () => {
    await mount(
      <Field>
        <FieldLabel>Start date</FieldLabel>
        <DatePicker locale="en-US" defaultMonth="2026-09">
          <DatePickerInputGroup />
          <DatePickerContent />
        </DatePicker>
      </Field>,
    );
    const result = await actOn(agent, [{ ref: 'Start date', action: 'setValue', args: ['September 14, 2026'] }]);
    if (result.ok) expect(entry(agent.snapshot(), 'Start date').value).toBe('2026-09-14');
  });
});

describe('ColorPicker is agent-ready', () => {
  it('takes a color as text, named by its field', async () => {
    const onValueChange = spy();
    await mount(
      <Field>
        <FieldLabel>Accent</FieldLabel>
        <ColorPicker defaultValue="#7f5af0" onValueChange={onValueChange}>
          <Popover>
            <ColorPickerTrigger />
            <ColorPickerContent swatches={['#ff453a', '#30d158']} />
          </Popover>
        </ColorPicker>
      </Field>,
    );
    const snapshot = agent.snapshot();
    expect(entry(snapshot, 'Accent')).toMatchObject({ component: 'color-picker', value: '#7f5af0', actions: ['setValue'] });
    await run(agent, [{ ref: 'Accent', action: 'setValue', args: ['#30d158'] }]);
    expect(onValueChange).toHaveBeenLastCalledWith('#30d158', expect.objectContaining({ source: 'agent' }));
    expect(entry(agent.snapshot(), 'Accent').value).toBe('#30d158');
  });

  // The trigger (a Popover trigger rendered as a button) is named by the current color ("vivid purple #7f5af0"),
  // not by the field, so the page lists a button and a popover an agent can't relate to "Accent".
  it('names its popover trigger after the field', async () => {
    await mount(
      <Field>
        <FieldLabel>Accent</FieldLabel>
        <ColorPicker defaultValue="#7f5af0">
          <Popover>
            <ColorPickerTrigger />
            <ColorPickerContent />
          </Popover>
        </ColorPicker>
      </Field>,
    );
    const popover = agent.snapshot().find((e) => e.component === 'popover' && !e.offPage);
    expect(popover?.label).toContain('Accent');
  });
});

describe('FileUpload is agent-ready', () => {
  const upload = async () => ({ url: 'https://example.com/x' });

  it('takes files through addFiles and lists them', async () => {
    const onValueChange = vi.fn();
    await mount(<FileUpload upload={upload} onValueChange={onValueChange} />);
    const input = entry(agent.snapshot(), 'Browse files');
    expect(input).toMatchObject({ component: 'file-input', multiple: true });
    expect(input.actions).toEqual(expect.arrayContaining(['addFiles', 'removeFile', 'clear']));
    await run(agent, [{ ref: 'Browse files', action: 'addFiles', args: [[new File(['hello'], 'notes.txt', { type: 'text/plain' })]] }]);
    await settle(20);
    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange.mock.calls.at(-1)?.[0].map((f: { file: File }) => f.file.name)).toEqual(['notes.txt']);
    expect(screen.getByText('notes.txt')).toBeTruthy();
  });

  it('reports the agent as the source of added files', async () => {
    const onValueChange = vi.fn();
    await mount(<FileUpload upload={upload} onValueChange={onValueChange} />);
    await run(agent, [{ ref: 'Browse files', action: 'addFiles', args: [[new File(['hello'], 'notes.txt')]] }]);
    // The call that added it keeps FileInput's reason and source; the upload's own steps follow as `programmatic`.
    expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'imperative', source: 'agent' });
  });

  it('inside a Field, is found by the field’s name', async () => {
    const onValueChange = vi.fn();
    await mount(
      <Field>
        <FieldLabel>Attachments</FieldLabel>
        <FileUpload upload={upload} onValueChange={onValueChange} />
      </Field>,
    );
    // Named "Attachments Browse files": the field's label, then its button's text.
    expect(agent.snapshot().find((e) => e.component === 'file-input' && !e.offPage)?.label).toContain('Attachments');
    await run(agent, [{ ref: 'Attachments', action: 'addFiles', args: [[new File(['x'], 'brief.pdf')]] }]);
    await settle(20);
    expect(onValueChange).toHaveBeenCalled();
  });
});
