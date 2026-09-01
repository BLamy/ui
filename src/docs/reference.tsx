import { createContext, useContext, useState, type ReactNode } from "react"
import { AtSign, Globe, Hash } from "lucide-react"

import type { CitationDef, ReferenceNode } from "../gitbook/ast"

export interface DocstreamRefContextValue {
  /** Called when a mention/tag chip (or a citation, if it has no url) is clicked. */
  onReferenceClick?: (ref: ReferenceNode) => void
  /** Full override for chip rendering; return null to fall back to the default. */
  renderReference?: (ref: ReferenceNode) => ReactNode | null
}

export const DocstreamRefContext = createContext<DocstreamRefContextValue>({})

export function InlineReference({ node }: { node: ReferenceNode }) {
  const { onReferenceClick, renderReference } = useContext(DocstreamRefContext)
  const custom = renderReference?.(node)
  if (custom != null) return <>{custom}</>

  if (node.kind === "citation") {
    // Citations default to linking their source; hosts can still observe clicks.
    if (node.url) {
      return (
        <a
          className="docs-cite"
          href={node.url}
          target="_blank"
          rel="noreferrer"
          title={node.label ?? node.url}
          onClick={() => onReferenceClick?.(node)}
        >
          {node.id}
        </a>
      )
    }
    // Definition missing (not yet streamed, or standalone parseInline call).
    return (
      <span className="docs-cite" onClick={() => onReferenceClick?.(node)}>
        {node.id}
      </span>
    )
  }

  const Icon = node.kind === "mention" ? AtSign : Hash
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
