import { useState } from 'react';
import type { ComposerAnnotatorProps } from '@/components/ui/composer/annotator';
import { PK_INKS, type PencilTool } from '@/components/ui/pencilkit/constants';
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas';
import { InkPicker, PencilActions, PencilToolbar, PencilToolbarDivider, ToolPicker } from '@/components/ui/pencilkit/pencil-toolbar';
import { usePencilHistory } from '@/components/ui/pencilkit/use-pencil-history';

/**
 * The Composer's default image annotator, on PencilKit: a canvas over the image, and the tool / ink / undo bar
 * under it so it never covers the image. Save flattens the strokes into the image. Every Composer and
 * AnnotateLightbox uses it unless a `ComposerAnnotatorProvider` or `annotator` prop says otherwise.
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
