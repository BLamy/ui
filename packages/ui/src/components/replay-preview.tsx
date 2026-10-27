/* ReplayPreview lives in docstream (`@brett_lamy/docstream/replay`), next to the rrweb stage and the marker helpers it
   is built on, and the DevTools and inspection readers. This module is the one place the ui package (and the `replay-preview` registry item) reaches it, so
   `@/components/ui/replay-preview` resolves the same way as every other part. */
export {
  ReplayPreview, formatReplayTime, getReplayMarkers, getReplayMeta, getReplayPointerTrack, replayPointerAt,
  getReplayDevtools, replayDevtoolsAt, getReplayInspections, resolveReplayInspections, replayInspectionAt,
} from '@brett_lamy/docstream/replay';
export type {
  ReplayPreviewHandle, ReplayPreviewProps, ReplayEvent, ReplayMarker, ReplayMarkerKind, ReplayMeta, ReplayPointerTrack,
  ReplayConsoleEntry, ReplayConsoleLevel, ReplayDevtools, ReplayDevtoolsState, ReplayDevtoolsTab, ReplayRequest,
  ReplayInspection, ReplayInspectionTab, ResolvedReplayInspection,
} from '@brett_lamy/docstream/replay';
export { replayDemoEvents } from '@brett_lamy/docstream/replay/demo';
