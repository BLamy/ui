import { useEffect, useState } from 'react'
import { parseStl, type StlMesh } from '@/components/ui/stl-viewer'

// parseStl on its own: the triangles, normals and bounds of a model, for your own renderer or checks.
export default function Mesh() {
  const [mesh, setMesh] = useState<StlMesh | null>(null)
  useEffect(() => {
    void fetch(`${import.meta.env.BASE_URL}models/torus-knot.stl`)
      .then((res) => res.arrayBuffer())
      .then((data) => setMesh(parseStl(data)))
  }, [])
  if (!mesh) return <p className="text-detail">Loading…</p>
  const size = mesh.max.map((v, i) => (v - mesh.min[i]!).toFixed(1)).join(' × ')
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-detail">
      <dt className="font-medium">Triangles</dt><dd className="m-0 tabular-nums">{mesh.triangles.toLocaleString()}</dd>
      <dt className="font-medium">Size</dt><dd className="m-0 tabular-nums">{size}</dd>
      <dt className="font-medium">Vertices</dt><dd className="m-0 tabular-nums">{mesh.positions.length / 3}</dd>
    </dl>
  )
}
