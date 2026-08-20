import type { SourceRefNode } from "../gitbook/ast"
import type { SourceFileSnapshot, SourceReferenceClient, SourceModule } from "./types"

function params(reference: SourceRefNode): URLSearchParams {
  return new URLSearchParams({
    mount: reference.mount,
    path: reference.path,
    export: reference.exportName,
    kind: reference.kind,
  })
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error((await response.text()) || `Docstream source request failed (${response.status})`)
  return response.json() as Promise<T>
}

/** Create a browser client for the endpoints installed by `docstreamSources()`. */
export function createViteSourceClient(apiBase = "/@docstream"): SourceReferenceClient {
  const base = apiBase.replace(/\/$/, "")
  return {
    async read(reference) {
      return json<SourceFileSnapshot>(await fetch(`${base}/source?${params(reference)}`))
    },
    async write(reference, content) {
      return json<SourceFileSnapshot>(
        await fetch(`${base}/source?${params(reference)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        }),
      )
    },
    async importModule(reference) {
      const url = `${base}/module?${params(reference)}&t=${Date.now()}`
      const loaded = await import(/* @vite-ignore */ url) as { default?: SourceModule }
      return loaded.default ?? (loaded as SourceModule)
    },
  }
}
