/* Blocks — the gallery of registry/blocks/*: each card previews the block live in a resizable viewport
   (desktop / tablet / phone), lists its files in a Code tab, and gives the `shadcn add` command.
   `?block=<slug>` renders one block full screen (BlockFullscreen). */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType, type PointerEvent as RPointerEvent } from 'react';
import { motion } from 'framer-motion';
import { Haptics, HlPre, Spinner, springs, useAppearance, useReducedMotion } from '@brett_lamy/ui';
import { CommandBlock, CopyButton, PillTabs } from './copy';
import { BLOCKS, itemUrl, type Block } from './registry';

const lazyCache = new Map<string, ComponentType>();
function useBlockComponent(block: Block) {
  return useMemo(() => {
    let C = lazyCache.get(block.slug);
    if (!C) { C = lazy(block.load); lazyCache.set(block.slug, C); }
    return C;
  }, [block]);
}

function Loading() {
  return <div className="dk-block-loading" style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--dk-muted)' }}><Spinner /></div>;
}

/** Mounts children only once the element scrolls near the viewport. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

export const blockHref = (slug: string, theme?: string) => `${import.meta.env.BASE_URL}?block=${slug}${theme ? `&theme=${theme}` : ''}`;

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
function Preview({ block, width, onResize }: { block: Block; width: number | null; onResize: (w: number | null) => void }) {
  const Block = useBlockComponent(block);
  const [ref, near] = useNearViewport<HTMLDivElement>();
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
    <div ref={ref} className="dk-block-stage">
      <motion.div
        ref={host}
        className="dk-block-frame"
        animate={{ width: width ?? '100%' }}
        initial={false}
        transition={dragging || reduced ? { duration: 0 } : springs.smooth}
      >
        {near ? <Suspense fallback={<Loading />}><Block /></Suspense> : <Loading />}
      </motion.div>
      <div className="dk-block-handle" onPointerDown={startDrag} role="separator" aria-orientation="vertical" aria-label="Resize preview" data-dragging={dragging || undefined} />
    </div>
  );
}

/** The Code tab: the block's files on the left, the selected file's source on the right. */
function Code({ block }: { block: Block }) {
  const files = block.files;
  const [file, setFile] = useState(files[0]);
  const [src, setSrc] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    Promise.all(files.map(async (f) => [f, block.sources[f] ? await block.sources[f]() : ''] as const))
      .then((all) => { if (live) setSrc(Object.fromEntries(all)); });
    return () => { live = false; };
  }, [block, files]);
  const code = src[file] ?? '';
  const target = (f: string) => `components/blocks/${block.slug}/${f}`;
  return (
    <div className="dk-block-code">
      <div className="dk-block-files" role="listbox" aria-label="Files">
        <div className="dk-block-files-h">Files</div>
        {files.map((f) => (
          <button key={f} type="button" role="option" aria-selected={f === file} className="dk-block-file" onClick={() => setFile(f)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><path d="M6 2.5h8l4.5 4.5v14.5H6z" /><path d="M14 2.5V7h4.5" /></svg>
            {f}
          </button>
        ))}
      </div>
      <div className="dk-block-source">
        <div className="dk-block-source-h">
          <span>{target(file)}</span>
          <CopyButton text={code} label={`Copy ${file}`} />
        </div>
        <div className="dk-code-body dk-block-source-body dk-scroll">
          {code ? <HlPre code={code} lang={file.endsWith('.json') ? 'json' : 'tsx'} /> : <Loading />}
        </div>
      </div>
    </div>
  );
}

const TABS = [{ id: 'preview', label: 'Preview' }, { id: 'code', label: 'Code' }] as const;

export function BlockCard({ block }: { block: Block }) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [width, setWidth] = useState<number | null>(null);
  const appearance = useAppearance();
  const vp: ViewportId | null = width == null ? 'desktop' : VIEWPORTS.find((v) => v.width === width)?.id ?? null;
  return (
    <section className="dk-block" id={`block-${block.slug}`} aria-labelledby={`block-${block.slug}-h`}>
      <div className="dk-block-head">
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h2 id={`block-${block.slug}-h`} className="dk-block-title">{block.title}</h2>
          <p className="dk-block-desc">{block.description}</p>
        </div>
        <div className="dk-block-tools">
          <PillTabs id={`block-${block.slug}-tab`} label="View" tabs={TABS} value={tab} onChange={setTab} />
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
          <a className="dk-icon-btn" href={blockHref(block.slug, appearance)} target="_blank" rel="noreferrer" title="Open full screen" aria-label={`Open ${block.title} full screen`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" /></svg>
          </a>
        </div>
      </div>
      <div className="dk-block-body">
        {tab === 'preview' ? <Preview block={block} width={width} onResize={setWidth} /> : <Code block={block} />}
      </div>
      <div className="dk-block-foot">
        <CommandBlock id={`block-${block.slug}-cmd`} cmd={{ dlx: `shadcn@latest add ${itemUrl(block.slug)}` }} />
      </div>
    </section>
  );
}

export function BlocksPage() {
  return (
    <div>
      <div className="dk-kicker">Blocks</div>
      <h1 className="dk-h1">Blocks</h1>
      <p className="dk-lead">
        Whole apps composed from BL UI parts, in the spirit of shadcn blocks. Each block is a few readable files that
        import only from <code>@brett_lamy/ui</code> — preview it at any width, read the code, and add it to your app with the
        shadcn CLI.
      </p>
      {BLOCKS.length ? BLOCKS.map((b) => <BlockCard key={b.slug} block={b} />) : <p className="dk-lead">No blocks yet.</p>}
      <div className="dk-block-add">
        <strong>Blocks land in <code>components/blocks/&lt;name&gt;/</code>.</strong> Render the default export from{' '}
        <code>page.tsx</code> in a sized container — blocks fill their parent and adapt to its width, not the window's.
      </div>
    </div>
  );
}

/** `?block=<slug>`: one block, full screen. */
export function BlockFullscreen({ slug }: { slug: string }) {
  const block = BLOCKS.find((b) => b.slug === slug);
  if (!block) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>No block named “{slug}”.</div>;
  return <FullscreenInner block={block} />;
}
function FullscreenInner({ block }: { block: Block }) {
  const Block = useBlockComponent(block);
  useEffect(() => { document.title = `${block.title} — BL UI blocks`; }, [block]);
  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      <Suspense fallback={<Loading />}><Block /></Suspense>
    </div>
  );
}
