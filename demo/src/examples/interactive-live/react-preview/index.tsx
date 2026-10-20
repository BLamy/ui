/* A multi-file React project running in almost-node. The playground entry is imported lazily,
   so the @agent-wasm/core runtime only downloads when this demo scrolls into view. */
import { Suspense, lazy } from "react"
import { PROJECTS } from "./projects"

const ReactCodePreview = lazy(() =>
  import("@brett_lamy/docstream/playground").then((m) => ({ default: m.ReactCodePreview })),
)

// Stable identity — it lands in the preview's effect deps. `basePath` lets the service
// worker route previews when the site is served from a sub-path (here /docstream/).
const WORKSPACE_OPTIONS = { basePath: import.meta.env.BASE_URL.replace(/\/$/, "") }

export default function ReactPreview({ variant = "counter" }: { variant?: string }) {
  const project = PROJECTS[variant] ?? PROJECTS.counter
  return (
    <Suspense fallback={<p style={{ fontSize: 13, opacity: 0.6 }}>Loading the almost-node runtime…</p>}>
      <ReactCodePreview
        key={variant}
        files={project.files}
        entry={project.entry}
        codeFile={project.codeFile}
        title={project.title}
        height={300}
        expandedCodeLines={40}
        workspaceOptions={WORKSPACE_OPTIONS}
      />
    </Suspense>
  )
}
