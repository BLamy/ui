// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseColor, type Color } from 'react-aria-components';
import { ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch, ColorSwatch } from '@/components/ui/color-field';
import { ColorPicker, ColorPickerContent, ColorPickerTrigger, ColorSlider, ColorSwatchPicker, ColorSwatchPickerItem } from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { PopoverTrigger } from '@/components/ui/popover';

afterEach(cleanup);

const field = (props: Partial<React.ComponentProps<typeof ColorField>> = {}) => (
  <ColorField defaultValue="#7f5af0" {...props}>
    <Label variant="field">Accent</Label>
    <ColorFieldGroup>
      <ColorFieldSwatch />
      <ColorFieldInput />
    </ColorFieldGroup>
  </ColorField>
);

describe('ColorField', () => {
  it('shows the color as hex and a swatch of it, under its label', () => {
    const { container } = render(field());
    const input = screen.getByRole('textbox', { name: 'Accent' }) as HTMLInputElement;
    expect(input.value).toBe('#7F5AF0');
    expect(container.querySelector('[data-slot=color-field-swatch]')?.getAttribute('role')).toBe('img');
  });

  it('commits a typed color on blur, with or without the hash, and reports it', () => {
    const onChange = vi.fn();
    render(field({ onChange }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '30d158' } });
    fireEvent.blur(input);
    expect((onChange.mock.calls.at(-1)![0] as Color).toString('hex')).toBe('#30D158');
    expect(input.value).toBe('#30D158');
  });

  it('puts back the last good color when the text is not a color', () => {
    render(field());
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'purple-ish' } });
    fireEvent.blur(input);
    expect(input.value).toBe('#7F5AF0');
  });

  it('shows a clear swatch while the field is empty', () => {
    const { container } = render(field({ defaultValue: null }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
    expect(container.querySelector('[data-slot=color-field-swatch]')).toBeTruthy();
  });
});

describe('ColorSwatch', () => {
  it('names the color it shows', () => {
    render(<ColorSwatch color="#ff0000" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/red/i);
  });
});

describe('ColorPicker', () => {
  it('shows its color in the trigger, with the opacity once it is below 1', () => {
    const a = render(
      <ColorPicker defaultValue="#7f5af0">
        <PopoverTrigger><ColorPickerTrigger /><ColorPickerContent /></PopoverTrigger>
      </ColorPicker>,
    );
    expect(screen.getByRole('button').textContent).toBe('#7F5AF0');
    a.unmount();
    render(
      <ColorPicker defaultValue="hsla(262, 83%, 66%, 0.6)">
        <PopoverTrigger><ColorPickerTrigger /><ColorPickerContent /></PopoverTrigger>
      </ColorPicker>,
    );
    expect(screen.getByRole('button').textContent).toBe('#9560F099');
  });

  it('survives a value it cannot read', () => {
    render(
      <ColorPicker defaultValue={'not a color' as unknown as string}>
        <PopoverTrigger><ColorPickerTrigger /><ColorPickerContent /></PopoverTrigger>
      </ColorPicker>,
    );
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('opens a popover with the area, hue slider, hex field and presets, which edit the same color', () => {
    const onChange = vi.fn();
    render(
      <ColorPicker defaultValue="#7f5af0" onChange={onChange}>
        <PopoverTrigger>
          <ColorPickerTrigger />
          <ColorPickerContent swatches={['#ff453a', '#30d158']} />
        </PopoverTrigger>
      </ColorPicker>,
    );
    fireEvent.click(screen.getByRole('button'));
    const dialog = screen.getByRole('dialog', { name: 'Color picker' });
    expect(within(dialog).getByRole('group', { name: 'Hue' })).toBeTruthy();
    expect(within(dialog).queryByRole('group', { name: 'Opacity' })).toBeNull();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Hex color' }), { target: { value: '#0a84ff' } });
    fireEvent.blur(within(dialog).getByRole('textbox', { name: 'Hex color' }));
    expect(onChange).toHaveBeenCalled();
    expect(screen.getAllByRole('button')[0].textContent).toBe('#0A84FF');

    const presets = within(dialog).getByRole('listbox', { name: 'Preset colors' });
    fireEvent.click(within(presets).getAllByRole('option')[1]);
    expect(screen.getAllByRole('button')[0].textContent).toBe('#30D158');
  });

  it('adds an opacity slider with `alpha`', () => {
    render(
      <ColorPicker defaultValue="#7f5af0">
        <PopoverTrigger><ColorPickerTrigger /><ColorPickerContent alpha /></PopoverTrigger>
      </ColorPicker>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('group', { name: 'Opacity' })).toBeTruthy();
  });

  it('steps a slider channel with the arrow keys', () => {
    const onChange = vi.fn();
    render(
      <ColorPicker value={parseColor('hsb(200, 100%, 100%)')} onChange={onChange}>
        <ColorSlider colorSpace="hsb" channel="hue" label="Hue" showValue />
      </ColorPicker>,
    );
    const thumb = screen.getByRole('slider');
    expect(screen.getByText('200°')).toBeTruthy();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect((onChange.mock.calls.at(-1)![0] as Color).getChannelValue('hue')).toBe(201);
  });

  it('lists preset swatches as options and marks the one that is selected', () => {
    render(
      <ColorPicker defaultValue="#30d158">
        <ColorSwatchPicker aria-label="Presets">
          {['#ff453a', '#30d158'].map((c) => <ColorSwatchPickerItem key={c} color={c} />)}
        </ColorSwatchPicker>
      </ColorPicker>,
    );
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true']);
  });
});
