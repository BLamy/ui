/* Runs a `{% demo %}` block's inline files in almost-node — the Preview of a pasted,
   self-contained demo when no resolver knows it. Just the iframe: the DemoViewer around it
   supplies the header, variants, viewports, Code view and fullscreen. */
import { useMemo, type ReactNode } from "react"

import type { DemoFile, InlineDemoRuntime, InlineDemoRuntimeProps } from "../demo/types"
import { createInlineDemoProject, type AlmostNodeWorkspaceOptions } from "./filesystem"
import { useAlmostNodeServer } from "./ReactCodePreview"

export interface InlineDemoPreviewProps extends InlineDemoRuntimeProps {
  /** Preferred virtual port. almost-node picks the next free one if taken. */
  port?: number
  /** iframe sandbox value (same-origin lets the almost-node service worker route it). */
  sandbox?: string
  /** Extra options for `createAlmostNodeWorkspace` (e.g. `basePath` for static hosting). */
  workspaceOptions?: Partial<AlmostNodeWorkspaceOptions>
}

function filesKey(files: DemoFile[], entry: string, dependencies: Record<string, string> | undefined) {
  return JSON.stringify([entry, dependencies ?? null, files.map((f) => [f.path, f.content])])
}

export function InlineDemoPreview({
  title,
  files,
  entry,
  variant,
  dependencies,
  port = 4173,
  sandbox = "allow-scripts allow-same-origin allow-forms allow-modals",
  workspaceOptions,
}: InlineDemoPreviewProps) {
  // Content-keyed so re-renders (variant switches, parent state) never restart Vite.
  const key = filesKey(files, entry, dependencies)
  const project = useMemo(
    () => {
      try {
        return { value: createInlineDemoProject(files, { entry, dependencies }) }
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  const { state, url, error } = useAlmostNodeServer({
    files: project.value?.files ?? {},
    port,
    run: project.value ? 1 : 0,
    workspaceOptions,
  })

  const message = project.error ?? error
  if (message) return <pre className="docs-demo-error" role="alert">{message}</pre>
  if (state !== "ready" || !url) {
    return <div className="docs-demo-runtime-status" role="status">Starting almost-node…</div>
  }
  const src = project.value?.wrapped && variant !== undefined ? `${url}?variant=${encodeURIComponent(variant)}` : url
  return <iframe key={src} title={title} className="docs-demo-runtime-frame" src={src} sandbox={sandbox} />
}

export interface AlmostNodeDemoRuntimeOptions {
  port?: number
  sandbox?: string
  workspaceOptions?: Partial<AlmostNodeWorkspaceOptions>
}

/**
 * An `InlineDemoRuntime` backed by almost-node (`@agent-wasm/core`, loaded lazily on first
 * use). Pass it as `demoRuntime`; `PlaygroundStreamdown` uses one with default options.
 */
export function createAlmostNodeDemoRuntime(options: AlmostNodeDemoRuntimeOptions = {}): InlineDemoRuntime {
  return (props): ReactNode => <InlineDemoPreview {...props} {...options} />
}

/** The default almost-node runtime (no base path, port 4173+). */
export const almostNodeDemoRuntime: InlineDemoRuntime = createAlmostNodeDemoRuntime()
