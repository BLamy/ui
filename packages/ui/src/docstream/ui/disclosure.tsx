"use client"

/* A disclosure whose root renders no element: UI SDK's collapsible primitive with just its trigger and panel, for
   places where the button and what it shows sit apart in the markup (a toolbar button and a panel under the bar).
   Where a wrapping element is fine, use `Collapsible` from `@ui-sdk/react/collapsible`: same parts, same attributes
   (`data-slot="collapsible-trigger"`, `data-slot="collapsible-panel"`, `data-open` / `data-closed`). */
import { collapsible } from "@ui-sdk/core/collapsible"
import { createParts } from "@ui-sdk/react/primitive"

const { Root: Disclosure, Trigger: DisclosureTrigger, Panel: DisclosurePanel } = createParts(collapsible, {
  trigger: "button",
  panel: "div",
})

export { Disclosure, DisclosurePanel, DisclosureTrigger }
