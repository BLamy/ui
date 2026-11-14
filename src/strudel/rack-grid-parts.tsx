"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { rackGrid } from "./rack-grid"

/** @internal */
export const {
  Root: RackGridRoot,
  Item: RackGridItem,
  Grip: RackGridGrip,
  Corner: RackGridCorner,
} = createParts(rackGrid, { root: "div", item: "div", grip: "button", corner: "button" })

