import { createContext, useContext } from "react"
import type { DemoResolver, DemoRuntimeOptions } from "./types"

/**
 * The host's demo resolver. Renderers given a `demoResolver` prop provide it, so
 * nested renderers (Markdown inside tabs, hints, a demo's own Markdown) inherit it.
 */
export const DocstreamDemoContext = createContext<DemoResolver | undefined>(undefined)

export function useDemoResolver(override?: DemoResolver): DemoResolver | undefined {
  const inherited = useContext(DocstreamDemoContext)
  return override ?? inherited
}

/**
 * How inline-file demos without a resolver run their Preview (`demoRuntime`) and which
 * extra npm packages they may import (`demoDependencies`). Provided by the renderers.
 */
export const DocstreamDemoRuntimeContext = createContext<DemoRuntimeOptions>({})

export function useDemoRuntime(override?: DemoRuntimeOptions): DemoRuntimeOptions {
  const inherited = useContext(DocstreamDemoRuntimeContext)
  return {
    runtime: override?.runtime ?? inherited.runtime,
    dependencies: override?.dependencies || inherited.dependencies
      ? { ...inherited.dependencies, ...override?.dependencies }
      : undefined,
  }
}

/**
 * Demo files held in memory by `src` (a `DemoVFS`), e.g. demos pasted from another page or
 * editor. `DemoViewer` falls back to them when a block has no inline files; the host
 * resolver still wins when it knows `src`. Provided by renderers' / editors' `demoVFS`.
 */
export const DocstreamDemoVFSContext = createContext<import("./vfs").DemoVFS | undefined>(undefined)
