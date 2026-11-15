// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue, createSliderController,
} from '@/components/ui/slider';
import { RowLabelContext } from '@/lib/row-label';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('Slider', () => {
  it('renders its parts from its props: a named thumb on a track, in a control', () => {
    const { container } = render(<Slider aria-label="Volume" defaultValue={40} />);
    const thumb = screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement;
    expect(thumb.type).toBe('range');
    expect(thumb.value).toBe('40');
    const root = container.querySelector('[data-slot="slider"]')!;
    // One thumb is the control: the name is its, not the group's around it.
    expect(root.hasAttribute('aria-label')).toBe(false);
    expect(root.querySelector('[data-slot="slider-control"] [data-slot="slider-track"] [data-slot="slider-indicator"]')).toBeTruthy();
    expect(root.querySelector('[data-slot="slider-track"] [data-slot="slider-thumb"]')).toBeTruthy();
    expect(root.querySelector('[data-slot="slider-value"]')).toBeNull();
  });

  it('steps with the arrow keys and jumps with Home and End, saying why and committing on key up', () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    render(<Slider aria-label="Volume" defaultValue={40} step={5} onValueChange={onValueChange} onValueCommit={onValueCommit} />);
    const thumb = screen.getByRole('slider') as HTMLInputElement;
    thumb.focus();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenLastCalledWith(45, expect.objectContaining({ reason: 'step-key', thumb: 0 }));
    expect(onValueCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(thumb, { key: 'ArrowRight' });
    expect(onValueCommit).toHaveBeenLastCalledWith(45, expect.anything());
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(onValueChange).toHaveBeenLastCalledWith(40, expect.anything());
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onValueChange).toHaveBeenLastCalledWith(100, expect.anything());
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onValueChange).toHaveBeenLastCalledWith(0, expect.anything());
    expect(thumb.value).toBe('0');
  });

  it('keeps to min, max and step', () => {
    const onValueChange = vi.fn();
    render(<Slider aria-label="Text size" min={1} max={7} defaultValue={7} onValueChange={onValueChange} />);
    const thumb = screen.getByRole('slider') as HTMLInputElement;
    expect(thumb.min).toBe('1');
    expect(thumb.max).toBe('7');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(onValueChange).toHaveBeenLastCalledWith(6, expect.anything());
  });

  it('shows a label that names the thumb, and the formatted value', async () => {
    const { container } = render(<Slider label="Brightness" showValue defaultValue={0.64} min={0} max={1} step={0.01} format={{ style: 'percent' }} />);
    await tick();
    const thumb = screen.getByRole('slider', { name: 'Brightness' });
    expect(thumb.getAttribute('aria-valuetext')).toBe('64%');
    expect(container.querySelector('[data-slot="slider-value"]')!.textContent).toBe('64%');
    const label = screen.getByText('Brightness');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe(container.querySelector('[data-slot="slider"]')!.id);
  });

  it('is a named group of named thumbs for a range, which never cross', async () => {
    const onValueChange = vi.fn();
    render(<Slider label="Price" defaultValue={[20, 80]} onValueChange={onValueChange} />);
    await tick();
    expect(screen.getByRole('group', { name: 'Price' })).toBeTruthy();
    const low = screen.getByRole('slider', { name: 'Minimum' }) as HTMLInputElement;
    const high = screen.getByRole('slider', { name: 'Maximum' }) as HTMLInputElement;
    expect([low.value, high.value]).toEqual(['20', '80']);
    fireEvent.keyDown(high, { key: 'ArrowLeft' });
    expect(onValueChange).toHaveBeenLastCalledWith([20, 79], expect.objectContaining({ thumb: 1 }));
    fireEvent.keyDown(low, { key: 'End' });
    expect(onValueChange).toHaveBeenLastCalledWith([79, 79], expect.objectContaining({ thumb: 0 }));
    cleanup();
    render(<Slider aria-label="Hours" defaultValue={[9, 17]} thumbLabels={['Opens', 'Closes']} />);
    expect(screen.getByRole('group', { name: 'Hours' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Opens' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Closes' })).toBeTruthy();
  });

  it('cannot be focused or moved while disabled', () => {
    const onValueChange = vi.fn();
    const { container } = render(<Slider aria-label="Volume" defaultValue={30} disabled onValueChange={onValueChange} />);
    const thumb = screen.getByRole('slider') as HTMLInputElement;
    expect(thumb.disabled).toBe(true);
    expect(container.querySelector('[data-slot="slider"]')!.hasAttribute('data-disabled')).toBe(true);
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('follows a controlled value, and a controller sets it', () => {
    const controller = createSliderController();
    const onValueChange = vi.fn();
    render(<Slider aria-label="Volume" value={10} onValueChange={onValueChange} controller={controller} />);
    const thumb = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenLastCalledWith(11, expect.anything());
    expect(thumb.value).toBe('10');
    act(() => { controller.setValue(50); });
    expect(onValueChange).toHaveBeenLastCalledWith(50, expect.objectContaining({ reason: 'imperative' }));
  });

  it('names a thumb you place yourself, and takes its size and variant', () => {
    const { container } = render(
      <Slider aria-label="Time" size="sm" variant="overlay" appearance="dark" defaultValue={5} max={60}>
        <SliderValue />
        <SliderControl><SliderTrack><SliderIndicator /><SliderThumb /></SliderTrack></SliderControl>
      </Slider>,
    );
    expect(screen.getByRole('slider', { name: 'Time' })).toBeTruthy();
    const root = container.querySelector('[data-slot="slider"]')!;
    expect(root.getAttribute('data-size')).toBe('sm');
    expect(root.getAttribute('data-variant')).toBe('overlay');
    expect(root.className).toContain('[--bl-slider-fill:light-dark(--alpha(black/72%),--alpha(white/88%))]');
    // `appearance="dark"` puts the slider in the dark scheme, so `overlay` resolves to white.
    expect(root.getAttribute('data-appearance')).toBe('dark');
    expect(root.className.split(' ')).toEqual(expect.arrayContaining(['dark', 'scheme-dark']));
    expect(root.querySelector('[data-slot="slider-value"]')!.textContent).toBe('5');
  });

  it('is labelled by the row it sits in, unless it has a name of its own', () => {
    render(
      <RowLabelContext value="row-title">
        <span id="row-title">Text Size</span>
        <Slider defaultValue={3} max={7} />
      </RowLabelContext>,
    );
    expect(screen.getByRole('slider', { name: 'Text Size' })).toBeTruthy();
    cleanup();
    render(
      <RowLabelContext value="row-title">
        <span id="row-title">Text Size</span>
        <Slider aria-label="Zoom" defaultValue={3} max={7} />
      </RowLabelContext>,
    );
    expect(screen.getByRole('slider', { name: 'Zoom' }).hasAttribute('aria-labelledby')).toBe(false);
  });

  it('takes caller colors as variables in className, and submits with a form', () => {
    const { container } = render(<form data-testid="form"><Slider aria-label="Warmth" name="warmth" defaultValue={62} className="[--bl-slider-fill:orange]" /></form>);
    expect((container.querySelector('[data-slot="slider"]') as HTMLElement).className).toContain('[--bl-slider-fill:orange]');
    expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('warmth')).toBe('62');
  });

  it('follows the page scheme by default and stands up with orientation="vertical"', () => {
    const { container } = render(<Slider aria-label="Gain" orientation="vertical" defaultValue={40} />);
    const root = container.querySelector('[data-slot="slider"]')!;
    expect(root.hasAttribute('data-appearance')).toBe(false);
    expect(root.className.split(' ')).not.toContain('dark');
    expect(root.getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByRole('slider', { name: 'Gain' }).getAttribute('aria-orientation') ?? 'vertical').toBe('vertical');
    const track = container.querySelector('[data-slot="slider-track"]')!;
    expect(track.getAttribute('data-orientation')).toBe('vertical');
    expect(track.className).toContain('data-[orientation=vertical]:w-1');
  });
});
