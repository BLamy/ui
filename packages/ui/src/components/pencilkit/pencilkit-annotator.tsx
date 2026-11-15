'use client';
import { useState } from 'react';
import type { ImageAnnotatorEngineProps } from '@/components/ui/pencilkit/image-annotator';
import { pencilInks, type PencilInk, type PencilTool } from '@/components/ui/pencilkit/constants';
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas';
import { PencilActions, PencilInkPicker, PencilToolbar, PencilToolbarPinned, PencilToolPicker } from '@/components/ui/pencilkit/pencil-toolbar';
import { ToolbarSeparator } from '@/components/ui/toolbar';
import { usePencilHistory } from '@/components/ui/pencilkit/use-pencil-history';

/** The annotator's inks. The paper is the user's image, not the theme's background, so black and white are literal
 *  here (the theme-following pair would draw "Black" white in the always-dark lightbox, and save it white). */
const IMAGE_BLACK = '#000000';
const IMAGE_WHITE = '#FFFFFF';
const imageInks: readonly PencilInk[] = [
  { value: IMAGE_BLACK, label: 'Black' },
  { value: IMAGE_WHITE, label: 'White' },
  ...pencilInks.slice(2),
];

/**
 * The default ImageAnnotator engine, on PencilKit: a canvas over the image, and the tool / ink / undo bar
 * under it so it never covers the image. Save flattens the strokes into the image. Every ImageAnnotator (and
 * Composer) uses it unless an `ImageAnnotatorProvider`, `engine` or `annotator` prop says otherwise.
 */
export function PencilKitAnnotator({ children }: ImageAnnotatorEngineProps) {
  const [tool, setTool] = useState<PencilTool>('pen');
  const [ink, setInk] = useState(imageInks[imageInks.length - 1].value);
  const history = usePencilHistory();
  return children({
    canvas: <PencilCanvas tool={tool} ink={ink} strokes={history.strokes} onStrokesChange={history.onStrokesChange} />,
    toolbar: (
      <PencilToolbar variant="plain" className="mx-auto">
        <PencilToolPicker value={tool} onValueChange={setTool} />
        <ToolbarSeparator />
        <PencilInkPicker inks={imageInks} value={ink} onValueChange={setInk} />
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
