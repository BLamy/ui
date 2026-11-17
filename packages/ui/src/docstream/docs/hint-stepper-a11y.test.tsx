import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "./DocsRenderer"

const html = (markdown: string) => renderToStaticMarkup(<MarkdownContent markdown={markdown} />)

describe("hints and steppers for assistive tech", () => {
  it("a hint is a note whose kind is read before its text", () => {
    const out = html('{% hint style="warning" %}\nThis removes the old flag.\n{% endhint %}')
    expect(out).toContain('class="docs-hint docs-hint-warning" role="note"')
    expect(out).toMatch(/<span class="docs-visually-hidden">Warning: <\/span>.*This removes the old flag\./)
    expect(html('{% hint style="info" %}\nHeads up.\n{% endhint %}')).toContain('<span class="docs-visually-hidden">Note: </span>')
  })

  it("a stepper is an ordered list whose titles are headings at their authored level", () => {
    const out = html(
      ["{% stepper %}", "{% step %}", "## Flip the flag", "", "Body", "{% endstep %}", "{% step %}", "### Ship it", "", "Done", "{% endstep %}", "{% endstepper %}", ""].join("\n"),
    )
    expect(out).toMatch(/<ol class="docs-stepper"><li class="docs-step">/)
    expect(out).toContain('<h2 class="docs-step-title">Flip the flag</h2>')
    expect(out).toContain('<h3 class="docs-step-title">Ship it</h3>')
    // The drawn numbers are the list's own: hidden from screen readers.
    expect(out).toContain('<div class="docs-step-rail" aria-hidden="true">')
  })
})
