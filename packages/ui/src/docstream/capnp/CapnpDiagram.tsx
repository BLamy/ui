"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Glyph } from "../ui/glyph"
import { useAsset } from "../asset-resolver"
import { HighlightedCode } from "../docs/HighlightedCode"
import { SplitCard, SplitCopyButton, SplitResult } from "../docs/SplitCard"
import { DetailsCollapsible, useHydrated } from "../ui/details-collapsible"
import { useColorScheme } from "../ui/use-color-scheme"

/* A workerd config, `config.capnp`, drawn as the Cloudflare services it runs: a ```capnp fence, or `{% embed url="config.capnp" %}`.
   The drawing is the library's CloudflareDiagram, read-only, from readWorkerdConfig. Both come from `@brett_lamy/ui/cloudflare`, by a
   dynamic import when the first one is shown, as the catalog behind them is about 150 KB; placeInLayers gives every service its place,
   so no layout engine (ELK) loads either. Cap'n Proto that isn't a workerd config stays code. The board is styled by the library's
   stylesheet (`@brett_lamy/ui/styles.css`), the card around it by docstream's. */

export const isCapnpLanguage = (language?: string | null) => /^(capnp|capnproto)$/i.test(language ?? "")
export const isCapnpUrl = (url: string) => /\.capnp(?:[?#]|$)/i.test(url.trim())
// The same test as looksLikeWorkerdConfig in the library, here so that a page that isn't drawing one never loads the catalog for it.
export const isWorkerdConfig = (code: string) => /:\s*Workerd\.Config\b/.test(code) || /\bservices\s*=\s*\[/.test(code)

/** How the board picks its colors: "auto" follows the page (the nearest `.dark` / `.light` or `data-theme`, else `color-scheme`). */
export type CapnpAppearance = "auto" | "light" | "dark"

export interface CapnpDiagramProps {
  /** The config's text. */
  code: string
  /** What it's called: its file's name, for an embed. Default "workerd config". */
  title?: string
  /**
   * Light or dark board. "auto" (the default) follows the nearest `.dark` / `.light` class or `data-theme` /
   * `data-appearance` attribute, else the page's `color-scheme` and the system setting, as docstream's other widgets do.
   * @defaultValue "auto"
   */
  appearance?: CapnpAppearance
}

export interface CapnpPreviewProps extends CapnpDiagramProps {
  /** The pane's label. Default "Cloudflare services". */
  label?: string
  /** On the right of the pane's header. */
  action?: ReactNode
}

export interface CapnpEmbedProps extends Omit<CapnpDiagramProps, "code"> {
  /** The file, read through the host's resolver (`AssetResolverProvider`) when there is one. */
  url: string
}

type Cloudflare = typeof import("@brett_lamy/ui/cloudflare")

let loaded: Cloudflare | null = null
let loading: Promise<Cloudflare> | null = null
const loadCloudflare = () => (loading ??= import("@brett_lamy/ui/cloudflare").then((m) => (loaded = m)))

/** The Cloudflare entry once it's here: at once after the first, so a second board on the page never flashes "Drawing".
 *  Not while hydrating, though: the server drew none, so neither does the hydrating render. */
function useCloudflare(): Cloudflare | Error | null {
  const hydrated = useHydrated()
  const [state, setState] = useState<Cloudflare | Error | null>(null)
  useEffect(() => {
    let live = true
    loadCloudflare().then((m) => live && setState(m), (e: unknown) => live && setState(e instanceof Error ? e : new Error(String(e))))
    return () => { live = false }
  }, [])
  return state ?? (hydrated ? loaded : null)
}

const DEFAULT_NAME = "workerd config"

type System = ReturnType<Cloudflare["placeInLayers"]>

/** The board: the system on a read-only CloudflareDiagram, as tall as it needs to be read whole (up to 70% of the viewport or
 *  640 px), with its bar docked under it. Where it starts is the diagram's: all of it when that can be read, else its top-start
 *  corner, clear of its toolbar. */
function Board({ cloudflare, system, name, appearance }: { cloudflare: Cloudflare; system: System; name: string; appearance: CapnpAppearance | undefined }) {
  const [measureScheme, scheme] = useColorScheme(appearance)
  return (
    <div ref={measureScheme} className={`docs-capnp-board ${scheme}`} data-appearance={scheme}>
      <cloudflare.CloudflareDiagram services={system.services} edges={system.edges} title={name} defaultPanelOpen={false} height="content" aria-label={`${name}, as Cloudflare services`} />
    </div>
  )
}

/** A workerd config's services on a read-only board, with what isn't drawn listed under it: the result pane, which the
 *  editor shows beside the editable source. */
export function CapnpPreview({ code, title, appearance, label = "Cloudflare services", action }: CapnpPreviewProps) {
  const cloudflare = useCloudflare()
  const ready = cloudflare && !(cloudflare instanceof Error) ? cloudflare : null
  const read = useMemo(() => (ready ? ready.readWorkerdConfig(code) : null), [ready, code])
  // Placed in layers by what reaches what, so it's drawn at once and the same every time, with no layout engine to load.
  const system = useMemo(() => (ready && read?.ok ? ready.placeInLayers(read.system) : null), [ready, read])
  const name = title ?? DEFAULT_NAME
  let board: ReactNode
  if (cloudflare instanceof Error) board = <pre className="docs-mermaid-error" role="alert">The diagram couldn’t load: {cloudflare.message}</pre>
  // The reader's reason says what's wrong and where ("line 4, column 47 needs a "," or a ")"").
  else if (read && !read.ok) board = <pre className="docs-mermaid-error" role="alert">{read.reason}</pre>
  else if (ready && system) board = <Board cloudflare={ready} system={system} name={name} appearance={appearance} />
  else board = <div className="docs-capnp-board docs-mermaid docs-mermaid-pending" role="status">Drawing the services…</div>
  return (
    <SplitResult label={label} action={action} className="docs-capnp-result">
      {board}
      {read?.ok && read.notes.length ? (
        <ul className="docs-capnp-notes" data-docstream-capnp-notes="" aria-label="Not drawn">
          {read.notes.map((n, i) => <li key={i} data-code={n.code}>{n.message}</li>)}
        </ul>
      ) : null}
    </SplitResult>
  )
}

/** A workerd config's services on a board, with what isn't drawn listed under it, and the source a press away. */
export function CapnpDiagram({ code, title, appearance }: CapnpDiagramProps) {
  const name = title ?? DEFAULT_NAME
  return (
    <SplitCard className="docs-capnp-preview" data-docstream-capnp="" aria-label={name}>
      <CapnpPreview code={code} title={name} label={name} appearance={appearance} action={<SplitCopyButton label={name} code={code} />} />
      <DetailsCollapsible
        className="docs-capnp-source"
        triggerClassName="docs-capnp-source-trigger"
        panelClassName="docs-capnp-source-body"
        summary={<>
          <Glyph name="chevron-right" className="docs-capnp-caret" size={14} sw={2.2} />
          <span>Source</span>
          <span className="docs-capnp-language">capnp</span>
        </>}
      >
        <pre className="docs-split-source">
          <HighlightedCode code={code} language="capnp" />
        </pre>
      </DetailsCollapsible>
    </SplitCard>
  )
}

/** `{% embed url="config.capnp" %}`: the file, read through the host's resolver (AssetResolverProvider) when there is one. */
export function CapnpEmbed({ url, title, appearance }: CapnpEmbedProps) {
  const src = useAsset(url)
  const [read, setRead] = useState<{ src: string; code?: string; error?: string } | null>(null)
  useEffect(() => {
    if (src === undefined) return
    let live = true
    fetch(src).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${r.statusText}`.trim())))).then(
      (code) => live && setRead({ src, code }),
      (e: unknown) => live && setRead({ src, error: e instanceof Error ? e.message : String(e) }),
    )
    return () => { live = false }
  }, [src])
  // A resolved URL (blob:) has no file name in it, so the name's the one written in the document.
  const name = title || url.split(/[?#]/)[0]!.split("/").pop() || url
  if (!read || read.src !== src) return <div className="docstream-asset-pending" aria-busy="true" />
  if (read.error !== undefined) {
    return (
      <SplitCard className="docs-capnp-preview" data-docstream-capnp="" aria-label={name}>
        <SplitResult label={name} className="docs-capnp-result">
          <pre className="docs-mermaid-error" role="alert">{name} couldn’t be read: {read.error}</pre>
        </SplitResult>
      </SplitCard>
    )
  }
  return <CapnpDiagram code={read.code!} title={name} appearance={appearance} />
}
