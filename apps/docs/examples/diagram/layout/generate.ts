import type { DiagramDraft, DiagramDraftNode } from '@/lib/diagram-layout'
import type { DiagramEdge } from '@/lib/diagram-model'

/** A seeded graph of about `n` nodes: some compound, some parallel, about 1.5 edges a node, mostly to somewhere nearby. */
export function generateDraft(n: number, seed = 42): DiagramDraft {
  let s = seed >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  const int = (k: number) => Math.floor(rnd() * k)
  const nodes: DiagramDraftNode[] = []
  const edges: DiagramEdge[] = []
  let count = 0

  const place = (parent: string | null, depth: number, budget: number) => {
    let left = budget
    while (left > 0) {
      const id = `s${count++}`
      left--
      const r = rnd()
      if (depth < 3 && left > 6 && r < 0.14) {
        const take = Math.min(left, 4 + int(Math.min(24, left)))
        left -= take
        nodes.push({ id, parent, kind: 'compound', label: id })
        place(id, depth + 1, take)
      } else if (depth < 3 && left > 8 && r < 0.17) {
        const take = Math.min(left - 2, 6 + int(6))
        left -= take + 2
        const half = Math.floor(take / 2)
        nodes.push({ id, parent, kind: 'parallel', label: id, detail: 'parallel' })
        nodes.push({ id: `${id}a`, parent: id, kind: 'region', label: `${id}a` })
        nodes.push({ id: `${id}b`, parent: id, kind: 'region', label: `${id}b` })
        place(`${id}a`, depth + 2, half)
        place(`${id}b`, depth + 2, take - half)
      } else {
        nodes.push({ id, parent, label: id })
      }
    }
  }
  place(null, 0, n)

  const ids = nodes.map((node) => node.id)
  const wanted = Math.round(n * 1.5)
  for (let e = 0; e < wanted; e++) {
    const a = int(ids.length)
    const near = rnd() < 0.8
    const b = rnd() < 0.05 ? a : near ? Math.max(0, Math.min(ids.length - 1, a + 1 + int(9) - 4)) : int(ids.length)
    edges.push({ id: `e${e}`, from: ids[a], to: ids[b], label: `E${e}`, kind: 'event' })
  }
  return { nodes, edges }
}
