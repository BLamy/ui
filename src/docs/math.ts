import katex from "katex"

export function renderMathToHtml(formula: string): string {
  return katex.renderToString(formula, {
    displayMode: true,
    throwOnError: false,
    output: "htmlAndMathml",
  })
}
