import type { MiniNode } from "@brett_lamy/docstream/strudel"

// Draws a mini-notation node and its children, each with the slice of source it covers.
export function TreeView({ node, source }: { node: MiniNode; source: string }) {
  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 16, listStyle: "none", font: "12px/1.6 ui-monospace, monospace" }}>
      <Node node={node} source={source} />
    </ul>
  )
}

function children(node: MiniNode): MiniNode[] {
  switch (node.type) {
    case "sequence":
      return node.steps
    case "stack":
    case "choose":
    case "feet":
    case "alternation":
      return node.layers
    case "polymeter":
      return node.layers
    case "subcycle":
      return [node.body]
    case "step":
      return [node.slice]
    case "atom":
      return []
  }
}

function Node({ node, source }: { node: MiniNode; source: string }) {
  const kids = children(node)
  const ops = node.type === "step" && node.ops.length ? ` ${node.ops.map((o) => o.op).join(" ")}` : ""
  return (
    <li>
      <span style={{ opacity: 0.6 }}>{node.type}{ops}</span>{" "}
      <code>{node.type === "atom" ? `${node.value}${node.rest ? " (rest)" : ""}` : source.slice(node.start, node.end)}</code>
      {kids.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none", borderLeft: "1px dashed color-mix(in oklab, currentColor 20%, transparent)" }}>
          {kids.map((kid, i) => (
            <Node key={i} node={kid} source={source} />
          ))}
        </ul>
      )}
    </li>
  )
}
