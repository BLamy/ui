import * as React from 'react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useAppearance, type Appearance } from '../../lib/theme';
import { PK_DARK, PK_INKS, PK_LIGHT, PK_W, type PencilStroke, type PencilTool } from '../../lib/pencilkit/constants';
import { PencilCanvas } from '../../components/pencilkit/pencil-canvas';
import {
  InkPicker,
  PencilActions,
  PencilToolbar,
  PencilToolbarDivider,
  ToolPicker,
  WidthPicker,
} from '../../components/pencilkit/pencil-toolbar';
import { usePencilHistory } from '../../components/pencilkit/use-pencil-history';

export interface PencilKitDemoProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Dark paper. Wins over `appearance`. */
  dark?: boolean | 'true';
  /** Light or dark paper. Defaults to the ambient `AppearanceProvider` value, else light. */
  appearance?: Appearance;
  tint?: string;
  /** strokes to pre-seed the canvas with (e.g. the `demoStrokes()` fixture) */
  defaultStrokes?: PencilStroke[];
}

/** The full PencilKit prototype demo: dotted paper, canvas, and the floating toolbar. */
export function PencilKitDemo({ dark: darkProp, appearance, tint, defaultStrokes, className, style, ...rest }: PencilKitDemoProps) {
  const ambient = useAppearance();
  const dark = darkProp != null ? darkProp === true || darkProp === 'true' : (appearance ?? ambient) === 'dark';
  const vars: Record<string, string> = { ...(dark ? PK_DARK : PK_LIGHT) };
  if (tint) vars['--bl-tint'] = tint;

  const [tool, setTool] = useState<PencilTool>('pen');
  const [ink, setInk] = useState(dark ? 1 : 0);
  const [wi, setWi] = useState(1);
  const history = usePencilHistory(defaultStrokes);

  return (
    <div
      data-slot="pencilkit-demo"
      className={cn(
        'relative h-full w-full overflow-hidden bg-muted bg-[length:22px_22px] font-ios text-foreground antialiased',
        // dotted paper
        dark
          ? 'bg-[radial-gradient(rgba(235,235,245,.13)_1px,transparent_1.2px)] scheme-dark'
          : 'bg-[radial-gradient(rgba(60,60,67,.15)_1px,transparent_1.2px)] scheme-light',
        className,
      )}
      // the light/dark token set (and optional tint) is chosen at runtime
      style={{ ...(vars as React.CSSProperties), ...style }}
      {...rest}
    >
      <PencilCanvas
        tool={tool}
        ink={PK_INKS[ink]}
        width={PK_W[wi].m}
        strokes={history.strokes}
        onStrokesChange={history.onStrokesChange}
        status="perfect-freehand@1.2.2"
        hint={
          <>
            <div className="text-[15.5px] font-semibold">Draw anywhere</div>
            <div className="mt-[3px] text-[12.5px]">
              Apple Pencil pressure is real — mouse and touch are simulated.
            </div>
          </>
        }
      >
        <PencilToolbar>
          <ToolPicker value={tool} onChange={setTool} />
          <PencilToolbarDivider />
          <InkPicker value={ink} onChange={setInk} />
          <PencilToolbarDivider />
          <WidthPicker value={wi} onChange={setWi} />
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
