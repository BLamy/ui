/* An in-memory project folder: the files next to the document, as a desktop app or a repo-backed
   web app would hold them. Paths are written into the Markdown as "./dir/name"; resolveAsset maps
   them to blob: URLs the browser can load. */
import { useCallback, useMemo, useRef, useState } from "react"
import { replayDemoEvents } from "@brett_lamy/docstream/replay/demo"

export interface ProjectFile {
  path: string
  type: string
  size: number
  url: string
  /** Where it came from: in the project from the start, or added by the editor's host callbacks. */
  origin: "project" | "uploaded"
}

/** An L-shaped bracket as ASCII STL: two boxes, twelve triangles each. */
function bracketStl(): string {
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
    const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]
    return faces.map((f) => `facet normal 0 0 0\n outer loop\n${f.map((i) => `  vertex ${v[i]!.join(" ")}`).join("\n")}\n endloop\nendfacet`).join("\n")
  }
  return `solid bracket\n${box(0, 0, 0, 40, 20, 4)}\n${box(0, 0, 4, 4, 20, 30)}\n${box(14, 0, 4, 26, 20, 8)}\nendsolid bracket\n`
}

const WIRING = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="220" viewBox="0 0 560 220">
  <rect width="560" height="220" rx="12" fill="#f4f4f8"/>
  <g font-family="system-ui, sans-serif" font-size="15" fill="#16161d">
    <rect x="30" y="70" width="130" height="80" rx="10" fill="#fff" stroke="#5b5bd6" stroke-width="2"/><text x="62" y="115">Sensor</text>
    <rect x="215" y="70" width="130" height="80" rx="10" fill="#fff" stroke="#5b5bd6" stroke-width="2"/><text x="243" y="115">Bracket</text>
    <rect x="400" y="70" width="130" height="80" rx="10" fill="#fff" stroke="#5b5bd6" stroke-width="2"/><text x="440" y="115">MCU</text>
  </g>
  <path d="M160 110h55M345 110h55" stroke="#5b5bd6" stroke-width="3" marker-end="url(#a)"/>
  <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0l10 5-10 5z" fill="#5b5bd6"/></marker></defs>
</svg>`

const STRUDEL = `stack(s("bd*2 [~ bd] sd ~"), note("<c3 a2 f2 g2>").s("sawtooth").lpf(800))\n`

/** The files the project starts with. */
export function seedFiles(): Array<{ path: string; blob: Blob }> {
  return [
    { path: "./models/bracket.stl", blob: new Blob([bracketStl()], { type: "model/stl" }) },
    { path: "./recordings/checkout.rrweb", blob: new Blob([JSON.stringify(replayDemoEvents)], { type: "application/json" }) },
    { path: "./music/printer.strudel", blob: new Blob([STRUDEL], { type: "text/plain" }) },
    { path: "./images/wiring.svg", blob: new Blob([WIRING], { type: "image/svg+xml" }) },
  ]
}

/** Files the reader can drop or paste with the sample buttons. */
export function sampleFile(name: "sensor-mount.stl" | "session.rrweb" | "notes.strudel"): File {
  if (name === "sensor-mount.stl") return new File([bracketStl().replace(/bracket/g, "mount")], name, { type: "" })
  if (name === "session.rrweb") return new File([JSON.stringify(replayDemoEvents)], name, { type: "" })
  return new File([`note("c4 e4 g4 b4").s("triangle")\n`], name, { type: "" })
}

export function useProject() {
  const [files, setFiles] = useState<ProjectFile[]>(() =>
    seedFiles().map(({ path, blob }) => ({ path, type: blob.type, size: blob.size, url: URL.createObjectURL(blob), origin: "project" as const })),
  )
  const byPath = useRef(new Map(files.map((f) => [f.path, f])))

  /** Stores a file under `dir` (a fresh name if taken) and returns the path to write. */
  const add = useCallback((file: File, dir: string): string => {
    const dot = file.name.lastIndexOf(".")
    const stem = dot > 0 ? file.name.slice(0, dot) : file.name
    const ext = dot > 0 ? file.name.slice(dot) : ""
    let path = `./${dir}/${file.name}`
    for (let n = 2; byPath.current.has(path); n++) path = `./${dir}/${stem}-${n}${ext}`
    const entry: ProjectFile = { path, type: file.type, size: file.size, url: URL.createObjectURL(file), origin: "uploaded" }
    byPath.current.set(path, entry)
    setFiles((all) => [...all, entry])
    return path
  }, [])

  // The editor's resolveAsset: "./models/bracket.stl" → blob:…; nothing for URLs outside the project.
  const resolveAsset = useCallback((url: string) => byPath.current.get(url)?.url, [])

  return useMemo(() => ({ files, add, resolveAsset }), [files, add, resolveAsset])
}
