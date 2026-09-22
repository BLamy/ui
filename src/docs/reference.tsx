import { createContext, useContext, useId, useState, type ReactNode } from "react"
import { ArrowUpRight, AtSign, FolderGit2, Globe, Hash } from "lucide-react"

import type { CitationDef, ReferenceNode } from "../gitbook/ast"

export interface CitationPreview {
  title?: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
}

export type CitationPreviewResolver = (citation: ReferenceNode) => CitationPreview | null | Promise<CitationPreview | null>

export interface DocstreamRefContextValue {
  /** Called when a mention/tag chip (or a citation, if it has no url) is clicked. */
  onReferenceClick?: (ref: ReferenceNode) => void
  /** Full override for chip rendering; return null to fall back to the default. */
  renderReference?: (ref: ReferenceNode) => ReactNode | null
  /** Resolves Open Graph-style metadata when a linked citation is hovered or focused. */
  resolveCitationPreview?: CitationPreviewResolver
}

export const DocstreamRefContext = createContext<DocstreamRefContextValue>({})

const previewCaches = new WeakMap<CitationPreviewResolver, Map<string, Promise<CitationPreview | null>>>()

function resolvePreview(resolver: CitationPreviewResolver, citation: ReferenceNode) {
  let cache = previewCaches.get(resolver)
  if (!cache) {
    cache = new Map()
    previewCaches.set(resolver, cache)
  }
  const key = citation.url ?? citation.id
  let request = cache.get(key)
  if (!request) {
    request = Promise.resolve(resolver(citation)).catch(() => null)
    cache.set(key, request)
  }
  return request
}

function CitationHoverCard({ node }: { node: ReferenceNode }) {
  const { onReferenceClick, resolveCitationPreview } = useContext(DocstreamRefContext)
  const [preview, setPreview] = useState<CitationPreview | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [requested, setRequested] = useState(false)
  const cardId = useId()
  const host = node.url ? hostnameOf(node.url) : null

  const requestPreview = () => {
    if (!resolveCitationPreview || requested) return
    setRequested(true)
    void resolvePreview(resolveCitationPreview, node).then((value) => setPreview(value))
  }

  const title = preview?.title ?? node.label ?? host ?? node.url
  const siteName = preview?.siteName ?? host
  const favicon = preview?.favicon ?? (host ? `https://www.google.com/s2/favicons?sz=32&domain=${host}` : undefined)

  return (
    <span className="docs-cite-wrap" onMouseEnter={requestPreview} onFocus={requestPreview}>
      <a
        className="docs-cite"
        href={node.url}
        target="_blank"
        rel="noreferrer"
        aria-describedby={cardId}
        onClick={() => onReferenceClick?.(node)}
      >
        {node.id}
      </a>
      <span className="docs-cite-card" id={cardId} role="tooltip">
        {preview?.image && !imageFailed ? (
          <span className="docs-cite-card-image-wrap">
            <img className="docs-cite-card-image" src={preview.image} alt="" onError={() => setImageFailed(true)} />
          </span>
        ) : null}
        <span className="docs-cite-card-body">
          <span className="docs-cite-card-source">
            {favicon ? <img className="docs-cite-card-favicon" src={favicon} alt="" /> : <Globe className="docs-cite-card-favicon" />}
            <span>{siteName}</span>
          </span>
          <span className="docs-cite-card-title">{title}</span>
          {preview?.description ? <span className="docs-cite-card-description">{preview.description}</span> : null}
          <span className="docs-cite-card-url">
            {node.url}
            <ArrowUpRight aria-hidden="true" />
          </span>
        </span>
      </span>
    </span>
  )
}

export function InlineReference({ node }: { node: ReferenceNode }) {
  const { onReferenceClick, renderReference } = useContext(DocstreamRefContext)
  const custom = renderReference?.(node)
  if (custom != null) return <>{custom}</>

  if (node.kind === "citation") {
    // Citations default to linking their source; hosts can still observe clicks.
    if (node.url) {
      return <CitationHoverCard node={node} />
    }
    // Definition missing (not yet streamed, or standalone parseInline call).
    return (
      <span className="docs-cite" onClick={() => onReferenceClick?.(node)}>
        {node.id}
      </span>
    )
  }

  const Icon = node.kind === "mention" ? AtSign : node.kind === "codebase" ? FolderGit2 : Hash
  return (
    <button
      type="button"
      className={`docs-ref docs-ref-${node.kind}`}
      onClick={() => onReferenceClick?.(node)}
    >
      <Icon className="docs-ref-icon" />
      {node.id}
    </button>
  )
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function SourceChip({ def }: { def: CitationDef }) {
  const [faviconFailed, setFaviconFailed] = useState(false)
  const host = hostnameOf(def.url)
  return (
    <a className="docs-source-chip" href={def.url} target="_blank" rel="noreferrer" title={def.label ?? def.url}>
      {host && !faviconFailed ? (
        <img
          className="docs-source-favicon"
          src={`https://www.google.com/s2/favicons?sz=32&domain=${host}`}
          alt=""
          onError={() => setFaviconFailed(true)}
        />
      ) : (
        <Globe className="docs-source-favicon" />
      )}
      {host ?? def.url}
    </a>
  )
}

/** Row of source-domain pills for a document's citation definitions. */
export function CitationSources({ citations }: { citations?: CitationDef[] }) {
  if (!citations?.length) return null
  return (
    <div className="docs-sources">
      {citations.map((def) => (
        <SourceChip key={def.id} def={def} />
      ))}
    </div>
  )
}
