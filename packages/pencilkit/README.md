# @brett_lamy/pencilkit

PencilKit's drawing surface in BL UI's language, on [perfect-freehand](https://github.com/steveruizok/perfect-freehand): `PencilCanvas`, the tool / ink / width pickers and undo bar, `usePencilHistory`, and `StrokePath` for rendering saved strokes. Built on `@brett_lamy/ui`.

## Install

```sh
npm i @brett_lamy/pencilkit @brett_lamy/ui
```

```tsx
import '@brett_lamy/ui/styles.css';
import { PencilKitDemo, demoStrokes } from '@brett_lamy/pencilkit';

<div style={{ position: 'relative', height: 540 }}>
  <PencilKitDemo defaultStrokes={demoStrokes()} style={{ position: 'absolute', inset: 0 }} />
</div>;
```

## The Composer's image annotator

`PencilKitAnnotator` plugs a PencilKit canvas and toolbar into `@brett_lamy/ui`'s `Composer`: pressing a pasted image opens it over the image, and Save flattens the strokes into it.

```tsx
import { ComposerAnnotatorProvider } from '@brett_lamy/ui';
import { PencilKitAnnotator } from '@brett_lamy/pencilkit';

<ComposerAnnotatorProvider annotator={PencilKitAnnotator}>
  <App />
</ComposerAnnotatorProvider>;
```

## Workspace development

```sh
pnpm nx build @brett_lamy/pencilkit
```
