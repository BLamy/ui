import type { Inline } from "./ast"
import { plainText } from "./inline"

const THUMBNAIL = /^thumbnail(?:\s*:\s*(.*))?$/i

/**
 * The badge of a thumbnail image, or `null` when the image isn't one. An image is a thumbnail when its
 * Markdown title starts with `thumbnail`: `![Overview](shot.jpg "thumbnail")`, or with a badge,
 * `![Overview](shot.jpg "thumbnail: 0:39.8")`. Elsewhere the title is just a tooltip.
 */
export function thumbnailLabel(node: Inline): string | null {
  if (node.type !== "image" || !node.title) return null
  const match = THUMBNAIL.exec(node.title.trim())
  return match ? (match[1]?.trim() ?? "") : null
}

/** A step's title from its heading: the plain text, without thumbnail images (they show beside it). */
export function stepTitleText(nodes: Inline[]): string {
  return plainText(nodes.filter((n) => thumbnailLabel(n) === null)).trim()
}
