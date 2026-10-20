import { useContext } from "react"

import type { LivePreviewRenderer } from "../docs/DocsRenderer"
import { DocstreamDemoRuntimeContext } from "../demo/context"
import { GitbookStreamdown, type GitbookStreamdownProps } from "../streamdown"
import { almostNodeDemoRuntime } from "./InlineDemoPreview"
import { ReactCodePreview } from "./ReactCodePreview"

export type PlaygroundStreamdownProps = GitbookStreamdownProps

/**
 * A `LivePreviewRenderer` that runs `live` React/JSX/TSX code fences in almost-node.
 * Pass it as `liveRenderer` to the root `GitbookStreamdown` / `DocsRenderer` (or the editor).
 */
export const almostNodeLiveRenderer: LivePreviewRenderer = ({ files, entry, title, collapsedCodeLines, expandedCodeLines }) => (
  <ReactCodePreview
    files={files}
    entry={entry}
    title={title}
    collapsedCodeLines={collapsedCodeLines}
    expandedCodeLines={expandedCodeLines}
  />
)

/**
 * `GitbookStreamdown` with the almost-node playground wired in: live code fences and
 * `{% demo %}` blocks with inline files (and no resolver) run in almost-node
 * (`@agent-wasm/core`, an optional peer dependency — install it to use this entry).
 * Explicit `liveRenderer` / `demoRuntime` props (or an outer runtime context) still win.
 */
export function PlaygroundStreamdown({ liveRenderer, demoRuntime, ...props }: PlaygroundStreamdownProps) {
  const inheritedRuntime = useContext(DocstreamDemoRuntimeContext).runtime
  return (
    <GitbookStreamdown
      {...props}
      liveRenderer={liveRenderer ?? almostNodeLiveRenderer}
      demoRuntime={demoRuntime ?? inheritedRuntime ?? almostNodeDemoRuntime}
    />
  )
}
