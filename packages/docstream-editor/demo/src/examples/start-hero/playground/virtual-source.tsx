import type { SourceReferenceClient } from "@brett_lamy/docstream/source"

/* A SourceReferenceClient over an in-memory "repo", standing in for docstream's Vite plugin
   (createViteSourceClient). The {% source-ref %} block reads and autosaves this file; the
   preview renders whatever label the saved source gives the button. */
const files = new Map([
  ["src/Button.tsx", 'export default function Button() {\n  return <button>Virtual file</button>\n}\n'],
])

function VirtualButton({ source }: { source: string }) {
  const label = /<button[^>]*>([^<]*)<\/button>/.exec(source)?.[1] ?? "Button"
  return (
    <button type="button" style={{ font: "inherit", padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--primary)", color: "var(--primary-foreground)" }}>
      {label}
    </button>
  )
}

export const virtualSource: SourceReferenceClient = {
  async read(reference) {
    return { content: files.get(reference.path) ?? "", provenance: { mount: reference.mount, path: reference.path, exportName: reference.exportName, kind: reference.kind } }
  },
  async write(reference, content) {
    files.set(reference.path, content)
    return { content, provenance: { mount: reference.mount, path: reference.path, exportName: reference.exportName, kind: reference.kind } }
  },
  async importModule(reference) {
    const source = files.get(reference.path) ?? ""
    return { default: () => <VirtualButton source={source} /> }
  },
}
