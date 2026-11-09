import { useEffect, useState } from "react"
import { DocPageActions, resolveDemosToMarkdown, useDemoResolver, type DemoMarkdownFormat } from "@brett_lamy/docstream"
import { PAGE } from "./page"

/**
 * What Copy page / View as Markdown produce for a small page, in both formats. The resolver is
 * the host's, read from context — the same one that renders the demos on this site.
 */
export default function ExportPreview({ variant = "inline" }: { variant?: string }) {
  const format: DemoMarkdownFormat = variant === "plain" ? "plain" : "inline"
  const resolver = useDemoResolver()
  const [output, setOutput] = useState("Resolving…")

  useEffect(() => {
    let live = true
    resolveDemosToMarkdown(PAGE, resolver, { format }).then(
      (md) => live && setOutput(md),
      (error: unknown) => live && setOutput(String(error)),
    )
    return () => {
      live = false
    }
  }, [resolver, format])

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
        <span>
          <code>resolveDemosToMarkdown(page, resolver, {"{"} format: "{format}" {"}"})</code> →{" "}
          {output.length.toLocaleString()} chars
        </span>
        <span style={{ marginLeft: "auto" }}>
          <DocPageActions
            markdown={PAGE}
            demoOptions={{ format }}
            transform={(md) => `${md.trim()}\n\n---\n\nExported from the page-actions demo.\n`}
            prompt={(url) => `Summarize ${url} in three bullet points.`}
          />
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          maxHeight: 380,
          overflow: "auto",
          padding: "10px 12px",
          borderRadius: 8,
          fontSize: 11.5,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          background: "var(--gb-code-bg)",
          color: "var(--gb-code-fg)",
        }}
      >
        {output}
      </pre>
    </div>
  )
}
