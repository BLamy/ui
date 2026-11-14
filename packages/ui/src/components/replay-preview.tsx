/* ReplayPreview lives in docstream (`@brett_lamy/docstream/replay`). This module is the one place the ui package (and
   the `replay-preview` registry item) reaches it, so `@/components/ui/replay-preview` resolves like every other part.
   It carries the component, the types of its props and handle, and `formatReplayTime` (to label times the way the
   player does). The stage, the marker / DevTools / inspection readers, the file loaders and the demo recording are
   docstream's: import them from `@brett_lamy/docstream/replay` and `@brett_lamy/docstream/replay/demo`. */
export { ReplayPreview, formatReplayTime } from '@brett_lamy/docstream/replay';
export type {
  ReplayPreviewProps, ReplayPreviewHandle, ReplaySource, ReplayChrome, ReplayEvent, ReplayMarker, ReplayMarkerKind,
  ReplayDevtools, ReplayDevtoolsTab, ReplayInspection, ReplayInspectionTab,
} from '@brett_lamy/docstream/replay';
