// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Listbox, ListboxGroup, ListboxGroupLabel, ListboxItem, ListboxSeparator, createListboxController, listboxItemVariants, listboxVariants,
} from '@/components/ui/listbox';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const key = async (name: string, init: KeyboardEventInit = {}) => { fireEvent.keyDown(document.activeElement!, { key: name, ...init }); await settle(); };
const press = async (el: Element, init: MouseEventInit = {}) => { fireEvent.click(el, init); await settle(); };
const selected = () => screen.getAllByRole('option').filter((option) => option.getAttribute('aria-selected') === 'true').map((option) => option.textContent);

const tones = ['Reflection', 'Apex', 'Beacon'];

describe('Listbox, single', () => {
  it('is a named listbox with one tab stop, on the selected option', () => {
    render(
      <Listbox aria-label="Ringtone" defaultValue="Apex">
        {tones.map((tone) => <ListboxItem key={tone} value={tone}>{tone}</ListboxItem>)}
      </Listbox>,
    );
    const list = screen.getByRole('listbox', { name: 'Ringtone' });
    expect(list.getAttribute('data-variant')).toBe('inset');
    const options = within(list).getAllByRole('option');
    expect(options.map((option) => option.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(selected()).toEqual(['Apex']);
    // The checkmark is drawn only in the selected row.
    expect(options[1].querySelector('[data-slot=listbox-item-indicator]')).toBeTruthy();
    expect(options[0].querySelector('[data-slot=listbox-item-indicator]')).toBeNull();
  });

  it('selects as the arrow keys move, and reports why', async () => {
    const onValueChange = vi.fn();
    render(
      <Listbox aria-label="Ringtone" defaultValue="Reflection" onValueChange={onValueChange}>
        {tones.map((tone) => <ListboxItem key={tone} value={tone}>{tone}</ListboxItem>)}
        <ListboxItem value="Circuit" disabled>Circuit</ListboxItem>
      </Listbox>,
    );
    screen.getByRole('option', { name: 'Reflection' }).focus();
    await key('ArrowDown');
    expect(onValueChange).toHaveBeenLastCalledWith('Apex', expect.objectContaining({ reason: 'list-navigation' }));
    expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Apex' }));
    await key('End');
    // The disabled option is skipped: End lands on the last one that can be chosen.
    expect(selected()).toEqual(['Beacon']);
    expect(screen.getByRole('option', { name: 'Circuit' }).getAttribute('aria-disabled')).toBe('true');
    await key('Home');
    expect(selected()).toEqual(['Reflection']);
    await press(screen.getByRole('option', { name: 'Beacon' }));
    expect(onValueChange).toHaveBeenLastCalledWith('Beacon', expect.objectContaining({ reason: 'item-press' }));
    await press(screen.getByRole('option', { name: 'Circuit' }));
    expect(selected()).toEqual(['Beacon']);
  });

  it('finds an option by typing its label, not its description', async () => {
    render(
      <Listbox aria-label="Share with" defaultValue="ana">
        <ListboxItem value="ana" description="kim@example.com">Ana Torres</ListboxItem>
        <ListboxItem value="kim" description="ana@example.com">Kim Park</ListboxItem>
      </Listbox>,
    );
    screen.getByRole('option', { name: /Ana Torres/ }).focus();
    await key('k');
    expect(document.activeElement).toBe(screen.getByRole('option', { name: /Kim Park/ }));
    // The description describes the option; its name is the label alone.
    const kim = screen.getByRole('option', { name: 'Kim Park' });
    expect(document.getElementById(kim.getAttribute('aria-describedby')!)?.textContent).toBe('ana@example.com');
  });

  it('stays controlled, and a cancelled change changes nothing', async () => {
    render(
      <Listbox aria-label="Ringtone" value="Apex" onValueChange={(_value, details) => details.cancel()}>
        {tones.map((tone) => <ListboxItem key={tone} value={tone}>{tone}</ListboxItem>)}
      </Listbox>,
    );
    await press(screen.getByRole('option', { name: 'Beacon' }));
    expect(selected()).toEqual(['Apex']);
  });

  it('with activation="manual" only a press, Space or Enter selects', async () => {
    const onValueChange = vi.fn();
    render(
      <Listbox aria-label="Ringtone" activation="manual" defaultValue="Reflection" onValueChange={onValueChange}>
        {tones.map((tone) => <ListboxItem key={tone} value={tone}>{tone}</ListboxItem>)}
      </Listbox>,
    );
    screen.getByRole('option', { name: 'Reflection' }).focus();
    await key('ArrowDown');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement?.hasAttribute('data-highlighted')).toBe(true);
    await key('Enter');
    expect(onValueChange).toHaveBeenCalledWith('Apex', expect.objectContaining({ reason: 'item-press' }));
  });
});

describe('Listbox, multiple', () => {
  const people = (
    <>
      <ListboxItem value="ana">Ana</ListboxItem>
      <ListboxItem value="kim">Kim</ListboxItem>
      <ListboxItem value="lee">Lee</ListboxItem>
    </>
  );

  it('toggles options, keeping the value a list', async () => {
    const onValueChange = vi.fn();
    render(<Listbox aria-label="Share with" multiple defaultValue={['ana']} onValueChange={onValueChange}>{people}</Listbox>);
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    await press(screen.getByRole('option', { name: 'Lee' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['ana', 'lee'], expect.objectContaining({ reason: 'item-press' }));
    await press(screen.getByRole('option', { name: 'Ana' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['lee'], expect.anything());
    expect(selected()).toEqual(['Lee']);
  });

  it('moves without selecting, toggles with Space, and selects a range with Shift', async () => {
    render(<Listbox aria-label="Share with" multiple defaultValue={['ana']}>{people}</Listbox>);
    screen.getByRole('option', { name: 'Ana' }).focus();
    await key('ArrowDown');
    expect(selected()).toEqual(['Ana']);
    await key(' ');
    expect(selected()).toEqual(['Ana', 'Kim']);
    await key('ArrowDown', { shiftKey: true });
    expect(selected()).toEqual(['Ana', 'Kim', 'Lee']);
  });

  it('is driven from outside by a controller', async () => {
    const controller = createListboxController<string, true>();
    render(<Listbox aria-label="Share with" multiple controller={controller}>{people}</Listbox>);
    await act(async () => { controller.selectAll(); });
    expect(selected()).toEqual(['Ana', 'Kim', 'Lee']);
    await act(async () => { controller.clear(); });
    expect(selected()).toEqual([]);
  });
});

describe('Listbox parts', () => {
  it('names a group by its label and hides separators from assistive tech', async () => {
    render(
      <Listbox aria-label="Timezone" variant="popup">
        <ListboxGroup>
          <ListboxGroupLabel>Americas</ListboxGroupLabel>
          <ListboxItem value="pt">Pacific Time</ListboxItem>
        </ListboxGroup>
        <ListboxSeparator />
        <ListboxGroup>
          <ListboxGroupLabel>Europe</ListboxGroupLabel>
          <ListboxItem value="cet">Central European Time</ListboxItem>
        </ListboxGroup>
      </Listbox>,
    );
    await settle(); // a group takes its name once its label is in the page
    expect(within(screen.getByRole('group', { name: 'Americas' })).getByRole('option').textContent).toBe('Pacific Time');
    expect(screen.getByRole('listbox').getAttribute('data-variant')).toBe('popup');
    expect(document.querySelector('[data-slot=listbox-separator]')?.getAttribute('aria-hidden')).toBe('true');
    // Popup rows follow their list's variant; group labels are the kit's menu section label.
    expect(screen.getAllByRole('option')[0].className).toContain('min-h-9');
    expect(screen.getByText('Americas').className).toContain('font-semibold');
  });

  it('draws options from data: strings, objects, groups and separators', async () => {
    const onValueChange = vi.fn();
    render(
      <Listbox
        aria-label="Fruit"
        onValueChange={onValueChange}
        items={['Apple', { value: 'banana', label: 'Banana', disabled: true }, { type: 'separator' }, { type: 'group', label: 'Citrus', items: ['Lemon'] }]}
      />,
    );
    await settle();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Apple', 'Banana', 'Lemon']);
    expect(screen.getByRole('option', { name: 'Banana' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('group', { name: 'Citrus' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Apple' }).className).toContain('min-h-11');
    await press(screen.getByRole('option', { name: 'Lemon' }));
    expect(onValueChange).toHaveBeenCalledWith('Lemon', expect.anything());
  });

  it('exports its recipes', () => {
    expect(listboxVariants({ variant: 'popup' })).toContain('overflow-y-auto');
    expect(listboxItemVariants({ variant: 'popup' })).toContain('data-highlighted:bg-accent');
    expect(listboxItemVariants()).toContain('min-h-11');
  });
});
