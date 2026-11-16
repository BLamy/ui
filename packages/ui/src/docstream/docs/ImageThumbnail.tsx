import { useId } from "react"
import type { Inline, InlineImageNode } from "../gitbook/ast"
import { useAsset } from "../asset-resolver"
import { thumbnailLabel } from "../gitbook/thumbnail"

export { thumbnailLabel }

/** The paragraph's leading thumbnail (whitespace before it ignored) and the inlines after it. */
export function leadingThumbnail(nodes: Inline[]): { image: InlineImageNode; label: string; rest: Inline[] } | null {
  const at = nodes.findIndex((n) => !(n.type === "text" && !n.text.trim()))
  const first = nodes[at]
  if (!first || first.type !== "image") return null
  const label = thumbnailLabel(first)
  if (label === null) return null
  const rest = nodes.slice(at + 1)
  // Drop the space that separated the image from the text.
  if (rest[0]?.type === "text") rest[0] = { ...rest[0], text: rest[0].text.replace(/^\s+/, "") }
  return { image: first, label, rest }
}

/**
 * A small framed image with an optional badge (a timestamp, say); hovering or focusing it opens a card
 * with the full image. First in a paragraph or list item, the text runs beside it.
 */
export function ImageThumbnail({ image, label }: { image: InlineImageNode; label: string }) {
  const src = useAsset(image.src)
  const cardId = useId()
  const alt = image.alt ?? ""
  const badge = label ? <span className="docs-thumb-badge">{label}</span> : null
  const thumb = (
    <span className="docs-thumb" tabIndex={0} role="img" aria-label={alt || label || "Image"} aria-describedby={cardId}>
      <span className="docs-thumb-frame">
        <img src={src} alt="" loading="lazy" draggable={false} />
        {badge}
      </span>
      <span className="docs-thumb-card" id={cardId} role="tooltip">
        <img src={src} alt={alt} loading="lazy" />
        {badge}
      </span>
    </span>
  )
  return image.link ? (
    <a href={image.link} target="_blank" rel="noreferrer" className="docs-thumb-link">
      {thumb}
    </a>
  ) : (
    thumb
  )
}
