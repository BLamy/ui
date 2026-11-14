'use client';
import { useState } from 'react';
import type { ImageAnnotatorEngineProps } from '@/components/ui/pencilkit/image-annotator';
import { pencilInks, type PencilTool } from '@/components/ui/pencilkit/constants';
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas';
import { PencilActions, PencilInkPicker, PencilToolbar, PencilToolbarPinned, PencilToolPicker } from '@/components/ui/pencilkit/pencil-toolbar';
import { ToolbarSeparator } from '@/components/ui/toolbar';
import { usePencilHistory } from '@/components/ui/pencilkit/use-pencil-history';

/**
 * The default ImageAnnotator engine, on PencilKit: a canvas over the image, and the tool / ink / undo bar
 * under it so it never covers the image. Save flattens the strokes into the image. Every ImageAnnotator (and
 * Composer) uses it unless an `ImageAnnotatorProvider`, `engine` or `annotator` prop says otherwise.
 */
export function PencilKitAnnotator({ children }: ImageAnnotatorEngineProps) {
  const [tool, setTool] = useState<PencilTool>('pen');
  const [ink, setInk] = useState(pencilInks[pencilInks.length - 1].value);
  const history = usePencilHistory();
  return children({
    title: 'Annotate — PencilKit strokes flatten into the image on save',
    canvas: <PencilCanvas tool={tool} ink={ink} strokes={history.strokes} onStrokesChange={history.onStrokesChange} />,
    toolbar: (
      <PencilToolbar variant="plain" className="mx-auto">
        <PencilToolPicker value={tool} onValueChange={setTool} />
        <ToolbarSeparator />
        <PencilInkPicker value={ink} onValueChange={setInk} />
        <PencilToolbarPinned>
          <ToolbarSeparator />
          <PencilActions
            onUndo={history.undo}
            onRedo={history.redo}
            onClear={history.clear}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            canClear={history.canClear}
          />
        </PencilToolbarPinned>
      </PencilToolbar>
    ),
  });
}
