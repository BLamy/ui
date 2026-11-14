// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { checkPattern } from '@ui-sdk/core/testing';
import { Checkbox, CheckboxGroup, CheckboxIndicator, createCheckboxController } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const checkedNames = () => screen.getAllByRole('checkbox').filter((c) => c.getAttribute('aria-checked') === 'true').map((c) => c.getAttribute('aria-label'));

describe('Checkbox', () => {
  it('is a checkbox that checks and unchecks, and says why', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Remember me" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole('checkbox', { name: 'Remember me' });
    expect(box.getAttribute('data-slot')).toBe('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(box.hasAttribute('data-checked')).toBe(true);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'press' }));
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'press' }));
  });

  it('meets the APG checkbox pattern: Space checks and unchecks it, reported as a keyboard press', async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Remember me" onCheckedChange={onCheckedChange} />);
    // The box itself: checkPattern would also count the form's hidden input beside it (see the gaps note).
    await checkPattern(screen.getByRole('checkbox', { name: 'Remember me' }), 'checkbox');
    expect(onCheckedChange.mock.calls.map(([checked, details]) => [checked, details.reason, details.source])).toEqual([
      [true, 'press', 'keyboard'],
      [false, 'press', 'keyboard'],
    ]);
  });

  it('is mixed while indeterminate, and a press checks it', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="All" defaultChecked="indeterminate" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('mixed');
    expect(box.hasAttribute('data-indeterminate')).toBe(true);
    // The mark is the dash, not the tick.
    expect(box.querySelector('path')!.getAttribute('d')).toBe('M6 12h12');
    fireEvent.click(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(box.querySelector('path')!.getAttribute('d')).not.toBe('M6 12h12');
  });

  it('keeps its mark mounted so the tick can draw on and off; children replace it', () => {
    const { unmount } = render(<Checkbox aria-label="Terms" />);
    const indicator = screen.getByRole('checkbox').querySelector('[data-slot="checkbox-indicator"]')!;
    expect(indicator.hasAttribute('data-unchecked')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(indicator.isConnected).toBe(true);
    expect(indicator.hasAttribute('data-checked')).toBe(true);
    unmount();
    render(<Checkbox aria-label="Terms" defaultChecked><CheckboxIndicator>yes</CheckboxIndicator></Checkbox>);
    expect(screen.getByRole('checkbox').textContent).toBe('yes');
  });

  it('cannot be changed while disabled, and takes the square shape', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Locked" shape="square" disabled defaultChecked onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole('checkbox') as HTMLButtonElement;
    expect(box.disabled).toBe(true);
    expect(box.className).toContain('rounded-md');
    fireEvent.click(box);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  it('is checked from elsewhere through its controller', () => {
    const controller = createCheckboxController();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Sync" controller={controller} onCheckedChange={onCheckedChange} />);
    act(() => { controller.setChecked(true); });
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'imperative' }));
  });

  it('is named and pressed by the Label around it', () => {
    render(<Label variant="control"><Checkbox />Remember me</Label>);
    const box = screen.getByRole('checkbox', { name: 'Remember me' });
    fireEvent.click(screen.getByText('Remember me'));
    expect(box.getAttribute('aria-checked')).toBe('true');
  });

  it('submits its value with a form while checked', () => {
    render(<form data-testid="form"><Checkbox aria-label="Terms" name="terms" value="yes" defaultChecked /><Checkbox aria-label="News" name="news" /></form>);
    const data = new FormData(screen.getByTestId('form') as HTMLFormElement);
    expect(data.get('terms')).toBe('yes');
    expect(data.has('news')).toBe(false);
  });
});

describe('CheckboxGroup', () => {
  const Channels = (props: Partial<React.ComponentProps<typeof CheckboxGroup>>) => (
    <CheckboxGroup aria-label="Channels" {...props}>
      <Checkbox parent aria-label="All" />
      <Checkbox value="email" aria-label="Email" />
      <Checkbox value="push" aria-label="Push" />
      <Checkbox value="sms" aria-label="SMS" />
    </CheckboxGroup>
  );

  it('is a named group that keeps one list of checked values', () => {
    const onValueChange = vi.fn();
    render(<Channels defaultValue={['push']} onValueChange={onValueChange} />);
    expect(screen.getByRole('group', { name: 'Channels' }).getAttribute('data-slot')).toBe('checkbox-group');
    expect(checkedNames()).toEqual(['Push']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email' }));
    const [value, details] = onValueChange.mock.calls.at(-1)!;
    expect([...value].sort()).toEqual(['email', 'push']);
    expect(details.reason).toBe('item-press');
    expect(checkedNames()).toEqual(['Email', 'Push']);
  });

  it('has a parent checkbox that is mixed while some are checked, and checks or clears them all', () => {
    const onValueChange = vi.fn();
    render(<Channels allValues={['email', 'push', 'sms']} defaultValue={['push']} onValueChange={onValueChange} />);
    const all = screen.getByRole('checkbox', { name: 'All' });
    expect(all.getAttribute('aria-checked')).toBe('mixed');
    fireEvent.click(all);
    expect([...onValueChange.mock.calls.at(-1)![0]].sort()).toEqual(['email', 'push', 'sms']);
    expect(all.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(all);
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());
    expect(checkedNames()).toEqual([]);
  });

  it('follows a controlled value', () => {
    const onValueChange = vi.fn();
    render(<Channels value={['email']} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'SMS' }));
    expect([...onValueChange.mock.calls.at(-1)![0]].sort()).toEqual(['email', 'sms']);
    expect(checkedNames()).toEqual(['Email']);
  });

  it('is named by a Label that points at it', async () => {
    render(
      <CheckboxGroup id="notify">
        <Label htmlFor="notify" variant="field">Notify me about</Label>
        <Checkbox value="mentions" aria-label="Mentions" />
      </CheckboxGroup>,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByRole('group', { name: 'Notify me about' })).toBeTruthy();
  });
});
