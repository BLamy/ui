import { useEffect, useMemo, useState } from "react"
import { parse } from "gpu-lexer"
import { fallbackSpans } from "@brett_lamy/ui/lib/syntax-lexer"

type Span = {
  type: "plain" | "comment" | "string" | "number" | "keyword" | "type" | "function" | "constant" | "operator"
  start: number
  end: number
}

/* Token colors live in styles.css (`.docs-tok-*`) and follow the host's color-scheme, so code reads on
   light and dark backgrounds alike. Hosts can retheme via the --docs-tok-* custom properties.

   Two lexers, one vocabulary. The synchronous fallback (the kit's lib/syntax-lexer, which CodeEditor uses too) colors the code at once, on the
   server too, so a fence is never plain where WebGPU is missing (Safari, Firefox, headless browsers, insecure
   contexts) or gpu-lexer's parse() rejects. When gpu-lexer resolves with spans, they replace the fallback's.
   `data-highlighter` on the <code> says which drew it: "gpu", "fallback" or "none". */

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function spansToHtml(code: string, spans: readonly Span[]) {
  let cursor = 0
  let html = ""
  for (const span of spans) {
    const start = Math.max(span.start, cursor)
    const end = Math.min(span.end, code.length)
    if (end <= start) continue
    html += escapeHtml(code.slice(cursor, start))
    const text = escapeHtml(code.slice(start, end))
    html += span.type === "plain" ? text : `<span class="docs-tok docs-tok-${span.type}">${text}</span>`
    cursor = end
  }
  return html + escapeHtml(code.slice(cursor))
}

/** The spans that fall on one line, cut to it (a block comment or a template string spans several). */
function lineSpans(spans: readonly Span[], start: number, end: number): Span[] {
  const out: Span[] = []
  for (const span of spans) {
    if (span.end <= start || span.start >= end) continue
    out.push({ type: span.type, start: Math.max(span.start, start) - start, end: Math.min(span.end, end) - start })
  }
  return out
}

export function HighlightedCode({ code, language, lineNumbers = false }: {
  code: string
  language: string | null
  lineNumbers?: boolean
}) {
  const lines = useMemo(() => code.split("\n"), [code])
  const fallback = useMemo<Span[]>(() => fallbackSpans(code, language), [code, language])
  const [gpu, setGpu] = useState<{ code: string; spans: Span[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    // Rejects without WebGPU; the fallback's spans stay.
    parse(code).then(
      (result) => { if (!cancelled && result.length) setGpu({ code, spans: result }) },
      () => {},
    )
    return () => { cancelled = true }
  }, [code])

  const fromGpu = gpu && gpu.code === code ? gpu.spans : null
  const spans = fromGpu ?? fallback
  const highlighter = fromGpu ? "gpu" : spans.length ? "fallback" : "none"
  const html = useMemo(() => spans.length ? spansToHtml(code, spans) : null, [code, spans])
  if (!lineNumbers) {
    return html === null
      ? <code data-highlighter={highlighter}>{code}</code>
      : <code data-highlighter={highlighter} dangerouslySetInnerHTML={{ __html: html }} />
  }

  let start = 0
  return <code data-highlighter={highlighter}>{lines.map((line, index) => {
    const from = start
    start += line.length + 1
    const cut = spans.length ? lineSpans(spans, from, from + line.length) : []
    const lineHtml = cut.length ? spansToHtml(line, cut) : null
    return <span key={index} className="docs-code-line">
      <span className="docs-code-lineno">{index + 1}</span>
      {lineHtml === null ? <span>{line}</span> : <span dangerouslySetInnerHTML={{ __html: lineHtml }} />}
    </span>
  })}</code>
}
