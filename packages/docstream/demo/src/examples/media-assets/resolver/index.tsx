import { useCallback, useEffect, useRef, useState, type DragEvent } from "react"
import { AssetResolverProvider, MarkdownContent, type AssetResolver } from "@brett_lamy/docstream"

const BASE = import.meta.env.BASE_URL // "/docstream/" on the docs site

const START = `Paths below are written relative to the document, the way a repo's Markdown would write them.

{% embed url="./models/bracket.stl" %}

![The poster frame](./media/flower-poster.jpg)

Drop an \`.stl\`, \`.strudel\`, \`.rrweb\` or image file on this demo: it is added as \`./dropped/<name>\`.`

// A folder-backed host: relative paths map to files it holds (here the site's public folder,
// plus anything dropped), and everything else falls through to the URL as written.
export default function ResolverDemo({ variant = "sync" }: { variant?: string }) {
  const [markdown, setMarkdown] = useState(START)
  const [dropped, setDropped] = useState<Record<string, string>>({})
  const [log, setLog] = useState<string[]>([])
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const resolve = useCallback<AssetResolver>(
    (url) => {
      const path = url.replace(/^\.\//, "")
      const out = dropped[path] ?? (url.startsWith("./") ? BASE + path : null)
      setTimeout(() => setLog((l) => [`${url} → ${out ?? "(default)"}`, ...l].slice(0, 4)))
      if (variant !== "async") return out
      // An async resolver (reading a file handle, signing a URL…): blocks show a pending frame meanwhile.
      return new Promise((done) => setTimeout(() => done(out), 1200))
    },
    [dropped, variant],
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const added: Record<string, string> = {}
    let md = ""
    for (const file of Array.from(e.dataTransfer.files)) {
      const url = URL.createObjectURL(file)
      urls.current.push(url)
      added[`dropped/${file.name}`] = url
      md += /\.(png|jpe?g|gif|svg|webp)$/i.test(file.name)
        ? `\n\n![${file.name}](./dropped/${file.name})`
        : `\n\n{% embed url="./dropped/${file.name}" %}`
    }
    setDropped((d) => ({ ...d, ...added }))
    setMarkdown((m) => m + md)
  }

  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} style={{ display: "grid", gap: 12, fontSize: 13 }}>
      <textarea
        value={markdown}
        onChange={(e) => setMarkdown(e.currentTarget.value)}
        rows={5}
        spellCheck={false}
        style={{ font: "12px/1.5 ui-monospace, monospace", padding: 10, borderRadius: 8, border: "1px solid color-mix(in oklab, currentColor 20%, transparent)", background: "transparent", color: "inherit" }}
      />
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, opacity: 0.7 }}>
        {log.map((line, i) => (
          <div key={i}>resolve({line})</div>
        ))}
      </div>
      <AssetResolverProvider resolve={resolve}>
        <MarkdownContent markdown={markdown} />
      </AssetResolverProvider>
    </div>
  )
}
