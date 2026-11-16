"use client"

import type { OptionsOf, StateOf } from "@ui-sdk/core"
import { usePart, usePrimitive, type PartProps, type PrimitiveHandle } from "@ui-sdk/react/primitive"
import { orbit } from "./orbit"

type OrbitHandle = PrimitiveHandle<typeof orbit>

/** The orbit's instance, for a viewer that draws from `orbit.api.getView()` and renders its surface elsewhere. */
function useOrbit(options: OptionsOf<typeof orbit>): OrbitHandle {
  return usePrimitive(orbit, options)
}

function OrbitCanvas({ orbit: handle, ...props }: { orbit: OrbitHandle } & PartProps<"canvas", StateOf<typeof orbit, "root">>) {
  return usePart(handle, "root", {}, props, "canvas")
}

export { OrbitCanvas, useOrbit, type OrbitHandle }
