"use client"

/* The player's two panels (equipment, code) open from buttons in its bar and render under it, side by side in
   the markup. Each is UI SDK's collapsible primitive, held by a handle rather than a root around its parts: two
   roots can't both wrap a bar that holds both buttons, since a part belongs to the nearest root. */
import type { OptionsOf, StateOf } from "@ui-sdk/core"
import { collapsible } from "@ui-sdk/core/collapsible"
import { usePart, usePrimitive, type PartProps, type PrimitiveHandle } from "@ui-sdk/react/primitive"

type PanelHandle = PrimitiveHandle<typeof collapsible>

function usePanel(options: OptionsOf<typeof collapsible>): PanelHandle {
  return usePrimitive(collapsible, options)
}

function PanelTrigger({ panel, ...props }: { panel: PanelHandle } & PartProps<"button", StateOf<typeof collapsible, "trigger">>) {
  return usePart(panel, "trigger", {}, props, "button")
}

function Panel({ panel, ...props }: { panel: PanelHandle } & PartProps<"div", StateOf<typeof collapsible, "panel">>) {
  return usePart(panel, "panel", {}, props, "div")
}

export { Panel, PanelTrigger, usePanel, type PanelHandle }
