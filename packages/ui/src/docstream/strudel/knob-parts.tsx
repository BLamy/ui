"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { knob } from "./knob"

/** @internal */
export const { Root: KnobRoot, Dial: KnobDial, Value: KnobValue } = createParts(knob, { root: "div", dial: "div", value: "span" })

