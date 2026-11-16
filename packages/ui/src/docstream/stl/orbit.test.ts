// @vitest-environment happy-dom
import { checkServer, mount } from "@ui-sdk/core/testing"
import { describe, expect, it } from "vitest"
import { orbit, type OrbitView } from "./orbit"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const HOME: OrbitView = { yaw: -0.6, pitch: 0.45, zoom: 1 }
const MARKUP = `<root as="canvas" aria-label="Bracket: 3D model"></root>`

// `keys()` reads "+" as the joiner of a combination, so the zoom keys are sent as they are.
const key = (el: HTMLElement, name: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }))

describe("orbit primitive", () => {
  it("is a named, focusable application surface", async () => {
    const view = mount(orbit, { defaultView: HOME }, MARKUP)
    try {
      expect(view.root.tagName).toBe("CANVAS")
      expect(view.root.getAttribute("role")).toBe("application")
      expect(view.root.getAttribute("tabindex")).toBe("0")
      expect(view.root.getAttribute("aria-label")).toBe("Bracket: 3D model")
      await view.keys("Tab")
      expect(document.activeElement).toBe(view.root)
    } finally {
      view.unmount()
    }
  })

  it("arrows turn it, + and - zoom, 0 goes home, and every change says why", async () => {
    const seen: string[] = []
    const view = mount(orbit, { defaultView: HOME, onViewChange: (_view, details) => seen.push(details.reason) }, MARKUP)
    try {
      await view.keys("Tab", "ArrowLeft")
      expect(view.state.view.yaw).toBeCloseTo(-0.75)
      await view.keys("ArrowRight", "ArrowRight")
      expect(view.state.view.yaw).toBeCloseTo(-0.45)
      await view.keys("ArrowUp")
      expect(view.state.view.pitch).toBeCloseTo(0.3)
      await view.keys("ArrowDown", "ArrowDown")
      expect(view.state.view.pitch).toBeCloseTo(0.6)
      key(view.root, "+")
      expect(view.state.view.zoom).toBeCloseTo(1.2)
      key(view.root, "=")
      expect(view.state.view.zoom).toBeCloseTo(1.44)
      key(view.root, "-")
      expect(view.state.view.zoom).toBeCloseTo(1.2)
      key(view.root, "0")
      expect(view.state.view).toEqual(HOME)
      expect(new Set(seen)).toEqual(new Set(["step-key"]))
      expect(view.changes[0]).toMatchObject({ key: "view", reason: "step-key", source: "keyboard" })
      expect(seen).toHaveLength(10)
    } finally {
      view.unmount()
    }
  })

  it("keeps the pitch and the zoom within their limits, and leaves modified arrows to the page", async () => {
    const view = mount(orbit, { defaultView: HOME, maxPitch: 0.5, maxZoom: 1.3, minZoom: 0.9 }, MARKUP)
    try {
      await view.keys("Tab", "ArrowDown", "ArrowDown")
      expect(view.state.view.pitch).toBe(0.5)
      key(view.root, "+")
      key(view.root, "+")
      expect(view.state.view.zoom).toBe(1.3)
      for (let i = 0; i < 4; i++) key(view.root, "-")
      expect(view.state.view.zoom).toBe(0.9)
      const before = view.state.view
      await view.keys("Alt+ArrowLeft")
      expect(view.state.view).toBe(before)
    } finally {
      view.unmount()
    }
  })

  it("a drag turns it by the distance moved, and a double-click goes home", async () => {
    const reasons: string[] = []
    const view = mount(orbit, { defaultView: HOME, onViewChange: (_view, details) => reasons.push(details.reason) }, MARKUP)
    try {
      await view.drag(view.root, { by: { x: 50, y: -20 } })
      expect(view.state.view.yaw).toBeCloseTo(HOME.yaw + 0.5)
      expect(view.state.view.pitch).toBeCloseTo(HOME.pitch - 0.2)
      expect(view.state.dragging).toBe(false)
      expect(reasons.every((reason) => reason === "drag")).toBe(true)
      view.root.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
      expect(view.state.view).toEqual(HOME)
      expect(reasons.at(-1)).toBe("reset-press")
    } finally {
      view.unmount()
    }
  })

  it("zooms on a pinch or ⌘/Ctrl-scroll and lets a plain scroll through", () => {
    const view = mount(orbit, { defaultView: HOME }, MARKUP)
    try {
      const plain = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true })
      view.root.dispatchEvent(plain)
      expect(plain.defaultPrevented).toBe(false)
      expect(view.state.view.zoom).toBe(1)
      const pinch = new WheelEvent("wheel", { deltaY: -10, bubbles: true, cancelable: true })
      // happy-dom's WheelEvent drops the modifier keys of its init.
      Object.defineProperty(pinch, "ctrlKey", { value: true })
      view.root.dispatchEvent(pinch)
      expect(pinch.defaultPrevented).toBe(true)
      expect(view.state.view.zoom).toBeCloseTo(Math.exp(0.1))
      expect(view.changes.at(-1)).toMatchObject({ key: "view", reason: "wheel" })
    } finally {
      view.unmount()
    }
  })

  it("spins without reporting a change, and code can set and reset the view", () => {
    const seen: string[] = []
    const view = mount(orbit, { defaultView: HOME, onViewChange: (_view, details) => seen.push(details.reason) }, MARKUP)
    try {
      view.api.spin(0.1)
      expect(view.api.getView().yaw).toBeCloseTo(-0.5)
      expect(seen).toEqual([])
      view.api.setView({ zoom: 100 })
      expect(view.api.getView().zoom).toBe(8)
      view.api.reset()
      expect(view.api.getView()).toEqual(HOME)
      expect(seen).toEqual(["imperative", "imperative"])
    } finally {
      view.unmount()
    }
  })

  it("renders on the server", () => {
    const html = checkServer(orbit, { defaultView: HOME }, MARKUP)
    expect(html).toContain('role="application"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('data-slot="orbit"')
  })
})
