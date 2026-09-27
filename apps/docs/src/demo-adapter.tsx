/* TEMPORARY (phase 1): renders a docs page — one docstream Markdown document — with its `{% demo %}` tags, until
   docstream 1.1.0 ships the native demo block, viewer and resolver hook. Everything the phase-2 switch deletes
   lives in this file:
   - DemoDoc: splits the page at top-level `{% demo src="…" %}` lines; Markdown runs render through MarkdownView
     (docstream), each tag through DemoView.
   - DemoView: resolves the src (./demo-resolver) and picks the viewer — the multi-file viewer (live preview with
     desktop / tablet / phone widths, a resize handle, full screen, and a Code tab listing every file) for
     multi-file demos and blocks, or the single-file card (docstream's ReactDemo: preview with the code under it).
   - The themed preview stage (BL / Workbench tokens following the docs appearance) and the variant switch.
   - DemoFullscreen: `?example=<page>/<example>` (or `?block=<slug>`) renders one demo full screen. */
import {
  Component, lazy, Suspense, useEffect, useMemo, useRef, useState,
  type ComponentType, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { ReactDemo } from '@brett_lamy/docstream/playground';
import {
  Haptics, HlPre, MarkdownView, MONO, Segmented, Spinner, springs, useAppearance, useReducedMotion, WFONT, WorkbenchTheme,
} from '@brett_lamy/ui';
import { CopyButton, PillTabs } from './app/copy';
import { demoLayout, resolveDemo, type DemoComponent, type DemoVariant, type ResolvedDemo } from './demo-resolver';
import { splitDemos } from './page-md';

/* ── The preview stage ─────────────────────────────────────────────────────────────────────────────────── */

const BLL: Record<string, string> = {
  '--bl-bg': '#fff', '--bl-bg2': '#F2F2F7', '--bl-card': '#fff', '--bl-label': '#0B0B0F',
  '--bl-label2': 'rgba(60,60,67,.6)', '--bl-label3': 'rgba(60,60,67,.36)', '--bl-sep': 'rgba(60,60,67,.22)',
  '--bl-fill': 'rgba(120,120,128,.13)', '--bl-fill2': 'rgba(120,120,128,.24)', '--bl-press': 'rgba(120,120,128,.16)',
  '--bl-tint': '#0A84FF', '--bl-green': '#34C759', '--bl-red': '#FF3B30',
  '--bl-bar': 'rgba(250,250,252,.85)', '--bl-stick': 'rgba(244,244,248,.92)', '--bl-side': '#ECECF1',
  '--bl-scrim': 'rgba(0,0,0,.38)',
};

const BLDK: Record<string, string> = {
  '--bl-bg': '#000', '--bl-bg2': '#0A0A0C', '--bl-card': '#1C1C1E', '--bl-label': '#F5F5F7',
  '--bl-label2': 'rgba(235,235,245,.62)', '--bl-label3': 'rgba(235,235,245,.3)', '--bl-sep': 'rgba(84,84,88,.48)',
  '--bl-fill': 'rgba(120,120,128,.22)', '--bl-fill2': 'rgba(120,120,128,.34)', '--bl-press': 'rgba(120,120,128,.22)',
  '--bl-tint': '#0A84FF', '--bl-green': '#30D158', '--bl-red': '#FF453A',
  '--bl-bar': 'rgba(16,16,18,.82)', '--bl-stick': 'rgba(18,18,20,.9)', '--bl-side': '#111114',
  '--bl-scrim': 'rgba(0,0,0,.5)',
};

class ErrB extends Component<{ label: string; children?: ReactNode }, { err: string | null }> {
  override state: { err: string | null } = { err: null };
  static getDerivedStateFromError(e: unknown) { return { err: String((e as any)?.message || e) }; }
  override render() {
    return this.state.err
      ? <div style={{ padding: 14, fontFamily: MONO, fontSize: 12, color: '#FF453A' }}>{this.props.label + ' failed: ' + this.state.err}</div>
      : this.props.children;
  }
}

/** The themed surface a preview renders on: BL tokens (light/dark) or a Workbench root. */
function Stage({ theme = 'bl', bleed, fill, children }: { theme?: 'bl' | 'wb'; bleed?: boolean; fill?: boolean; children?: ReactNode }) {
  const dark = useAppearance() === 'dark';
  const pad: CSSProperties = {
    padding: bleed ? 0 : 18, boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
    ...(fill ? { height: '100%', overflow: 'auto' } : null),
  };
  if (theme === 'wb') {
    return <WorkbenchTheme className="bl-live-stage" style={pad}><ErrB label="preview">{children}</ErrB></WorkbenchTheme>;
  }
  return (
    <div className="bl-live-stage" style={{
      ...(dark ? BLDK : BLL), ...pad, background: 'var(--bl-bg2)', color: 'var(--bl-label)',
      colorScheme: dark ? 'dark' : 'light', fontFamily: WFONT,
    } as CSSProperties}>
      <ErrB label="preview">{children}</ErrB>
    </div>
  );
}

/** The variant switch in a demo's header. */
function VariantSwitch({ label, options, value, onChange, width }: {
  label: string; options: DemoVariant[]; value: string; onChange: (id: string) => void; width?: number;
}) {
  const dark = useAppearance() === 'dark';
  return (
    <div className="bl-live-switch" style={{ ...(dark ? BLDK : BLL), width: width ?? Math.max(150, options.length * 88), fontFamily: WFONT } as CSSProperties}>
      <Segmented aria-label={label} options={options} value={value} onChange={onChange} />
    </div>
  );
}

function useVariant(demo: ResolvedDemo) {
  const first = demo.meta.variants?.[0]?.id ?? '';
  const [variant, setVariant] = useState(first);
  useEffect(() => setVariant(first), [demo.src, first]);
  const control = demo.meta.variants ? (
    <VariantSwitch label={demo.meta.title + ' variant'} options={demo.meta.variants} value={variant} onChange={setVariant}
      width={demo.meta.variantsWidth} />
  ) : null;
  return [variant, control] as const;
}

function Loading() {
  return <div className="dk-block-loading" style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--dk-muted)' }}><Spinner /></div>;
}

const lazyCache = new Map<string, ComponentType<{ variant?: string }>>();
function useDemoComponent(demo: ResolvedDemo): DemoComponent {
  return useMemo(() => {
    if (demo.component) return demo.component;
    let C = lazyCache.get(demo.src);
    if (!C) { C = lazy(demo.load); lazyCache.set(demo.src, C); }
    return C;
  }, [demo]);
}

/** The demo itself: examples on their themed stage, blocks bare (they bring their own full-bleed surface). */
function DemoBody({ demo, variant, fill }: { demo: ResolvedDemo; variant: string; fill?: boolean }) {
  const C = useDemoComponent(demo);
  const el = <Suspense fallback={<Loading />}><C {...(demo.meta.variants ? { variant } : {})} /></Suspense>;
  if (demo.kind === 'block') return el;
  return <Stage theme={demo.meta.theme} bleed={demo.meta.bleed} fill={fill}>{el}</Stage>;
}

/* ── Single-file demos: the preview with its code underneath ────────────────────────────────────────────── */

function useSources(demo: ResolvedDemo) {
  const eager = Object.values(demo.files).every((s) => typeof s === 'string');
  const [src, setSrc] = useState<Record<string, string>>(() => (eager ? (demo.files as Record<string, string>) : {}));
  useEffect(() => {
    if (eager) { setSrc(demo.files as Record<string, string>); return; }
    let live = true;
    Promise.all(Object.entries(demo.files).map(async ([f, s]) => [f, typeof s === 'string' ? s : await s()] as const))
      .then((all) => { if (live) setSrc(Object.fromEntries(all)); });
    return () => { live = false; };
  }, [demo, eager]);
  return src;
}

function SingleDemo({ demo }: { demo: ResolvedDemo }) {
  const [variant, control] = useVariant(demo);
  const sources = useSources(demo);
  const names = Object.keys(demo.files);
  const code = names.length === 1
    ? sources[names[0]] ?? ''
    : names.map((n) => `// ${n}\n${sources[n] ?? ''}`).join('\n\n');
  return (
    <ReactDemo
      className="bl-live"
      title={demo.meta.title}
      status={demo.meta.status ?? 'live'}
      actions={control}
      preview={<DemoBody demo={demo} variant={variant} />}
      height="auto"
      code={code}
      language="tsx"
      collapsedCodeLines={3}
      expandedCodeLines={36}
    />
  );
}

/* ── Multi-file demos: live preview at any width, full screen, and every file ───────────────────────────── */

/** Mounts children only once the element scrolls near the viewport. */
function useNearViewport<T extends Element>(eager: boolean) {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(eager);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

export const demoHref = (src: string, theme?: string) =>
  `${import.meta.env.BASE_URL}?example=${encodeURIComponent(src)}${theme ? `&theme=${theme}` : ''}`;

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', width: null },
  { id: 'tablet', label: 'Tablet', width: 820 },
  { id: 'phone', label: 'Phone', width: 390 },
] as const;
type ViewportId = (typeof VIEWPORTS)[number]['id'];

const VPIcon = ({ id }: { id: ViewportId }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {id === 'desktop' ? <><rect x="2.5" y="4" width="19" height="12.5" rx="2" /><path d="M8.5 20h7M12 16.5V20" /></>
      : id === 'tablet' ? <><rect x="4.5" y="2.5" width="15" height="19" rx="2.2" /><path d="M11 18.5h2" /></>
        : <><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M11 18.5h2" /></>}
  </svg>
);

/** The live preview: a framed viewport whose width follows the toggle, or the handle while dragging. */
function Preview({ demo, variant, width, height, onResize }: {
  demo: ResolvedDemo; variant: string; width: number | null; height?: number; onResize: (w: number | null) => void;
}) {
  const [ref, near] = useNearViewport<HTMLDivElement>(demo.kind === 'example');
  const host = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  const startDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const el = host.current;
    if (!el) return;
    e.preventDefault();
    const left = el.getBoundingClientRect().left;
    const max = el.parentElement!.clientWidth;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const w = Math.round(Math.min(max, Math.max(340, ev.clientX - left)));
      onResize(w >= max - 4 ? null : w);
    };
    const up = () => { setDragging(false); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div ref={ref} className="dk-block-stage" style={height ? { height } : undefined}>
      <motion.div
        ref={host}
        className="dk-block-frame"
        animate={{ width: width ?? '100%' }}
        initial={false}
        transition={dragging || reduced ? { duration: 0 } : springs.smooth}
      >
        {near ? <DemoBody demo={demo} variant={variant} fill /> : <Loading />}
      </motion.div>
      <div className="dk-block-handle" onPointerDown={startDrag} role="separator" aria-orientation="vertical" aria-label="Resize preview" data-dragging={dragging || undefined} />
    </div>
  );
}

const FileGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><path d="M6 2.5h8l4.5 4.5v14.5H6z" /><path d="M14 2.5V7h4.5" /></svg>
);

/** The Code tab: the demo's files on the left, the selected file's source on the right. */
function Code({ demo, height }: { demo: ResolvedDemo; height?: number }) {
  const files = Object.keys(demo.files);
  const [file, setFile] = useState(files[0]);
  const src = useSources(demo);
  const code = src[file] ?? '';
  const path = (f: string) => (demo.kind === 'block' ? `components/blocks/${demo.src.slice('blocks/'.length)}/${f}` : f);
  const lang = file.endsWith('.json') ? 'json' : file.endsWith('.css') ? 'css' : 'tsx';
  return (
    <div className="dk-block-code" style={height ? { height } : undefined}>
      <div className="dk-block-files" role="listbox" aria-label="Files">
        <div className="dk-block-files-h">Files</div>
        {files.map((f) => (
          <button key={f} type="button" role="option" aria-selected={f === file} className="dk-block-file" onClick={() => setFile(f)}>
            <FileGlyph />
            {f}
          </button>
        ))}
      </div>
      <div className="dk-block-source">
        <div className="dk-block-source-h">
          <span>{path(file)}</span>
          <CopyButton text={code} label={`Copy ${file}`} />
        </div>
        <div className="dk-code-body dk-block-source-body dk-scroll">
          {code ? <HlPre code={code} lang={lang} /> : <Loading />}
        </div>
      </div>
    </div>
  );
}

const TABS = [{ id: 'preview', label: 'Preview' }, { id: 'code', label: 'Code' }] as const;

function MultiDemo({ demo }: { demo: ResolvedDemo }) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [width, setWidth] = useState<number | null>(null);
  const [variant, control] = useVariant(demo);
  const appearance = useAppearance();
  const vp: ViewportId | null = width == null ? 'desktop' : VIEWPORTS.find((v) => v.width === width)?.id ?? null;
  const id = 'demo-' + demo.src.replace(/\//g, '-');
  const height = demo.kind === 'example' ? demo.meta.height : undefined;
  return (
    <section className="dk-block" id={id} aria-labelledby={`${id}-h`}>
      <div className="dk-block-head">
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h2 id={`${id}-h`} className="dk-block-title">{demo.meta.title}</h2>
          {demo.meta.description ? <p className="dk-block-desc">{demo.meta.description}</p> : null}
        </div>
        <div className="dk-block-tools">
          {control}
          <PillTabs id={`${id}-tab`} label="View" tabs={TABS} value={tab} onChange={setTab} />
          {tab === 'preview' ? (
            <div className="dk-vp" role="group" aria-label="Viewport">
              {VIEWPORTS.map((v) => (
                <button key={v.id} type="button" className="dk-vp-btn" aria-pressed={vp === v.id} title={v.label} aria-label={v.label}
                  onClick={() => { Haptics.selection(); setWidth(v.width); }}>
                  <VPIcon id={v.id} />
                </button>
              ))}
              <span className="dk-vp-w" aria-live="polite">{width ? `${width}px` : '100%'}</span>
            </div>
          ) : null}
          <a className="dk-icon-btn" href={demoHref(demo.src, appearance)} target="_blank" rel="noreferrer" title="Open full screen" aria-label={`Open ${demo.meta.title} full screen`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" /></svg>
          </a>
        </div>
      </div>
      <div className="dk-block-body">
        {tab === 'preview'
          ? <Preview demo={demo} variant={variant} width={width} height={height} onResize={setWidth} />
          : <Code demo={demo} height={height} />}
      </div>
    </section>
  );
}

export function DemoView({ src, layout }: { src: string; layout?: string }) {
  const demo = resolveDemo(src);
  if (!demo) {
    return <div className="dk-md"><p style={{ color: 'var(--dk-muted)', fontFamily: MONO, fontSize: 12.5 }}>Missing example: {src}</p></div>;
  }
  return demoLayout(demo, layout) === 'multi' ? <MultiDemo key={src} demo={demo} /> : <SingleDemo key={src} demo={demo} />;
}

/** A docs page: one docstream Markdown document, demo tags rendered in place. */
export function DemoDoc({ markdown }: { markdown: string }) {
  const segs = useMemo(() => splitDemos(markdown), [markdown]);
  return (
    <>
      {segs.map((s, i) => s.kind === 'markdown'
        ? <div key={i} className="dk-md"><MarkdownView markdown={s.text} /></div>
        : <DemoView key={i + s.src} src={s.src} layout={s.attrs.layout} />)}
    </>
  );
}

/** `?example=<src>` / `?block=<slug>`: one demo, full screen. */
export function DemoFullscreen({ src }: { src: string }) {
  const demo = resolveDemo(src);
  useEffect(() => { if (demo) document.title = `${demo.meta.title} — BL UI`; }, [demo]);
  if (!demo) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>No example named “{src}”.</div>;
  return <FullscreenInner demo={demo} />;
}
function FullscreenInner({ demo }: { demo: ResolvedDemo }) {
  const [variant] = useVariant(demo);
  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      <DemoBody demo={demo} variant={variant} fill />
    </div>
  );
}
