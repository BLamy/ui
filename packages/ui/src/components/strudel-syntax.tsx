/* Strudel's syntax tree: the program (acorn) read as a song — tempo, tracks, method chains — plus a full
   mini-notation parser, and range-exact edits. It lives in docstream (`@brett_lamy/docstream/strudel`); re-exported
   so `@/components/ui/strudel-syntax` resolves like every other part. */
export {
  parseStrudel, parseMini, miniAtoms, miniLayers, chainCalls, findCall, StrudelSyntaxError, MiniSyntaxError,
  applyEdits, formatNumber, setArg, setMethod, removeMethod, setTempo, setMiniAtom, setMiniSource, mixCode, isAudible,
} from '@brett_lamy/docstream/strudel';
export type {
  StrudelSong, StrudelTrack, StrudelChain, StrudelCall, StrudelArg, StrudelTempo, TrackKind as StrudelTrackKind, StrudelMix, CodeEdit,
  MiniGroup, MiniSequence, MiniLayers, MiniStep, MiniSlice, MiniAtom, MiniOp, MiniNode, MiniSubcycle, MiniAlternation, MiniPolymeter,
} from '@brett_lamy/docstream/strudel';
