/* StlViewer lives in docstream (`@brett_lamy/ui/docstream/stl`, the library's own entry, imported by the package's name
   because the registry doesn't copy docstream), where `{% embed url="part.stl" %}` renders it. This module re-exports
   the viewer; the mesh reader (`parseStl`, `isStlUrl`) is imported from `@brett_lamy/ui/docstream/stl`. */
export { StlViewer } from '@brett_lamy/ui/docstream/stl';
export type { StlViewerProps } from '@brett_lamy/ui/docstream/stl';
