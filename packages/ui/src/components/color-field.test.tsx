// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { ColorField, ColorFieldChannelInput, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch, ColorSwatch } from '@/components/ui/color-field';
import { ColorPicker } from '@/components/ui/color-picker';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

/** The arguments of a mock's latest call. */
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1];

/** Lets the label find its control and the field wire its ids, which happen a tick after mounting. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const VIOLET = '#7f5af0';

const field = (props: ComponentProps<typeof ColorField> = {}, fieldProps: ComponentProps<typeof Field> = {}) => (
  <Field {...fieldProps}>
    <FieldLabel>Accent</FieldLabel>
    <ColorField defaultValue={VIOLET} {...props} />
    <FieldDescription>Any CSS color.</FieldDescription>
    <FieldError>Pick a darker color.</FieldError>
  </Field>
);

const type = (input: HTMLElement, text: string) => fireEvent.input(input, { target: { value: text } });

describe('ColorField', () => {
  it('is a group named by its label, with a swatch and a text box holding the color', async () => {
    render(field());
    await settle();
    const group = screen.getByRole('group', { name: 'Accent' });
    expect(group.getAttribute('data-slot')).toBe('color-picker');
    expect(group.getAttribute('aria-describedby')).toBe(screen.getByText('Any CSS color.').id);
    const input = screen.getByRole('textbox', { name: 'Color' }) as HTMLInputElement;
    expect(group.contains(input)).toBe(true);
    expect(input.value).toBe(VIOLET);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/purple/);
    // The swatch is filled with the color the part writes on it.
    expect(screen.getByRole('img').style.getPropertyValue('--color-picker-color')).not.toBe('');
  });

  it('focuses the text box when its label is pressed', async () => {
    render(field());
    await settle();
    fireEvent.click(screen.getByText('Accent'));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('reads a typed color on Enter and reports it once, with its reason', () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    render(field({ onValueChange, onValueCommit }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    type(input, 'rebeccapurple');
    // Typing alone changes nothing.
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe('#663399');
    expect(onValueChange.mock.calls[0][1].reason).toBe('input-commit');
    expect(onValueChange.mock.calls[0][1].color).toMatchObject({ space: 'hsv', alpha: 1 });
    expect(onValueCommit).toHaveBeenCalledTimes(1);
    expect(onValueCommit.mock.calls[0][0]).toBe('#663399');
    expect(input.value).toBe('#663399');
  });

  it('reads a typed color when the text box loses focus', () => {
    const onValueChange = vi.fn();
    render(field({ onValueChange }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    type(input, 'hsl(135 70% 50%)');
    fireEvent.focusOut(input);
    expect(last(onValueChange)[0]).toBe('#26d953');
    expect(input.value).toBe('#26d953');
  });

  it('puts the value back when the text is not a color, and on Escape', () => {
    const onValueChange = vi.fn();
    render(field({ onValueChange }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    type(input, 'purple-ish');
    fireEvent.focusOut(input);
    expect(input.value).toBe(VIOLET);
    type(input, '');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe(VIOLET);
    type(input, 'red');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe(VIOLET);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps its value when the change is canceled, and follows a controlled one', () => {
    const { rerender } = render(<ColorField aria-label="Accent" value={VIOLET} onValueChange={(_, details) => details.cancel()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    type(input, 'red');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe(VIOLET);
    rerender(<ColorField aria-label="Accent" value="#0a84ff" />);
    expect(input.value).toBe('#0a84ff');
  });

  it('writes the value in the `format` asked for', () => {
    const onValueChange = vi.fn();
    render(<ColorField aria-label="Accent" space="oklch" defaultValue="oklch(0.7 0.1 250)" onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    type(input, 'red');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange.mock.calls[0][0]).toMatch(/^oklch\(/);
  });

  it('shows the field as invalid from its Field', async () => {
    render(field({}, { invalid: true }));
    await settle();
    const group = screen.getByRole('group', { name: 'Accent' });
    expect(group.hasAttribute('data-invalid')).toBe(true);
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Pick a darker color.')).toBeTruthy();
  });

  it('shows no error and no invalid state while it is valid', async () => {
    render(field());
    await settle();
    const group = screen.getByRole('group', { name: 'Accent' });
    expect(group.hasAttribute('data-invalid')).toBe(false);
    expect(group.hasAttribute('aria-invalid')).toBe(false);
    expect(screen.queryByText('Pick a darker color.')).toBeNull();
  });

  it('disables the text box and marks the field', () => {
    render(<ColorField aria-label="Accent" defaultValue={VIOLET} disabled />);
    expect(screen.getByRole('group').hasAttribute('data-disabled')).toBe(true);
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('keeps a read-only field focusable and unchanged', () => {
    const onValueChange = vi.fn();
    render(<ColorField aria-label="Accent" defaultValue={VIOLET} readOnly onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    type(input, 'red');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe(VIOLET);
  });

  it('submits its value under `name`', () => {
    render(
      <form aria-label="Theme">
        <ColorField aria-label="Accent" name="accent" defaultValue={VIOLET} />
      </form>,
    );
    expect(new FormData(screen.getByRole<HTMLFormElement>('form')).get('accent')).toBe(VIOLET);
  });

  it('takes its own parts: a smaller swatch and a named text box', () => {
    render(
      <ColorField aria-label="Accent" size="sm" defaultValue={VIOLET}>
        <ColorFieldSwatch aria-label="Current accent" />
        <ColorFieldInput aria-label="Hex" placeholder="#RRGGBB" />
      </ColorField>,
    );
    expect(screen.getByRole('img', { name: 'Current accent' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Hex' }).getAttribute('placeholder')).toBe('#RRGGBB');
  });
});

describe('ColorFieldChannelInput', () => {
  it('edits one channel as a number, named after it', () => {
    const onValueChange = vi.fn();
    render(
      <ColorField aria-label="Accent" space="hsl" format="hsl" defaultValue="hsl(262 83% 66%)" onValueChange={onValueChange}>
        <ColorFieldChannelInput channel="hue" />
        <ColorFieldChannelInput channel="saturation" />
        <ColorFieldChannelInput channel="lightness" />
      </ColorField>,
    );
    const hue = screen.getByRole('spinbutton', { name: 'Hue' }) as HTMLInputElement;
    expect(hue.value).toBe('262');
    expect(hue.max).toBe('360');
    expect((screen.getByRole('spinbutton', { name: 'Saturation' }) as HTMLInputElement).value).toBe('83');
    // UI SDK reports this commit with the input's `change` event, which its own vocabulary of reasons does not list,
    // so its first one warns in development. Strict mode would turn that warning into a throw.
    globalThis.__UI_SDK_STRICT__ = false;
    try {
      fireEvent.change(hue, { target: { value: '200' } });
    } finally {
      globalThis.__UI_SDK_STRICT__ = true;
    }
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe('hsl(200 83% 66%)');
    expect(onValueChange.mock.calls[0][1].reason).toBe('input-commit');
  });
});

describe('ColorFieldGroup', () => {
  it('edits the color of the ColorPicker around it', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ColorPicker aria-label="Accent" defaultValue={VIOLET} onValueChange={onValueChange}>
        <ColorFieldGroup size="sm">
          <ColorFieldSwatch />
          <ColorFieldInput />
        </ColorFieldGroup>
      </ColorPicker>,
    );
    // One root: the group is a plain box inside the picker.
    expect(container.querySelectorAll('[data-slot=color-picker]')).toHaveLength(1);
    expect(container.querySelector('[data-slot=color-field-group]')?.getAttribute('role')).toBeNull();
    const input = screen.getByRole('textbox', { name: 'Color' }) as HTMLInputElement;
    type(input, '#30d158');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange.mock.calls[0][0]).toBe('#30d158');
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/green/);
  });
});

describe('ColorSwatch', () => {
  it('is an image of the color it is given, named by it or by `aria-label`', () => {
    render(
      <>
        <ColorSwatch color="hsl(4 100% 61%)" />
        <ColorSwatch color="hsl(4 100% 61%)" aria-label="Brand red" />
      </>,
    );
    const [plain, named] = screen.getAllByRole('img');
    expect(plain.getAttribute('aria-label')).toBe('hsl(4 100% 61%)');
    expect(plain.style.getPropertyValue('--color-picker-color')).toBe('hsl(4 100% 61%)');
    expect(named.getAttribute('aria-label')).toBe('Brand red');
  });
});
