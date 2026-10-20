import { useEffect, useMemo, useState } from "react"
import { StlViewer, parseStl } from "@brett_lamy/docstream"
import { gear, toBinaryStl, torus, wave } from "./mesh"

const SHAPES = { torus, gear, wave }
type Shape = keyof typeof SHAPES

// StlViewer loads a URL, so a mesh made in the browser goes in as a blob: URL.
export default function GeneratedModel({ variant = "torus" }: { variant?: string }) {
  const shape = (variant in SHAPES ? variant : "torus") as Shape
  const [detail, setDetail] = useState(24)
  const [color, setColor] = useState("#6366f1")
  const [spin, setSpin] = useState(true)

  const stl = useMemo(() => toBinaryStl(SHAPES[shape](detail), `docstream ${shape}`), [shape, detail])
  // parseStl is the same parser the viewer runs: handy for validating an upload or reading its size.
  const mesh = useMemo(() => parseStl(stl), [stl])
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([stl], { type: "model/stl" }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [stl])

  const size = mesh.max.map((v, i) => (v - mesh.min[i]!).toFixed(1)).join(" × ")
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 560, margin: "0 auto" }}>
      {url && <StlViewer key={`${url}-${spin}`} src={url} title={`${shape}.stl`} color={color} autoRotate={spin} />}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, fontSize: 13 }}>
        <label style={row}>
          detail
          <input type="range" min={4} max={64} value={detail} onChange={(e) => setDetail(+e.currentTarget.value)} />
        </label>
        <label style={row}>
          color <input type="color" value={color} onChange={(e) => setColor(e.currentTarget.value)} />
        </label>
        <label style={row}>
          <input type="checkbox" checked={spin} onChange={() => setSpin((s) => !s)} /> autoRotate
        </label>
        <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
          parseStl → {mesh.triangles.toLocaleString()} triangles, {size} mm, {(stl.byteLength / 1024).toFixed(1)} KB
        </span>
      </div>
    </div>
  )
}

const row = { display: "inline-flex", alignItems: "center", gap: 6 }
