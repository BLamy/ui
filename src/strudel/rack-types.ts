/* The rack's and its controls' change details: types only, apart from StrudelRack.tsx so the player (and the root
   entry's types) can name them without pulling the rack's parser into their module graph. */

/** Why a knob or fader moved: UI SDK's slider reasons, and `"reset-press"` for the double-click reset. */
export type ControlValueChangeReason =
  | "drag"
  | "step-key"
  | "track-press"
  | "accessibility-adjust"
  | "reset-press"
  | "reset"
  | "restore"
  | "imperative"

/** What a knob or fader reports with its new value. The full UI SDK change details (`source`, `cancel`) come
    along where the control has them. */
export interface ControlValueChangeDetails {
  reason: ControlValueChangeReason
  /** The DOM event behind it: the key, the pointer move, the double-click. Undefined for imperative changes. */
  event?: Event
}

/** How a rack edit happened: the reason of the control behind it (a knob or fader's, a select's, a step's), or
    `"remove-press"` for an effect's Remove button. */
export type StrudelRackChangeReason = ControlValueChangeReason | "item-press" | "list-navigation" | "press" | "input-commit" | "remove-press"

/** Which control made a rack edit. */
export type StrudelRackControl = "tempo" | "output" | "gain" | "effect" | "sound" | "key" | "scale" | "steps"

/** What `onValueChange` reports with the edited code. */
export interface StrudelRackChangeDetails {
  reason: StrudelRackChangeReason
  /** The DOM event behind it, when there is one. */
  event?: Event
  control: StrudelRackControl
  /** The track's index in the song, for a track's controls. */
  track?: number
  /** The effect's method (`"lpf"`, `"room"`): its knob, its Remove button, or the one the Add menu added. */
  param?: string
}
