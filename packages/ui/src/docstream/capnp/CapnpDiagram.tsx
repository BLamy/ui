"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
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
interface Size { width: number; height: number }
interface View { x: number; y: number; zoom: number }

// What sits over the board: the zoom tools at its top, and the frame's bar ("3 services", Services) at its foot.
const CLEAR_TOP = 60
const CLEAR_BOTTOM = 64
const CLEAR_SIDE = 20
// Below this a service's words are too small to read. A board too narrow for the whole system at this size (a phone)
// starts here, at the first layer, and the rest is a drag, Fit, or the Services panel away. Services connect left to
// right, so a narrow board can't stack them in a column: the connections would have to come back round through them.
const LEGIBLE = 0.66

/** The box around the services, from their places and sizes. */
function boundsOf(cloudflare: Cloudflare, system: System) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of system.services) {
    if (!s.at) return null
    const ports = cloudflare.servicePorts(s.kind)
    const ins = ports.filter((p) => p.direction === "in").length
    x0 = Math.min(x0, s.at.x)
    y0 = Math.min(y0, s.at.y)
    x1 = Math.max(x1, s.at.x + cloudflare.SERVICE_NODE.w)
    y1 = Math.max(y1, s.at.y + cloudflare.serviceNodeHeight(ins, ports.length - ins))
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null
}

/** Where the board starts: the whole system in the room the tools leave, never larger than life, and never smaller than
 *  can be read. */
function startView(box: { x0: number; y0: number; x1: number; y1: number }, size: Size): View | undefined {
  if (size.width <= 0 || size.height <= 0) return undefined
  const w = size.width - CLEAR_SIDE * 2
  const h = size.height - CLEAR_TOP - CLEAR_BOTTOM
  const fit = Math.min(1, w / (box.x1 - box.x0), h / (box.y1 - box.y0))
  if (fit >= LEGIBLE) return { zoom: fit, x: size.width / 2 - ((box.x0 + box.x1) / 2) * fit, y: CLEAR_TOP + h / 2 - ((box.y0 + box.y1) / 2) * fit }
  const zoom = Math.max(LEGIBLE, Math.min(fit, h / (box.y1 - box.y0)))
  return { zoom, x: CLEAR_SIDE - box.x0 * zoom, y: CLEAR_TOP + Math.max(0, (h - (box.y1 - box.y0) * zoom) / 2) - box.y0 * zoom }
}

/** The element's size, as it changes. */
function useSize(): [(element: HTMLElement | null) => void, Size | null] {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  useEffect(() => {
    if (!element) return
    const read = () => {
      const { width, height } = element.getBoundingClientRect()
      setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }))
    }
    read()
    if (typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, size]
}

/** The board: the system on a read-only CloudflareDiagram, once the board's size says where it starts. */
function Board({ cloudflare, system, name, appearance }: { cloudflare: Cloudflare; system: System; name: string; appearance: CapnpAppearance | undefined }) {
  const [measureScheme, scheme] = useColorScheme(appearance)
  const [measureSize, size] = useSize()
  const ref = useCallback((element: HTMLElement | null) => { measureScheme(element); measureSize(element) }, [measureScheme, measureSize])
  const box = useMemo(() => boundsOf(cloudflare, system), [cloudflare, system])
  const view = useMemo(() => (size && box ? startView(box, size) : undefined), [box, size])
  // Whether it all fits: a board that starts to, or stops, starts again from its own view; one that's been moved and only
  // changes size a little keeps where it was put.
  const whole = !view || !box || view.zoom * (box.x1 - box.x0) <= (size?.width ?? 0)
  return (
    <div ref={ref} className={`docs-capnp-board ${scheme}`} data-appearance={scheme} data-whole={whole ? "" : undefined}>
      {size ? (
        <cloudflare.CloudflareDiagram key={whole ? "whole" : "part"} services={system.services} edges={system.edges} defaultPanelOpen={false}
          {...(view ? { defaultViewport: view } : {})} aria-label={`${name}, as Cloudflare services`} />
      ) : null}
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
          <ChevronRight className="docs-capnp-caret" size={14} strokeWidth={2.2} aria-hidden="true" />
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
