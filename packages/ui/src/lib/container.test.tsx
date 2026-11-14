// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import { SizeClassProvider, usePresentation, useSizeClass, useSizeClassScope, type SizeClass } from '@/lib/container';
import { BLProvider } from '@/lib/theme';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Credenza, CredenzaContent, CredenzaTitle } from '@/components/ui/credenza';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

/* happy-dom rejects a cancelled animation's `finished` promise whether or not anyone reads it; a browser doesn't. */
const animate = Element.prototype.animate;
Element.prototype.animate = function (...args: Parameters<typeof animate>) {
  const animation = animate.apply(this, args);
  animation.finished.catch(() => undefined);
  return animation;
};

/* happy-dom has no layout: BLProvider's root reports `width`, everything else nothing. */
let width = 0;
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.slot === 'bl-provider' ? width : 0;
    },
  });
});
afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  width = 0;
});

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const content = () => document.querySelector<HTMLElement>('[data-slot=dialog-content]');
const scoped = (value: SizeClass | undefined) => ({ children }: { children: ReactNode }) => (
  <SizeClassProvider value={value}>{children}</SizeClassProvider>
);

describe('usePresentation', () => {
  it('passes "auto" through with no size class around, so UI SDK\'s own rule decides', () => {
    expect(renderHook(() => usePresentation('auto', 'dialog')).result.current).toBe('auto');
  });
  it('is a sheet in a compact scope and the component\'s own presentation in a medium or regular one', () => {
    expect(renderHook(() => usePresentation('auto', 'popover'), { wrapper: scoped('compact') }).result.current).toBe('sheet');
    expect(renderHook(() => usePresentation('auto', 'popover'), { wrapper: scoped('medium') }).result.current).toBe('popover');
    expect(renderHook(() => usePresentation('auto', 'dialog'), { wrapper: scoped('regular') }).result.current).toBe('dialog');
  });
  it("leaves the author's choice alone", () => {
    expect(renderHook(() => usePresentation('dialog', 'dialog'), { wrapper: scoped('compact') }).result.current).toBe('dialog');
    expect(renderHook(() => usePresentation(undefined, 'dialog'), { wrapper: scoped('compact') }).result.current).toBeUndefined();
  });
  it('the nearest scope wins, and an unmeasured one passes the scope around it through', () => {
    const nested = ({ children }: { children: ReactNode }) => (
      <SizeClassProvider value="regular"><SizeClassProvider value="compact">{children}</SizeClassProvider></SizeClassProvider>
    );
    expect(renderHook(() => useSizeClassScope(), { wrapper: nested }).result.current).toBe('compact');
    const unmeasured = ({ children }: { children: ReactNode }) => (
      <SizeClassProvider value="medium"><SizeClassProvider value={undefined}>{children}</SizeClassProvider></SizeClassProvider>
    );
    expect(renderHook(() => useSizeClassScope(), { wrapper: unmeasured }).result.current).toBe('medium');
  });
});

describe('useSizeClass', () => {
  it("reads the nearest scope until (or without) measuring an element of its own", () => {
    expect(renderHook(() => useSizeClass()[1], { wrapper: scoped('compact') }).result.current).toBe('compact');
    expect(renderHook(() => useSizeClass()[1]).result.current).toBe('regular');
    expect(renderHook(() => useSizeClass({ initial: 'medium' })[1], { wrapper: scoped('compact') }).result.current).toBe('medium');
  });
});

describe('BLProvider as a layer host and a size-class scope', () => {
  it('renders data-layer-host in its markup, on the server too', () => {
    const html = renderToString(<BLProvider>app</BLProvider>);
    expect(html).toContain('data-layer-host=""');
    expect(html).not.toContain('data-size-class');
  });

  it('measures its own box, writes data-size-class and provides it to everything inside', () => {
    width = 390;
    let seen: SizeClass | undefined;
    const Probe = () => {
      seen = useSizeClassScope();
      return null;
    };
    const { container } = render(<BLProvider><Probe /></BLProvider>);
    expect(container.querySelector('[data-slot=bl-provider]')?.getAttribute('data-size-class')).toBe('compact');
    expect(seen).toBe('compact');
  });

  function RenameDialog({ open, inner }: { open: boolean; inner?: SizeClass }) {
    const dialog = (
      <Dialog open={open} presentation="auto">
        <DialogContent>
          <DialogTitle>Rename</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    return <BLProvider>{inner ? <SizeClassProvider value={inner}>{dialog}</SizeClassProvider> : dialog}</BLProvider>;
  }

  it('a Dialog with presentation="auto" opened by its owner is a sheet in a compact BLProvider, whatever the screen', async () => {
    width = 390;
    const { rerender } = render(<RenameDialog open={false} />);
    rerender(<RenameDialog open />);
    await settle();
    expect(content()?.getAttribute('data-presentation')).toBe('sheet');
    // Rendered into the provider's root, a layer host: it stays out of the top layer.
    expect(content()?.closest('[data-layer-host]')).not.toBeNull();
    expect(content()?.hasAttribute('popover')).toBe(false);
  });

  it('and a centered dialog in a regular one', async () => {
    width = 1280;
    const { rerender } = render(<RenameDialog open={false} />);
    rerender(<RenameDialog open />);
    await settle();
    expect(content()?.getAttribute('data-presentation')).toBe('dialog');
  });

  it('open from the first render, it already follows the provider', async () => {
    width = 390;
    render(<RenameDialog open />);
    await settle();
    expect(content()?.getAttribute('data-presentation')).toBe('sheet');
  });

  it('follows the scope it is rendered in, not where its content is portaled (a compact column in a wide app)', async () => {
    width = 1280;
    const { rerender } = render(<RenameDialog open={false} inner="compact" />);
    rerender(<RenameDialog open inner="compact" />);
    await settle();
    // The content lives in the regular provider's root; the column around the Dialog is compact.
    expect(content()?.parentElement?.closest('[data-size-class]')?.getAttribute('data-size-class')).toBe('regular');
    expect(content()?.getAttribute('data-presentation')).toBe('sheet');
  });
});

describe('Credenza with no trigger', () => {
  function Gate({ open, sizeClass }: { open: boolean; sizeClass?: SizeClass }) {
    return (
      <BLProvider>
        <SizeClassProvider value={sizeClass}>
          <Credenza open={open}>
            <CredenzaContent>
              <CredenzaTitle>Sign in</CredenzaTitle>
            </CredenzaContent>
          </Credenza>
        </SizeClassProvider>
      </BLProvider>
    );
  }

  it('opened by its owner in a compact host, it presents as a tray', async () => {
    width = 390;
    const { rerender } = render(<Gate open={false} />);
    rerender(<Gate open />);
    await settle();
    expect(content()?.getAttribute('data-presentation')).toBe('sheet');
  });

  it('in a compact column of a regular app it is a tray, and in a regular column a card', async () => {
    width = 1280;
    const { rerender } = render(<Gate open={false} sizeClass="compact" />);
    rerender(<Gate open sizeClass="compact" />);
    await settle();
    expect(content()?.getAttribute('data-presentation')).toBe('sheet');
    cleanup();
    const second = render(<Gate open={false} sizeClass="regular" />);
    second.rerender(<Gate open sizeClass="regular" />);
    await settle();
    expect(content()?.getAttribute('data-presentation')).toBe('dialog');
  });
});
