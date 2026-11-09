import type { ComponentType } from "react"
import type { SourceRefNode } from "../gitbook/ast"

export interface SourceProvenance {
  mount: string
  path: string
  exportName: string
  kind: SourceRefNode["kind"]
  absolutePath?: string
  mtimeMs?: number
}

export interface SourceFileSnapshot {
  content: string
  provenance: SourceProvenance
}

export interface SourceModule {
  default?: unknown
  [exportName: string]: unknown
}

export interface SourceReferenceClient {
  read(reference: SourceRefNode): Promise<SourceFileSnapshot>
  write(reference: SourceRefNode, content: string): Promise<SourceFileSnapshot>
  importModule(reference: SourceRefNode): Promise<SourceModule>
}

export interface StoryLike {
  args?: Record<string, unknown>
  render?: ComponentType<Record<string, unknown>> | ((args: Record<string, unknown>) => unknown)
}

export interface StoryMetaLike {
  args?: Record<string, unknown>
  component?: ComponentType<Record<string, unknown>>
  render?: ComponentType<Record<string, unknown>> | ((args: Record<string, unknown>) => unknown)
}
