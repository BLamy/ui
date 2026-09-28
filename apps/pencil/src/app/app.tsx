/* Pencil — a full-window sketchpad: PencilCanvas on dotted paper, the PencilKit toolbar parts and an undo
   history. Paper and the default ink follow the ambient appearance. */
import { useState, type CSSProperties } from 'react';
import {
  InkPicker,
  PencilActions,
  PencilCanvas,
  PencilToolbar,
  PencilToolbarDivider,
  PK_DARK,
  PK_INKS,
  PK_LIGHT,
  PK_W,
  ToolPicker,
  WidthPicker,
  cn,
  useAppearance,
  usePencilHistory,
  type PencilTool,
} from '@brett_lamy/ui';

export function PencilApp() {
  const dark = useAppearance() === 'dark';
  const [tool, setTool] = useState<PencilTool>('pen');
  // null = the label ink (near-black on light paper, near-white on dark), so it flips with the appearance
  const [ink, setInk] = useState<number | null>(null);
  const [width, setWidth] = useState(1);
  const history = usePencilHistory();
  const inkIndex = ink ?? (dark ? 1 : 0);

  return (
    <div
      className={cn(
        'h-full bg-muted bg-[length:22px_22px] font-ios text-foreground antialiased',
        dark
          ? 'bg-[radial-gradient(rgba(235,235,245,.13)_1px,transparent_1.2px)] scheme-dark'
          : 'bg-[radial-gradient(rgba(60,60,67,.15)_1px,transparent_1.2px)] scheme-light',
      )}
      // PencilKit's light/dark token set
      style={(dark ? PK_DARK : PK_LIGHT) as CSSProperties}
    >
      <PencilCanvas
        tool={tool}
        ink={PK_INKS[inkIndex]}
        width={PK_W[width].m}
        strokes={history.strokes}
        onStrokesChange={history.onStrokesChange}
        hint={
          <>
            <div className="text-[15.5px] font-semibold">Draw anywhere</div>
            <div className="mt-[3px] px-6 text-[12.5px]">Apple Pencil pressure is real — mouse and touch are simulated.</div>
          </>
        }
      >
        <PencilToolbar>
          <ToolPicker value={tool} onChange={setTool} />
          <PencilToolbarDivider />
          <InkPicker value={inkIndex} onChange={setInk} />
          <PencilToolbarDivider />
          <WidthPicker value={width} onChange={setWidth} />
          <PencilToolbarDivider />
          <PencilActions
            onUndo={history.undo}
            onRedo={history.redo}
            onClear={history.clear}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          />
        </PencilToolbar>
      </PencilCanvas>
    </div>
  );
}
