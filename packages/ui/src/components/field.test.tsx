// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import { Input, createInputController } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

// A field's parts register, and its control is wired, a tick after mounting.
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const type = (el: HTMLElement, text: string) => fireEvent.input(el, { target: { value: text } });
const slot = (name: string) => document.querySelector(`[data-slot=${name}]`) as HTMLElement;
const described = (el: HTMLElement) => (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent);

describe('Field', () => {
  it('names the control with its label, describes it, and gives it the field name', async () => {
    render(
      <Field name="email" className="mt-2">
        <FieldLabel variant="field">Email</FieldLabel>
        <Input type="email" />
        <FieldDescription>We never share it.</FieldDescription>
        <FieldError />
      </Field>,
    );
    await settle();
    const input = screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement;
    expect(input.name).toBe('email');
    expect(described(input)).toEqual(['We never share it.']);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(document.querySelector('[data-slot=field-error]')).toBeNull();
    // Ours first, the caller's last.
    const root = slot('field');
    expect(root.className).toContain('gap-1.5');
    expect(root.className).toContain('mt-2');
    // A press on the label reaches the control.
    expect(screen.getByText('Email').getAttribute('for')).toBe(input.id);
  });

  it('shows the browser\'s validation after a submit attempt, and clears it once the value is valid', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Form onSubmit={onSubmit}>
        <Field name="email">
          <FieldLabel>Email</FieldLabel>
          <Input type="email" required />
          <FieldError match="valueMissing">Enter your email address.</FieldError>
        </Field>
        <Button type="submit">Save</Button>
      </Form>,
    );
    await settle();
    const input = screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement;
    expect(slot('field').hasAttribute('data-required')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.hasAttribute('data-invalid')).toBe(true);
    expect(described(input)).toEqual(['Enter your email address.']);
    type(input, 'jane@example.com');
    await settle();
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(document.querySelector('[data-slot=field-error]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows an error your code decides at once, and drops it when `invalid` is cleared', async () => {
    function Taken() {
      const [error, setError] = useState('That address is already registered.');
      return (
        <Field name="email" invalid={error ? true : undefined}>
          <FieldLabel>Email</FieldLabel>
          <Input type="email" defaultValue="taken@example.com" onValueChange={() => setError('')} />
          <FieldError match>{error}</FieldError>
        </Field>
      );
    }
    render(<Taken />);
    await settle();
    const input = screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(described(input)).toEqual(['That address is already registered.']);
    type(input, 'free@example.com');
    await settle();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('a disabled field disables its control and marks every part', async () => {
    render(
      <Field disabled>
        <FieldLabel>Email</FieldLabel>
        <Input />
        <FieldDescription>Locked.</FieldDescription>
      </Field>,
    );
    await settle();
    expect((screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement).disabled).toBe(true);
    for (const name of ['field', 'field-label', 'input', 'field-description']) {
      expect(slot(name).hasAttribute('data-disabled'), name).toBe(true);
    }
  });
});

describe('FieldSet', () => {
  it('is a fieldset named by its legend and described by its own description', async () => {
    render(
      <FieldSet>
        <FieldLegend>Account</FieldLegend>
        <FieldGroup>
          <Field name="name">
            <FieldLabel>Full name</FieldLabel>
            <Input />
          </Field>
        </FieldGroup>
        <FieldDescription>You can change these later in Settings.</FieldDescription>
      </FieldSet>,
    );
    await settle();
    const set = screen.getByRole('group', { name: 'Account' });
    expect(set.tagName).toBe('FIELDSET');
    expect(described(set)).toEqual(['You can change these later in Settings.']);
    expect(screen.getByText('Account').tagName).toBe('LEGEND');
    // The set's description is not the field's.
    expect(screen.getByRole('textbox', { name: 'Full name' }).getAttribute('aria-describedby')).toBeNull();
  });

  it('disabled disables every control inside', async () => {
    render(
      <FieldSet disabled>
        <FieldLegend>Billing</FieldLegend>
        <Field name="street">
          <FieldLabel>Street</FieldLabel>
          <Input />
        </Field>
        <Field name="notes">
          <FieldLabel>Notes</FieldLabel>
          <Textarea />
        </Field>
      </FieldSet>,
    );
    await settle();
    expect((screen.getByRole('group', { name: 'Billing' }) as HTMLFieldSetElement).disabled).toBe(true);
    expect(slot('field').hasAttribute('data-disabled')).toBe(true);
  });
});

describe('Input', () => {
  it('reports typing with its reason, and a canceled change keeps the text', () => {
    const onValueChange = vi.fn((value: string, details: { cancel: () => void }) => { if (!/^\d*$/.test(value)) details.cancel(); });
    render(<Input aria-label="Code" size="sm" className="w-24" onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox', { name: 'Code' }) as HTMLInputElement;
    expect(input.className).toContain('h-8');
    expect(input.className).toContain('w-24');
    type(input, '12');
    expect(onValueChange).toHaveBeenLastCalledWith('12', expect.objectContaining({ reason: 'input-change' }));
    type(input, '12a');
    expect(input.value).toBe('12');
  });

  it('a controller writes and clears it from outside', () => {
    const controller = createInputController();
    const onValueChange = vi.fn();
    render(<Input aria-label="Message" controller={controller} onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox', { name: 'Message' }) as HTMLInputElement;
    act(() => { controller.setValue('On my way!'); });
    expect(input.value).toBe('On my way!');
    expect(onValueChange).toHaveBeenLastCalledWith('On my way!', expect.objectContaining({ reason: 'imperative' }));
    act(() => { controller.clear(); });
    expect(input.value).toBe('');
  });

  it('marks its states for styling', () => {
    render(<Input aria-label="Name" defaultValue="Jane" disabled aria-invalid />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input.getAttribute('data-slot')).toBe('input');
    expect(input.hasAttribute('data-filled')).toBe(true);
    expect(input.hasAttribute('data-disabled')).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('Textarea', () => {
  it('reports typing, and its submit shortcut hands the text to onSubmit while Enter alone adds a line', () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn();
    render(<Textarea aria-label="Message" size="sm" submitShortcut="mod+enter" onSubmit={onSubmit} onValueChange={onValueChange} />);
    const area = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    expect(area.tagName).toBe('TEXTAREA');
    expect(area.className).toContain('min-h-16');
    type(area, 'On my way');
    expect(onValueChange).toHaveBeenLastCalledWith('On my way', expect.objectContaining({ reason: 'input-change' }));
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
    // ⌘ + Enter on Apple platforms, Ctrl + Enter elsewhere: exactly one of these is the shortcut.
    fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(area, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.lastCall?.[0]).toBe('On my way');
  });
});

describe('Form', () => {
  function Signup({ onSave }: { onSave: (data: Record<string, FormDataEntryValue>) => void }) {
    return (
      <Form aria-label="Sign up" className="gap-3" onSubmit={(event) => { event.preventDefault(); onSave(Object.fromEntries(new FormData(event.currentTarget))); }}>
        <Field name="name">
          <FieldLabel>Full name</FieldLabel>
          <Input defaultValue="Jane Appleseed" />
        </Field>
        <Field name="about">
          <FieldLabel>About you</FieldLabel>
          <Textarea />
        </Field>
        <Button type="submit">Create account</Button>
        <Button type="reset" variant="secondary">Reset</Button>
      </Form>
    );
  }

  it('is a native form that submits its fields under their names', async () => {
    const onSave = vi.fn();
    render(<Signup onSave={onSave} />);
    await settle();
    const form = screen.getByRole('form', { name: 'Sign up' });
    expect(form.tagName).toBe('FORM');
    expect(form.className).toContain('flex-col');
    expect(form.className).toContain('gap-3');
    type(screen.getByRole('textbox', { name: 'About you' }), 'Designer');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Jane Appleseed', about: 'Designer' });
  });

  it('an agent finds every field by its label and fills it', async () => {
    const onSave = vi.fn();
    render(<Signup onSave={onSave} />);
    await settle();
    const entries = agent.snapshot().filter((entry) => !entry.offPage);
    for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    const labels = entries.map((entry) => entry.label);
    for (const label of ['Full name', 'About you', 'Create account', 'Reset']) expect(labels, `${label} is missing from the snapshot`).toContain(label);
    const result = await act(() => agent.act({
      steps: [
        { ref: 'Full name', action: 'setValue', args: ['Ada Lovelace'] },
        { ref: 'About you', action: 'setValue', args: ['Engineer'] },
        { ref: 'Create account', action: 'press' },
      ],
    }));
    expect(result.ok, result.error?.message).toBe(true);
    expect(onSave).toHaveBeenCalledWith({ name: 'Ada Lovelace', about: 'Engineer' });
  });
});
