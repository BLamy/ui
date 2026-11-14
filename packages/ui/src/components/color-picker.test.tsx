// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import {
  ColorInput, ColorPicker, ColorPickerArea, ColorPickerChannelInput, ColorPickerContent, ColorPickerEyeDropper, ColorPickerField,
  ColorPickerInput, ColorPickerSlider, ColorPickerSliderThumb, ColorPickerSwatch, ColorPickerSwatches, ColorPickerSwatchItem,
  ColorPickerTrigger, ColorSwatch, createColorPickerController,
} from '@/components/ui/color-picker';
import { Popover } from '@/components/ui/popover';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

/** The arguments of a mock's latest call. */
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1];

/** Lets a popover finish opening or closing, and a label find its control. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const VIOLET = '#7f5af0';
const PRESETS = ['#ff453a', '#30d158'];

const popover = (props: ComponentProps<typeof ColorPicker> = {}, content: ComponentProps<typeof ColorPickerContent> = {}) => (
  <ColorPicker aria-label="Accent" defaultValue={VIOLET} {...props}>
    <ColorPickerTrigger />
    <ColorPickerContent {...content} />
  </ColorPicker>
);

const open = async () => {
  fireEvent.click(screen.getByRole('button'));
  await settle();
  return screen.getByRole('dialog', { name: 'Accent' });
};

describe('ColorPicker', () => {
  it('is a group that holds the color and hands its state to a children function', () => {
    render(
      <ColorPicker aria-label="Accent" defaultValue={VIOLET}>
        {({ value }) => <output>{value}</output>}
      </ColorPicker>,
    );
    expect(screen.getByRole('group', { name: 'Accent' }).getAttribute('data-slot')).toBe('color-picker');
    expect(screen.getByRole('status').textContent).toBe(VIOLET);
  });

  it('takes a new value from its controller', () => {
    const controller = createColorPickerController();
    const onValueChange = vi.fn();
    render(
      <ColorPicker aria-label="Accent" defaultValue={VIOLET} controller={controller} onValueChange={onValueChange}>
        <ColorPickerSwatch />
      </ColorPicker>,
    );
    let done = false;
    act(() => {
      done = controller.setValue('rebeccapurple');
    });
    expect(done).toBe(true);
    expect(controller.getValue()).toBe('#663399');
    expect(onValueChange.mock.calls[0][1].reason).toBe('imperative');
    expect(controller.setValue('not a color')).toBe(false);
  });
});

describe('ColorPickerTrigger and ColorPickerContent', () => {
  it('shows the color in the trigger as hex, with the opacity once it is below 1', () => {
    const view = render(popover());
    expect(screen.getByRole('button').textContent).toBe(VIOLET);
    expect(within(screen.getByRole('button')).getByRole('img').getAttribute('aria-label')).toMatch(/purple/);
    view.unmount();
    render(popover({ defaultValue: 'hsla(262, 83%, 66%, 0.6)' }));
    expect(screen.getByRole('button').textContent).toBe('#9560f099');
  });

  it('shows the value in the picker\'s `format`, and opens from the root\'s `defaultOpen` with no Popover around it', async () => {
    render(popover({ format: 'hsl', defaultOpen: true }));
    await settle();
    expect(screen.getByRole('button', { name: /^Accent/ }).textContent).toMatch(/^hsl\(/);
    expect(screen.getByRole('dialog', { name: 'Accent' })).toBeTruthy();
  });

  it('names the trigger and the dialog after the picker, not its color', async () => {
    render(popover());
    expect(screen.getByRole('button', { name: 'Accent, #7f5af0' })).toBeTruthy();
    expect(await open()).toBeTruthy();
  });

  it('inside a Field, the trigger and the dialog take the field’s label', async () => {
    render(
      <Field>
        <FieldLabel>Tint</FieldLabel>
        <ColorPicker defaultValue={VIOLET}>
          <Popover>
            <ColorPickerTrigger />
            <ColorPickerContent />
          </Popover>
        </ColorPicker>
      </Field>,
    );
    await settle();
    expect(screen.getByRole('button', { name: /^Tint/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Tint/ }));
    await settle();
    expect(screen.getByRole('dialog', { name: 'Tint' })).toBeTruthy();
  });

  it('hides the hex with `showValue={false}`', () => {
    render(
      <ColorPicker aria-label="Accent" defaultValue={VIOLET}>
        <Popover>
          <ColorPickerTrigger aria-label="Accent color" showValue={false} />
          <ColorPickerContent />
        </Popover>
      </ColorPicker>,
    );
    expect(screen.getByRole('button', { name: 'Accent color' }).textContent).toBe('');
  });

  it('survives a value it cannot read', () => {
    render(popover({ defaultValue: 'not a color' }));
    expect(screen.getByRole('button').textContent).toBe('#000000');
  });

  it('opens a dialog with the area, a hue slider, a color field and presets, which edit the same color', async () => {
    const onValueChange = vi.fn();
    render(popover({ onValueChange }, { swatches: PRESETS }));
    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const dialog = await open();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(within(dialog).getByRole('slider', { name: 'Saturation and brightness' })).toBeTruthy();
    expect(within(dialog).getByRole('slider', { name: 'Hue' })).toBeTruthy();
    expect(within(dialog).queryByRole('slider', { name: 'Opacity' })).toBeNull();

    const input = within(dialog).getByRole('textbox', { name: 'Color' }) as HTMLInputElement;
    expect(input.value).toBe(VIOLET);
    fireEvent.input(input, { target: { value: '#0a84ff' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(last(onValueChange)[0]).toBe('#0a84ff');
    expect(trigger.textContent).toBe('#0a84ff');

    const presets = within(dialog).getByRole('listbox', { name: 'Preset colors' });
    fireEvent.click(within(presets).getAllByRole('option')[1]);
    expect(last(onValueChange)[0]).toBe('#30d158');
    expect(last(onValueChange)[1].reason).toBe('item-press');
    expect(trigger.textContent).toBe('#30d158');
    expect(input.value).toBe('#30d158');
  });

  it('closes on Escape and gives focus back to the trigger', async () => {
    render(popover());
    const trigger = screen.getByRole('button');
    trigger.focus();
    const dialog = await open();
    fireEvent.keyDown(within(dialog).getByRole('textbox'), { key: 'Escape' });
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('adds an opacity slider with `alpha`, and takes another name', async () => {
    render(popover({}, { alpha: true, 'aria-label': 'Accent color' }));
    fireEvent.click(screen.getByRole('button'));
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Accent color' });
    expect(within(dialog).getByRole('slider', { name: 'Opacity' }).getAttribute('data-channel')).toBe('alpha');
  });

  it('renders your own parts in place of the default ones', async () => {
    render(
      <ColorPicker aria-label="Accent" defaultValue={VIOLET}>
        <Popover>
          <ColorPickerTrigger />
          <ColorPickerContent>
            <ColorPickerSlider channel="hue" />
          </ColorPickerContent>
        </Popover>
      </ColorPicker>,
    );
    const dialog = await open();
    expect(within(dialog).getAllByRole('slider')).toHaveLength(1);
    expect(within(dialog).queryByRole('textbox')).toBeNull();
  });
});

describe('ColorPickerSlider', () => {
  it('steps its channel with the arrow keys, and reports each step and its commit', () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    render(
      <ColorPicker aria-label="Accent" space="hsl" defaultValue="hsl(200 100% 50%)" onValueChange={onValueChange} onValueCommit={onValueCommit}>
        <ColorPickerSlider channel="hue" />
      </ColorPicker>,
    );
    const thumb = screen.getByRole('slider', { name: 'Hue' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('200');
    expect(thumb.getAttribute('aria-valuemax')).toBe('360');
    expect(thumb.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(last(onValueChange)[0]).toBe('hsl(201 100% 50%)');
    expect(last(onValueChange)[1].reason).toBe('step-key');
    expect(onValueCommit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(thumb, { key: 'ArrowLeft', shiftKey: true });
    expect(thumb.getAttribute('aria-valuenow')).toBe('191');
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('360');
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('0');
    fireEvent.keyDown(thumb, { key: 'PageUp' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('36');
  });

  it('names its thumb with `label`, focuses it from the label, and shows the value with `showValue`', async () => {
    render(
      <ColorPicker aria-label="Accent" defaultValue="hsl(200 100% 50%)">
        <ColorPickerSlider channel="hue" label="Teinte" showValue />
        <ColorPickerSlider channel="alpha" showValue />
      </ColorPicker>,
    );
    await settle();
    const hue = screen.getByRole('slider', { name: 'Teinte' });
    expect(screen.getByText('200°')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(screen.getByText('201°')).toBeTruthy();
    fireEvent.click(screen.getByText('Teinte'));
    expect(document.activeElement).toBe(hue);
    // The thumb keeps the channel's own name where there is no label.
    expect(screen.getByRole('slider', { name: 'Alpha' })).toBeTruthy();
  });

  it('fills its thumb with the color under it, opaque unless it edits the opacity', () => {
    render(
      <ColorPicker aria-label="Accent" space="hsl" defaultValue="hsl(200 100% 50% / 0.5)">
        <ColorPickerSlider channel="hue" />
        <ColorPickerSlider channel="alpha">
          <ColorPickerSliderThumb aria-label="Opacity" style={{ outlineWidth: 3 }} />
        </ColorPickerSlider>
      </ColorPicker>,
    );
    expect(screen.getByRole('slider', { name: 'Hue' }).style.getPropertyValue('--color-picker-color')).toBe('hsl(200 100% 50%)');
    const opacity = screen.getByRole('slider', { name: 'Opacity' });
    expect(opacity.style.getPropertyValue('--color-picker-color')).toBe('hsl(200 100% 50% / 0.5)');
    expect(opacity.style.outlineWidth).toBe('3px');
  });

  it('cannot be focused or stepped while the picker is disabled', () => {
    const onValueChange = vi.fn();
    render(
      <ColorPicker aria-label="Accent" defaultValue={VIOLET} disabled onValueChange={onValueChange}>
        <ColorPickerSlider channel="hue" />
      </ColorPicker>,
    );
    const thumb = screen.getByRole('slider');
    expect(thumb.getAttribute('tabindex')).toBe('-1');
    expect(thumb.getAttribute('aria-disabled')).toBe('true');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('ColorPickerArea', () => {
  it('moves across with Left and Right and up with Up and Down, as one slider for both channels', () => {
    const onValueChange = vi.fn();
    render(
      <ColorPicker aria-label="Accent" defaultValue="hsl(200 100% 50%)" onValueChange={onValueChange}>
        <ColorPickerArea />
      </ColorPicker>,
    );
    const thumb = screen.getByRole('slider', { name: 'Saturation and brightness' });
    expect(thumb.getAttribute('aria-valuetext')).toBe('Saturation 100%, Brightness 100%');
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(thumb.getAttribute('aria-valuetext')).toBe('Saturation 99%, Brightness 100%');
    fireEvent.keyDown(thumb, { key: 'ArrowDown' });
    expect(thumb.getAttribute('aria-valuetext')).toBe('Saturation 99%, Brightness 99%');
    expect(last(onValueChange)[1].reason).toBe('step-key');
    expect(thumb.style.getPropertyValue('--color-picker-color')).not.toBe('');
  });
});

describe('ColorPickerSwatches', () => {
  const presets = (props: ComponentProps<typeof ColorPicker> = {}) => (
    <ColorPicker aria-label="Accent" defaultValue="#30d158" {...props}>
      <ColorPickerSwatches aria-label="Presets">
        {['#ff453a', 'rgb(48 209 88)', '#0a84ff'].map((color) => <ColorPickerSwatchItem key={color} value={color} />)}
      </ColorPickerSwatches>
    </ColorPicker>
  );

  it('lists the presets as options, selects the one that looks like the color, and is one tab stop', async () => {
    render(presets());
    await settle();
    const options = within(screen.getByRole('listbox', { name: 'Presets' })).getAllByRole('option');
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(options.map((option) => option.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(options[0].getAttribute('aria-label')).toMatch(/red/);
  });

  it('moves between presets with the arrow keys and picks one with Enter', () => {
    const onValueChange = vi.fn();
    render(presets({ onValueChange }));
    const options = screen.getAllByRole('option');
    options[1].focus();
    fireEvent.keyDown(options[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(options[2]);
    // Moving focus picks nothing.
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(options[2], { key: 'Home' });
    expect(document.activeElement).toBe(options[0]);
    fireEvent.click(options[0]);
    expect(onValueChange.mock.calls[0][0]).toBe('#ff453a');
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
  });
});

describe('ColorPickerEyeDropper', () => {
  it('is a named button, disabled and marked where the browser has no EyeDropper', async () => {
    render(
      <ColorPicker aria-label="Accent" defaultValue={VIOLET}>
        <ColorPickerEyeDropper />
      </ColorPicker>,
    );
    await settle();
    const button = screen.getByRole('button', { name: 'Pick a color from the screen' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('data-unsupported')).toBe(true);
  });
});

const field = (props: ComponentProps<typeof ColorInput> = {}, fieldProps: ComponentProps<typeof Field> = {}) => (
  <Field {...fieldProps}>
    <FieldLabel>Accent</FieldLabel>
    <ColorInput defaultValue={VIOLET} {...props} />
    <FieldDescription>Any CSS color.</FieldDescription>
    <FieldError>Pick a darker color.</FieldError>
  </Field>
);

const typeText = (input: HTMLElement, text: string) => fireEvent.input(input, { target: { value: text } });

describe('ColorInput', () => {
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
    typeText(input, 'rebeccapurple');
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
    typeText(input, 'hsl(135 70% 50%)');
    fireEvent.focusOut(input);
    expect(last(onValueChange)[0]).toBe('#26d953');
    expect(input.value).toBe('#26d953');
  });

  it('puts the value back when the text is not a color, and on Escape', () => {
    const onValueChange = vi.fn();
    render(field({ onValueChange }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    typeText(input, 'purple-ish');
    fireEvent.focusOut(input);
    expect(input.value).toBe(VIOLET);
    typeText(input, '');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe(VIOLET);
    typeText(input, 'red');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe(VIOLET);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps its value when the change is canceled, and follows a controlled one', () => {
    const { rerender } = render(<ColorInput aria-label="Accent" value={VIOLET} onValueChange={(_, details) => details.cancel()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    typeText(input, 'red');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe(VIOLET);
    rerender(<ColorInput aria-label="Accent" value="#0a84ff" />);
    expect(input.value).toBe('#0a84ff');
  });

  it('writes the value in the `format` asked for', () => {
    const onValueChange = vi.fn();
    render(<ColorInput aria-label="Accent" space="oklch" defaultValue="oklch(0.7 0.1 250)" onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    typeText(input, 'red');
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
    render(<ColorInput aria-label="Accent" defaultValue={VIOLET} disabled />);
    expect(screen.getByRole('group').hasAttribute('data-disabled')).toBe(true);
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('keeps a read-only field focusable and unchanged', () => {
    const onValueChange = vi.fn();
    render(<ColorInput aria-label="Accent" defaultValue={VIOLET} readOnly onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    typeText(input, 'red');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe(VIOLET);
  });

  it('submits its value under `name`', () => {
    render(
      <form aria-label="Theme">
        <ColorInput aria-label="Accent" name="accent" defaultValue={VIOLET} />
      </form>,
    );
    expect(new FormData(screen.getByRole<HTMLFormElement>('form')).get('accent')).toBe(VIOLET);
  });

  it('takes its own parts: a smaller swatch and a named text box', () => {
    render(
      <ColorInput aria-label="Accent" size="sm" defaultValue={VIOLET}>
        <ColorPickerSwatch aria-label="Current accent" />
        <ColorPickerInput aria-label="Hex" placeholder="#RRGGBB" />
      </ColorInput>,
    );
    expect(screen.getByRole('img', { name: 'Current accent' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Hex' }).getAttribute('placeholder')).toBe('#RRGGBB');
  });
});

describe('ColorPickerChannelInput', () => {
  it('edits one channel as a number, named after it', () => {
    const onValueChange = vi.fn();
    render(
      <ColorInput aria-label="Accent" space="hsl" format="hsl" defaultValue="hsl(262 83% 66%)" onValueChange={onValueChange}>
        <ColorPickerChannelInput channel="hue" />
        <ColorPickerChannelInput channel="saturation" />
        <ColorPickerChannelInput channel="lightness" />
      </ColorInput>,
    );
    const hue = screen.getByRole('spinbutton', { name: 'Hue' }) as HTMLInputElement;
    expect(hue.value).toBe('262');
    // The unit follows the number, hidden from screen readers (the spin button says its own value).
    expect(hue.nextElementSibling?.textContent).toBe('°');
    expect(hue.nextElementSibling?.getAttribute('aria-hidden')).toBe('true');
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

describe('ColorPickerField', () => {
  it('edits the color of the ColorPicker around it', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <ColorPicker aria-label="Accent" defaultValue={VIOLET} onValueChange={onValueChange}>
        <ColorPickerField size="sm">
          <ColorPickerSwatch />
          <ColorPickerInput />
        </ColorPickerField>
      </ColorPicker>,
    );
    // One root: the group is a plain box inside the picker.
    expect(container.querySelectorAll('[data-slot=color-picker]')).toHaveLength(1);
    expect(container.querySelector('[data-slot=color-picker-field]')?.getAttribute('role')).toBeNull();
    const input = screen.getByRole('textbox', { name: 'Color' }) as HTMLInputElement;
    typeText(input, '#30d158');
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
