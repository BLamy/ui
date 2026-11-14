// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ToolButton, ToolToggle } from './toolbar';

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

function Bar({ onFit }: { onFit: () => void }) {
  const [arrows, setArrows] = useState(true);
  return <>
    <ToolToggle icon="arrow-up-right" label={arrows ? 'Hide arrows' : 'Show arrows'} pressed={arrows} onPressedChange={setArrows} />
    <ToolButton icon="magnifyingglass" label="Zoom to fit" onClick={onFit} />
  </>;
}

it('draws its layer switches as toggles (aria-pressed, data-pressed) and its actions as plain buttons', async () => {
  const onFit = vi.fn();
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => root!.render(<Bar onFit={onFit} />));
  const toggle = () => host!.querySelector<HTMLElement>('[aria-label$="arrows"]')!;
  expect(toggle().getAttribute('aria-pressed')).toBe('true');
  expect(toggle().hasAttribute('data-pressed')).toBe(true);
  await act(async () => toggle().click());
  expect(toggle().getAttribute('aria-label')).toBe('Show arrows');
  expect(toggle().getAttribute('aria-pressed')).toBe('false');
  expect(toggle().hasAttribute('data-pressed')).toBe(false);

  const fit = host!.querySelector<HTMLElement>('[aria-label="Zoom to fit"]')!;
  expect(fit.hasAttribute('aria-pressed')).toBe(false);
  await act(async () => fit.click());
  expect(onFit).toHaveBeenCalledTimes(1);
});
