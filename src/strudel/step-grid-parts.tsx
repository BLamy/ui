"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { stepGrid } from "./step-grid"

/** @internal */
export const { Root: StepGridRoot, Cell: StepGridCell, Editor: StepGridEditor } = createParts(stepGrid, {
  root: "div",
  cell: "button",
  editor: "input",
})

