import { useEffect, useState, type ComponentType } from "react"
import { useAsset } from "../asset-resolver"
import { HighlightedCode } from "../docs/HighlightedCode"

/* A workerd config, `config.capnp`, drawn as the Cloudflare services it runs: a ```capnp fence, or `{% embed url="config.capnp" %}`.
   The drawing is the library's CloudflareDiagram, read-only, from readWorkerdConfig, and both come from `@brett_lamy/ui/cloudflare`
   when one's first on a page, as the catalog behind them is about 150 KB. Cap'n Proto that isn't a workerd config stays code. */

export const isCapnpLanguage = (language?: string | null) => /^(capnp|capnproto)$/i.test(language ?? "")
export const isCapnpUrl = (url: string) => /\.capnp(?:[?#]|$)/i.test(url.trim())
// The same test as looksLikeWorkerdConfig in the library, here so that a page that isn't drawing one never loads the catalog for it.
export const isWorkerdConfig = (code: string) => /:\s*Workerd\.Config\b/.test(code) || /\bservices\s*=\s*\[/.test(code)

interface Drawing {
  CloudflareDiagram: ComponentType<{ services: readonly unknown[]; edges?: readonly unknown[]; defaultPanelOpen?: boolean; "aria-label"?: string }>
  readWorkerdConfig: (code: string) =>
    | { ok: true; system: System; notes: { code: string; message: string }[] }
    | { ok: false; reason: string }
  placeInLayers: (system: System) => System
}
type System = { services: readonly unknown[]; edges: readonly unknown[] }

let loading: Promise<Drawing> | null = null
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore The package's own entry: in the workspace it's its source, and docstream's own build reads the library's dist/.
const loadDrawing = () => (loading ??= import("@brett_lamy/ui/cloudflare").then((m) => m as unknown as Drawing))

export interface CapnpDiagramProps {
  /** The config's text. */
  code: string
  /** What it's called: its file's name, for an embed. */
  title?: string
}

function useDrawing(): Drawing | Error | null {
  const [drawing, setDrawing] = useState<Drawing | Error | null>(null)
  useEffect(() => {
    let live = true
    loadDrawing().then((d) => live && setDrawing(d), (e: unknown) => live && setDrawing(e instanceof Error ? e : new Error(String(e))))
    return () => { live = false }
  }, [])
  return drawing
}

/** A workerd config's services on a board, read-only, with what isn't drawn listed under it: what the editor shows beside the source. */
export function CapnpPreview({ code, title }: CapnpDiagramProps) {
  const drawing = useDrawing()
  if (drawing === null) return <div className="docs-mermaid docs-mermaid-pending" role="status">Drawing the config…</div>
  if (drawing instanceof Error) return <pre className="docs-mermaid-error" role="alert">The diagram couldn’t load: {drawing.message}</pre>
  const read = drawing.readWorkerdConfig(code)
  if (!read.ok) return <pre className="docs-mermaid-error" role="alert">{read.reason}</pre>
  // Placed in layers by what reaches what, so it's drawn at once and the same every time, with no layout engine to load.
  const system = drawing.placeInLayers(read.system)
  return (
    <>
      <div className="docs-capnp-board">
        <drawing.CloudflareDiagram services={system.services} edges={system.edges} defaultPanelOpen={false} aria-label={`${title ?? "workerd config"}, as Cloudflare services`} />
      </div>
      {read.notes.length ? (
        <ul className="docs-capnp-notes" data-docstream-capnp-notes="">
          {read.notes.map((n, i) => <li key={i} data-code={n.code}>{n.message}</li>)}
        </ul>
      ) : null}
    </>
  )
}

/** A workerd config's services on a board, with what isn't drawn listed under it, and the source a press away. */
export function CapnpDiagram({ code, title }: CapnpDiagramProps) {
  const [source, setSource] = useState(false)
  const name = title ?? "workerd config"
  return (
    <section className="docs-capnp" data-docstream-capnp="" aria-label={name}>
      <div className="docs-split-head">
        <span className="docs-split-label">{name}</span>
        <button type="button" className="docs-split-action docs-capnp-toggle" aria-pressed={source} onClick={() => setSource((s) => !s)}>
          {source ? "Diagram" : "Source"}
        </button>
      </div>
      {source ? (
        <pre className="docs-split-source docs-capnp-source">
          <HighlightedCode code={code} language="capnp" />
        </pre>
      ) : (
        <CapnpPreview code={code} title={name} />
      )}
    </section>
  )
}

/** `{% embed url="config.capnp" %}`: the file, read through the host's resolver (AssetResolverProvider) when there is one. */
export function CapnpEmbed({ url, title }: { url: string; title?: string }) {
  const src = useAsset(url)
  const [read, setRead] = useState<{ src: string; code?: string; error?: string } | null>(null)
  useEffect(() => {
    if (src === undefined) return
    let live = true
    fetch(src).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${r.statusText}`)))).then(
      (code) => live && setRead({ src, code }),
      (e: unknown) => live && setRead({ src, error: e instanceof Error ? e.message : String(e) }),
    )
    return () => { live = false }
  }, [src])
  // A resolved URL (blob:) has no file name in it, so the name's the one written in the document.
  const name = title || url.split(/[?#]/)[0]!.split("/").pop() || url
  if (!read || read.src !== src) return <div className="docstream-asset-pending" aria-busy="true" />
  if (read.error !== undefined) return <pre className="docs-mermaid-error" role="alert">{name} couldn’t be read: {read.error}</pre>
  return <CapnpDiagram code={read.code!} title={name} />
}
