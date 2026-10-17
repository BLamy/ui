/* StlViewer lives in docstream (`@brett_lamy/docstream/stl`), where `{% embed url="part.stl" %}` renders it. This
   module is the one place the ui package (and the `stl-viewer` registry item) reaches it, so
   `@/components/ui/stl-viewer` resolves the same way as every other part. */
export { StlViewer, parseStl, isStlUrl } from '@brett_lamy/docstream/stl';
export type { StlViewerProps, StlMesh } from '@brett_lamy/docstream/stl';
