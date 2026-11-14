/* Test setup for every file. UI SDK's development warnings fail the test that causes them, and the DOM
   environments (happy-dom) get the browser APIs its popups and panels call that they don't implement. */
declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

if (typeof HTMLElement !== "undefined") {
  // Without the Popover API UI SDK falls back to a portal on <body>, which the server renderer refuses.
  HTMLElement.prototype.showPopover = function () {}
  HTMLElement.prototype.hidePopover = function () {}
  Element.prototype.getAnimations = () => []
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.checkVisibility = () => true
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

export {}
