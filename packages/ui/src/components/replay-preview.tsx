/* ReplayPreview lives in docstream, which is part of the library but built and installed whole, not copied by the
   registry: it's imported by the package's own name (`@brett_lamy/ui/docstream/replay`), and a registry install adds
   `@brett_lamy/ui` for it. This module is the widget's one place among the kit's parts, so `@/components/ui/replay-preview`
   resolves like every other part: the component and the types of its props and handle. The stage, the marker /
   DevTools / inspection readers, `formatReplayTime`, the file loaders and the demo recording are docstream's: import
   them from `@brett_lamy/ui/docstream/replay` and `@brett_lamy/ui/docstream/replay/demo`. */
export { ReplayPreview } from '@brett_lamy/ui/docstream/replay';
export type {
  ReplayPreviewProps, ReplayPreviewHandle, ReplaySource, ReplayChrome, ReplayEvent, ReplayMarker, ReplayMarkerKind,
  ReplayDevtools, ReplayDevtoolsTab, ReplayInspection, ReplayInspectionTab,
} from '@brett_lamy/ui/docstream/replay';
