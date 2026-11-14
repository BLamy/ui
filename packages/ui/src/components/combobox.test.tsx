// @vitest-environment happy-dom
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Combobox, ComboboxChip, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxGroupLabel, ComboboxInput, ComboboxItem, ComboboxLabel,
  ComboboxList, ComboboxStatus, createComboboxController,
} from '@/components/ui/combobox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const key = async (name: string) => { fireEvent.keyDown(document.activeElement!, { key: name }); await settle(); };
const type = async (input: HTMLElement, text: string) => { fireEvent.change(input, { target: { value: text } }); await settle(); };
const shown = () => screen.queryAllByRole('option').filter((option) => !option.hidden).map((option) => option.textContent);

const cities = ['Amsterdam', 'Barcelona', 'Berlin', 'Lisbon'];

function City(props: Partial<ComponentProps<typeof Combobox<string>>>) {
  return (
    <Combobox {...props}>
      <ComboboxLabel variant="field">City</ComboboxLabel>
      <ComboboxInput placeholder="Search cities" />
      <ComboboxContent>
        <ComboboxEmpty>No cities found.</ComboboxEmpty>
        <ComboboxList>
          {cities.map((city) => <ComboboxItem key={city} value={city}>{city}</ComboboxItem>)}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

describe('Combobox', () => {
  it('is a labelled combobox input with a disclosure button out of the tab order', async () => {
    render(<City />);
    await settle();
    const input = screen.getByRole('combobox', { name: 'City' });
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    const button = screen.getByRole('button', { name: 'Show options' });
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('filters as you type, keeps focus in the input, and chooses the highlighted option with Enter', async () => {
    const onValueChange = vi.fn();
    const onQueryChange = vi.fn();
    render(<City onValueChange={onValueChange} onQueryChange={onQueryChange} />);
    const input = screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;
    input.focus();
    await type(input, 'b');
    expect(onQueryChange).toHaveBeenLastCalledWith('b', expect.objectContaining({ reason: 'input-change' }));
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(shown()).toEqual(['Barcelona', 'Berlin', 'Lisbon']);
    await type(input, 'ber');
    expect(shown()).toEqual(['Berlin']);
    await key('ArrowDown');
    const berlin = screen.getByRole('option', { name: 'Berlin' });
    expect(berlin.hasAttribute('data-highlighted')).toBe(true);
    expect(input.getAttribute('aria-activedescendant')).toBe(berlin.id);
    expect(document.activeElement).toBe(input);
    await key('Enter');
    expect(onValueChange).toHaveBeenCalledWith('Berlin', expect.objectContaining({ reason: 'item-press' }));
    expect(input.value).toBe('Berlin');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens with the arrow keys and from its button, and Escape closes it', async () => {
    const onOpenChange = vi.fn();
    render(<City onOpenChange={onOpenChange} />);
    const input = screen.getByRole('combobox', { name: 'City' });
    input.focus();
    await key('ArrowDown');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(4);
    // The popup hides itself when no item is shown, keyed on the items' slot.
    expect(within(screen.getByRole('listbox')).getAllByRole('option').every((option) => option.getAttribute('data-slot') === 'combobox-item')).toBe(true);
    await key('Escape');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Show options' }));
    await settle();
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the empty message when nothing matches, and brings the chosen label back when it closes', async () => {
    render(<City defaultValue="Lisbon" />);
    const input = screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;
    expect(input.value).toBe('Lisbon');
    input.focus();
    await type(input, 'zz');
    expect(shown()).toEqual([]);
    expect(screen.getByRole('status').textContent).toBe('No cities found.');
    await key('Escape');
    await key('Escape');
    expect(input.value).toBe('Lisbon');
  });

  it('keeps typed text as the value with allowCustomValue', async () => {
    const onValueChange = vi.fn();
    render(<City allowCustomValue onValueChange={onValueChange} />);
    const input = screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;
    input.focus();
    await type(input, 'Porto');
    await key('Enter');
    expect(onValueChange).toHaveBeenLastCalledWith('Porto', expect.anything());
    expect(input.value).toBe('Porto');
  });

  it('is disabled like a native input', () => {
    render(<City disabled defaultValue="Berlin" />);
    const input = screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('Berlin');
  });

  it('takes its name and description from a Field', async () => {
    render(
      <Field name="assignee">
        <FieldLabel variant="field">Assignee</FieldLabel>
        <Combobox defaultValue="kim">
          <ComboboxInput />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxItem value="kim" description="kim@example.com">Kim Park</ComboboxItem>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <FieldDescription>Gets a notification.</FieldDescription>
      </Field>,
    );
    await settle();
    const input = screen.getByRole('combobox', { name: 'Assignee' }) as HTMLInputElement;
    // The option's own text is its label: the input does not show the description.
    expect(input.value).toBe('Kim Park');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('Gets a notification.');
    const form = document.querySelector<HTMLInputElement>('[data-slot=combobox-form-input]')!;
    expect(form.name).toBe('assignee');
    expect(form.value).toBe('kim');
  });

  it('draws data items with the same rows, filtered, with groups that hide when empty', async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        defaultOpen
        onValueChange={onValueChange}
        items={[
          { type: 'group', label: 'Europe', items: [{ value: 'ber', label: 'Berlin', keywords: ['Germany'] }, { value: 'lis', label: 'Lisbon' }] },
          { type: 'group', label: 'Asia', items: [{ value: 'tyo', label: 'Tokyo' }] },
        ]}
      >
        <ComboboxInput aria-label="City" />
        <ComboboxContent />
      </Combobox>,
    );
    await settle();
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Berlin' }).className).toContain('min-h-9');
    const input = screen.getByRole('combobox', { name: 'City' });
    input.focus();
    await type(input, 'germ');
    expect(shown()).toEqual(['Berlin']);
    expect(screen.queryByRole('group', { name: 'Asia' })).toBeNull();
    // A data combobox that starts open keeps its keyboard wiring.
    await key('ArrowDown');
    await key('Enter');
    expect(onValueChange).toHaveBeenCalledWith('ber', expect.anything());
  });

  it('composes groups by hand', async () => {
    render(
      <Combobox defaultOpen>
        <ComboboxInput aria-label="City" />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxGroupLabel>Europe</ComboboxGroupLabel>
              <ComboboxItem value="ber">Berlin</ComboboxItem>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    );
    await settle();
    expect(within(screen.getByRole('group', { name: 'Europe' })).getByRole('option').textContent).toBe('Berlin');
  });

  it('is driven from outside by a controller', async () => {
    const controller = createComboboxController<string>();
    render(<City controller={controller} />);
    const input = screen.getByRole('combobox', { name: 'City' }) as HTMLInputElement;
    await act(async () => { controller.setValue('Amsterdam'); });
    expect(input.value).toBe('Amsterdam');
    await act(async () => { controller.clear(); });
    expect(input.value).toBe('');
  });

  it('with multiple, shows the chosen options as chips whose remove buttons report chip-remove', async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox multiple defaultValue={['Berlin', 'Lisbon']} onValueChange={onValueChange}>
        <ComboboxLabel variant="field">Cities</ComboboxLabel>
        <ComboboxInput chips placeholder="Add a city" />
        <ComboboxContent>
          <ComboboxList>{cities.map((city) => <ComboboxItem key={city} value={city}>{city}</ComboboxItem>)}</ComboboxList>
        </ComboboxContent>
      </Combobox>,
    );
    const chips = () => [...document.querySelectorAll('[data-slot=combobox-chip]')].map((chip) => chip.textContent);
    expect(chips()).toEqual(['Berlin', 'Lisbon']);
    // The input sits inside UI SDK's chip row, so Backspace and the arrows reach the chips.
    expect(document.querySelector('[data-slot=combobox-chips] [data-slot=combobox-input]')).toBeTruthy();
    const remove = screen.getByRole('button', { name: 'Remove Berlin' });
    expect(remove.tabIndex).toBe(-1);
    fireEvent.click(remove);
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith(['Lisbon'], expect.objectContaining({ reason: 'remove-press' }));
    expect(chips()).toEqual(['Lisbon']);
    // Backspace in the empty input removes the last chip.
    screen.getByRole('combobox', { name: 'Cities' }).focus();
    await key('Backspace');
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());
    expect(chips()).toEqual([]);
  });

  it('draws custom chips, and a Clear button that empties the selection and the query', async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox multiple defaultValue={['Berlin']} onValueChange={onValueChange}>
        <ComboboxLabel variant="field">Cities</ComboboxLabel>
        <ComboboxInput
          clearable
          clearLabel="Clear cities"
          chips={(state) => (state.value as string[]).map((value) => <ComboboxChip key={value} value={value} removeLabel={`Drop ${value}`}>{value.toUpperCase()}</ComboboxChip>)}
        />
        <ComboboxContent>
          <ComboboxList>{cities.map((city) => <ComboboxItem key={city} value={city}>{city}</ComboboxItem>)}</ComboboxList>
        </ComboboxContent>
      </Combobox>,
    );
    expect(document.querySelector('[data-slot=combobox-chip]')!.textContent).toBe('BERLIN');
    expect(screen.getByRole('button', { name: 'Drop Berlin' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear cities' }));
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: 'clear-press' }));
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Cities' }));
  });

  it('shows an async list\'s status line in the popup', async () => {
    render(
      <Combobox items={[]} status="loading" defaultOpen filter={false}>
        <ComboboxLabel variant="field">Movie</ComboboxLabel>
        <ComboboxInput />
        <ComboboxContent>
          <ComboboxStatus>{(state) => (state.loading ? 'Searching…' : null)}</ComboboxStatus>
          <ComboboxList />
        </ComboboxContent>
      </Combobox>,
    );
    await settle();
    expect(document.querySelector('[data-slot=combobox-status]')!.textContent).toBe('Searching…');
  });
});
