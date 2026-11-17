"use client"

import { useEffect, useState } from "react"
import { PeleDiagram } from "../docs/Mermaid"
import { SplitCard, SplitResult, SplitSource } from "../docs/SplitCard"
import { useHydrated } from "../ui/details-collapsible"
import { useColorScheme } from "../ui/use-color-scheme"

/* An ```xstate fence: the machine drawn by the library's StateDiagram, read-only, from its source. The same reading
   (`parseXState`) and the same drawing (`machineToDraft`: the machine's context under its name, each state a card with its
   entry and exit actions, invokes and tags, each transition a pill or a card with its guard and actions) as a StateDiagram
   in an app. The diagram comes from `@brett_lamy/ui/state-diagram` by a dynamic import when the first fence is shown, and
   it lays the machine out with ELK and makes it with XState, the library's optional peers. Where the diagram can't load,
   the fence falls back to its text form, a Mermaid statechart (`./machine`'s `xstateToMermaid`). The board is styled by
   the library's stylesheet (`@brett_lamy/ui/styles.css`), the card around it by docstream's. */

/** How the board picks its colors: "auto" follows the page (the nearest `.dark` / `.light` or `data-theme`, else `color-scheme`). */
export type XStateAppearance = "auto" | "light" | "dark"

export interface XStateDiagramProps {
  code: string
  /**
   * Light or dark board. "auto" (the default) follows the page, as docstream's other widgets do.
   * @defaultValue "auto"
   */
  appearance?: XStateAppearance
}
export const isXStateLanguage = (language?: string | null) => language?.toLowerCase() === "xstate"

type StateDiagramModule = typeof import("@brett_lamy/ui/state-diagram")

let loaded: StateDiagramModule | null = null
let loading: Promise<StateDiagramModule> | null = null
const loadStateDiagram = () => (loading ??= import("@brett_lamy/ui/state-diagram").then((m) => (loaded = m)))

/** The StateDiagram once it's here: at once after the first, so a second fence never flashes "Drawing". Not while
 *  hydrating: the server drew none. */
function useStateDiagram(): StateDiagramModule | Error | null {
  const hydrated = useHydrated()
  const [state, setState] = useState<StateDiagramModule | Error | null>(null)
  useEffect(() => {
    let live = true
    loadStateDiagram().then((m) => live && setState(m), (e: unknown) => live && setState(e instanceof Error ? e : new Error(String(e))))
    return () => { live = false }
  }, [])
  return state ?? (hydrated ? loaded : null)
}

/** The text form, for where the library's diagram can't load: a Mermaid statechart from the same model. */
function MermaidFallback({ code }: { code: string }) {
  const [result, setResult] = useState<{ source: string; diagram?: string; error?: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    import("./machine").then(({ xstateToMermaid }) => {
      if (!cancelled) setResult({ source: code, diagram: xstateToMermaid(code) })
    }).catch((error: unknown) => {
      if (!cancelled) setResult({ source: code, error: error instanceof Error ? error.message : String(error) })
    })
    return () => { cancelled = true }
  }, [code])
  if (result?.source === code && result.diagram) return <PeleDiagram code={result.diagram} />
  return result?.source === code && result.error
    ? <pre className="docs-mermaid-error" role="alert">{result.error}</pre>
    : <div className="docs-mermaid docs-mermaid-pending" role="status">Drawing statechart…</div>
}

/** The result pane shared by Markdown and the live editor: the machine on a read-only StateDiagram. */
export function XStatePreview({ code, appearance }: XStateDiagramProps) {
  const library = useStateDiagram()
  const [measureScheme, scheme] = useColorScheme(appearance)
  let board
  if (library instanceof Error) board = <MermaidFallback code={code} />
  else if (library) {
    board = (
      <div ref={measureScheme} className={`docs-xstate-board ${scheme}`} data-appearance={scheme}>
        <library.StateDiagram source={code} defaultPanelOpen={false} />
      </div>
    )
  } else board = <div className="docs-xstate-board docs-mermaid docs-mermaid-pending" role="status">Drawing statechart…</div>
  return <SplitResult label="XState" className="docs-xstate-result">{board}</SplitResult>
}

export function XStateDiagram({ code, appearance }: XStateDiagramProps) {
  return <SplitCard className="docs-xstate-preview" data-docstream-xstate="">
    <SplitSource label="XState" code={code} language="typescript" />
    <XStatePreview code={code} appearance={appearance} />
  </SplitCard>
}
