// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { SidebarDemo } from './sidebar-demo';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
});

const chip = (name: string) => [...document.querySelectorAll<HTMLElement>('button[aria-pressed]')].find((b) => b.textContent === name)!;
const pressed = () => [...document.querySelectorAll('[role=group][aria-label=Variant] [aria-pressed=true]')].map((b) => b.textContent);

it('picks one variant and one presentation at a time (ToggleGroups) and toggles the narrow container on its own', async () => {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => root!.render(<SidebarDemo />));
  expect(pressed()).toEqual(['docked']);
  await act(async () => chip('rail').click());
  expect(pressed()).toEqual(['rail']);
  // The current variant stays pressed when pressed again.
  await act(async () => chip('rail').click());
  expect(pressed()).toEqual(['rail']);
  expect(chip('narrow container').getAttribute('aria-pressed')).toBe('false');
  await act(async () => chip('narrow container').click());
  expect(chip('narrow container').getAttribute('aria-pressed')).toBe('true');
  expect(pressed()).toEqual(['rail']);
  // Presentation is a second, independent choice.
  const presentation = () => [...document.querySelectorAll('[role=group][aria-label=Presentation] [aria-pressed=true]')].map((b) => b.textContent);
  expect(presentation()).toEqual(['auto']);
  await act(async () => chip('drawer').click());
  expect(presentation()).toEqual(['drawer']);
  expect(pressed()).toEqual(['rail']);
});
