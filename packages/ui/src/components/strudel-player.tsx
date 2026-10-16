/* StrudelPlayer lives in docstream (`@brett_lamy/docstream/strudel`), where ```strudel fences and `.strudel`
   embeds render it. This module is the one place the ui package (and the `strudel-player` registry item) reaches
   it, so `@/components/ui/strudel-player` resolves the same way as every other part. */
export {
  StrudelPlayer, DEFAULT_SAMPLES, playStrudel, stopStrudel, updateStrudel, subscribeStrudel, getStrudelSnapshot, strudelNow,
} from '@brett_lamy/docstream/strudel';
export type { StrudelPlayerProps, StrudelPattern, StrudelHap, StrudelSnapshot } from '@brett_lamy/docstream/strudel';
