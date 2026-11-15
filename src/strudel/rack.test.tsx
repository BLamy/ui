// @vitest-environment happy-dom
import { useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { click, focus, mount, press, tick } from "../__fixtures__/dom"
import { StrudelPlayer } from "./StrudelPlayer"
import { StrudelRack } from "./StrudelRack"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const SONG = `setcps(.5)
stack(
  s("bd*2 [~ bd] sd ~, hh*8").gain(.8),
  n("<0 3 4 3>").scale("G2:minor").s("sawtooth").lpf(sine.range(300, 900).slow(8)),
  note("c4 e4 g4").s('piano').room(.4)
).postgain(.9)`

function Rack({ log, playable }: { log: string[]; playable?: string[] }) {
  const [code, setCode] = useState(SONG)
  return <StrudelRack code={code} onChange={(next) => { log.push(next); setCode(next) }} onPlayableChange={(next) => playable?.push(next)} />
}

const device = (host: HTMLElement, name: string) => host.querySelector<HTMLElement>(`section.strudel-device[aria-label="${name}"]`)!
const named = (root: ParentNode, role: string, name: string) =>
  [...root.querySelectorAll<HTMLElement>(`[role="${role}"]`)].find((el) => {
    const labelled = el.getAttribute("aria-labelledby")
    return el.getAttribute("aria-label") === name || (labelled && document.getElementById(labelled)?.textContent === name)
  })

const option = (host: HTMLElement, text: string) =>
  [...host.querySelectorAll<HTMLElement>('[role="listbox"][data-open] [role="option"]')].find((o) => o.textContent === text)

describe("StrudelRack", () => {
  it("mute and solo are toggles: pressed state, Space and click, and the mix they make", async () => {
    const playable: string[] = []
    const view = await mount(<Rack log={[]} playable={playable} />)
    const drums = device(view.host, "bd · sd · hh")
    const [mute, solo] = [...drums.querySelectorAll<HTMLButtonElement>("button.strudel-device__toggle")]
    expect([mute!.getAttribute("aria-label"), solo!.getAttribute("aria-label")]).toEqual(["Mute", "Solo"])
    expect([mute!.getAttribute("data-slot"), mute!.getAttribute("aria-pressed"), solo!.getAttribute("aria-pressed")]).toEqual(["toggle", "false", "false"])
    await click(mute)
    expect(mute!.getAttribute("aria-pressed")).toBe("true")
    expect(mute!.hasAttribute("data-pressed")).toBe(true)
    expect(drums.getAttribute("data-audible")).toBe("false")
    expect(playable.at(-1)).toContain("stack(\n  silence,")
    await focus(mute)
    await press(" ")
    expect(mute!.getAttribute("aria-pressed")).toBe("false")
    await focus(solo)
    await press("Enter")
    expect(solo!.getAttribute("aria-pressed")).toBe("true")
    expect(device(view.host, "Keys · piano").getAttribute("data-audible")).toBe("false")
    await view.unmount()
  })

  it("the layout switch is a radio group: arrows move and choose, and grid mode drops the modules into the grid", async () => {
    const view = await mount(<Rack log={[]} />)
    const group = named(view.host, "radiogroup", "Layout")!
    const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(radios.map((r) => [r.textContent, r.getAttribute("aria-checked"), r.tabIndex])).toEqual([["rack", "true", 0], ["grid", "false", -1]])
    expect(view.host.querySelector(".strudel-rack")!.getAttribute("data-mode")).toBe("rack")
    await focus(radios[0])
    await press("ArrowRight")
    // The master strip moved into the grid, and the switch with it: focus is on the new choice.
    const grid = [...named(view.host, "radiogroup", "Layout")!.querySelectorAll<HTMLElement>('[role="radio"]')][1]!
    expect(document.activeElement).toBe(grid)
    expect(grid.getAttribute("aria-checked")).toBe("true")
    expect(grid.hasAttribute("data-checked")).toBe(true)
    expect(view.host.querySelector(".strudel-rack")!.getAttribute("data-mode")).toBe("grid")
    expect(view.host.querySelectorAll('[data-slot="rack-grid-item"]')).toHaveLength(4)
    expect(view.host.querySelector('button[aria-label="Move Master"]')).not.toBeNull()
    await press("ArrowLeft")
    expect(view.host.querySelector(".strudel-rack")!.getAttribute("data-mode")).toBe("rack")
    expect(view.host.querySelector('[data-slot="rack-grid"]')).toBeNull()
    expect(document.activeElement!.textContent).toBe("rack")
    await view.unmount()
  })

  it("the LCD's choices are selects named Sound, Key and Scale; choosing one rewrites the code", async () => {
    const log: string[] = []
    const view = await mount(<Rack log={log} />)
    const bass = device(view.host, "Bass · sawtooth")
    const sound = named(bass, "combobox", "Sound")!
    const key = named(bass, "combobox", "Key")!
    const scale = named(bass, "combobox", "Scale")!
    expect([sound.textContent, key.textContent, scale.textContent]).toEqual(["sawtooth", "G", "minor"])
    expect(sound.getAttribute("aria-expanded")).toBe("false")
    expect(bass.querySelector("select")).toBeNull()

    await focus(sound)
    await press("ArrowDown")
    const list = bass.querySelector<HTMLElement>('[role="listbox"]')!
    expect(sound.getAttribute("aria-expanded")).toBe("true")
    expect(list.querySelector('[role="option"][aria-selected="true"]')!.textContent).toBe("sawtooth")
    await press("s")
    await press("q")
    expect(list.querySelector("[data-highlighted]")!.textContent).toBe("square")
    await press("Enter")
    expect(log.at(-1)).toContain('.s("square")')
    expect(sound.getAttribute("aria-expanded")).toBe("false")
    expect(list.hasAttribute("data-open")).toBe(false)
    expect(document.activeElement).toBe(named(device(view.host, "Bass · square"), "combobox", "Sound"))

    await click(named(device(view.host, "Bass · square"), "combobox", "Scale"))
    await click(option(view.host, "dorian"))
    expect(log.at(-1)).toContain('.scale("G2:dorian")')
    await click(named(device(view.host, "Bass · square"), "combobox", "Key"))
    await click(option(view.host, "D"))
    expect(log.at(-1)).toContain('.scale("D2:dorian")')
    await view.unmount()
  })

  it("the + button is a menu of the effects a module doesn't have yet; choosing one adds its knob", async () => {
    const log: string[] = []
    const view = await mount(<Rack log={log} />)
    const drums = device(view.host, "bd · sd · hh")
    const add = drums.querySelector<HTMLButtonElement>("button.strudel-device__add")!
    expect(add.getAttribute("aria-label")).toBe("Add an effect to bd · sd · hh")
    expect(add.getAttribute("aria-haspopup")).toBe("menu")
    expect(add.getAttribute("aria-expanded")).toBe("false")
    await focus(add)
    await press("Enter")
    const menu = drums.querySelector<HTMLElement>('[role="menu"]')!
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items[0]!.textContent).toBe("Cutoff lpf")
    expect(items.some((item) => item.textContent === "Cutoff cutoff")).toBe(false)
    expect(document.activeElement).toBe(items[0])
    // Typing goes by the effect's name.
    await press("r")
    expect(document.activeElement!.textContent).toBe("Reso lpq")
    await press("Escape")
    expect(drums.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(add)
    await press(" ")
    await click([...drums.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) => item.textContent === "Reverb room"))
    expect(log.at(-1)).toContain('s("bd*2 [~ bd] sd ~, hh*8").gain(.8).room(.4)')
    expect(named(device(view.host, "bd · sd · hh"), "slider", "Reverb")).toBeDefined()
    await view.unmount()
  })

  it("faders and knobs write the code: the gain fader, an effect knob, a modulated one, and the master's", async () => {
    const log: string[] = []
    const view = await mount(<Rack log={log} />)
    const gain = named(device(view.host, "bd · sd · hh"), "slider", "Gain") as HTMLInputElement
    expect(gain.type).toBe("range")
    expect(gain.getAttribute("aria-valuetext")).toBe("80")
    await focus(gain)
    // A tenth of the fader's travel, which runs to 1.5.
    await press("PageUp")
    expect(log.at(-1)).toContain(".gain(.945)")

    const reverb = named(device(view.host, "Keys · piano"), "slider", "Reverb")!
    expect(reverb.getAttribute("aria-valuetext")).toBe("40")
    await focus(reverb)
    await press("ArrowUp")
    expect(log.at(-1)).toContain(".room(.45)")
    const remove = device(view.host, "Keys · piano").querySelector<HTMLButtonElement>('button[aria-label="Remove Reverb"]')!
    await click(remove)
    expect(log.at(-1)).not.toContain(".room(")

    const cutoff = named(device(view.host, "Bass · sawtooth"), "slider", "Cutoff")!
    expect(cutoff.getAttribute("aria-disabled")).toBe("true")
    expect(cutoff.getAttribute("aria-valuetext")).toBe("∿")
    const before = log.length
    await focus(cutoff)
    await press("ArrowUp")
    expect(log).toHaveLength(before)

    const master = named(view.host, "group", "Master")!
    const tempo = named(master, "slider", "Tempo")!
    expect(tempo.getAttribute("aria-valuetext")).toBe("120 bpm")
    await focus(tempo)
    await press("End")
    expect(log.at(-1)).toContain("setcps(2)")
    expect(master.querySelector('output[aria-label="Tempo"]')!.textContent).toBe("480BPM")
    await view.unmount()
  })

  it("renders on the server, and names a syntax error instead", () => {
    const html = renderToStaticMarkup(<StrudelRack code={SONG} onChange={() => {}} />)
    expect(html.match(/data-slot="toggle"/g)).toHaveLength(6)
    expect(html).toContain('role="radiogroup"')
    expect(html.match(/role="combobox"/g)).toHaveLength(3)
    expect(html).not.toContain("<select")
    expect(renderToStaticMarkup(<StrudelRack code={"stack("} onChange={() => {}} />)).toContain('role="alert"')
  })
})

describe("StrudelPlayer", () => {
  const toggles = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>("button.docstream-strudel__toggle")]

  it("names its buttons, and keeps the equipment and the code closed until asked", async () => {
    const view = await mount(<StrudelPlayer code={SONG} title="Night drive" />)
    expect(view.host.querySelector<HTMLButtonElement>("button.docstream-strudel__play")!.getAttribute("aria-label")).toBe("Play Night drive")
    const [equipment, code] = toggles(view.host)
    expect([equipment!.getAttribute("aria-label"), code!.getAttribute("aria-label")]).toEqual(["Equipment", "Code"])
    expect([equipment!.getAttribute("aria-expanded"), code!.getAttribute("aria-expanded")]).toEqual(["false", "false"])
    expect(equipment!.hasAttribute("aria-controls")).toBe(false)
    expect(view.host.querySelector(".docstream-strudel__code")).toBeNull()
    expect(view.host.querySelector(".strudel-rack")).toBeNull()
    await view.unmount()
  })

  it("each button opens its own panel with Enter, Space or a click, points at it, and closes it again", async () => {
    const view = await mount(<StrudelPlayer code={SONG} title="Night drive" />)
    const [equipment, code] = toggles(view.host)
    await focus(code)
    await press("Enter")
    const region = view.host.querySelector<HTMLElement>(".docstream-strudel__code")!
    expect(code!.getAttribute("aria-expanded")).toBe("true")
    expect(code!.hasAttribute("data-open")).toBe(true)
    expect(code!.getAttribute("aria-controls")).toBe(region.id)
    expect([region.getAttribute("role"), region.getAttribute("aria-label"), region.tabIndex]).toEqual(["region", "Night drive code", 0])
    expect(region.textContent).toContain('note("c4 e4 g4")')
    // The other button's panel is its own.
    expect(equipment!.getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(code)

    await click(equipment)
    for (let i = 0; i < 20 && !view.host.querySelector(".strudel-rack"); i++) await tick(10)
    expect(equipment!.getAttribute("aria-expanded")).toBe("true")
    const panel = view.host.querySelector<HTMLElement>(".docstream-strudel__equipment")!
    expect(equipment!.getAttribute("aria-controls")).toBe(panel.id)
    expect(panel.querySelector(".strudel-rack")).not.toBeNull()
    expect(view.host.querySelector(".docstream-strudel__code")).not.toBeNull()

    await focus(code)
    await press(" ")
    expect(code!.getAttribute("aria-expanded")).toBe("false")
    expect(view.host.querySelector(".docstream-strudel__code")).toBeNull()
    expect(view.host.querySelector(".strudel-rack")).not.toBeNull()
    await view.unmount()
  })

  it("`showCode` renders the code open, on the server too, and `rack={false}` leaves the equipment button out", async () => {
    const html = renderToStaticMarkup(<StrudelPlayer code={SONG} showCode rack={false} />)
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain("docstream-strudel__code")
    expect(html).not.toContain('aria-label="Equipment"')
    const view = await mount(<StrudelPlayer code={SONG} showCode rack={false} />)
    expect(toggles(view.host).map((t) => t.getAttribute("aria-label"))).toEqual(["Code"])
    expect(view.host.querySelector(".docstream-strudel__code")).not.toBeNull()
    await view.unmount()
  })

  it("`defaultCodeOpen` / `defaultRackOpen` open a panel at first; the deprecated `showCode` / `showRack` still do", async () => {
    for (const props of [{ defaultCodeOpen: true }, { showCode: true }]) {
      expect(renderToStaticMarkup(<StrudelPlayer code={SONG} rack={false} {...props} />)).toContain("docstream-strudel__code")
    }
    const view = await mount(<StrudelPlayer code={SONG} defaultRackOpen />)
    for (let i = 0; i < 20 && !view.host.querySelector(".strudel-rack"); i++) await tick(10)
    expect(toggles(view.host)[0]!.getAttribute("aria-expanded")).toBe("true")
    expect(view.host.querySelector(".strudel-rack")).not.toBeNull()
    await view.unmount()
    // The new name wins over the old one.
    expect(renderToStaticMarkup(<StrudelPlayer code={SONG} rack={false} showCode defaultCodeOpen={false} />)).not.toContain("docstream-strudel__code")
  })

  it("`codeOpen` / `rackOpen` control the panels: the toggle only asks, with UI SDK's details", async () => {
    const onCodeOpenChange = vi.fn()
    const view = await mount(<StrudelPlayer code={SONG} rack={false} codeOpen={false} onCodeOpenChange={onCodeOpenChange} />)
    const [code] = toggles(view.host)
    await click(code)
    expect(onCodeOpenChange).toHaveBeenCalledOnce()
    expect(onCodeOpenChange.mock.calls[0]![0]).toBe(true)
    expect(onCodeOpenChange.mock.calls[0]![1]).toMatchObject({ reason: "trigger-press" })
    expect(code!.getAttribute("aria-expanded")).toBe("false")
    expect(view.host.querySelector(".docstream-strudel__code")).toBeNull()
    await view.rerender(<StrudelPlayer code={SONG} rack={false} codeOpen onCodeOpenChange={onCodeOpenChange} />)
    expect(code!.getAttribute("aria-expanded")).toBe("true")
    expect(view.host.querySelector(".docstream-strudel__code")).not.toBeNull()
    await view.unmount()
  })

  it("an uncontrolled panel reports its changes, and `details.cancel()` keeps it as it was", async () => {
    const seen: boolean[] = []
    const view = await mount(<StrudelPlayer code={SONG} rack={false} onCodeOpenChange={(open, details) => { seen.push(open); if (seen.length > 1) details.cancel() }} />)
    const [code] = toggles(view.host)
    await click(code)
    expect(code!.getAttribute("aria-expanded")).toBe("true")
    await click(code)
    expect(seen).toEqual([true, false])
    expect(code!.getAttribute("aria-expanded")).toBe("true")
    await view.unmount()
  })

  it("onCodeChange says whether the rack edited the code or Revert put it back", async () => {
    const calls: [string, { reason: string }][] = []
    const view = await mount(<StrudelPlayer code={SONG} title="Night drive" defaultRackOpen onCodeChange={(next, details) => calls.push([next, details])} />)
    for (let i = 0; i < 20 && !view.host.querySelector(".strudel-rack"); i++) await tick(10)
    const gain = named(device(view.host, "bd · sd · hh"), "slider", "Gain")!
    await focus(gain)
    await press("PageUp")
    expect(calls.at(-1)![0]).toContain(".gain(.945)")
    expect(calls.at(-1)![1]).toEqual({ reason: "rack-edit" })
    await click(view.host.querySelector<HTMLButtonElement>("button.docstream-strudel__revert"))
    expect(calls.at(-1)).toEqual([SONG, { reason: "revert" }])
    await view.unmount()
  })

  it("names its figure, and passes className, style and ref to it", async () => {
    const ref = createRef<HTMLElement>()
    const view = await mount(<StrudelPlayer ref={ref} code={SONG} title="Night drive" className="wide" style={{ maxWidth: 480 }} />)
    const figure = view.host.querySelector<HTMLElement>("figure.docstream-strudel")!
    expect(ref.current).toBe(figure)
    expect([figure.className, figure.style.maxWidth, figure.getAttribute("aria-label")]).toEqual(["docstream-strudel wide", "480px", "Night drive"])
    await view.rerender(<StrudelPlayer code={SONG} title="Night drive" aria-label="Night drive, a Strudel loop" />)
    expect(view.host.querySelector("figure")!.getAttribute("aria-label")).toBe("Night drive, a Strudel loop")
    await view.unmount()
  })
})
