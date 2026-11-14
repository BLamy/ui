// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Radio, RadioGroup, RadioIndicator, createRadioGroupController } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const checked = () => screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.getAttribute('value') ?? r.parentElement!.textContent);

function Billing(props: Partial<React.ComponentProps<typeof RadioGroup>>) {
  return (
    <RadioGroup aria-label="Billing" {...props}>
      <Label variant="control"><Radio value="monthly" />Monthly</Label>
      <Label variant="control"><Radio value="yearly" />Yearly</Label>
      <Label variant="control"><Radio value="lifetime" disabled />Lifetime</Label>
    </RadioGroup>
  );
}

describe('RadioGroup', () => {
  it('is a named radio group whose radios take their names from their labels', () => {
    render(<Billing defaultValue="monthly" />);
    const group = screen.getByRole('radiogroup', { name: 'Billing' });
    expect(group.getAttribute('data-slot')).toBe('radio-group');
    expect(screen.getByRole('radio', { name: 'Monthly' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Yearly' }).getAttribute('aria-checked')).toBe('false');
    expect(checked()).toEqual(['Monthly']);
  });

  it('has one tab stop: the checked radio, or the first when none is', () => {
    render(<Billing />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', null]);
    cleanup();
    render(<Billing defaultValue="yearly" />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', null]);
  });

  it('checks on press, from the radio or its label, and says why', () => {
    const onValueChange = vi.fn();
    render(<Billing defaultValue="monthly" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Yearly' }));
    expect(onValueChange).toHaveBeenLastCalledWith('yearly', expect.objectContaining({ reason: 'item-press' }));
    expect(checked()).toEqual(['Yearly']);
    fireEvent.click(screen.getByText('Monthly'));
    expect(checked()).toEqual(['Monthly']);
  });

  it('moves and checks with the arrow keys, skipping a disabled radio', () => {
    const onValueChange = vi.fn();
    render(<Billing defaultValue="monthly" onValueChange={onValueChange} />);
    const [monthly, yearly, lifetime] = screen.getAllByRole('radio');
    expect((lifetime as HTMLButtonElement).disabled).toBe(true);
    monthly.focus();
    fireEvent.keyDown(monthly, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(yearly);
    expect(onValueChange).toHaveBeenLastCalledWith('yearly', expect.objectContaining({ reason: 'list-navigation' }));
    fireEvent.keyDown(yearly, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(monthly);
    expect(checked()).toEqual(['Monthly']);
  });

  it('draws the dot only in the checked radio; children replace it', () => {
    const { unmount } = render(<Billing defaultValue="yearly" />);
    const [monthly, yearly] = screen.getAllByRole('radio');
    expect(monthly.querySelector('[data-slot="radio-indicator"]')).toBeNull();
    expect(yearly.querySelector('[data-slot="radio-indicator"]')).toBeTruthy();
    unmount();
    render(<RadioGroup aria-label="Size" defaultValue="m"><Radio value="m" aria-label="M"><RadioIndicator data-testid="own" /></Radio></RadioGroup>);
    expect(screen.getByRole('radio').querySelectorAll('[data-slot="radio-indicator"]')).toHaveLength(1);
    expect(screen.getByTestId('own')).toBeTruthy();
  });

  it('follows a controlled value, and a controller checks a radio', () => {
    const controller = createRadioGroupController();
    const onValueChange = vi.fn();
    render(<Billing value="monthly" onValueChange={onValueChange} controller={controller} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Yearly' }));
    expect(checked()).toEqual(['Monthly']);
    act(() => { controller.setValue('yearly'); });
    expect(onValueChange).toHaveBeenLastCalledWith('yearly', expect.objectContaining({ reason: 'imperative' }));
  });

  it('lays out in a column, or a row with orientation', () => {
    const { unmount } = render(<Billing />);
    expect(screen.getByRole('radiogroup').className).toContain('flex-col');
    unmount();
    render(<Billing orientation="horizontal" />);
    expect(screen.getByRole('radiogroup').className).toContain('flex-row');
  });

  it('is named by a Label that points at it, and submits its value', async () => {
    render(
      <form data-testid="form">
        <RadioGroup id="plan" name="plan" defaultValue="pro">
          <Label htmlFor="plan" variant="field">Plan</Label>
          <Radio value="free" aria-label="Free" />
          <Radio value="pro" aria-label="Pro" />
        </RadioGroup>
      </form>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByRole('radiogroup', { name: 'Plan' })).toBeTruthy();
    expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('plan')).toBe('pro');
  });
});
