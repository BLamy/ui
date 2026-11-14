/* StlViewer lives in docstream (`@brett_lamy/docstream/stl`), where `{% embed url="part.stl" %}` renders it. This
   module re-exports the viewer; the mesh reader (`parseStl`, `isStlUrl`) is imported from `@brett_lamy/docstream/stl`. */
export { StlViewer } from '@brett_lamy/docstream/stl';
export type { StlViewerProps } from '@brett_lamy/docstream/stl';
