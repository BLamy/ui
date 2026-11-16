import { Icon, type IconProps } from "@brett_lamy/ui/lib/icon"

/* The kit's Icon in the editor's chrome, drawn at 1.15× in the same box (`[data-docstream-glyph]`, docstream's
   tokens.css), as docstream's own glyphs are (docstream/ui/glyph.tsx). */
export function Glyph({ size = 24, ...props }: IconProps) {
  return <Icon {...props} size={size} data-docstream-glyph="" />
}
