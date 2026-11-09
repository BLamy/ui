import type { CodeBlockNode } from "../gitbook/ast"

/** A `tui` language or standalone `tui` fence marker opts source into an interactive terminal. */
export function isTuiCodeBlock(block: Pick<CodeBlockNode, "language" | "info">): boolean {
  if (block.language?.toLowerCase() === "tui") return true
  // Attribute values such as title="A tui example" must never opt a fence into execution.
  const tokens = block.info?.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "").split(/\s+/) ?? []
  return tokens.some((token) => token.toLowerCase() === "tui")
}
