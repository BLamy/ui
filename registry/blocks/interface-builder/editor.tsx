/* The window: a toolbar (navigator toggle, Run, the device, the document's status, undo and redo, the library,
   appearance, the inspector toggle), the navigator (outline and library) on the leading side, the storyboard in
   the middle with the motion timeline under it, and the inspector on the trailing side. The preview runs over the
   storyboard as a dialog modal to it alone, so the panes stay live while it runs. The window has its own size
   class (compact below 720px, regular from 900px): below regular the side panes become drawers over the canvas
   that leave it usable, and the toolbar drops its labels when compact. */
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useShortcut } from '@ui-sdk/react/shortcuts';
import { AdaptivePane, createAdaptivePaneController } from '@/components/ui/adaptive-pane';
import { createCanvasController } from '@/components/ui/canvas';
import { createDialogController } from '@/components/ui/dialog';
import { unionRect, type Viewport } from '@/lib/canvas-math';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import { usePresence } from '@/lib/presence';
import { BLProvider } from '@/lib/theme';
import { sceneRect } from './geometry';
import { Inspector } from './inspector';
import { LibraryGhost } from './library';
import { DEVICES } from './model';
import { Navigator } from './navigator';
import { Player } from './player';
import { useBuilder } from './store';
import { Storyboard } from './storyboard';
import { Timeline } from './timeline';
import { Toolbar } from './toolbar';

/** Interface Builder's accent: Xcode blue. */
const IB_TINT = { light: '#0A6CFF', dark: '#3D8BFF' } as const;

/** The builder's size classes: the toolbar is compact below 720px, the panes dock beside the canvas from 900px. */
const BREAKPOINTS = { medium: 720, regular: 900 } as const;

/** Whether focus is in a text field, where ⌘Z is the field's own. */
const typing = () => !!(document.activeElement as Element | null)?.closest?.('input, textarea, [contenteditable]');

export function Editor({ appearance, defaultRunning }: { appearance: 'light' | 'dark'; defaultRunning: boolean }) {
  const b = useBuilder();
  const ref = useRef<HTMLDivElement | null>(null);
  const [measure, sizeClass] = useSizeClass<HTMLDivElement>({ breakpoints: BREAKPOINTS, initial: 'regular' });
  const setRoot = useCallback((el: HTMLDivElement | null) => { ref.current = el; measure(el); }, [measure]);
  const narrow = sizeClass !== 'regular';
  const [navOpen, setNavOpen] = useState(!narrow);
  const [inspectorOpen, setInspectorOpen] = useState(!narrow);
  // The toolbar's pane toggles reach the panes through their controllers (AdaptivePaneTrigger).
  const [navPane] = useState(createAdaptivePaneController);
  const [inspectorPane] = useState(createAdaptivePaneController);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [running, setRunning] = useState(defaultRunning);
  const [player] = useState(() => createDialogController());
  const [sceneLook, setSceneLook] = useState<'light' | 'dark'>(appearance);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 0.4 });
  // The zoom menu and the navigator move the storyboard's view through it.
  const [canvasView] = useState(() => createCanvasController());
  const [play, setPlay] = useState(0);
  const [frameAt, setFrameAt] = useState<number | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  // The storyboard's box is the preview's layer host: the dialog renders into it from its first open.
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const setCanvas = useCallback((el: HTMLDivElement | null) => { canvas.current = el; setStage(el); }, []);
  const device = DEVICES[b.doc.device];

  // Every scene in view: on opening, and when the storyboard is laid out for another device or another one opens.
  const fitted = useRef<string | null>(null);
  const layout = `${b.doc.device}|${b.doc.name}`;
  useLayoutEffect(() => {
    const r = canvas.current?.getBoundingClientRect();
    if (!r || fitted.current === layout || r.width < 50) return;
    fitted.current = layout;
    const all = unionRect(b.doc.scenes.map((s) => sceneRect(s, device)));
    canvasView.fit(all && { ...all, y: all.y - 40, h: all.h + 40 }, { padding: 56 });
  });

  // Panes follow the size class until you toggle them yourself: docked open when regular, closed drawers below.
  const touched = useRef(false);
  const [wasNarrow, setWasNarrow] = useState(narrow);
  if (wasNarrow !== narrow) {
    setWasNarrow(narrow);
    if (!touched.current) { setNavOpen(!narrow); setInspectorOpen(!narrow); }
  }

  // The timeline scrubs the selected scene.
  const timelineScene = b.scene?.id ?? (b.selection.kind === 'segue' ? null : b.doc.entry);
  const timeline = usePresence<HTMLDivElement>(timelineOpen && !!timelineScene);
  const shownScene = useRef(timelineScene);
  if (timelineScene) shownScene.current = timelineScene;

  const focusScene = (id: string) => {
    const s = b.doc.scenes.find((x) => x.id === id);
    if (s) canvasView.fit({ ...sceneRect(s, device), y: s.y - 40, h: device.h + 40 }, { padding: 48 });
  };

  // ⌘R runs (the preview has ⌘R to restart and ⌘. to stop), ⇧⌘L is the toolbar's. ⌘Z and ⇧⌘Z undo and redo from
  // anywhere in this builder but a text field (the canvas handles its own). Each runs only while focus is inside.
  const inside = () => !!ref.current?.contains(document.activeElement);
  useShortcut('mod+r', (event) => { player.setOpen(true, { reason: 'shortcut', event }); }, { when: () => inside() && !running, description: 'Run' });
  useShortcut('mod+z', () => b.undo(), { when: () => inside() && !running && !typing(), description: 'Undo' });
  useShortcut('shift+mod+z', () => b.redo(), { when: () => inside() && !running && !typing(), description: 'Redo' });

  const replay = () => { setFrameAt(null); setPlay((n) => n + 1); };

  return (
    <BLProvider appearance={appearance} tint={appearance === 'dark' ? IB_TINT.dark : IB_TINT.light} className="bg-background">
      <SizeClassProvider value={sizeClass}>
        <div ref={setRoot} data-slot="interface-builder" className="relative flex h-full w-full flex-col overflow-hidden text-foreground">
          <Toolbar
            navPane={navPane}
            inspectorPane={inspectorPane}
            running={running}
            onRun={(event) => player.setOpen(true, { reason: 'trigger-press', event })}
            onStop={(event) => player.close({ reason: 'trigger-press', event })}
            sceneLook={sceneLook}
            onSceneLook={setSceneLook}
            timelineOpen={timelineOpen}
            onToggleTimeline={() => { setTimelineOpen((o) => !o); setFrameAt(null); }}
            onPlay={replay}
            zoom={viewport.zoom}
            onZoom={(k) => (k === 'fit' ? canvasView.fit(unionRect(b.doc.scenes.map((s) => sceneRect(s, device))), { padding: 56 }) : canvasView.zoomBy(k))}
          />
          <div className="relative flex min-h-0 flex-1">
            <AdaptivePane
              controller={navPane}
              presentation={narrow ? 'drawer' : 'column'}
              side="start"
              aria-label="Navigator"
              open={navOpen}
              onOpenChange={(open) => { touched.current = true; setNavOpen(open); }}
              modal={false}
              columnWidth={264}
              drawerWidth={264}
              className="border-r border-border bg-card"
              zIndex={20}
            >
              <aside aria-label="Navigator" className="flex min-h-0 flex-1 flex-col">
                <Navigator onFocusScene={focusScene} />
              </aside>
            </AdaptivePane>

            <main className="relative flex min-w-0 flex-1 flex-col">
              {/* A layer host: the running preview is modal to the storyboard only, and stays inside its box. */}
              <div ref={setCanvas} data-layer-host="" className="relative min-h-0 flex-1 overflow-clip [contain:layout]">
                <Storyboard viewport={viewport} onViewportChange={setViewport} controller={canvasView} appearance={sceneLook} play={play} frameAt={frameAt} timelineScene={timelineOpen ? timelineScene : null} />
                {stage ? <Player controller={player} open={running} onOpenChange={(open) => setRunning(open)} container={stage} appearance={sceneLook} /> : null}
              </div>
              {timeline.mounted && shownScene.current ? (
                <div ref={timeline.ref} className="grid grid-rows-[1fr] border-t border-border bg-card transition-[grid-template-rows] duration-spring-smooth ease-spring-smooth data-starting-style:grid-rows-[0fr] data-ending-style:grid-rows-[0fr] motion-reduce:transition-none">
                  <div className="min-h-0 overflow-hidden">
                    <Timeline sceneId={shownScene.current} frameAt={frameAt} onFrameAt={setFrameAt} onPlay={replay} />
                  </div>
                </div>
              ) : null}
            </main>

            <AdaptivePane
              controller={inspectorPane}
              presentation={narrow ? 'drawer' : 'column'}
              side="end"
              aria-label="Inspector"
              open={inspectorOpen}
              onOpenChange={(open) => { touched.current = true; setInspectorOpen(open); }}
              modal={false}
              columnWidth={316}
              drawerWidth={316}
              className="border-l border-border bg-card"
              zIndex={20}
            >
              <aside aria-label="Inspector" className="flex min-h-0 flex-1 flex-col">
                <Inspector onPlay={replay} />
              </aside>
            </AdaptivePane>
          </div>
          <LibraryGhost root={ref} />
        </div>
      </SizeClassProvider>
    </BLProvider>
  );
}
