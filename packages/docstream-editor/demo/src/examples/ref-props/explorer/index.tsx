import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"

const initial = `---
title: Prop explorer
tags: [editor, props]
---

Flip the switches above. Type \`/\` for the slash menu, \`@\` or \`#\` for chips.

- [ ] Paste a docs page with \`markdownPaste\` on, then off
`

type Props = {
  toolbar: boolean
  editable: boolean
  slashMenu: boolean
  references: boolean
  documentProperties: "true" | "false" | "open"
  markdownPaste: boolean
  imagePaste: "inline" | "chip"
  placeholder: string
}
const DEFAULTS: Props = { toolbar: true, editable: true, slashMenu: true, references: true, documentProperties: "true", markdownPaste: true, imagePaste: "inline", placeholder: "" }

/** The JSX for the current settings, listing only what differs from the defaults. */
function jsx(p: Props): string {
  const attrs = ["markdown={markdown}", "onChange={setMarkdown}"]
  for (const key of ["toolbar", "editable", "slashMenu", "references", "markdownPaste"] as const) if (!p[key]) attrs.push(`${key}={false}`)
  if (p.documentProperties === "false") attrs.push("documentProperties={false}")
  if (p.documentProperties === "open") attrs.push("documentProperties={{ defaultOpen: true }}")
  if (p.imagePaste === "chip") attrs.push('imagePaste="chip"')
  if (p.placeholder) attrs.push(`placeholder=${JSON.stringify(p.placeholder)}`)
  return `<GitbookEditor\n  ${attrs.join("\n  ")}\n/>`
}

export default function PropExplorer() {
  const [p, setP] = useState(DEFAULTS)
  const [markdown, setMarkdown] = useState(initial)
  const set = <K extends keyof Props>(key: K, value: Props[K]) => setP((prev) => ({ ...prev, [key]: value }))
  // slashMenu, references, placeholder and editable are read when the editor is created (and
  // defaultOpen when the property sheet mounts), so changing them remounts the editor.
  const key = [p.editable, p.slashMenu, p.references, p.placeholder, p.documentProperties].join("|")
  const box = { border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)" }

  return (
    <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
      <style>{".gb.px-editor { max-width: none; padding: 4px 16px 16px; border: 0; background: none }"}</style>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", color: "var(--muted-foreground)" }}>
        {(["toolbar", "editable", "slashMenu", "references", "markdownPaste"] as const).map((k) => (
          <label key={k} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
            <input type="checkbox" checked={p[k]} onChange={(e) => set(k, e.target.checked)} /> {k}
          </label>
        ))}
        <label>documentProperties{" "}
          <select value={p.documentProperties} onChange={(e) => set("documentProperties", e.target.value as Props["documentProperties"])}>
            <option value="true">true</option><option value="open">{"{ defaultOpen: true }"}</option><option value="false">false</option>
          </select>
        </label>
        <label>imagePaste{" "}
          <select value={p.imagePaste} onChange={(e) => set("imagePaste", e.target.value as Props["imagePaste"])}>
            <option value="inline">inline</option><option value="chip">chip</option>
          </select>
        </label>
        <label>placeholder{" "}
          <input value={p.placeholder} placeholder="(default)" onChange={(e) => set("placeholder", e.target.value)} style={{ width: 150 }} />
        </label>
      </div>
      <div style={box}>
        <GitbookEditor
          key={key}
          className="px-editor"
          markdown={markdown}
          onChange={setMarkdown}
          toolbar={p.toolbar}
          editable={p.editable}
          slashMenu={p.slashMenu}
          references={p.references}
          markdownPaste={p.markdownPaste}
          documentProperties={p.documentProperties === "open" ? { defaultOpen: true } : p.documentProperties === "true"}
          imagePaste={p.imagePaste}
          {...(p.placeholder ? { placeholder: p.placeholder } : {})}
        />
      </div>
      <pre style={{ margin: 0, padding: 12, borderRadius: 10, background: "var(--muted)", font: "12px/1.55 ui-monospace, Menlo, monospace" }}>{jsx(p)}</pre>
    </div>
  )
}
