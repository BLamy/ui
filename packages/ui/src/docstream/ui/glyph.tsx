import { Icon, type IconProps } from "@brett_lamy/ui/lib/icon"

/* The kit's Icon in docstream's and the editor's own chrome. The kit draws a glyph inside its 24px box with the margin
   SF Symbols keeps; docstream's chrome was laid out around glyphs that fill more of the box, so a glyph here is drawn
   at 1.15× (`[data-docstream-glyph]` in tokens.css): the same box, the same alignment, and the size and stroke weight
   readers had before. Layout is untouched (a CSS `scale`), and kit icons inside a document (a demo's) are left alone. */
export function Glyph({ size = 24, ...props }: IconProps) {
  return <Icon {...props} size={size} data-docstream-glyph="" />
}
