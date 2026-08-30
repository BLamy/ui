import * as React from 'react';
import { useState } from 'react';
import { cn } from '@touchkit/ui';
import { PFONT, PK_DARK, PK_INKS, PK_LIGHT, PK_W, type PencilStroke, type PencilTool } from './constants';
import { PencilCanvas } from './pencil-canvas';
import {
  InkPicker,
  PencilActions,
  PencilToolbar,
  PencilToolbarDivider,
  ToolPicker,
  WidthPicker,
} from './pencil-toolbar';
import { usePencilHistory } from './use-pencil-history';

export interface PencilKitDemoProps extends React.HTMLAttributes<HTMLDivElement> {
  dark?: boolean | 'true';
  tint?: string;
  /** strokes to pre-seed the canvas with (e.g. the `demoStrokes()` fixture) */
  defaultStrokes?: PencilStroke[];
}

/** The full PencilKit prototype demo: dotted paper, canvas, and the floating toolbar. */
export function PencilKitDemo({ dark: darkProp, tint, defaultStrokes, className, style, ...rest }: PencilKitDemoProps) {
  const dark = darkProp === true || darkProp === 'true';
  const vars: Record<string, string> = { ...(dark ? PK_DARK : PK_LIGHT) };
  if (tint) vars['--tk-tint'] = tint;

  const [tool, setTool] = useState<PencilTool>('pen');
  const [ink, setInk] = useState(dark ? 1 : 0);
  const [wi, setWi] = useState(1);
  const history = usePencilHistory(defaultStrokes);

  return (
    <div
      data-slot="pencilkit-demo"
      className={cn(className)}
      style={{
        ...(vars as React.CSSProperties),
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        background: 'var(--tk-bg2)', color: 'var(--tk-label)', fontFamily: PFONT,
        colorScheme: dark ? 'dark' : 'light', WebkitFontSmoothing: 'antialiased',
        backgroundImage:
          'radial-gradient(' + (dark ? 'rgba(235,235,245,.13)' : 'rgba(60,60,67,.15)') + ' 1px, transparent 1.2px)',
        backgroundSize: '22px 22px',
        ...style,
      }}
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
            <div style={{ fontSize: 15.5, fontWeight: 600 }}>Draw anywhere</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>
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
