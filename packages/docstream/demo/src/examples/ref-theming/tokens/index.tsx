import { MarkdownContent } from "@brett_lamy/docstream"
import "./themes.css"
import { sample } from "./sample"

// One document, three themes. Nothing about the Markdown changes — only CSS custom properties.
export default function ThemedDocument({ variant = "default" }: { variant?: string }) {
  if (variant === "midnight") {
    // Host (shadcn-style) tokens on a wrapper; docstream's --gb-* tokens read them.
    return (
      <div className="ref-theme-frame ref-theme-midnight">
        <MarkdownContent markdown={sample} />
      </div>
    )
  }
  if (variant === "brand") {
    // --gb-* tokens set on the [data-docstream] element itself through className.
    return (
      <div className="ref-theme-frame">
        <MarkdownContent className="ref-theme-brand" markdown={sample} />
      </div>
    )
  }
  // No tokens at all: docstream's built-in light defaults.
  return (
    <div className="ref-theme-frame">
      <MarkdownContent markdown={sample} />
    </div>
  )
}
