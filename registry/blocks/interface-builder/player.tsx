/* The preview (Run, ⌘R): the storyboard as a live app in a device. The app's layers are its root scene and what's
   presented over it — a sheet you can swipe down, a cross-fade, Magic Motion (shared layoutIds fly between them), a
   replaced root, or a push for a scene with no NavigationStack to push in. Inside a layer the kit's containers do
   the navigating: a NavigationStack pushes and pops its pages, a TabView keeps every tab alive, a SplitView shows
   details. Every scene on screen is an Instance (runtime.ts) with its own state; contexts live at the root. The
   debug area shows the active scene's variables, the scenes on screen and every event and action, Xcode's way.
   Slow Animations slows the transitions the storyboard sets. Edits made while it runs show up live. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion, MotionConfig, type PanInfo } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PlainButton } from '@/components/ui/plain-button';
import { createToastQueue, Toaster, toastApi } from '@/components/ui/toast';
import { useContainerSize } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { springSpec, toFramer, type TransitionSpec } from './easing';
import { preview } from './expr';
import { DEVICES, type Device, type SegueKind } from './model';
import { designEnv, SceneView, StatusBar, type RenderEnv } from './render';
import { Instance, type AppRuntime, type LogKind } from './runtime';
import { contextDefaults } from './scope';
import { useBuilder } from './store';

export interface LogEntry { id: number; t: number; text: string; kind: LogKind }

interface Frame {
  key: number;
  inst: Instance;
  /** How it was presented (null for the root). */
  via: { kind: SegueKind; transition: TransitionSpec } | null;
}

let logSeq = 1;
const SPEEDS = [1, 0.5, 0.25, 0.1] as const;

/* ── The window ── */

export function Player({ appearance, onClose }: { appearance: 'light' | 'dark'; onClose: () => void }) {
  const b = useBuilder();
  const device = DEVICES[b.doc.device];
  const [speed, setSpeed] = useState(1);
  const [generation, setGeneration] = useState(0);
  const [debug, setDebug] = useState(true);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [active, setActive] = useState<Instance | null>(null);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 900, height: 700 });
  const showDebug = debug && size.width > 760;
  const room = { w: size.width - (showDebug ? 300 : 0) - 48, h: size.height - 48 };
  const scale = Math.max(0.3, Math.min(1, room.h / (device.h + 24), room.w / (device.w + 24)));
  const start = useRef(performance.now());
  const push = useCallback((text: string, kind: LogKind = 'action') => {
    setLog((l) => [...l.slice(-199), { id: logSeq++, t: performance.now() - start.current, text, kind }]);
  }, []);
  const restart = () => { setGeneration((g) => g + 1); setLog([]); setActive(null); start.current = performance.now(); };

  // ⌘R restarts while running.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') { e.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  return (
    <motion.div
      data-slot="ib-player"
      role="dialog"
      aria-label={`Running ${b.doc.name}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-30 flex flex-col bg-muted/92 backdrop-blur-md"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card/80 px-3">
        <span className="grid size-6 place-items-center rounded-full bg-success text-white"><Icon name="play" size={11} sw={2.4} /></span>
        <span className="min-w-0 truncate text-footnote font-medium">Running {b.doc.name} on {device.name}</span>
        <span className="flex-1" />
        <DropdownMenu>
          <PlainButton aria-label={`Animation speed: ${speed}×`} className={cn('flex h-7 cursor-pointer items-center gap-1 rounded-md border-0 px-2 text-caption font-medium outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring', speed < 1 ? 'bg-warning/15 text-warning' : 'bg-transparent text-muted-foreground')}>
            <Icon name="clock" size={13} sw={2.1} /> {speed === 1 ? 'Normal speed' : `Slow ${speed}×`}
          </PlainButton>
          <DropdownMenuContent aria-label="Animation speed" placement="bottom end" onAction={(k) => setSpeed(Number(k))}>
            {SPEEDS.map((s) => <DropdownMenuItem key={s} id={String(s)}>{s === 1 ? 'Normal' : `${s}× (Slow Animations)`}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <PlainButton aria-label="Restart" title="Restart (⌘R)" onPress={restart} className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none hover:bg-secondary hover:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring">
          <Icon name="arrow-clockwise" size={15} sw={2.1} />
        </PlainButton>
        <PlainButton aria-label={debug ? 'Hide debug area' : 'Show debug area'} title="Debug area" aria-pressed={debug} onPress={() => setDebug((d) => !d)} className={cn('grid size-7 cursor-pointer place-items-center rounded-md border-0 outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring', debug ? 'bg-secondary text-primary' : 'bg-transparent text-muted-foreground')}>
          <Icon name="panel-bottom" size={15} sw={2.1} />
        </PlainButton>
        <PlainButton aria-label="Stop" title="Stop (⌘.)" onPress={onClose} className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-secondary px-2.5 text-caption font-semibold outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
          <Icon name="stop" size={11} sw={2.4} /> Stop
        </PlainButton>
      </div>
      <div ref={ref} className="flex min-h-0 flex-1">
        <div className="relative grid min-w-0 flex-1 place-items-center overflow-hidden">
          <motion.div
            initial={{ y: 30, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={springs.smooth}
            style={{ width: (device.w + 24) * scale, height: (device.h + 24) * scale }}
            className="relative"
          >
            <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})`, width: device.w + 24, height: device.h + 24 }}>
              <div className="rounded-[67px] bg-black p-3 shadow-[0_30px_80px_black] shadow-black/35 ring-1 ring-white/10" style={{ borderRadius: device.radius + 12 }}>
                {/* Layout animations and drags measure in page px; the device is scaled, so tell framer-motion. */}
                <MotionConfig transformPagePoint={(p) => ({ x: p.x / scale, y: p.y / scale })}>
                  <DeviceScreen key={generation} device={device} appearance={appearance} speed={speed} onLog={push} onActive={setActive} onTick={bump} />
                </MotionConfig>
              </div>
            </div>
          </motion.div>
        </div>
        {showDebug ? <DebugArea log={log} active={active} tick={tick} onClear={() => setLog([])} /> : null}
      </div>
    </motion.div>
  );
}

/* ── The app ── */

function DeviceScreen({ device, appearance, speed, onLog, onActive, onTick }: {
  device: Device; appearance: 'light' | 'dark'; speed: number; onLog: (t: string, k?: LogKind) => void;
  onActive: (fn: Instance | null | ((cur: Instance | null) => Instance | null)) => void;
  onTick: () => void;
}) {
  const b = useBuilder();
  const doc = useRef(b.doc);
  doc.current = b.doc;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [contexts, setContexts] = useState(() => contextDefaults(b.doc));
  const ctx = useRef(contexts);
  const [morph, setMorph] = useState<TransitionSpec>(springSpec(0.5, 0.18));
  const queue = useMemo(() => createToastQueue({ maxVisibleToasts: 2 }), []);
  const toast = useMemo(() => toastApi(queue), [queue]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const framesRef = useRef(frames);
  framesRef.current = frames;

  const app = useMemo<AppRuntime>(() => {
    const instances = new Set<Instance>();
    const runtime: AppRuntime = {
      doc: () => doc.current,
      speed: () => speedRef.current,
      contexts: () => ctx.current,
      setContext: (alias, field, value) => {
        ctx.current = { ...ctx.current, [alias]: { ...ctx.current[alias], [field]: value } };
        setContexts(ctx.current);
        instances.forEach((i) => i.touch());
      },
      present: (from, sceneId, props, kind, transition) => {
        const key = frameSeq++;
        // A replaced root starts the app over: nothing presented it.
        const inst = new Instance(runtime, sceneId, props, { frame: { dismiss: () => dismiss(key) } }, kind === 'replace' ? null : from);
        inst.arrived = 'navigated';
        setMorph(transition);
        setFrames((fs) => (kind === 'replace' ? [{ key, inst, via: { kind, transition } }] : [...fs, { key, inst, via: { kind, transition } }]));
        onActive(inst);
      },
      log: (text, kind) => onLog(text, kind),
      toast: (m) => { toast.hud(m); },
      instances,
      // The debug area follows what you navigate to and what you touch. Embedded scenes (a container's page, a tab
      // that isn't showing) only take over when nothing on screen is followed yet; effects run children first, so a
      // container appearing after its page doesn't take over from it either.
      appear: (inst) => onActive((cur) => {
        const gone = !cur || !instances.has(cur);
        if (inst.arrived === 'embedded' && !gone) return cur;
        for (let i: Instance | null = cur; i && !gone; i = i.parent) if (i === inst) return cur;
        return inst;
      }),
      // Whatever presented or held a scene that left is followed instead (and the scene tree redraws either way).
      disappear: (inst) => {
        onTick();
        onActive((cur) => {
          if (cur !== inst) return cur;
          for (let i = inst.parent; i; i = i.parent) if (instances.has(i)) return i;
          return null;
        });
      },
    };
    const dismiss = (key: number) => {
      const i = framesRef.current.findIndex((f) => f.key === key);
      if (i <= 0) return false;
      const top = framesRef.current[framesRef.current.length - 1];
      if (top.via) setMorph(top.via.transition);
      onLog(`dismiss ${framesRef.current[i].inst.scene?.name ?? ''}`, 'nav');
      setFrames((fs) => fs.slice(0, i));
      return true;
    };
    return runtime;
    // One runtime per run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The first layer: the storyboard's entry scene.
  useEffect(() => {
    const inst = new Instance(app, doc.current.entry, {}, {}, null);
    setFrames([{ key: frameSeq++, inst, via: null }]);
    onActive(inst);
  }, [app, onActive]);

  const env = useMemo<RenderEnv>(() => ({
    ...designEnv(),
    live: true,
    speed,
    doc: b.doc,
    contexts: b.doc.contexts,
    morph,
  }), [speed, b.doc, morph]);

  return (
    <div className="relative overflow-hidden bg-black" style={{ width: device.w, height: device.h, borderRadius: device.radius }}>
      <LayoutGroup id="ib-player">
        <AnimatePresence initial={false}>
          {frames.map((f, i) => (
            <FrameView key={f.key} frame={f} index={i} cover={frames[i + 1] ?? null} top={i === frames.length - 1} device={device} env={env} appearance={appearance}
              back={() => f.inst.back()} backTitle={i > 0 ? frames[i - 1].inst.scene?.name ?? 'Back' : ''} />
          ))}
        </AnimatePresence>
      </LayoutGroup>
      <div className={cn('pointer-events-none absolute inset-0 z-200', appearance === 'dark' ? 'dark' : 'light')}>
        <StatusBar device={device} />
        {device.bottom ? <span aria-hidden="true" className="absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-foreground" /> : null}
      </div>
      <Toaster queue={queue} inline placement="top" offset={device.top + 4} className="z-210" />
    </div>
  );
}

let frameSeq = 1;
const SHEET_GAP = 10;

/** One layer: where it rests on top, and where it waits under the layer that covers it. */
function FrameView({ frame, index, cover, top, device, env, appearance, back, backTitle }: {
  frame: Frame; index: number; cover: Frame | null; top: boolean; device: Device; env: RenderEnv; appearance: 'light' | 'dark'; back: () => void; backTitle: string;
}) {
  const kind = frame.via?.kind ?? null;
  const own = toFramer(frame.via?.transition ?? springSpec(0.4, 0), env.speed);
  const coveredBy = toFramer(cover?.via?.transition ?? springSpec(0.4, 0), env.speed);
  const modal = kind === 'modal';
  const enter = kind === 'push' || kind === 'detail' ? { x: '100%' } : modal ? { y: '100%' } : kind === 'fade' || kind === 'magic' ? { opacity: 0 } : { opacity: 1 };
  const under = cover?.via?.kind;
  const rest = !cover ? { x: 0, y: 0, opacity: 1, scale: 1 }
    : under === 'push' || under === 'detail' ? { x: '-28%', y: 0, opacity: 1, scale: 1 }
      : under === 'modal' ? { x: 0, y: 0, opacity: 1, scale: 0.93 }
        : { x: 0, y: 0, opacity: 0, scale: 1 };
  const scene = frame.inst.scene;
  const screen: Device = modal ? { ...device, h: device.h - device.top - SHEET_GAP, top: 18, radius: 14 } : device;
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 140 || info.velocity.y > 700) back(); };
  if (!scene) return null;
  return (
    <motion.div
      className={cn('absolute inset-x-0 bottom-0 overflow-hidden', modal ? 'rounded-t-card shadow-[0_-8px_30px_black] shadow-black/25' : 'top-0')}
      style={{ zIndex: index, top: modal ? device.top + SHEET_GAP : 0, transformOrigin: '50% 0%' }}
      initial={enter}
      animate={rest}
      exit={{ ...enter, transition: own }}
      transition={cover ? coveredBy : own}
      drag={modal && top ? 'y' : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.9 }}
      dragSnapToOrigin
      onDragEnd={onDragEnd}
      inert={!top}
    >
      {/* What's under a sheet or a pushed scene dims. */}
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 z-190 bg-black" initial={false} animate={{ opacity: under === 'push' || under === 'detail' || under === 'modal' ? 0.18 : 0 }} transition={coveredBy} />
      {modal ? <span aria-hidden="true" className="absolute top-1.5 left-1/2 z-190 h-[5px] w-9 -translate-x-1/2 rounded-full bg-muted-foreground/40" /> : null}
      <SceneView
        scene={scene}
        device={screen}
        env={env}
        inst={frame.inst}
        appearance={appearance}
        rounded={false}
        chrome={false}
        nav={kind === 'push' || kind === 'detail' ? { canGoBack: true, backTitle, goBack: back } : undefined}
      />
    </motion.div>
  );
}

/* ── Debug area ── */

/** The scenes on screen, as a tree: which scene embeds or presents which. */
function sceneTree(active: Instance | null): string[] {
  if (!active) return [];
  const all = [...active.app.instances];
  const live = new Set(all);
  // Roots: nothing presented them, or what did has gone (a replaced root).
  const kids = (p: Instance | null) => all.filter((i) => (p ? i.parent === p : !i.parent || !live.has(i.parent)));
  const out: string[] = [];
  const visit = (i: Instance, depth: number) => {
    out.push(`${'  '.repeat(depth)}${i === active ? '▸ ' : ''}${i.scene?.name ?? '?'}`);
    kids(i).forEach((k) => visit(k, depth + 1));
  };
  kids(null).forEach((r) => visit(r, 0));
  return out;
}

function DebugArea({ log, active, tick, onClear }: { log: LogEntry[]; active: Instance | null; tick: number; onClear: () => void }) {
  void tick;
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [log.length]);
  useSyncExternalStore(active?.subscribe ?? (() => () => {}), active?.getVersion ?? (() => 0), () => 0);
  const scene = active?.scene;
  const scope = active?.scope() ?? {};
  const groups = scene ? [
    { title: 'Props', values: scene.props.map((p) => [p.name, scope[p.name]] as const) },
    { title: 'State', values: scene.state.map((s) => [s.name, scope[s.name]] as const) },
    { title: 'Memos', values: scene.memos.map((m) => [m.name, scope[m.name]] as const) },
    { title: 'Contexts', values: (active?.app.doc().contexts ?? []).map((c) => [c.alias, scope[c.alias]] as const) },
  ].filter((g) => g.values.length) : [];
  return (
    <aside aria-label="Debug area" className="flex w-[300px] shrink-0 flex-col border-l border-border bg-card">
      <DebugSection title={scene ? `Variables · ${scene.name}` : 'Variables'}>
        {groups.length ? groups.map((g) => (
          <div key={g.title} className="mb-1.5">
            <div className="text-caption2 font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</div>
            {g.values.map(([k, v]) => (
              <div key={k} className="flex gap-2 font-mono text-caption2 leading-[1.5]">
                <span className="shrink-0 text-primary">{k}</span>
                <span className="min-w-0 truncate text-foreground" title={typeof v === 'string' ? v : JSON.stringify(v, (_, x) => (typeof x === 'function' ? 'ƒ' : x))}>{preview(v, 60)}</span>
              </div>
            ))}
          </div>
        )) : <span className="text-caption text-muted-foreground">No props or state.</span>}
      </DebugSection>
      <DebugSection title="Scenes on screen">
        <pre className="m-0 font-mono text-caption2 leading-[1.5] whitespace-pre text-muted-foreground">{sceneTree(active).join('\n') || '—'}</pre>
      </DebugSection>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-caption font-semibold">Console</span>
          <PlainButton onPress={onClear} aria-label="Clear console" className="grid size-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring">
            <Icon name="trash" size={12} sw={2.2} />
          </PlainButton>
        </div>
        <ol aria-live="polite" className="bl-scroll m-0 min-h-0 flex-1 list-none overflow-y-auto p-2">
          {log.map((e) => (
            <li key={e.id} className="flex gap-2 py-px font-mono text-caption2 leading-[1.45]">
              <span className="shrink-0 text-tertiary-foreground tabular-nums">{(e.t / 1000).toFixed(2)}</span>
              <span className={cn('min-w-0 break-words', e.kind === 'warn' ? 'text-warning' : e.kind === 'nav' ? 'text-primary' : e.kind === 'event' ? 'text-foreground' : 'text-muted-foreground')}>{e.text}</span>
            </li>
          ))}
          <li ref={end} aria-hidden="true" />
        </ol>
      </div>
    </aside>
  );
}

function DebugSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="shrink-0 border-b border-border px-3 py-2">
      <h3 className="m-0 mb-1 text-caption font-semibold">{title}</h3>
      <div className="max-h-48 overflow-y-auto">{children}</div>
    </section>
  );
}
