// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppearanceProvider, BLProvider, ThemeScope, useScopeAppearance, useThemeScope, useThemeScopeProps } from '@/lib/theme';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

function Probe() {
  const scope = useThemeScope();
  const overlay = useThemeScopeProps();
  const workbench = useScopeAppearance('workbench');
  return (
    <output data-testid="probe" data-scope={scope?.scope} data-appearance={scope?.appearance} data-overlay={overlay['data-theme-scope']} data-overlay-class={overlay.className} data-workbench={workbench} />
  );
}
const probe = () => screen.getByTestId('probe');

describe('ThemeScope scope="workbench"', () => {
  it('is dark when nothing says otherwise, and marks its root', () => {
    const { container } = render(<ThemeScope scope="workbench"><Probe /></ThemeScope>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-slot')).toBe('theme-scope');
    expect(root.getAttribute('data-theme-scope')).toBe('workbench');
    expect(root.className).toContain('dark');
    expect(probe().dataset.appearance).toBe('dark');
  });

  it('follows the ambient appearance, and an explicit one wins', () => {
    render(
      <AppearanceProvider value="light">
        <ThemeScope scope="workbench"><Probe /></ThemeScope>
      </AppearanceProvider>,
    );
    expect(probe().dataset.appearance).toBe('light');
    cleanup();
    render(
      <AppearanceProvider value="light">
        <ThemeScope scope="workbench" appearance="dark"><Probe /></ThemeScope>
      </AppearanceProvider>,
    );
    expect(probe().dataset.appearance).toBe('dark');
  });

  it('a nested workbench scope inherits the enclosing one; other named scopes stay light by default', () => {
    render(
      <ThemeScope scope="workbench" appearance="light">
        <ThemeScope scope="workbench"><Probe /></ThemeScope>
      </ThemeScope>,
    );
    expect(probe().dataset.appearance).toBe('light');
    cleanup();
    render(<ThemeScope scope="sheet"><Probe /></ThemeScope>);
    expect(probe().dataset.appearance).toBe('light');
    expect(probe().dataset.workbench).toBe('dark');
  });

  it('publishes itself, so an overlay opened inside wears the scope, also inside a BLProvider', () => {
    render(
      <BLProvider>
        <ThemeScope scope="workbench" tint="#30d158"><Probe /></ThemeScope>
      </BLProvider>,
    );
    expect(probe().dataset.scope).toBe('workbench');
    expect(probe().dataset.overlay).toBe('workbench');
    expect(probe().dataset.overlayClass).toBe('dark scheme-dark');
  });

  it('takes a ref and any div prop', () => {
    let el: HTMLDivElement | null = null;
    render(<ThemeScope scope="workbench" ref={(node) => { el = node; }} id="ws" data-x="1" />);
    expect(el).not.toBeNull();
    expect(el!.id).toBe('ws');
    expect(el!.dataset.x).toBe('1');
  });
});
