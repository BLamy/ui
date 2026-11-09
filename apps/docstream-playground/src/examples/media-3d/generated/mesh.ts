// Tiny mesh generators, written out as binary STL: an 80-byte header, a uint32 triangle
// count, then 50 bytes per triangle (normal, three vertices, a 2-byte attribute).
export type Vec3 = [number, number, number]
export type Triangle = [Vec3, Vec3, Vec3]

/** A torus around Z: `detail` segments around the ring, half as many around the tube. */
export function torus(detail: number, R = 30, r = 10): Triangle[] {
  const u = Math.max(3, detail), v = Math.max(3, Math.round(detail / 2))
  const at = (i: number, j: number): Vec3 => {
    const a = (i / u) * Math.PI * 2, b = (j / v) * Math.PI * 2
    return [(R + r * Math.cos(b)) * Math.cos(a), (R + r * Math.cos(b)) * Math.sin(a), r * Math.sin(b)]
  }
  const out: Triangle[] = []
  for (let i = 0; i < u; i++)
    for (let j = 0; j < v; j++) {
      const p = at(i, j), q = at(i + 1, j), s = at(i + 1, j + 1), t = at(i, j + 1)
      out.push([p, q, s], [p, s, t])
    }
  return out
}

/** A spur gear: `detail` teeth, extruded 8 mm along Z. */
export function gear(detail: number, outer = 32, inner = 26, hole = 8, depth = 8): Triangle[] {
  const teeth = Math.max(6, Math.round(detail / 2))
  const rim: [number, number][] = []
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2, w = Math.PI / teeth
    for (const [da, r] of [[0, inner], [w * 0.25, outer], [w * 0.75, outer], [w, inner]] as const)
      rim.push([Math.cos(a + da) * r, Math.sin(a + da) * r])
  }
  const n = rim.length
  const bore = rim.map((_, k) => {
    const a = Math.atan2(rim[k]![1], rim[k]![0])
    return [Math.cos(a) * hole, Math.sin(a) * hole] as [number, number]
  })
  const out: Triangle[] = []
  const up = (p: [number, number]): Vec3 => [p[0], p[1], depth]
  const down = (p: [number, number]): Vec3 => [p[0], p[1], 0]
  for (let k = 0; k < n; k++) {
    const a = rim[k]!, b = rim[(k + 1) % n]!, c = bore[k]!, d = bore[(k + 1) % n]!
    out.push([up(c), up(a), up(b)], [up(c), up(b), up(d)]) // top face ring
    out.push([down(c), down(b), down(a)], [down(c), down(d), down(b)]) // bottom face ring
    out.push([down(a), down(b), up(b)], [down(a), up(b), up(a)]) // teeth wall
    out.push([down(d), down(c), up(c)], [down(d), up(c), up(d)]) // bore wall
  }
  return out
}

/** A wavy height field: z = sin(x)·cos(y), `detail` cells a side. */
export function wave(detail: number, size = 60, height = 6): Triangle[] {
  const n = Math.max(2, detail)
  const at = (i: number, j: number): Vec3 => {
    const x = (i / n - 0.5) * size, y = (j / n - 0.5) * size
    return [x, y, height * Math.sin(x / 6) * Math.cos(y / 6)]
  }
  const out: Triangle[] = []
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) out.push([at(i, j), at(i + 1, j), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i, j + 1)])
  return out
}

export function toBinaryStl(triangles: Triangle[], header = "docstream generated mesh"): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + triangles.length * 50)
  const view = new DataView(buffer)
  for (let i = 0; i < Math.min(80, header.length); i++) view.setUint8(i, header.charCodeAt(i) & 0x7f)
  view.setUint32(80, triangles.length, true)
  triangles.forEach((tri, t) => {
    const base = 84 + t * 50 + 12 // leave the stored normal zero: parseStl recomputes it from the winding
    tri.forEach((v, k) => v.forEach((x, j) => view.setFloat32(base + k * 12 + j * 4, x, true)))
  })
  return buffer
}
