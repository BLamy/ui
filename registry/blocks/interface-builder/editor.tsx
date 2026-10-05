/* The window: a toolbar (navigator toggle, Run, the device, the document's status, undo and redo, the library,
   appearance, the inspector toggle), the navigator (outline and library) on the leading side, the storyboard in
   the middle with the motion timeline under it, and the inspector on the trailing side. The preview runs over the
   storyboard. Below 900px the side panes float over the canvas instead of beside it. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fitCamera, unionRect, type Camera } from '@/lib/canvas-math';
import { useContainerSize } from '@/lib/container';
import { springs } from '@/lib/motion';
import { BLProvider } from '@/lib/theme';
import { cn } from '@/lib/utils';
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

export function Editor({ appearance, initialRunning }: { appearance: 'light' | 'dark'; initialRunning: boolean }) {
  const b = useBuilder();
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 1280, height: 760 });
  const narrow = size.width < 900;
  const [navOpen, setNavOpen] = useState(!narrow);
  const [inspectorOpen, setInspectorOpen] = useState(!narrow);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [running, setRunning] = useState(initialRunning);
  const [sceneLook, setSceneLook] = useState<'light' | 'dark'>(appearance);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 0.4 });
  const [play, setPlay] = useState(0);
  const [frameAt, setFrameAt] = useState<number | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const device = DEVICES[b.doc.device];

  // Every scene in view: on opening, and when the storyboard is laid out for another device or another one opens.
  const fitted = useRef<string | null>(null);
  const layout = `${b.doc.device}|${b.doc.name}`;
  useLayoutEffect(() => {
    const r = canvas.current?.getBoundingClientRect();
    if (!r || fitted.current === layout || r.width < 50) return;
    fitted.current = layout;
    const all = unionRect(b.doc.scenes.map((s) => sceneRect(s, device)));
    setCamera(fitCamera(all && { ...all, y: all.y - 40, h: all.h + 40 }, { width: r.width, height: r.height }, 56));
  });

  // Panes follow the width class until you toggle them yourself.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) return;
    setNavOpen(!narrow);
    setInspectorOpen(!narrow);
  }, [narrow]);

  // The timeline scrubs the selected scene.
  const timelineScene = b.scene?.id ?? (b.selection.kind === 'segue' ? null : b.doc.entry);

  const zoomTo = (fn: (c: Camera, w: number, h: number) => Camera) => {
    const r = canvas.current?.getBoundingClientRect();
    if (r) setCamera((c) => fn(c, r.width, r.height));
  };
  const focusScene = (id: string) => zoomTo((_, w, h) => {
    const s = b.doc.scenes.find((x) => x.id === id);
    return s ? fitCamera({ ...sceneRect(s, device), y: s.y - 40, h: device.h + 40 }, { width: w, height: h }, 48) : _;
  });

  const look = useMemo(() => (appearance === 'dark' ? IB_TINT.dark : IB_TINT.light), [appearance]);

  // ⌘R runs, ⌘. stops, ⇧⌘L is the toolbar's. ⌘Z and ⇧⌘Z undo and redo from anywhere in the builder but a text
  // field (the canvas handles its own).
  const { undo, redo } = b;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      const inside = ref.current?.contains(document.activeElement);
      if (key === 'r' && !e.shiftKey && inside) { e.preventDefault(); setRunning(true); }
      else if (key === '.' && running) { e.preventDefault(); setRunning(false); }
      else if (key === 'z' && inside && !running && !(e.target as Element).closest?.('input, textarea, [contenteditable]')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [running, ref, undo, redo]);

  const side = narrow ? 'absolute inset-y-0 z-20 shadow-[0_12px_40px_black] shadow-black/20' : 'relative';

  return (
    <BLProvider dark={appearance === 'dark'} tint={look} className="bg-background">
      <div ref={ref} data-slot="interface-builder" className="relative flex h-full w-full flex-col overflow-hidden text-foreground">
        <Toolbar
          navOpen={navOpen}
          onToggleNav={() => { touched.current = true; setNavOpen((o) => !o); }}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => { touched.current = true; setInspectorOpen((o) => !o); }}
          running={running}
          onRun={() => setRunning(true)}
          onStop={() => setRunning(false)}
          sceneLook={sceneLook}
          onSceneLook={setSceneLook}
          timelineOpen={timelineOpen}
          onToggleTimeline={() => { setTimelineOpen((o) => !o); setFrameAt(null); }}
          onPlay={() => { setFrameAt(null); setPlay((n) => n + 1); }}
          zoom={camera.z}
          onZoom={(k) => zoomTo((c, w, h) => (k === 'fit'
            ? fitCamera(unionRect(b.doc.scenes.map((s) => sceneRect(s, device))), { width: w, height: h }, 56)
            : { z: Math.max(0.1, Math.min(4, c.z * k)), x: w / 2 - (w / 2 - c.x) * (Math.max(0.1, Math.min(4, c.z * k)) / c.z), y: h / 2 - (h / 2 - c.y) * (Math.max(0.1, Math.min(4, c.z * k)) / c.z) }))}
          compact={size.width < 720}
        />
        <div className="relative flex min-h-0 flex-1">
          <AnimatePresence initial={false}>
            {navOpen ? (
              <motion.aside
                key="nav"
                aria-label="Navigator"
                initial={{ x: -280, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -280, opacity: 0 }}
                transition={springs.smooth}
                className={cn(side, 'left-0 flex w-[264px] shrink-0 flex-col border-r border-border bg-card')}
              >
                <Navigator onFocusScene={focusScene} />
              </motion.aside>
            ) : null}
          </AnimatePresence>

          <main className="relative flex min-w-0 flex-1 flex-col">
            <div ref={canvas} className="relative min-h-0 flex-1">
              <Storyboard camera={camera} onCameraChange={setCamera} appearance={sceneLook} play={play} frameAt={frameAt} timelineScene={timelineOpen ? timelineScene : null} />
              <AnimatePresence>
                {running ? <Player key="player" appearance={sceneLook} onClose={() => setRunning(false)} /> : null}
              </AnimatePresence>
            </div>
            <AnimatePresence initial={false}>
              {timelineOpen && timelineScene ? (
                <motion.div key="timeline" initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={springs.smooth} className="overflow-hidden border-t border-border bg-card">
                  <Timeline sceneId={timelineScene} frameAt={frameAt} onFrameAt={setFrameAt} onPlay={() => { setFrameAt(null); setPlay((n) => n + 1); }} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </main>

          <AnimatePresence initial={false}>
            {inspectorOpen ? (
              <motion.aside
                key="inspector"
                aria-label="Inspector"
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                transition={springs.smooth}
                className={cn(side, 'right-0 flex w-[316px] shrink-0 flex-col border-l border-border bg-card')}
              >
                <Inspector onPlay={() => { setFrameAt(null); setPlay((n) => n + 1); }} />
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>
        <LibraryGhost root={ref} />
      </div>
    </BLProvider>
  );
}
