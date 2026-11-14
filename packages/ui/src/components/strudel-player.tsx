/* StrudelPlayer lives in docstream (`@brett_lamy/docstream/strudel`), where ```strudel fences and `.strudel`
   embeds render it. This module re-exports the player and the functions that drive its one shared runtime from your
   own controls. The rack, its hardware and the syntax tree are imported from `@brett_lamy/docstream/strudel`. */
export {
  StrudelPlayer, playStrudel, stopStrudel, updateStrudel, subscribeStrudel, getStrudelSnapshot,
} from '@brett_lamy/docstream/strudel';
export type { StrudelPlayerProps, StrudelSnapshot } from '@brett_lamy/docstream/strudel';
