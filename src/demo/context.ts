import { createContext, useContext } from "react"
import type { DemoResolver } from "./types"

/**
 * The host's demo resolver. Renderers given a `demoResolver` prop provide it, so
 * nested renderers (Markdown inside tabs, hints, a demo's own Markdown) inherit it.
 */
export const DocstreamDemoContext = createContext<DemoResolver | undefined>(undefined)

export function useDemoResolver(override?: DemoResolver): DemoResolver | undefined {
  const inherited = useContext(DocstreamDemoContext)
  return override ?? inherited
}
