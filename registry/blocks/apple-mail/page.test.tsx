// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppleMail from './page';

MotionGlobalConfig.skipAnimations = true;

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
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

it('a sender’s name is a mailto link that previews the contact card', async () => {
  await act(async () => root.render(<AppleMail />));
  await settle();
  const links = [...element.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]')];
  expect(links.length).toBeGreaterThan(0);
  expect(links.every((a) => a.getAttribute('data-slot') === 'hover-card-trigger' && !a.hasAttribute('tabindex'))).toBe(true);
});

it('the compose fields are UI SDK Inputs that write the draft', async () => {
  await act(async () => root.render(<AppleMail defaultDraft={{ to: '', cc: '', subject: '', body: '' }} />));
  await settle();
  const subject = document.querySelector<HTMLInputElement>('input[aria-label="Subject"]')!;
  expect(subject.getAttribute('data-slot')).toBe('input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(subject, 'Hello');
    subject.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
  expect(subject.value).toBe('Hello');
  // The sheet's title follows the subject.
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Hello');
});
