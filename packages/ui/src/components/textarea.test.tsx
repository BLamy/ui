// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInputController } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const area = () => screen.getByRole('textbox', { name: 'Notes' }) as HTMLTextAreaElement;

describe('Textarea', () => {
  it('is a named native textarea in the filled look, sized by its variant', () => {
    render(<Textarea aria-label="Notes" size="lg" />);
    expect(area().tagName).toBe('TEXTAREA');
    expect(area().getAttribute('data-slot')).toBe('textarea');
    expect(area().className).toContain('min-h-36');
    act(() => { area().focus(); });
    expect(document.activeElement).toBe(area());
  });

  it('reports typing with its reason, and Enter alone adds a line when there is no shortcut', () => {
    const onValueChange = vi.fn();
    const onSubmit = vi.fn();
    render(<Textarea aria-label="Notes" onValueChange={onValueChange} onSubmit={onSubmit} />);
    fireEvent.input(area(), { target: { value: 'line one' } });
    expect(onValueChange).toHaveBeenLastCalledWith('line one', expect.objectContaining({ reason: 'input-change' }));
    expect(fireEvent.keyDown(area(), { key: 'Enter' })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits on Enter with submitShortcut="enter", leaving Shift+Enter for a new line', () => {
    const onSubmit = vi.fn();
    render(<Textarea aria-label="Notes" defaultValue="Ship it" submitShortcut="enter" onSubmit={onSubmit} />);
    fireEvent.keyDown(area(), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(area(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.lastCall?.[0]).toBe('Ship it');
  });

  it('is written from outside through an input controller, and says so', () => {
    const controller = createInputController();
    const onValueChange = vi.fn();
    render(<Textarea aria-label="Notes" controller={controller} onValueChange={onValueChange} />);
    act(() => { controller.setValue('From the template'); });
    expect(area().value).toBe('From the template');
    expect(onValueChange).toHaveBeenLastCalledWith('From the template', expect.objectContaining({ reason: 'imperative' }));
    act(() => { controller.focus(); });
    expect(document.activeElement).toBe(area());
  });
});
