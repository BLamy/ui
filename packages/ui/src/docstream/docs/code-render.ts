import { createContext, type ReactNode } from "react"
import type { CodeBlockNode } from "../gitbook/ast"

/** What `renderCode` gets with the fence. */
export interface CodeBlockRenderDetails {
  /** `"block"`: a fence on its own, drawn whole (header, copy button and code). `"tab"`: one tab of a code-only
      tab set, where only the panel's body is yours: the tab strip, the title and the copy button stay docstream's. */
  placement: "block" | "tab"
  /** Docstream's own highlighted `<code>` for this fence, to put inside your chrome if you only want to frame it. */
  highlighted: ReactNode
}

/**
 * Draws a fenced code block yourself (a host's code editor, its own highlighter). Return `null` or `undefined`
 * to fall back to docstream's rendering, as `renderReference` does. Widget fences (mermaid, xstate, tscircuit,
 * strudel, tui and live React fences) keep their widgets and never reach it.
 */
export type CodeBlockRenderer = (block: CodeBlockNode, details: CodeBlockRenderDetails) => ReactNode | null | undefined

/** @internal The renderer in effect; nested renderers (OpenAPI descriptions, demos) inherit it. */
export const CodeRenderContext = createContext<CodeBlockRenderer | undefined>(undefined)
