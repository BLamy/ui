import { MarkdownContent } from "@brett_lamy/docstream"
import { memoryResolver } from "./memoryResolver"

// Markdown rendered with its own resolver. The prop overrides the site's resolver from
// context for everything inside, so `memory/greeting` resolves here and nowhere else.
const MARKDOWN = `{% demo src="memory/greeting" %}

When \`load\` rejects (an unknown \`src\`, no inline files to fall back on), the error renders in place of the preview:

{% demo src="memory/missing" %}
`

export default function CustomResolver() {
  return <MarkdownContent markdown={MARKDOWN} demoResolver={memoryResolver} documentProperties={false} />
}
