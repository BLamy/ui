// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note } from './data';
import { RenameField } from './item-menu';
import { FilterMenu, NoteMenu } from './parts';
import type { NotesState } from './use-notes';

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

const note = { id: 'n1', title: 'a', body: '# a', file: { name: 'a.md', path: 'notes/a.md' } } as unknown as Note;

function Harness({ rename }: { rename: (id: string, name: string) => void }) {
  const [renaming, setRenaming] = useState<NotesState['renaming']>(null);
  const notes = {
    notes: [note], folders: [], drafts: {}, renaming, setRenaming, setCreating: () => undefined,
    files: { busy: false, run: (f: () => unknown) => f() },
    rename: async (id: string, name: string) => rename(id, name),
  } as unknown as NotesState;
  return <>
    <NoteMenu notes={notes} n={note} />
    {renaming ? <RenameField notes={notes} id={note.id} name={note.file.name} /> : <span>{note.file.name}</span>}
  </>;
}

it('Rename… from the note menu hands focus to the name field, which keeps the rename open until you leave it', async () => {
  const rename = vi.fn();
  await act(async () => root.render(<Harness rename={rename} />));
  const trigger = element.querySelector<HTMLElement>('button[aria-label="More"]')!;
  trigger.focus();
  await act(async () => trigger.click());
  await settle();
  // The menu is named by its trigger, not a dead aria-label.
  const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
  expect(menu.hasAttribute('aria-label')).toBe(false);
  expect(document.getElementById(menu.getAttribute('aria-labelledby')!)).toBe(trigger);

  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) => el.textContent?.includes('Rename'))!;
  await act(async () => item.click());
  await settle();

  const field = element.querySelector<HTMLInputElement>('[data-rename-field="n1"]')!;
  expect(field).toBeTruthy();
  expect(document.activeElement).toBe(field);
  // The stem is selected, so typing keeps the extension.
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, 1]);
  expect(rename).not.toHaveBeenCalled();

  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(field, 'b.md');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
  expect(rename).toHaveBeenCalledWith('n1', 'b.md');
  expect(element.querySelector('[data-rename-field]')).toBeNull();
});

it('another action from the same menu returns focus to its trigger', async () => {
  await act(async () => root.render(<Harness rename={vi.fn()} />));
  const trigger = element.querySelector<HTMLElement>('button[aria-label="More"]')!;
  trigger.focus();
  await act(async () => trigger.click());
  await settle();
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) => el.textContent?.includes('Copy Path'))!;
  await act(async () => item.click());
  await settle();
  expect(document.activeElement).toBe(trigger);
});

it('the filter menu is named by its trigger and its choices by a group label', async () => {
  const onChange = vi.fn();
  await act(async () => root.render(<FilterMenu filter="markdown" onChange={onChange} />));
  const trigger = element.querySelector<HTMLElement>('button[aria-label="Filter files"]')!;
  await act(async () => trigger.click());
  await settle();
  const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
  expect(document.getElementById(menu.getAttribute('aria-labelledby')!)).toBe(trigger);
  const group = menu.querySelector<HTMLElement>('[role="group"]')!;
  expect(document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent).toBe('Show');
  const all = [...menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((el) => el.textContent?.includes('All Files'))!;
  await act(async () => all.click());
  expect(onChange).toHaveBeenCalledWith('all');
});
