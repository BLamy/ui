"use client"

/* Which color scheme an element sits in, for widgets that have to hand concrete colors to something CSS can't reach
   (a sandboxed iframe, a canvas). The nearest ancestor that says so wins: `.dark` / `.light`, or `data-theme` /
   `data-appearance` set to "dark" / "light" (DocsSite, shadcn and next-themes hosts). Without one, the element's
   computed `color-scheme` decides; "light dark" (or nothing at all on a page that follows the system) defers to
   `prefers-color-scheme`. It follows changes to those attributes on every ancestor and to the system setting. */
import { useEffect, useLayoutEffect, useState } from "react"

export type Appearance = "auto" | "light" | "dark"
export type ColorScheme = "light" | "dark"

const MARKED = '.dark, .light, [data-theme="dark"], [data-theme="light"], [data-appearance="dark"], [data-appearance="light"]'
const DARK = '.dark, [data-theme="dark"], [data-appearance="dark"]'
const ATTRIBUTES = ["class", "style", "data-theme", "data-appearance"]

const systemDark = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches

/** The scheme `element` renders in. Its own markers are skipped, so a widget may mark itself with what it found. */
export function colorSchemeOf(element: Element): ColorScheme {
  const marked = element.parentElement?.closest(MARKED)
  if (marked) return marked.matches(DARK) ? "dark" : "light"
  const declared = typeof getComputedStyle === "function" ? getComputedStyle(element).colorScheme ?? "" : ""
  const dark = /\bdark\b/.test(declared)
  const light = /\blight\b/.test(declared)
  if (dark && !light) return "dark"
  if (light && !dark) return "light"
  return systemDark() ? "dark" : "light"
}

// Measure before paint on the client, so a dark page never flashes the light fallback.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Resolves an `appearance` prop. "light" and "dark" are returned as given; "auto" measures the element passed to the
 * returned ref callback and follows it. Before the element mounts (and on the server) "auto" is `fallback`.
 */
export function useColorScheme(appearance: Appearance = "auto", fallback: ColorScheme = "light"): [ref: (element: HTMLElement | null) => void, scheme: ColorScheme] {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [detected, setDetected] = useState<ColorScheme | null>(null)
  const auto = appearance !== "light" && appearance !== "dark"

  useIsoLayoutEffect(() => {
    if (!auto || !element) return
    const update = () => setDetected(colorSchemeOf(element))
    update()
    const observer = typeof MutationObserver === "function" ? new MutationObserver(update) : null
    for (let parent = element.parentElement; parent && observer; parent = parent.parentElement) {
      observer.observe(parent, { attributes: true, attributeFilter: ATTRIBUTES })
    }
    const media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined
    media?.addEventListener?.("change", update)
    return () => {
      observer?.disconnect()
      media?.removeEventListener?.("change", update)
    }
  }, [auto, element])

  return [setElement, auto ? detected ?? fallback : appearance]
}
