// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { checkPattern } from '@ui-sdk/core/testing';
import { Switch, SwitchThumb, createSwitchController } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RowLabelContext } from '@/lib/row-label';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('Switch', () => {
  it('is a switch that turns on and off, and says why', () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Wi-Fi" onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole('switch', { name: 'Wi-Fi' });
    expect(sw.getAttribute('data-slot')).toBe('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.hasAttribute('data-checked')).toBe(true);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'press' }));
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'press' }));
  });

  it('meets the APG switch pattern: Space turns it on and off, reported as a keyboard press', async () => {
    const onCheckedChange = vi.fn();
    const { container } = render(<div><Switch aria-label="Wi-Fi" onCheckedChange={onCheckedChange} /></div>);
    await checkPattern(container.firstElementChild as HTMLElement, 'switch');
    expect(onCheckedChange.mock.calls.map(([checked, details]) => [checked, details.reason, details.source])).toEqual([
      [true, 'press', 'keyboard'],
      [false, 'press', 'keyboard'],
    ]);
  });

  it('renders its thumb, which follows its state; children replace it', () => {
    const { container, unmount } = render(<Switch aria-label="Sounds" defaultChecked />);
    const thumb = container.querySelector('[data-slot="switch-thumb"]')!;
    expect(thumb.hasAttribute('data-checked')).toBe(true);
    expect(thumb.parentElement).toBe(screen.getByRole('switch'));
    unmount();
    render(<Switch aria-label="Sounds"><SwitchThumb data-testid="own" /></Switch>);
    expect(screen.getByRole('switch').querySelectorAll('[data-slot="switch-thumb"]')).toHaveLength(1);
    expect(screen.getByTestId('own')).toBeTruthy();
  });

  it('follows a controlled value, and keeps it when the change is cancelled', () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Sync" checked={false} onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole('switch');
    fireEvent.click(sw);
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    expect(sw.getAttribute('aria-checked')).toBe('false');
    cleanup();
    render(<Switch aria-label="Locked" onCheckedChange={(_, details) => details.cancel()} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('cannot be changed while disabled or read-only', () => {
    const onCheckedChange = vi.fn();
    render(<><Switch aria-label="Off" disabled onCheckedChange={onCheckedChange} /><Switch aria-label="Managed" readOnly defaultChecked onCheckedChange={onCheckedChange} /></>);
    const off = screen.getByRole('switch', { name: 'Off' }) as HTMLButtonElement;
    expect(off.disabled).toBe(true);
    expect(off.hasAttribute('data-disabled')).toBe(true);
    fireEvent.click(off);
    const managed = screen.getByRole('switch', { name: 'Managed' });
    expect(managed.getAttribute('aria-readonly')).toBe('true');
    fireEvent.click(managed);
    expect(managed.getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('is turned on from elsewhere through its controller', () => {
    const controller = createSwitchController();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Backups" controller={controller} onCheckedChange={onCheckedChange} />);
    act(() => { controller.setChecked(true); });
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'imperative' }));
  });

  it('is named and pressed by the Label around it', () => {
    render(<Label variant="control">Airplane mode<Switch /></Label>);
    const sw = screen.getByRole('switch', { name: 'Airplane mode' });
    fireEvent.click(screen.getByText('Airplane mode'));
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('is labelled by the row it sits in, unless it has a name of its own', () => {
    render(
      <RowLabelContext value="row-title">
        <span id="row-title">Dark Mode</span>
        <Switch data-testid="row" />
        <Switch data-testid="own" aria-label="Appearance" />
      </RowLabelContext>,
    );
    expect(screen.getByTestId('row').getAttribute('aria-labelledby')).toBe('row-title');
    expect(screen.getByRole('switch', { name: 'Dark Mode' })).toBe(screen.getByTestId('row'));
    expect(screen.getByTestId('own').hasAttribute('aria-labelledby')).toBe(false);
    expect(screen.getByRole('switch', { name: 'Appearance' })).toBe(screen.getByTestId('own'));
  });

  it('submits with a form while on', () => {
    render(<form data-testid="form"><Switch aria-label="Updates" name="updates" defaultChecked /></form>);
    expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('updates')).toBe('on');
  });

  it('takes a size, which its thumb reads from the track', () => {
    render(<Switch aria-label="Wi-Fi" size="sm" defaultChecked />);
    const track = screen.getByRole('switch', { name: 'Wi-Fi' });
    expect(track.getAttribute('data-size')).toBe('sm');
    expect(track.className).toContain('w-[38px]');
    expect(track.querySelector('[data-slot="switch-thumb"]')!.className).toContain('group-data-[size=sm]:w-[18px]');
    cleanup();
    render(<Switch aria-label="Wi-Fi" />);
    expect(screen.getByRole('switch').getAttribute('data-size')).toBe('default');
  });
});

