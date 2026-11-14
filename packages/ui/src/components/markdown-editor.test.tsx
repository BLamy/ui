// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@ui-sdk/react/field';
import {
  MarkdownEditor, looksLikeMarkdown, type MarkdownEditorHandle, type MarkdownEditorValueChangeDetails,
} from '@/components/ui/markdown-editor';
import { BLProvider } from '@/lib/theme';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const doc = () => document.querySelector<HTMLElement>('[data-slot=markdown-editor] [contenteditable]')!;
type Props = ComponentProps<typeof MarkdownEditor>;
async function mount(props: Props) {
  const ref = createRef<MarkdownEditorHandle>();
  const view = render(<MarkdownEditor ref={ref} {...props} />);
  await waitFor(() => expect(ref.current?.editor).toBeTruthy());
  await waitFor(() => expect(doc()).toBeTruthy());
  return { ...view, ref, update: (next: Props) => view.rerender(<MarkdownEditor ref={ref} {...next} />) };
}

describe('MarkdownEditor', () => {
  it('names the contenteditable and carries the field state onto it', async () => {
    await mount({ 'aria-label': 'Notes', 'aria-describedby': 'hint', placeholder: 'Write…', invalid: true, defaultValue: 'Hello' });
    await waitFor(() => expect(doc().getAttribute('aria-label')).toBe('Notes'));
    expect(doc().getAttribute('aria-describedby')).toBe('hint');
    expect(doc().getAttribute('aria-invalid')).toBe('true');
    expect(doc().getAttribute('aria-placeholder')).toBe('Write…');
    expect(doc().textContent).toContain('Hello');
    expect(document.querySelector('[data-slot=markdown-editor]')!.hasAttribute('data-invalid')).toBe(true);
  });

  it('uncontrolled: setMarkdown replaces the document, reports Markdown and submits it with the form', async () => {
    const onValueChange = vi.fn();
    const { ref, container } = await mount({ 'aria-label': 'Body', defaultValue: 'one', onValueChange, name: 'body' });
    act(() => ref.current!.setMarkdown('# Title\n\nSome **bold** text'));
    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    const [md, details] = onValueChange.mock.lastCall! as [string, MarkdownEditorValueChangeDetails];
    expect(details).toMatchObject({ reason: 'imperative', source: 'programmatic', canceled: false });
    expect(md).toMatch(/^# Title/);
    expect(md).toMatch(/\*\*bold\*\*/);
    expect(ref.current!.getMarkdown()).toBe(md);
    expect(doc().querySelector('h1')?.textContent).toBe('Title');
    expect(container.querySelector<HTMLInputElement>('input[type=hidden][name=body]')!.value).toBe(md);
  });

  it('an edit in the editor reports input-change with the event behind it', async () => {
    const onValueChange = vi.fn();
    const { ref } = await mount({ 'aria-label': 'Body', defaultValue: 'one', onValueChange });
    act(() => {
      fireEvent.keyDown(doc(), { key: '!' });
      ref.current!.editor!.commands.insertContent('!');
    });
    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    const [, details] = onValueChange.mock.lastCall! as [string, MarkdownEditorValueChangeDetails];
    expect(details.reason).toBe('input-change');
    expect(details.event?.type).toBe('keydown');
  });

  it('a canceled change puts the document back and keeps the value', async () => {
    const { ref, container } = await mount({
      'aria-label': 'Body', defaultValue: 'keep me', name: 'body',
      onValueChange: (_md, details) => details.cancel(),
    });
    act(() => ref.current!.setMarkdown('replaced'));
    await waitFor(() => expect(doc().textContent).toContain('keep me'));
    expect(doc().textContent).not.toContain('replaced');
    expect(ref.current!.getMarkdown()).toContain('keep me');
    expect(container.querySelector<HTMLInputElement>('input[type=hidden][name=body]')!.value).toContain('keep me');
  });

  it('joins a UI SDK Field: labelled, described, and taking its name, disabled and invalid state', async () => {
    const ref = createRef<MarkdownEditorHandle>();
    const { container } = render(
      <Field name="notes" invalid disabled>
        <FieldLabel>Notes</FieldLabel>
        <MarkdownEditor ref={ref} defaultValue="x" />
        <FieldDescription>Markdown is fine.</FieldDescription>
        <FieldError match>Too short.</FieldError>
      </Field>,
    );
    await waitFor(() => expect(doc()?.getAttribute('aria-labelledby')).toBeTruthy());
    const label = document.getElementById(doc().getAttribute('aria-labelledby')!);
    expect(label?.textContent).toBe('Notes');
    const described = doc().getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(expect.arrayContaining(['Markdown is fine.', 'Too short.']));
    expect(doc().getAttribute('aria-invalid')).toBe('true');
    expect(doc().getAttribute('aria-disabled')).toBe('true');
    expect(doc().getAttribute('contenteditable')).toBe('false');
    expect(container.querySelector<HTMLInputElement>('input[type=hidden]')!.name).toBe('notes');
  });

  it('controlled: shows the value it is given, and follows a new one', async () => {
    const { update } = await mount({ 'aria-label': 'Body', value: 'first', onValueChange: () => {} });
    expect(doc().textContent).toContain('first');
    update({ 'aria-label': 'Body', value: 'second', onValueChange: () => {} });
    await waitFor(() => expect(doc().textContent).toContain('second'));
  });

  it('read-only and disabled: not editable, said on the field, no toolbar', async () => {
    const { update } = await mount({ 'aria-label': 'Body', defaultValue: 'x', readOnly: true, toolbar: true });
    await waitFor(() => expect(doc().getAttribute('aria-readonly')).toBe('true'));
    expect(doc().getAttribute('contenteditable')).toBe('false');
    expect(document.querySelector('[data-slot=markdown-editor]')!.hasAttribute('data-toolbar')).toBe(false);
    update({ 'aria-label': 'Body', defaultValue: 'x', disabled: true });
    await waitFor(() => expect(doc().getAttribute('aria-disabled')).toBe('true'));
    expect(doc().getAttribute('contenteditable')).toBe('false');
    update({ 'aria-label': 'Body', defaultValue: 'x' });
    await waitFor(() => expect(doc().getAttribute('contenteditable')).toBe('true'));
    expect(doc().hasAttribute('aria-readonly')).toBe(false);
  });

  it('⌘/Ctrl+Enter submits the current Markdown', async () => {
    const onSubmit = vi.fn();
    const { ref } = await mount({ 'aria-label': 'Body', defaultValue: 'send me', onSubmit });
    act(() => ref.current!.focus());
    fireEvent.keyDown(doc(), { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledWith(expect.stringContaining('send me'));
  });

  it('puts the checkbox slot classes on the task checkbox (a UI SDK checkbox button)', async () => {
    await mount({ 'aria-label': 'Tasks', defaultValue: '- [ ] Open\n- [x] Done\n', classNames: { checkbox: 'tick' } });
    await waitFor(() => expect(document.querySelectorAll('.tick')).toHaveLength(2));
    const [open, done] = document.querySelectorAll<HTMLElement>('.tick');
    expect(open.getAttribute('role')).toBe('checkbox');
    expect(open.hasAttribute('data-checked')).toBe(false);
    expect(done.hasAttribute('data-checked')).toBe(true);
  });

  it('opens the slash menu in place: inside the editor, and so inside the BLProvider layer host', async () => {
    // The menu is UI SDK's Trigger Menu, which renders in place only where the browser has a top layer (a
    // browser without one gets a <body> portal): give happy-dom the Popover API so this runs the browser path.
    const proto = HTMLElement.prototype as Partial<Pick<HTMLElement, 'showPopover' | 'hidePopover'>>;
    proto.showPopover = () => {};
    proto.hidePopover = () => {};
    try {
      const ref = createRef<MarkdownEditorHandle>();
      render(<BLProvider><MarkdownEditor ref={ref} aria-label="Notes" /></BLProvider>);
      await waitFor(() => expect(ref.current?.editor).toBeTruthy());
      await waitFor(() => expect(doc()).toBeTruthy());
      const editor = ref.current!.editor!;
      // Typing in a focused editor opens the menu; a program's edit (or one before focus) does not.
      await act(async () => { editor.commands.focus(); });
      await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
      await act(async () => { editor.commands.insertContent('/'); });
      const menu = await waitFor(() => { const el = document.querySelector<HTMLElement>('.slash-menu'); expect(el).toBeTruthy(); return el!; });
      expect(menu.getAttribute('data-slot')).toBe('trigger-menu-content');
      expect(menu.closest('[data-slot=markdown-editor]')).toBeTruthy();
      expect(menu.closest('[data-layer-host]')).toBeTruthy();
      // Contained by the host, not in the top layer: no popover attribute to hide it, raised over the host's content.
      expect(menu.hasAttribute('popover')).toBe(false);
      expect(menu.style.zIndex).toBe('2147483000');
      // Options are the Trigger Menu's: div[role=option].slash-item, the first one highlighted.
      const options = menu.querySelectorAll<HTMLElement>('[role=option]');
      expect(options.length).toBeGreaterThan(0);
      expect([...options].every((o) => o.classList.contains('slash-item'))).toBe(true);
      expect(options[0]!.hasAttribute('data-highlighted')).toBe(true);
    } finally {
      delete proto.showPopover;
      delete proto.hidePopover;
    }
  });

  it('tells Markdown-looking paste from plain text', () => {
    expect(looksLikeMarkdown('# Heading\n\n- a\n- b')).toBe(true);
    expect(looksLikeMarkdown('just a sentence')).toBe(false);
  });
});
