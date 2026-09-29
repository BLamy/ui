import * as React from 'react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { themeScopeProps, useAppearance, type Appearance } from '../../lib/theme';
import { PK_INKS, PK_W, type PencilStroke, type PencilTool } from '../../lib/pencilkit/constants';
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

/** Dotted paper: the theme's muted surface with a 22px grid of muted-foreground dots. */
export const pencilPaperClassName =
  'bg-muted bg-[length:22px_22px] bg-[radial-gradient(color-mix(in_srgb,var(--muted-foreground)_25%,transparent)_1px,transparent_1.2px)] dark:bg-[radial-gradient(color-mix(in_srgb,var(--muted-foreground)_21%,transparent)_1px,transparent_1.2px)]';

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
  const scope = themeScopeProps({ appearance: dark ? 'dark' : 'light', tint });

  const [tool, setTool] = useState<PencilTool>('pen');
  const [ink, setInk] = useState(dark ? 1 : 0);
  const [wi, setWi] = useState(1);
  const history = usePencilHistory(defaultStrokes);

  return (
    <div
      data-slot="pencilkit-demo"
      className={cn(
        'relative h-full w-full overflow-hidden font-ios text-foreground antialiased',
        pencilPaperClassName,
        scope.className,
        className,
      )}
      // the optional tint (--primary / --ring) is chosen at runtime
      style={{ ...scope.style, ...style }}
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
