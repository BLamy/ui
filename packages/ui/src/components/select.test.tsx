// @vitest-environment happy-dom
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Select, SelectContent, SelectGroup, SelectGroupLabel, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
  createSelectController, selectTriggerVariants,
} from '@/components/ui/select';
import { ThemeScope } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const key = async (name: string) => { fireEvent.keyDown(document.activeElement!, { key: name }); await settle(); };
const press = async (el: Element) => { fireEvent.click(el); await settle(); };

const repeat = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Every Day' },
  { value: 'weekly', label: 'Every Week' },
];

function Repeat(props: Partial<ComponentProps<typeof Select<string>>>) {
  return (
    <Select placeholder="Choose…" {...props}>
      <SelectLabel variant="field">Repeat</SelectLabel>
      <SelectTrigger />
      <SelectContent>
        {repeat.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        <SelectItem value="yearly" disabled description="Not for this calendar">Every Year</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('is a labelled button that shows the placeholder, then the chosen label', async () => {
    render(<Repeat />);
    const trigger = screen.getByRole('combobox', { name: 'Repeat' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('data-placeholder')).toBe(true);
    expect(trigger.textContent).toBe('Choose…');
    await press(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByRole('listbox', { name: 'Repeat' });
    await press(within(list).getByRole('option', { name: 'Every Week' }));
    expect(trigger.textContent).toBe('Every Week');
    expect(trigger.hasAttribute('data-placeholder')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('shows the label of its value before the list has ever opened, without the description', () => {
    render(<Repeat defaultValue="yearly" />);
    expect(screen.getByRole('combobox', { name: 'Repeat' }).textContent).toBe('Every Year');
  });

  it('opens with the arrow keys, moves past disabled options, and chooses with Enter', async () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<Repeat defaultValue="never" onValueChange={onValueChange} onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Repeat' });
    trigger.focus();
    await key('ArrowDown');
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    expect(options[3].getAttribute('aria-disabled')).toBe('true');
    expect(options[0].hasAttribute('data-highlighted')).toBe(true);
    await key('ArrowDown');
    await key('ArrowDown');
    await key('ArrowDown'); // the disabled last option is skipped: the highlight wraps to the first
    expect(options[0].hasAttribute('data-highlighted')).toBe(true);
    await key('ArrowDown');
    await key('Enter');
    expect(onValueChange).toHaveBeenCalledWith('daily', expect.objectContaining({ reason: 'item-press' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'item-press' }));
    expect(trigger.textContent).toBe('Every Day');
  });

  it('closes on Escape without changing the value, and returns focus', async () => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<Repeat defaultValue="never" onValueChange={onValueChange} onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Repeat' });
    trigger.focus();
    await key('ArrowDown');
    await key('ArrowDown');
    await key('Escape');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('selects by typing on the closed button, from data before the list has ever opened', async () => {
    const onValueChange = vi.fn();
    render(<Repeat items={repeat} onValueChange={onValueChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Repeat' });
    trigger.focus();
    await key('n');
    expect(onValueChange).toHaveBeenCalledWith('never', expect.objectContaining({ reason: 'list-navigation' }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toBe('Never');
  });

  it('keeps the list open and the value a list with multiple', async () => {
    const onValueChange = vi.fn();
    render(<Repeat multiple defaultValue={['never']} defaultOpen onValueChange={onValueChange} />);
    await settle();
    await press(screen.getByRole('option', { name: 'Every Day' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['never', 'daily'], expect.objectContaining({ reason: 'item-press' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Repeat' }).textContent).toBe('Never, Every Day');
  });

  it('is disabled like a native select', () => {
    render(<Repeat disabled defaultValue="never" />);
    const trigger = screen.getByRole('combobox', { name: 'Repeat' }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(trigger.hasAttribute('data-disabled')).toBe(true);
  });

  it('takes its name, its error and its invalid state from a Field', async () => {
    render(
      <Field invalid name="priority">
        <FieldLabel variant="field">Priority</FieldLabel>
        <Select placeholder="Choose…">
          <SelectTrigger />
          <SelectContent><SelectItem value="low">Low</SelectItem></SelectContent>
        </Select>
        <FieldError>Pick a priority.</FieldError>
      </Field>,
    );
    await settle();
    const trigger = screen.getByRole('combobox', { name: 'Priority' });
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(trigger.hasAttribute('data-invalid')).toBe(true);
    expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe('Pick a priority.');
    expect(document.querySelector<HTMLInputElement>('[data-slot=select-form-input]')?.name).toBe('priority');
  });

  it('draws groups, separators and data items with the same rows', async () => {
    const onValueChange = vi.fn();
    render(
      <Select
        defaultOpen
        defaultValue="pt"
        onValueChange={onValueChange}
        items={[
          { type: 'group', label: 'Americas', items: [{ value: 'pt', label: 'Pacific Time' }, { value: 'et', label: 'Eastern Time' }] },
          { type: 'separator' },
          { type: 'group', label: 'Europe', items: [{ value: 'cet', label: 'Central European Time' }] },
        ]}
      >
        <SelectTrigger aria-label="Time zone" />
        <SelectContent />
      </Select>,
    );
    await settle();
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    expect(within(screen.getByRole('group', { name: 'Americas' })).getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'Pacific Time' }).className).toContain('min-h-9');
    // A data select that starts open keeps its keyboard wiring.
    screen.getByRole('option', { name: 'Pacific Time' }).focus();
    await key('ArrowDown');
    await key('ArrowDown');
    expect(screen.getByRole('option', { name: 'Eastern Time' }).hasAttribute('data-highlighted')).toBe(true);
    await key('Enter');
    expect(onValueChange).toHaveBeenCalledWith('et', expect.anything());
  });

  it('composes groups by hand, with a custom value', async () => {
    render(
      <Select defaultOpen defaultValue="gmt">
        <SelectTrigger aria-label="Time zone"><SelectValue>{(state) => `Zone: ${state.label}`}</SelectValue></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectGroupLabel>Europe</SelectGroupLabel>
            <SelectItem value="gmt">Greenwich Mean Time</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="utc">UTC</SelectItem>
        </SelectContent>
      </Select>,
    );
    await settle();
    expect(screen.getByRole('combobox', { name: 'Time zone' }).textContent).toBe('Zone: Greenwich Mean Time');
    expect(screen.getByRole('group', { name: 'Europe' })).toBeTruthy();
  });

  it('opens, sets and clears from a controller', async () => {
    const controller = createSelectController<string>();
    render(<Repeat controller={controller} />);
    await act(async () => { controller.setValue('weekly'); });
    expect(screen.getByRole('combobox', { name: 'Repeat' }).textContent).toBe('Every Week');
    await act(async () => { void controller.open(); });
    await settle();
    expect(screen.getByRole('listbox')).toBeTruthy();
    await act(async () => { controller.close(); controller.clear(); });
    await settle();
    expect(screen.getByRole('combobox', { name: 'Repeat' }).textContent).toBe('Choose…');
  });

  it('wears the ThemeScope it was opened from, and exports its trigger recipe', async () => {
    render(<ThemeScope scope="terminal"><Repeat defaultOpen /></ThemeScope>);
    await settle();
    expect(screen.getByRole('listbox').getAttribute('data-theme-scope')).toBe('terminal');
    expect(selectTriggerVariants({ variant: 'plain' })).toContain('bg-transparent');
    expect(selectTriggerVariants({ size: 'sm' })).toContain('h-8');
  });
});
