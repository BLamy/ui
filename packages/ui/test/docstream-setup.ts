/* Test setup for docstream's and the editor's suites (src/docstream, src/docstream-editor), as their own packages ran
   them (2.0.1's vitest.setup.ts and test/setup.ts). UI SDK's development warnings fail the test that causes them, and
   happy-dom gets the browser APIs UI SDK's popups and panels call that it doesn't implement. The library's own tests set
   what they need file by file, so this applies only to a test file under those two folders. */
import { expect, vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined;
}

const part = /[\\/]src[\\/](docstream|docstream-editor)[\\/]/.exec(expect.getState().testPath ?? '')?.[1];

if (part) {
  globalThis.__UI_SDK_STRICT__ = true;
  // Some of their tests import a whole sub-system on first use (the editor's schema, the site): cold, inside the
  // library's run of some 350 files at once, that can take longer than Vitest's 5 s default.
  vi.setConfig({ testTimeout: 20_000 });
  if (typeof HTMLElement !== 'undefined') {
    // Without the Popover API UI SDK falls back to a portal on <body>, which the server renderer refuses.
    HTMLElement.prototype.showPopover = function () {};
    HTMLElement.prototype.hidePopover = function () {};
    Element.prototype.getAnimations = () => [];
    Element.prototype.scrollIntoView = function () {};
    Element.prototype.checkVisibility = () => true;
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (part === 'docstream-editor' && typeof document !== 'undefined') {
    document.elementFromPoint = () => null;
    document.elementsFromPoint = () => [];
    document.head.append(Object.assign(document.createElement('style'), { textContent: '[popover] { display: block !important }' }));
  }
}

export {};
