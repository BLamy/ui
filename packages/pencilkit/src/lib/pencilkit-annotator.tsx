import { useState } from 'react';
import type { ComposerAnnotatorProps } from '@brett_lamy/ui';
import { PK_INKS, type PencilTool } from './constants';
import { PencilCanvas } from './pencil-canvas';
import { InkPicker, PencilActions, PencilToolbar, PencilToolbarDivider, ToolPicker } from './pencil-toolbar';
import { usePencilHistory } from './use-pencil-history';

/**
 * The Composer's image annotator, on PencilKit: a canvas over the image, and the tool / ink / undo bar under it
 * so it never covers the image. Save flattens the strokes into the image. Plug it in with
 * `<ComposerAnnotatorProvider annotator={PencilKitAnnotator}>` or `<Composer annotator={PencilKitAnnotator}>`
 * (both from @brett_lamy/ui), or pass it to `AnnotateLightbox`.
 */
export function PencilKitAnnotator({ children }: ComposerAnnotatorProps) {
  const [tool, setTool] = useState<PencilTool>('pen');
  const [ink, setInk] = useState(5);
  const history = usePencilHistory();
  return children({
    title: 'Annotate — PencilKit strokes flatten into the image on save',
    canvas: <PencilCanvas tool={tool} ink={PK_INKS[ink]} strokes={history.strokes} onStrokesChange={history.onStrokesChange} />,
    toolbar: (
      <PencilToolbar className="relative bottom-auto left-auto mx-auto translate-x-0 shadow-none">
        <ToolPicker value={tool} onChange={setTool} />
        <PencilToolbarDivider />
        <InkPicker value={ink} onChange={setInk} />
        <PencilToolbarDivider />
        <PencilActions
          onUndo={history.undo}
          onRedo={history.redo}
          onClear={history.clear}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
        />
      </PencilToolbar>
    ),
  });
}
