/* `@brett_lamy/ui/docstream/strudel`: the player and the one shared runtime that drives it. The rack, its hardware and
   the syntax tree (which bring the parser, acorn) are `@brett_lamy/ui/docstream/strudel/rack`. */
export { StrudelPlayer } from "./StrudelPlayer"
export type { StrudelCodeChangeDetails, StrudelPanelChangeReason, StrudelPlayerProps } from "./StrudelPlayer"
export type { StrudelRackChangeDetails, StrudelRackChangeReason, StrudelRackControl } from "./rack-types"
export {
  DEFAULT_SAMPLES,
  getStrudelSnapshot,
  playStrudel,
  stopStrudel,
  strudelNow,
  subscribeStrudel,
  updateStrudel,
} from "./engine"
export type { StrudelHap, StrudelPattern, StrudelSnapshot } from "./engine"
export { isStrudelFile, isStrudelLanguage } from "./url"
