import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react"
import { Play } from "lucide-react"
import { HighlightedCode } from "./HighlightedCode"
import { CopyIcon, useCopied } from "./copy"

/* Mermaid diagrams, drawn by Pele (https://pele.run): Mermaid text in, SVG out, synchronously and with no
   browser layout pass. A diagram is a card of two panes — the source on the left, the drawing on the right with
   an "Open in Playground" link and how long it took — that stack on a narrow page. Pele loads on first use, and only
   the diagram types a page uses. */

export interface MermaidProps {
  code: string
  /** Accepted for compatibility with older documents; the source pane always shows the whole diagram. */
  collapsedCodeLines?: number
  expandedCodeLines?: number
}

/** Pele's playground, opened on this source. Long sources don't fit in a link. */
export function pelePlaygroundUrl(code: string): string | null {
  const hash = new URLSearchParams({ source: code }).toString()
  return hash.length > 8000 ? null : `https://pele.run/playground#${hash}`
}

export interface PeleDrawing {
  svg?: string
  error?: string
  /** How long Pele took to draw it. */
  ms?: number
}

/** Draws `code` with Pele: the SVG (or the error) and the render time; null until it's drawn. */
export function usePele(code: string, host: RefObject<HTMLElement | null>): PeleDrawing | null {
  const [drawn, setDrawn] = useState<PeleDrawing | null>(null)
  const idPrefix = `pele-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`
  useEffect(() => {
    let cancelled = false
    import("pele/lazy")
      .then(async (pele) => {
        await pele.load(pele.detectType(code))
        if (cancelled) return
        // Pele measures text itself, so it needs the font the diagram is shown in.
        const style = host.current ? getComputedStyle(host.current) : null
        const font = style ? style.getPropertyValue("--pele-font").trim() || style.fontFamily : ""
        // …and the SVG draws in `--pele-font`, so measure and draw with the same one.
        if (font && host.current && !style?.getPropertyValue("--pele-font").trim()) host.current.style.setProperty("--pele-font", font)
        const start = performance.now()
        try {
          // The pane's width: a wide left-to-right chart turns top-down in a narrow pane rather than shrinking.
          const width = host.current ? host.current.clientWidth - parseFloat(style?.paddingLeft ?? "0") - parseFloat(style?.paddingRight ?? "0") : 0
          const { svg } = pele.render(code, { idPrefix, ...(font ? { fontFamily: font } : {}), ...(width > 0 ? { maxWidth: width } : {}) })
          setDrawn({ svg, ms: performance.now() - start })
        } catch (e) {
          if (!(e instanceof pele.PeleError)) throw e
          setDrawn({ error: e.message })
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setDrawn({ error: String((e as Error)?.message ?? e) })
      })
    return () => {
      cancelled = true
    }
  }, [code, idPrefix, host])
  return drawn
}

const formatMs = (ms: number) => (ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`)

/** The drawing pane: "Pele", the playground link, the diagram and its render time. */
export function PeleDiagram({ code, className, children }: { code: string; className?: string; children?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const drawn = usePele(code, host)
  const playground = pelePlaygroundUrl(code)
  return (
    <div ref={host} className={`docs-pele-pane docs-pele-diagram-pane${className ? ` ${className}` : ""}`}>
      <div className="docs-pele-head">
        <span className="docs-pele-label">Pele</span>
        {playground ? (
          <a className="docs-pele-action" href={playground} target="_blank" rel="noreferrer">
            <Play width={14} height={14} strokeWidth={2} aria-hidden="true" />
            Open in Playground
          </a>
        ) : null}
      </div>
      {drawn?.error !== undefined ? (
        // The message quotes the diagram source: text, never markup.
        <pre className="docs-mermaid-error" role="alert">{drawn.error}</pre>
      ) : drawn?.svg ? (
        <div className="docs-mermaid" dangerouslySetInnerHTML={{ __html: drawn.svg }} />
      ) : (
        <div className="docs-mermaid docs-mermaid-pending">Drawing…</div>
      )}
      {drawn?.ms !== undefined ? <span className="docs-pele-time">{formatMs(drawn.ms)}</span> : null}
      {children}
    </div>
  )
}

export function Mermaid({ code }: MermaidProps) {
  const { copied, copy } = useCopied()
  return (
    <section className="docs-mermaid-preview" data-docstream-mermaid="">
      <div className="docs-pele-pane docs-pele-source-pane">
        <div className="docs-pele-head">
          <span className="docs-pele-label">Mermaid</span>
          <button type="button" className="docs-pele-action docs-pele-copy" aria-label={copied ? "Copied" : "Copy Mermaid source"} onClick={() => void copy(code)}>
            <CopyIcon copied={copied} size={16} />
          </button>
        </div>
        <pre className="docs-pele-source">
          <HighlightedCode code={code} language="mermaid" />
        </pre>
      </div>
      <PeleDiagram code={code} />
    </section>
  )
}
