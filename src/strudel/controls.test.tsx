// @vitest-environment happy-dom
import { act, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { focus, mount, press } from "../__fixtures__/dom"
import { parseMini, type MiniAtom } from "./ast/mini"
import { Fader, Knob, type ControlProps, type ControlValueChangeDetails } from "./controls"
import { RackGrid, type GridLayout } from "./RackGrid"
import { StepGrid } from "./StepGrid"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const doubleClick = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })))

function Controlled({ as: Control, initial, seen, ...props }: Omit<ControlProps, "value" | "onChange"> & { as: typeof Knob; initial: number; seen: number[] }) {
  const [value, setValue] = useState(initial)
  return <Control {...props} value={value} onChange={(next) => { seen.push(next); setValue(next) }} />
}

describe("Knob", () => {
  it("is a slider named by its label, with the formatted value as its text", async () => {
    const view = await mount(<Knob label="Cutoff" value={1200} min={40} max={16000} log format={(v) => `${Math.round(v)} Hz`} onChange={() => {}} size="lg" />)
    const dial = view.host.querySelector<HTMLElement>('[role="slider"]')!
    expect(dial.getAttribute("aria-label")).toBe("Cutoff")
    expect(dial.getAttribute("aria-valuemin")).toBe("40")
    expect(dial.getAttribute("aria-valuemax")).toBe("16000")
    expect(dial.getAttribute("aria-valuenow")).toBe("1200")
    expect(dial.getAttribute("aria-valuetext")).toBe("1200 Hz")
    expect(dial.getAttribute("tabindex")).toBe("0")
    expect(dial.hasAttribute("aria-disabled")).toBe(false)
    expect(dial.className).toBe("strudel-knob__dial")
    const root = view.host.querySelector<HTMLElement>(".strudel-knob")!
    expect(root.getAttribute("data-slot")).toBe("knob")
    expect(root.getAttribute("data-size")).toBe("lg")
    expect(root.querySelector(".strudel-knob__value")!.textContent).toBe("1200 Hz")
    expect(root.querySelector(".strudel-knob__label")!.textContent).toBe("Cutoff")
    await view.unmount()
  })

  it("arrows, Page keys, Home and End turn it and report the new value; a double-click resets", async () => {
    const seen: number[] = []
    const view = await mount(<Controlled as={Knob} label="Reverb" initial={0.4} min={0} max={1} defaultValue={0.25} seen={seen} />)
    const dial = view.host.querySelector<HTMLElement>('[role="slider"]')!
    await focus(dial)
    await press("ArrowUp")
    await press("ArrowLeft")
    await press("PageUp")
    await press("ArrowDown", dial, { altKey: true })
    await press("End")
    await press("Home")
    expect(seen.map((v) => +v.toFixed(4))).toEqual([0.45, 0.4, 0.6, 0.59, 1, 0])
    expect(dial.getAttribute("aria-valuenow")).toBe("0")
    expect(document.activeElement).toBe(dial)
    await doubleClick(dial)
    expect(seen.at(-1)).toBe(0.25)
    expect(view.host.querySelector(".strudel-knob__value")!.textContent).toBe("0.25")
    await view.unmount()
  })

  it("a modulated knob says so, stays reachable and ignores the keys", async () => {
    const seen: number[] = []
    const view = await mount(<Controlled as={Knob} label="Cutoff" initial={1200} min={40} max={16000} log disabled display="∿" title="lpf is modulated" seen={seen} />)
    const dial = view.host.querySelector<HTMLElement>('[role="slider"]')!
    expect(dial.getAttribute("aria-disabled")).toBe("true")
    expect(dial.getAttribute("aria-valuetext")).toBe("∿")
    expect(dial.getAttribute("title")).toBe("lpf is modulated")
    expect(view.host.querySelector(".strudel-knob")!.hasAttribute("data-disabled")).toBe(true)
    await focus(dial)
    await press("ArrowUp")
    await press("End")
    expect(seen).toEqual([])
    expect(view.host.querySelectorAll(".strudel-knob__led[data-on]")).toHaveLength(0)
    await view.unmount()
  })

  it("renders on the server with its LEDs lit up to the value", () => {
    const html = renderToStaticMarkup(<Knob label="Pan" value={0.5} min={0} max={1} onChange={() => {}} />)
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-label="Pan"')
    // A bipolar knob at its centre lights only the middle LED.
    expect(html.match(/data-on="true"/g)).toHaveLength(1)
  })
})

describe("Fader", () => {
  it("is UI SDK's slider, standing up: a range input named by the label, with the formatted value", async () => {
    const view = await mount(<Fader label="Gain" value={0.75} min={0} max={1.5} format={(v) => `${Math.round(v * 100)}`} onChange={() => {}} />)
    const root = view.host.querySelector<HTMLElement>(".strudel-fader")!
    expect(root.getAttribute("data-slot")).toBe("slider")
    expect(root.getAttribute("data-orientation")).toBe("vertical")
    const input = root.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(input.getAttribute("aria-label")).toBe("Gain")
    expect(input.getAttribute("aria-orientation")).toBe("vertical")
    expect(input.getAttribute("aria-valuetext")).toBe("75")
    expect(root.querySelector(".strudel-fader__value")!.textContent).toBe("75")
    expect(root.querySelector('.strudel-fader__track[data-slot="slider-control"] .strudel-fader__cap[data-slot="slider-thumb"]')).not.toBeNull()
    expect(view.host.querySelector('[role="slider"]')).toBe(input)
    await view.unmount()
  })

  it("steps a hundredth of its travel per arrow, a tenth with Shift or Page keys, and maps it onto the range", async () => {
    const seen: number[] = []
    const view = await mount(<Controlled as={Fader} label="Gain" initial={0.75} min={0} max={1.5} seen={seen} />)
    const input = view.host.querySelector<HTMLInputElement>('input[type="range"]')!
    await focus(input)
    await press("ArrowUp")
    await press("ArrowDown", input, { shiftKey: true })
    await press("PageUp")
    await press("End")
    await press("Home")
    expect(seen.map((v) => +v.toFixed(4))).toEqual([0.765, 0.615, 0.765, 1.5, 0])
    expect(input.getAttribute("aria-valuetext")).toBe("0.00")
    await view.unmount()
  })

  it("a log fader moves evenly by ratio, and a double-click on the track resets it", async () => {
    const seen: number[] = []
    const view = await mount(<Controlled as={Fader} label="Cutoff" initial={20} min={20} max={20000} log defaultValue={1200} seen={seen} />)
    const input = view.host.querySelector<HTMLInputElement>('input[type="range"]')!
    await focus(input)
    for (let i = 0; i < 5; i++) await press("PageUp")
    expect(seen.at(-1)).toBeCloseTo(Math.sqrt(20 * 20000), 3)
    await doubleClick(view.host.querySelector(".strudel-fader__track")!)
    expect(seen.at(-1)).toBe(1200)
    await view.unmount()
  })

  it("disabled, it's a disabled range input that shows what stands in for its value", async () => {
    const seen: number[] = []
    const view = await mount(<Controlled as={Fader} label="Gain" initial={1} min={0} max={1.5} disabled display="∿" defaultValue={1} seen={seen} />)
    const input = view.host.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(input.disabled).toBe(true)
    expect(input.getAttribute("aria-valuetext")).toBe("∿")
    expect(view.host.querySelector(".strudel-fader")!.hasAttribute("data-disabled")).toBe(true)
    await doubleClick(view.host.querySelector(".strudel-fader__track")!)
    expect(seen).toEqual([])
    await view.unmount()
  })
})

describe("Knob and Fader change details", () => {
  function Reporting({ as: Control, log, legacy }: { as: typeof Knob; log: [number, ControlValueChangeDetails][]; legacy?: [number, ControlValueChangeDetails][] }) {
    const [value, setValue] = useState(0.4)
    return (
      <Control
        label="Level"
        value={value}
        min={0}
        max={1}
        defaultValue={0.25}
        onValueChange={(next, details) => { log.push([next, details]); setValue(next) }}
        {...(legacy ? { onChange: (next: number, details: ControlValueChangeDetails) => void legacy.push([next, details]) } : {})}
      />
    )
  }

  it.each([["Knob", Knob], ["Fader", Fader]] as const)("%s: onValueChange says why, with the event; the deprecated onChange gets the same", async (_name, Control) => {
    const log: [number, ControlValueChangeDetails][] = []
    const legacy: [number, ControlValueChangeDetails][] = []
    const view = await mount(<Reporting as={Control} log={log} legacy={legacy} />)
    const slider = view.host.querySelector<HTMLElement>('[role="slider"]')!
    await focus(slider)
    await press("ArrowUp")
    expect(log).toHaveLength(1)
    expect(log[0]![1].reason).toBe("step-key")
    expect(log[0]![1].event).toBeInstanceOf(KeyboardEvent)
    expect((log[0]![1].event as KeyboardEvent).key).toBe("ArrowUp")
    await doubleClick(Control === Knob ? slider : view.host.querySelector(".strudel-fader__track")!)
    expect(log.at(-1)![0]).toBe(0.25)
    expect(log.at(-1)![1].reason).toBe("reset-press")
    expect(log.at(-1)![1].event?.type).toBe("dblclick")
    expect(legacy).toEqual(log)
    await view.unmount()
  })
})

describe("StepGrid", () => {
  const cells = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>("button.strudel-step__cell")]

  function Steps({ source, seen }: { source: string; seen: [string, string][] }) {
    const [mini] = useState(() => parseMini(source))
    return <StepGrid mini={mini} label="Drum steps" onAtomChange={(atom: MiniAtom, text) => seen.push([atom.value, text])} />
  }

  it("draws every step, nested ones too, as a pressed-state button in one named group with one tab stop", async () => {
    const view = await mount(<Steps source="bd ~ [sd hh] <cp rim>" seen={[]} />)
    const group = view.host.querySelector<HTMLElement>(".strudel-steps")!
    expect(group.getAttribute("role")).toBe("group")
    expect(group.getAttribute("aria-label")).toBe("Drum steps")
    expect(cells(view.host).map((c) => [c.getAttribute("aria-label"), c.getAttribute("aria-pressed")])).toEqual([
      ["bd", "true"], ["Rest", "false"], ["sd", "true"], ["hh", "true"], ["cp", "true"], ["rim", "true"],
    ])
    expect(cells(view.host).map((c) => c.tabIndex)).toEqual([0, -1, -1, -1, -1, -1])
    expect(cells(view.host)[1]!.hasAttribute("data-rest")).toBe(true)
    expect(view.host.querySelector("input")).toBeNull()
    await view.unmount()
  })

  it("arrows walk the steps across the nesting; Space rests a step and fills a rest with the row's sound", async () => {
    const seen: [string, string][] = []
    const view = await mount(<Steps source="bd ~ [sd hh] bd" seen={seen} />)
    await focus(cells(view.host)[0])
    await press(" ")
    await press("ArrowRight")
    expect(document.activeElement).toBe(cells(view.host)[1])
    await press("Enter")
    await press("ArrowRight")
    await press("ArrowRight")
    expect(document.activeElement).toBe(cells(view.host)[3])
    await press("End")
    expect(document.activeElement).toBe(cells(view.host)[4])
    await press("Home")
    expect(document.activeElement).toBe(cells(view.host)[0])
    expect(seen).toEqual([["bd", "~"], ["~", "bd"]])
    await view.unmount()
  })

  it("F2 swaps a step for its editor: Enter commits a valid value and focus returns to the step", async () => {
    const seen: [string, string][] = []
    const view = await mount(<Steps source="bd sd" seen={seen} />)
    await focus(cells(view.host)[1])
    await press("F2")
    const editor = view.host.querySelector<HTMLInputElement>("input.strudel-step__input")!
    expect(editor.getAttribute("aria-label")).toBe("Step value")
    expect(editor.value).toBe("sd")
    expect(document.activeElement).toBe(editor)
    expect(cells(view.host)).toHaveLength(1)
    editor.value = "cp:2"
    await press("Enter", editor)
    expect(seen).toEqual([])
    await focus(cells(view.host)[1])
    await press("F2")
    const again = view.host.querySelector<HTMLInputElement>("input.strudel-step__input")!
    again.value = " cp "
    await press("Enter", again)
    expect(seen).toEqual([["sd", "cp"]])
    expect(view.host.querySelector("input")).toBeNull()
    expect(document.activeElement).toBe(cells(view.host)[1])
    await press("F2")
    await press("Escape", view.host.querySelector("input"))
    expect(seen).toHaveLength(1)
    expect(document.activeElement).toBe(cells(view.host)[1])
    await view.unmount()
  })
})

describe("RackGrid", () => {
  function Grid({ seen }: { seen: GridLayout[] }) {
    const [layout, setLayout] = useState<GridLayout>({ order: ["drums"], sizes: {} })
    return (
      <RackGrid
        items={[
          { key: "master", label: "Master", span: 12, node: <div>Master</div> },
          { key: "drums", label: "Drums", node: <div>Drums</div> },
          { key: "bass", label: "Bass", node: <div>Bass</div> },
        ]}
        layout={layout}
        onLayoutChange={(next) => { seen.push(next); setLayout(next) }}
      />
    )
  }
  const order = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>(".strudel-grid__item")].map((el) => el.dataset.gridKey)
  const grip = (host: HTMLElement, name: string) => host.querySelector<HTMLElement>(`button[aria-label="Move ${name}"]`)!
  const corner = (host: HTMLElement, name: string) => host.querySelector<HTMLElement>(`button[aria-label="Resize ${name}"]`)!

  it("lists its modules in layout order (new ones last), each with a move and a resize button", async () => {
    const view = await mount(<Grid seen={[]} />)
    const grid = view.host.querySelector<HTMLElement>(".strudel-grid")!
    expect(grid.getAttribute("role")).toBe("list")
    expect(grid.getAttribute("aria-label")).toBe("Modules")
    expect(order(view.host)).toEqual(["drums", "master", "bass"])
    expect(view.host.querySelectorAll('[role="listitem"]')).toHaveLength(3)
    expect(grip(view.host, "Drums").getAttribute("aria-pressed")).toBe("false")
    expect(corner(view.host, "Bass").tagName).toBe("BUTTON")
    await view.unmount()
  })

  it("Space on a grip picks its module up, arrows move it, Space drops it and the layout changes once", async () => {
    const seen: GridLayout[] = []
    const view = await mount(<Grid seen={seen} />)
    await focus(grip(view.host, "Drums"))
    await press(" ")
    expect(grip(view.host, "Drums").getAttribute("aria-pressed")).toBe("true")
    await press("ArrowRight")
    expect(order(view.host)).toEqual(["master", "drums", "bass"])
    expect(seen).toEqual([])
    await press("End")
    await press(" ")
    expect(seen).toEqual([{ order: ["master", "bass", "drums"], sizes: {} }])
    expect(order(view.host)).toEqual(["master", "bass", "drums"])
    expect(grip(view.host, "Drums").getAttribute("aria-pressed")).toBe("false")
    await press("Enter")
    await press("Home")
    await press("Escape")
    expect(order(view.host)).toEqual(["master", "bass", "drums"])
    expect(seen).toHaveLength(1)
    await view.unmount()
  })

  it("arrows on a corner resize its module, starting from the module's own span", async () => {
    const seen: GridLayout[] = []
    const view = await mount(<Grid seen={seen} />)
    await focus(corner(view.host, "Master"))
    await press("ArrowLeft")
    await press("ArrowDown")
    const columns = Number(view.host.querySelector<HTMLElement>(".strudel-grid")!.style.gridTemplateColumns.match(/repeat\((\d+)/)![1])
    expect(seen.at(-1)).toEqual({ order: ["drums", "master", "bass"], sizes: { master: { w: 12 - 12 / columns, h: 144 } } })
    expect(document.activeElement).toBe(corner(view.host, "Master"))
    await view.unmount()
  })
})
