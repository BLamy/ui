// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, Radio } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('Label', () => {
  it('is a native label in the kit’s variants', () => {
    render(<><Label htmlFor="email" variant="field" className="mb-1">Email</Label><input id="email" /></>);
    const label = screen.getByText('Email');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('data-slot')).toBe('label');
    expect(label.className).toContain('text-footnote');
    expect(label.className).toContain('mb-1');
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy();
  });

  it('names a control a plain label cannot reach, and a press moves focus into it', async () => {
    render(
      <>
        <Label htmlFor="speed">Shipping speed</Label>
        <RadioGroup id="speed" defaultValue="express">
          <Radio value="standard" aria-label="Standard" />
          <Radio value="express" aria-label="Express" />
        </RadioGroup>
      </>,
    );
    await tick();
    expect(screen.getByRole('radiogroup', { name: 'Shipping speed' })).toBeTruthy();
    fireEvent.click(screen.getByText('Shipping speed'));
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Express' }));
  });

  it('names a slider’s thumb and focuses it on a press', async () => {
    render(<><Label htmlFor="volume">Volume</Label><Slider id="volume" defaultValue={30} /></>);
    await tick();
    const thumb = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.click(screen.getByText('Volume'));
    expect(document.activeElement).toBe(thumb);
  });

  it('presses the control it points at or wraps', () => {
    render(
      <>
        <Label htmlFor="updates">Email me updates</Label>
        <Switch id="updates" />
        <Label variant="control"><Checkbox />Accept the terms</Label>
      </>,
    );
    fireEvent.click(screen.getByText('Email me updates'));
    expect(screen.getByRole('switch', { name: 'Email me updates' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByText('Accept the terms'));
    expect(screen.getByRole('checkbox', { name: 'Accept the terms' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Accept the terms').className).toContain('gap-3');
  });
});
