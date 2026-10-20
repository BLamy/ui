// A host-supplied resolver for asset URLs in a document: an app that opens Markdown from a
// folder maps "./models/part.stl" to a blob: URL of that file. Without one (or when it
// returns nothing for a URL), `resolveAsset` applies.
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react"
import { resolveAsset } from "./assets"

/** Returns the URL to load for `url` as written in the document, or nothing to use the default. */
export type AssetResolver = (url: string) => string | null | undefined | Promise<string | null | undefined>

export const AssetResolverContext = createContext<AssetResolver | null>(null)

export function AssetResolverProvider({ resolve, children }: { resolve: AssetResolver | null | undefined; children?: ReactNode }) {
  return createElement(AssetResolverContext.Provider, { value: resolve ?? null }, children)
}

type Resolved = { url: string; src: string | undefined }

/** The loadable URL for `url`, or undefined while the host's resolver is still working on it. */
export function useAsset(url: string): string | undefined {
  const resolve = useContext(AssetResolverContext)
  const first = (): Resolved => {
    if (!resolve || !url) return { url, src: resolveAsset(url) }
    const out = resolve(url)
    if (out instanceof Promise) return { url, src: undefined }
    return { url, src: out ?? resolveAsset(url) }
  }
  const [state, setState] = useState<Resolved>(first)
  useEffect(() => {
    if (!resolve || !url) {
      setState({ url, src: resolveAsset(url) })
      return
    }
    let live = true
    const out = resolve(url)
    if (!(out instanceof Promise)) {
      setState({ url, src: out ?? resolveAsset(url) })
      return
    }
    setState((prev) => (prev.url === url ? prev : { url, src: undefined }))
    out.then(
      (src) => live && setState({ url, src: src ?? resolveAsset(url) }),
      () => live && setState({ url, src: resolveAsset(url) }),
    )
    return () => {
      live = false
    }
  }, [resolve, url])
  return state.url === url ? state.src : undefined
}
