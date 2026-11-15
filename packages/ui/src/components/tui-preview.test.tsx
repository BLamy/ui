// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { TuiPreview, type TuiAppearance } from '@/components/ui/tui-preview';
import { ThemeScope, type Appearance } from '@/lib/theme';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const CODE = 'import { createCliRenderer } from "@opentui/core"\nawait createCliRenderer()';
const root = () => document.querySelector<HTMLElement>('[data-slot=tui-preview]')!;

function Scoped({ scope, appearance }: { scope: Appearance; appearance?: TuiAppearance }) {
  return <ThemeScope appearance={scope}><TuiPreview code={CODE} title="Counter" appearance={appearance} /></ThemeScope>;
}

describe('TuiPreview', () => {
  it('follows the kit ThemeScope by default, and follows it when it changes', async () => {
    const view = render(<Scoped scope="dark" />);
    await waitFor(() => expect(root().dataset.appearance).toBe('dark'));
    view.rerender(<Scoped scope="light" />);
    await waitFor(() => expect(root().dataset.appearance).toBe('light'));
  });

  it('takes a forced appearance over the scope', async () => {
    render(<Scoped scope="light" appearance="dark" />);
    await waitFor(() => expect(root().dataset.appearance).toBe('dark'));
  });

  it('is idle with a named Run button, and Run waits while the reply is streaming', () => {
    const onStateChange = vi.fn();
    const view = render(<TuiPreview code={CODE} title="Counter" streaming onStateChange={onStateChange} />);
    const run = view.getByRole('button', { name: /run/i });
    expect(root().dataset.tuiState).toBe('idle');
    expect(root().getAttribute('aria-label')).toBe('Counter');
    expect(run.hasAttribute('disabled') || run.getAttribute('aria-disabled') === 'true').toBe(true);
    view.rerender(<TuiPreview code={CODE} title="Counter" onStateChange={onStateChange} />);
    expect(view.getByRole('button', { name: /run/i }).hasAttribute('disabled')).toBe(false);
    expect(onStateChange).not.toHaveBeenCalledWith('starting');
  });
});
