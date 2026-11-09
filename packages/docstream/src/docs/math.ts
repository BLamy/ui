/* KaTeX lives behind this module, which DocsRenderer loads with a dynamic import the
   first time a page has a math block — pages without math never download KaTeX. */
import katex from "katex"
import "katex/dist/katex.min.css"

export function renderMathToHtml(formula: string): string {
  return katex.renderToString(formula, {
    displayMode: true,
    throwOnError: false,
    output: "htmlAndMathml",
  })
}
