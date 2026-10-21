/** A triangle soup ready for `drawArrays`: three vertices (and three copies of the face normal) per triangle. */
export interface StlMesh {
  positions: Float32Array
  normals: Float32Array
  triangles: number
  min: [number, number, number]
  max: [number, number, number]
}

/** True for a URL whose path ends in `.stl` (query string and hash ignored). */
export function isStlUrl(url: string): boolean {
  return /\.stl(?:[?#]|$)/i.test(url.trim())
}

// A binary STL is an 80-byte header, a uint32 triangle count, then 50 bytes per triangle. ASCII
// files start with "solid", but so do some binary headers, so the byte length decides.
function isBinary(view: DataView): boolean {
  if (view.byteLength < 84) return false
  return 84 + view.getUint32(80, true) * 50 === view.byteLength
}

function faceNormal(p: Float32Array, o: number, out: Float32Array) {
  const ux = p[o + 3]! - p[o]!, uy = p[o + 4]! - p[o + 1]!, uz = p[o + 5]! - p[o + 2]!
  const vx = p[o + 6]! - p[o]!, vy = p[o + 7]! - p[o + 1]!, vz = p[o + 8]! - p[o + 2]!
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz) || 1
  nx /= len
  ny /= len
  nz /= len
  for (let k = 0; k < 3; k++) {
    out[o + k * 3] = nx
    out[o + k * 3 + 1] = ny
    out[o + k * 3 + 2] = nz
  }
}

function finish(positions: Float32Array, triangles: number): StlMesh {
  // Stored normals are often zero or wrong; the winding is what slicers trust, so recompute.
  const normals = new Float32Array(positions.length)
  for (let t = 0; t < triangles; t++) faceNormal(positions, t * 9, normals)
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k]!
      if (v < min[k]!) min[k] = v
      if (v > max[k]!) max[k] = v
    }
  }
  if (!triangles) {
    min.fill(0)
    max.fill(0)
  }
  return { positions, normals, triangles, min, max }
}

/** Parse a binary or ASCII STL file. Throws when the data is neither. */
export function parseStl(data: ArrayBuffer): StlMesh {
  const view = new DataView(data)
  if (isBinary(view)) {
    const triangles = view.getUint32(80, true)
    const positions = new Float32Array(triangles * 9)
    for (let t = 0; t < triangles; t++) {
      const base = 84 + t * 50 + 12 // skip the stored normal
      for (let k = 0; k < 9; k++) positions[t * 9 + k] = view.getFloat32(base + k * 4, true)
    }
    return finish(positions, triangles)
  }
  const text = new TextDecoder().decode(data)
  if (!/^\s*solid\b/i.test(text)) throw new Error("Not an STL file")
  const values: number[] = []
  const vertex = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi
  for (let m = vertex.exec(text); m; m = vertex.exec(text)) values.push(+m[1]!, +m[2]!, +m[3]!)
  const triangles = Math.floor(values.length / 9)
  if (!triangles && /facet/i.test(text)) throw new Error("Malformed ASCII STL")
  return finish(Float32Array.from(values.slice(0, triangles * 9)), triangles)
}
