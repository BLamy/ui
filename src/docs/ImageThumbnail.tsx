import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ui-sdk/react/hover-card"
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
 * with the full image (UI SDK's Hover Card). First in a paragraph or list item, the text runs beside it.
 */
export function ImageThumbnail({ image, label }: { image: InlineImageNode; label: string }) {
  const src = useAsset(image.src)
  const alt = image.alt ?? ""
  const name = alt || label || "Image"
  const badge = label ? <span className="docs-thumb-badge">{label}</span> : null
  return (
    <HoverCard delay={200} closeDelay={120}>
      <HoverCardTrigger
        className={image.link ? "docs-thumb docs-thumb-link" : "docs-thumb"}
        render={image.link ? <a href={image.link} target="_blank" rel="noreferrer" aria-label={name} /> : <span tabIndex={0} role="img" aria-label={name} />}
      >
        <span className="docs-thumb-frame">
          <img src={src} alt="" loading="lazy" draggable={false} />
          {badge}
        </span>
      </HoverCardTrigger>
      <HoverCardContent render={<span />} className="docs-thumb-card" side="bottom" align="start" sideOffset={10} collisionPadding={16}>
        <img src={src} alt={alt} loading="lazy" />
        {badge}
      </HoverCardContent>
    </HoverCard>
  )
}
