import { createElement, useEffect, useState, type ComponentType, type ReactNode } from "react"
import type { SourceRefNode } from "../gitbook/ast"
import type { SourceModule, SourceReferenceClient, StoryLike, StoryMetaLike } from "./types"

export interface SourcePreviewProps {
  reference: SourceRefNode
  client: SourceReferenceClient
  className?: string
  fallback?: ReactNode
  onError?: (error: Error) => void
}

function componentFrom(module: SourceModule, reference: SourceRefNode): { component: ComponentType<Record<string, unknown>>; props: Record<string, unknown> } {
  if (reference.kind === "component") {
    const candidate = reference.exportName === "default" ? module.default : module[reference.exportName]
    if (typeof candidate !== "function") throw new Error(`${reference.path} does not export component ${reference.exportName}`)
    return { component: candidate as ComponentType<Record<string, unknown>>, props: {} }
  }

  const meta = (module.default ?? {}) as StoryMetaLike
  const story = module[reference.exportName] as StoryLike | undefined
  if (!story) throw new Error(`${reference.path} does not export story ${reference.exportName}`)
  const component = story.render ?? meta.render ?? meta.component
  if (typeof component !== "function") throw new Error(`${reference.path}#${reference.exportName} has no renderable component`)
  return {
    component: component as ComponentType<Record<string, unknown>>,
    props: { ...(meta.args ?? {}), ...(story.args ?? {}) },
  }
}

/** Render a component or CSF story directly from a Vite-mounted source file. */
export function SourcePreview({ reference, client, className, fallback = "Loading source…", onError }: SourcePreviewProps) {
  const [renderable, setRenderable] = useState<ReturnType<typeof componentFrom> | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setRenderable(null)
    setError(null)
    void client.importModule(reference).then(
      (module) => {
        if (!cancelled) setRenderable(componentFrom(module, reference))
      },
      (cause: unknown) => {
        const next = cause instanceof Error ? cause : new Error(String(cause))
        if (!cancelled) {
          setError(next)
          onError?.(next)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [client, onError, reference])

  const wrapper = className ? `docs-source-preview ${className}` : "docs-source-preview"
  return (
    <section className={wrapper} data-docstream-source-preview="" data-source-path={reference.path}>
      <header className="docs-source-preview-header">
        <span>{reference.title ?? `${reference.path}#${reference.exportName}`}</span>
        <code>{reference.mount}:{reference.path}</code>
      </header>
      <div className="docs-source-preview-body">
        {error ? <pre className="docs-source-preview-error">{error.message}</pre> : renderable ? createElement(renderable.component, renderable.props) : fallback}
      </div>
    </section>
  )
}
