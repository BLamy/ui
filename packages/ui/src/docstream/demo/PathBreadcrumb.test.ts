import { describe, expect, it } from "vitest"
import { buildCrumbs, childEntries, collapseRange, entryContains, firstFileIn, hiddenEntries, siblingEntries } from "./PathBreadcrumb"

const PATHS = [
  "index.tsx",
  "components/user-panel.tsx",
  "components/avatar.tsx",
  "components/ui/button.tsx",
  "lib/format.ts",
  "data.ts",
]

describe("buildCrumbs", () => {
  it("src parts first, then folders, then the file", () => {
    const crumbs = buildCrumbs("blocks/discord-clone", "components/user-panel.tsx")
    expect(crumbs.map((c) => [c.name, c.kind, c.path])).toEqual([
      ["blocks", "src", ""],
      ["discord-clone", "src", ""],
      ["components", "dir", "components"],
      ["user-panel.tsx", "file", "components/user-panel.tsx"],
    ])
    expect(new Set(crumbs.map((c) => c.key)).size).toBe(crumbs.length)
  })

  it("a root file with no src is a single file segment", () => {
    expect(buildCrumbs("", "index.tsx").map((c) => [c.name, c.kind])).toEqual([["index.tsx", "file"]])
  })

  it("nested folders carry their full path", () => {
    const crumbs = buildCrumbs("", "components/ui/button.tsx")
    expect(crumbs.map((c) => c.path)).toEqual(["components", "components/ui", "components/ui/button.tsx"])
  })
})

describe("childEntries / siblingEntries", () => {
  it("lists the direct children of the root: folders first, then files, each A to Z", () => {
    expect(childEntries(PATHS, "").map((e) => `${e.kind}:${e.name}`)).toEqual([
      "dir:components",
      "dir:lib",
      "file:data.ts",
      "file:index.tsx",
    ])
  })

  it("a folder entry opens the first file inside it (list order)", () => {
    const root = childEntries(PATHS, "")
    expect(root.find((e) => e.name === "components")!.target).toBe("components/user-panel.tsx")
    expect(root.find((e) => e.name === "lib")!.target).toBe("lib/format.ts")
    expect(firstFileIn(PATHS, "components/ui")).toBe("components/ui/button.tsx")
    expect(firstFileIn(PATHS, "nope")).toBeUndefined()
    expect(firstFileIn(PATHS, "")).toBe("index.tsx")
  })

  it("lists a nested folder's own children", () => {
    expect(childEntries(PATHS, "components").map((e) => `${e.kind}:${e.name}`)).toEqual(["dir:ui", "file:avatar.tsx", "file:user-panel.tsx"])
  })

  it("a folder segment's siblings are the entries of its parent (folders and files)", () => {
    const [components] = buildCrumbs("", "components/user-panel.tsx")
    expect(siblingEntries(PATHS, components).map((e) => e.name)).toEqual(["components", "lib", "data.ts", "index.tsx"])
    const ui = buildCrumbs("", "components/ui/button.tsx")[1]
    expect(siblingEntries(PATHS, ui).map((e) => e.name)).toEqual(["ui", "avatar.tsx", "user-panel.tsx"])
  })

  it("the file segment lists only the files in its folder", () => {
    const file = buildCrumbs("", "components/user-panel.tsx").at(-1)!
    expect(siblingEntries(PATHS, file).map((e) => e.name)).toEqual(["avatar.tsx", "user-panel.tsx"])
  })

  it("a src segment is the demo root", () => {
    const [blocks] = buildCrumbs("blocks/x", "index.tsx")
    expect(siblingEntries(PATHS, blocks)).toEqual(childEntries(PATHS, ""))
  })

  it("marks the entry that is, or contains, the active file", () => {
    const entries = childEntries(PATHS, "")
    const marked = entries.filter((e) => entryContains(e, "components/ui/button.tsx")).map((e) => e.name)
    expect(marked).toEqual(["components"])
    expect(entryContains({ path: "components" }, "components-extra/a.ts")).toBe(false)
    expect(entryContains({ path: "" }, "index.tsx")).toBe(false)
  })
})

describe("hiddenEntries", () => {
  it("lists the hidden segments; a folder opens the first file inside it", () => {
    const segments = buildCrumbs("blocks/demo", "components/ui/button.tsx")
    const hidden = hiddenEntries(PATHS, segments, { start: 1, end: 4 })
    expect(hidden.map((e) => [e.name, e.kind, e.target])).toEqual([
      ["demo", "dir", "index.tsx"],
      ["components", "dir", "components/user-panel.tsx"],
      ["ui", "dir", "components/ui/button.tsx"],
    ])
  })
})

describe("collapseRange", () => {
  // 5 segments of 50px each, a 30px ellipsis item.
  const widths = [50, 50, 50, 50, 50]
  it("returns null when everything fits, or there is nothing in the middle to hide", () => {
    expect(collapseRange(widths, 30, 250)).toBeNull()
    expect(collapseRange(widths, 30, 1000)).toBeNull()
    expect(collapseRange([100, 100], 30, 10)).toBeNull()
    expect(collapseRange([100], 30, 10)).toBeNull()
  })

  it("keeps first and last and as many trailing segments as fit", () => {
    // first(50) + ellipsis(30) + 3 trailing(150) = 230
    expect(collapseRange(widths, 30, 240)).toEqual({ start: 1, end: 2 })
    // 50 + 30 + 100 = 180
    expect(collapseRange(widths, 30, 200)).toEqual({ start: 1, end: 3 })
    // 50 + 30 + 50 = 130
    expect(collapseRange(widths, 30, 135)).toEqual({ start: 1, end: 4 })
  })

  it("never hides the first or the last, however narrow", () => {
    expect(collapseRange(widths, 30, 20)).toEqual({ start: 1, end: 4 })
    expect(collapseRange(widths, 30, 0)).toEqual({ start: 1, end: 4 })
  })

  it("accounts for different widths", () => {
    const uneven = [40, 90, 30, 30, 60]
    // 40 + 30 + 60 + 30 = 160 fits in 170, 40+30+60+30+30 = 190 does not
    expect(collapseRange(uneven, 30, 170)).toEqual({ start: 1, end: 3 })
  })
})
