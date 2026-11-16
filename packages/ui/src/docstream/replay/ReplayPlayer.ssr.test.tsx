/* The player renders on a server (no DOM): the scrubber, the buttons and an open DevTools panel come out with their
   roles and names, so the page is right before it hydrates. Runs in Node, without a document. */
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { replayDemoEvents } from "./demo"
import { ReplayPreview } from "./ReplayPreview"

describe("server rendering", () => {
  it("has no document to lean on", () => {
    expect(typeof document).toBe("undefined")
  })

  it("renders the scrubber as a slider and the DevTools buttons as toggles", () => {
    const html = renderToString(<ReplayPreview events={replayDemoEvents} mounted initialTime={8000} />)
    expect(html).toContain('data-slot="replay-preview-scrubber"')
    expect(html).toMatch(/<input[^>]*aria-label="Playback position"[^>]*role="slider"|<input[^>]*role="slider"[^>]*aria-label="Playback position"/)
    expect(html).toContain('data-part="replay-devtools-buttons"')
    expect(html).toMatch(/data-part="replay-devtools-button"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*data-part="replay-devtools-button"/)
  })

  it("renders an open panel: the separator, the tabs, the selected pane and its controls", () => {
    const html = renderToString(<ReplayPreview events={replayDemoEvents} mounted initialTime={8000} defaultDevtoolsTab="network" />)
    expect(html).toContain('data-slot="replay-devtools"')
    expect(html).toMatch(/data-slot="replay-devtools-resize"[^>]*role="separator"|role="separator"[^>]*data-slot="replay-devtools-resize"/)
    expect(html).toContain("--replay-devtools-height:58%")
    expect(html).toContain('role="tablist"')
    expect(html).toContain('role="tabpanel"')
    expect(html).toContain('data-pane="network"')
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('role="grid"')
    // One row holds the table's tab stop before any script runs.
    expect(html.match(/data-slot="replay-devtools-table-row"[^>]*tabindex="0"|tabindex="0"[^>]*data-slot="replay-devtools-table-row"/g)).toHaveLength(1)
    const consoleHtml = renderToString(<ReplayPreview events={replayDemoEvents} mounted initialTime={8000} defaultDevtoolsTab="console" />)
    expect(consoleHtml).toContain('role="combobox"')
    expect(consoleHtml).toContain("All levels")
    expect(consoleHtml).toContain('role="log"')
  })
})
