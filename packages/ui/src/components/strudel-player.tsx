/* StrudelPlayer lives in docstream (`@brett_lamy/ui/docstream/strudel`, the library's own entry, imported by the package's
   name because the registry doesn't copy docstream), where ```strudel fences and `.strudel`
   embeds render it. This module re-exports the player and the functions that drive its one shared runtime from your
   own controls. The rack, its hardware and the syntax tree are imported from `@brett_lamy/ui/docstream/strudel/rack`. */
export {
  StrudelPlayer, playStrudel, stopStrudel, updateStrudel, subscribeStrudel, getStrudelSnapshot,
} from '@brett_lamy/ui/docstream/strudel';
export type {
  StrudelPlayerProps, StrudelCodeChangeDetails, StrudelPanelChangeReason, StrudelSnapshot,
} from '@brett_lamy/ui/docstream/strudel';
