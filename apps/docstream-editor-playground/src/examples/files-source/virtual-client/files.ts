/* The in-memory "repo" the source refs point at. Plain JS: h() is React.createElement. */
export const FILES: Record<string, string> = {
  "src/Badge.js": `import { useState } from "react"

export default function Badge({ label = "Beta" }) {
  const [clicks, setClicks] = useState(0)
  return h("button", {
    onClick: () => setClicks(clicks + 1),
    style: { font: "inherit", padding: "4px 12px", borderRadius: 999, border: 0, background: "#5b5bd6", color: "#fff" },
  }, label + " · " + clicks)
}
`,
  "src/Button.js": `export function Button({ tone = "primary", children }) {
  const colors = { primary: "#16a34a", danger: "#dc2626" }
  return h("button", {
    style: { font: "inherit", padding: "6px 16px", borderRadius: 8, border: 0, color: "#fff", background: colors[tone] || "#555" },
  }, children)
}
`,
  "src/Button.stories.js": `import { Button } from "./Button.js"

export default { component: Button, args: { children: "Save changes" } }

export const Primary = { args: { tone: "primary" } }

export const Danger = { args: { tone: "danger", children: "Delete project" } }
`,
}
