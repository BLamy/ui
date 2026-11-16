// @vitest-environment happy-dom
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input, createInputController, type InputValueCommitDetails } from '@/components/ui/input';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const box = (name = 'Email') => screen.getByRole('textbox', { name }) as HTMLInputElement;
const type = (el: HTMLInputElement, value: string) => fireEvent.input(el, { target: { value } });

describe('Input', () => {
  it('forwards ref to the native input, for selection and programmatic focus', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Email" defaultValue="hello world" />);
    expect(ref.current).toBe(box());
    act(() => { ref.current!.focus(); ref.current!.setSelectionRange(0, 5); });
    expect(document.activeElement).toBe(box());
    expect(box().selectionStart).toBe(0);
    expect(box().selectionEnd).toBe(5);
  });

  it('is a named native input in the iOS filled look, in the Tab order', () => {
    render(<Input aria-label="Email" size="sm" />);
    expect(box().tagName).toBe('INPUT');
    expect(box().getAttribute('data-slot')).toBe('input');
    expect(box().className).toContain('h-8');
    expect(box().tabIndex).toBe(0);
    act(() => { box().focus(); });
    expect(document.activeElement).toBe(box());
  });

  it('reports typing with its reason, and a canceled change keeps the old text', () => {
    const onValueChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState('a');
      return <Input aria-label="Email" value={value} onValueChange={(next, details) => {
        onValueChange(next, details);
        if (next.includes(' ')) details.cancel();
        else setValue(next);
      }} />;
    }
    render(<Controlled />);
    type(box(), 'ab');
    expect(box().value).toBe('ab');
    expect(onValueChange).toHaveBeenLastCalledWith('ab', expect.objectContaining({ reason: 'input-change' }));
    type(box(), 'ab c');
    expect(onValueChange).toHaveBeenLastCalledWith('ab c', expect.objectContaining({ reason: 'input-change', canceled: true }));
    expect(box().value).toBe('ab');
  });

  it('is written and cleared from outside through its controller, and says so', () => {
    const controller = createInputController();
    const onValueChange = vi.fn();
    render(<Input aria-label="Email" controller={controller} onValueChange={onValueChange} />);
    act(() => { controller.setValue('ada@example.com'); });
    expect(box().value).toBe('ada@example.com');
    expect(controller.getValue()).toBe('ada@example.com');
    expect(onValueChange).toHaveBeenLastCalledWith('ada@example.com', expect.objectContaining({ reason: 'imperative', source: 'programmatic' }));
    act(() => { controller.clear(); });
    expect(box().value).toBe('');
    act(() => { controller.focus(); });
    expect(document.activeElement).toBe(box());
  });

  it('is natively disabled, with UI SDK\'s data-disabled to style it', () => {
    render(<Input aria-label="Email" disabled defaultValue="x" />);
    expect(box().disabled).toBe(true);
    expect(box().hasAttribute('data-disabled')).toBe(true);
  });
});

describe('Input onValueCommit', () => {
  function Rename({ onCommit, refuse = false }: { onCommit: (v: string, d: InputValueCommitDetails) => void; refuse?: boolean }) {
    const [name, setName] = useState('idle');
    return <Input aria-label="Name" value={name} onValueCommit={(v, d) => { onCommit(v, d); if (!refuse) setName(v); }} />;
  }

  it('commits on Enter, not on each key, and says so', () => {
    const onCommit = vi.fn();
    render(<Rename onCommit={onCommit} />);
    const input = box('Name');
    type(input, 'waiting');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('waiting');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('waiting', expect.objectContaining({ reason: 'enter-key' }));
    expect(input.value).toBe('waiting');
  });

  it('commits on leaving, and puts back what the owner refuses', () => {
    const onCommit = vi.fn();
    render(<Rename onCommit={onCommit} refuse />);
    const input = box('Name');
    type(input, 'nope');
    act(() => { fireEvent.blur(input); });
    expect(onCommit).toHaveBeenCalledWith('nope', expect.objectContaining({ reason: 'blur' }));
    expect(input.value).toBe('idle');
  });

  it('doesn’t commit what didn’t change', () => {
    const onCommit = vi.fn();
    render(<Rename onCommit={onCommit} />);
    fireEvent.keyDown(box('Name'), { key: 'Enter' });
    act(() => { fireEvent.blur(box('Name')); });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('puts the text back on Escape, and keeps that Escape to itself', () => {
    const onCommit = vi.fn();
    const outside = vi.fn();
    render(<div onKeyDown={outside}><Rename onCommit={onCommit} /></div>);
    const input = box('Name');
    type(input, 'oops');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('idle');
    expect(outside).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    // With nothing to put back, Escape goes on (a panel can close).
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(outside).toHaveBeenCalledTimes(1);
  });

  it('follows a new value from outside, dropping the draft', () => {
    function Outside() {
      const [name, setName] = useState('idle');
      return (
        <>
          <button type="button" onClick={() => setName('closed')}>Reset</button>
          <Input aria-label="Name" value={name} onValueCommit={setName} />
        </>
      );
    }
    render(<Outside />);
    type(box('Name'), 'half typed');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(box('Name').value).toBe('closed');
  });

  it('is invalid with its Field, and its error describes it', () => {
    render(
      <Field invalid>
        <FieldLabel>Binding</FieldLabel>
        <Input value="x y" onValueCommit={() => {}} />
        <FieldError>“x y” can’t be a name on env.</FieldError>
      </Field>,
    );
    const input = box('Binding');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain('“x y” can’t be a name on env.');
  });
});
