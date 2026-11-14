'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import { animateIn } from '@ui-sdk/core';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, type DialogCloseActionDetails, type DialogOptions } from '@ui-sdk/react/dialog';
import { buttonVariants } from '@/components/ui/button';
import { PencilKitAnnotator } from '@/components/ui/pencilkit/pencilkit-annotator';
import { prefersReducedMotion } from '@/lib/motion';
import { themeScopeProps, useLayerHost } from '@/lib/theme';
import { cn } from '@/lib/utils';

/* ══ ImageAnnotator — draw on an image, save it flattened ══
   A lightbox (UI SDK's Dialog) that shows an image with a drawing surface laid over it and tools under it; Save
   rasterizes the image and the surface's first <svg> into one PNG. The surface comes from an *engine*: a component
   that hands the lightbox its canvas and tools through a render-prop child. The default engine is PencilKit's
   (`PencilKitAnnotator`); swap it for a subtree with `ImageAnnotatorProvider`, or per lightbox with `engine`.
   `null` opts out: the lightbox is then a plain preview (the image and Close).

     <ImageAnnotator src={png} open={open} onOpenChange={setOpen} onSave={(url) => setPng(url)} />
     <ImageAnnotatorProvider engine={MyEngine}>…</ImageAnnotatorProvider>

   The Composer opens one when an image attachment is pressed (its `annotator` prop picks the engine). */

/** What an engine hands the lightbox. */
export interface ImageAnnotatorSurface {
  /** The drawing surface, stretched over the image. Its first <svg> is flattened into the image on save. */
  canvas: React.ReactNode;
  /** Tools, in a bar under the image so they never cover it. */
  toolbar?: React.ReactNode;
  /** The lightbox's heading (default "Annotate — strokes flatten into the image on save"). */
  title?: string;
}
export interface ImageAnnotatorEngineProps {
  /** Lays the surface out in the lightbox: call it with the canvas and tools and return the result. */
  children: (surface: ImageAnnotatorSurface) => React.ReactNode;
}
/** A drawing engine for the lightbox (`PencilKitAnnotator` is the default one). */
export type ImageAnnotatorEngine = React.ComponentType<ImageAnnotatorEngineProps>;

const EngineContext = React.createContext<ImageAnnotatorEngine | null>(PencilKitAnnotator);

export interface ImageAnnotatorProviderProps {
  /** The engine every ImageAnnotator (and Composer) below uses; `null` makes them plain previews. */
  engine: ImageAnnotatorEngine | null;
  children?: React.ReactNode;
}

/** Swaps the drawing engine for every ImageAnnotator and Composer below it. */
export function ImageAnnotatorProvider({ engine, children }: ImageAnnotatorProviderProps) {
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

/** The engine in effect: the nearest ImageAnnotatorProvider's, else `PencilKitAnnotator`; `null` if opted out. */
export function useImageAnnotatorEngine(): ImageAnnotatorEngine | null {
  return React.useContext(EngineContext);
}

export interface ImageAnnotatorProps extends Pick<DialogOptions, 'open' | 'defaultOpen' | 'onOpenChange' | 'onOpenChangeComplete'> {
  /** The image (a URL or a data URL). */
  src: string;
  /**
   * Save pressed: the image with its strokes flattened into one PNG data URL. The lightbox then closes with reason
   * `action` and `returnValue` `"save"` (Cancel closes with `close-press` and `"cancel"`).
   */
  onSave?: (dataUrl: string, details: DialogCloseActionDetails) => void;
  /** The drawing engine; defaults to the nearest ImageAnnotatorProvider's, else PencilKit. `null` forces the preview. */
  engine?: ImageAnnotatorEngine | null;
  /** A fixed drawing surface (its first <svg> is flattened), instead of an engine. */
  canvas?: React.ReactNode;
  /** The element the image zooms out of on open and back into on close (a thumbnail); else it scales in. */
  origin?: () => HTMLElement | null;
}

/** The lightbox's palette: a dark `workbench` theme scope, whatever opened it (an image well, dark tools). */
const LIGHTBOX_SCOPE = themeScopeProps({ scope: 'workbench', appearance: 'dark' });

/** Writes where the image box flies from (open) or to (close) as variables its transition reads. */
function setZoom(box: HTMLElement, origin: HTMLElement | null, fallbackScale: number) {
  const reduce = prefersReducedMotion();
  const s = !reduce && origin ? origin.getBoundingClientRect() : null;
  const f = box.getBoundingClientRect();
  const set = (x: number, y: number, scale: number, opacity: number, clip: string) => {
    box.style.setProperty('--zoom-x', `${x}px`);
    box.style.setProperty('--zoom-y', `${y}px`);
    box.style.setProperty('--zoom-scale', String(scale));
    box.style.setProperty('--zoom-opacity', String(opacity));
    box.style.setProperty('--zoom-clip', clip);
  };
  const rest = 'inset(0px round var(--radius-card))';
  if (!s || !s.width || !f.width) {
    set(0, 0, reduce ? 1 : fallbackScale, 0, rest);
    return false;
  }
  // Scaled to cover the thumbnail, clipped to its shape and corners.
  const scale = Math.max(s.width / f.width, s.height / f.height);
  const ix = (f.width - s.width / scale) / 2,
    iy = (f.height - s.height / scale) / 2;
  const radius = parseFloat(getComputedStyle(origin!.closest('button') ?? origin!).borderRadius) || 10;
  set(s.left + s.width / 2 - (f.left + f.width / 2), s.top + s.height / 2 - (f.top + f.height / 2), scale, 1, `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${radius / scale}px)`);
  return true;
}

/** Flattens the image and the surface's strokes into one PNG at the image's native resolution. */
function rasterize(img: HTMLImageElement, box: HTMLElement): Promise<string | null> {
  // The box is exactly the image (aspect kept), so strokes map 1:1.
  const w = img.clientWidth,
    h = img.clientHeight,
    sc = Math.max(1, img.naturalWidth / (w || 1));
  const cv = document.createElement('canvas');
  cv.width = w * sc;
  cv.height = h * sc;
  const ctx = cv.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const svg = box.querySelector('[data-slot="pencil-canvas"] > svg') ?? box.querySelector('svg');
  if (!svg) return Promise.resolve(cv.toDataURL('image/png'));
  const cl = svg.cloneNode(true) as SVGElement;
  // Theme-following inks (`var(--foreground)`) mean nothing in a standalone SVG: bake in the colours drawn now.
  const live = svg.querySelectorAll('path');
  cl.querySelectorAll('path').forEach((p, i) => {
    for (const attr of ['fill', 'stroke'] as const) {
      if (p.getAttribute(attr)?.startsWith('var(') && live[i]) p.setAttribute(attr, getComputedStyle(live[i])[attr]);
    }
  });
  cl.setAttribute('width', String(w));
  cl.setAttribute('height', String(h));
  cl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new Promise((resolve) => {
    const im = new Image();
    const fin = () => resolve(cv.toDataURL('image/png'));
    im.onload = () => {
      ctx.drawImage(im, 0, 0, cv.width, cv.height);
      fin();
    };
    im.onerror = fin;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl));
  });
}

/* The chrome above and the tools below follow the image in, a beat later, and leave quickly. */
const lightboxChrome = (delay: string) =>
  cn(
    'transition-[opacity,translate] duration-spring-smooth ease-spring-smooth',
    delay,
    'group-data-starting-style/lightbox:translate-y-2.5 group-data-starting-style/lightbox:opacity-0',
    'group-data-ending-style/lightbox:opacity-0 group-data-ending-style/lightbox:delay-0 group-data-ending-style/lightbox:duration-120 group-data-ending-style/lightbox:ease-exit',
    'motion-reduce:translate-y-0 motion-reduce:delay-0 motion-reduce:duration-150',
  );

/**
 * The annotation lightbox. It is UI SDK's Dialog (open state, reasons, focus, Escape and outside press, the layer
 * host), and its motion is the dialog's enter and exit: the backdrop and chrome fade on `data-starting-style` /
 * `data-ending-style`, and the image flies out of `origin` (the thumbnail it was pressed on) and back into it.
 */
export function ImageAnnotator({
  src,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onOpenChangeComplete,
  onSave,
  canvas,
  engine: engineProp,
  origin,
}: ImageAnnotatorProps) {
  const [openInner, setOpenInner] = useState(defaultOpen);
  const open = openProp ?? openInner;
  const boxRef = useRef<HTMLDivElement>(null);
  // The image as state: the dialog's content mounts in its own commit, and the flight starts once it is there.
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const contextEngine = useImageAnnotatorEngine();
  const Engine = canvas === undefined ? (engineProp === undefined ? contextEngine : engineProp) : null;
  // The thumbnail hides while the image is out of it (it is the image, flown out), and shows once it is back.
  const hidden = useRef<HTMLElement | null>(null);
  const reveal = () => {
    if (hidden.current) hidden.current.style.visibility = '';
    hidden.current = null;
  };
  React.useEffect(() => reveal, []);
  const host = useLayerHost();
  const [ready, setReady] = useState(false);

  // Open: once the image has its size, it flies out of the thumbnail (UI SDK's animateIn from where it was).
  React.useLayoutEffect(() => {
    if (!open || !img) return;
    if (!ready) {
      if (img.complete && img.naturalWidth) setReady(true);
      else {
        const done = () => setReady(true);
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        return () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
        };
      }
      return;
    }
    const box = boxRef.current;
    if (!box) return;
    const from = origin?.() ?? null;
    if (setZoom(box, from, 0.94) && from) {
      hidden.current = from;
      from.style.visibility = 'hidden';
    }
    return animateIn(box);
  }, [open, ready, img]);

  const setOpen: NonNullable<DialogOptions['onOpenChange']> = (next, details) => {
    onOpenChange?.(next, details);
    if (details.canceled) return;
    // Close: the box flies back to wherever the thumbnail is now, as the dialog's exit.
    if (!next && boxRef.current) setZoom(boxRef.current, hidden.current ?? origin?.() ?? null, 0.96);
    if (openProp === undefined) setOpenInner(next);
  };

  const save = async (_event: Event | undefined, details: DialogCloseActionDetails) => {
    const box = boxRef.current;
    const url = img && box ? await rasterize(img, box) : null;
    if (url) onSave?.(url, details);
  };
  const preview = canvas === undefined && !Engine;
  // The lightbox around a surface: chrome above the image, the surface over it, tools under it.
  const layout = (surface: ImageAnnotatorSurface | null) => (
    <>
      <div data-slot="image-annotator-header" className={cn('flex items-center gap-2', lightboxChrome('delay-80'))}>
        <span className="flex-1 text-footnote font-semibold text-foreground">
          {surface ? (surface.title ?? 'Annotate — strokes flatten into the image on save') : 'Preview'}
        </span>
        {surface ? (
          <>
            <DialogClose value="cancel" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Cancel
            </DialogClose>
            <DialogClose value="save" action={save} className={buttonVariants({ size: 'sm' })}>
              Save annotation
            </DialogClose>
          </>
        ) : (
          <DialogClose className={buttonVariants({ size: 'sm' })}>Close</DialogClose>
        )}
      </div>
      <div
        ref={boxRef}
        data-slot="image-annotator-image"
        data-loading={!ready || undefined}
        className={cn(
          'relative origin-center self-center overflow-hidden rounded-card border border-border bg-code will-change-transform data-loading:invisible',
          '[clip-path:inset(0px_round_var(--radius-card))]',
          '[transition:translate_var(--duration-spring-smooth)_var(--ease-spring-smooth),scale_var(--duration-spring-smooth)_var(--ease-spring-smooth),clip-path_var(--duration-spring-smooth)_var(--ease-spring-smooth),opacity_var(--duration-spring-smooth)_var(--ease-spring-smooth)]',
          // Where it flies from (data-starting-style, its own) and back to (the dialog's data-ending-style).
          'data-starting-style:translate-x-(--zoom-x) data-starting-style:translate-y-(--zoom-y) data-starting-style:scale-(--zoom-scale) data-starting-style:opacity-(--zoom-opacity) data-starting-style:[clip-path:var(--zoom-clip)]',
          'group-data-ending-style/lightbox:translate-x-(--zoom-x) group-data-ending-style/lightbox:translate-y-(--zoom-y) group-data-ending-style/lightbox:scale-(--zoom-scale) group-data-ending-style/lightbox:opacity-(--zoom-opacity) group-data-ending-style/lightbox:[clip-path:var(--zoom-clip)]',
          'motion-reduce:[transition:opacity_150ms]',
        )}
      >
        <img ref={setImg} src={src} alt="" className="block h-auto max-h-[68cqh] w-auto max-w-[86cqw] min-w-[min(340px,86cqw)]" />
        {surface?.canvas}
      </div>
      {surface?.toolbar ? (
        <div data-slot="image-annotator-tools" className={lightboxChrome('delay-120')}>
          {surface.toolbar}
        </div>
      ) : null}
    </>
  );
  return (
    // UI SDK's Dialog: it renders into the layer host, traps focus, and Escape or an outside press closes it (after
    // the image has flown back into its thumbnail). Fixed parts fill the host, so the lightbox covers the frame it
    // was opened in; the image is sized from the content's own box (container units), never from the viewport.
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(next) => {
        if (!next) {
          reveal();
          setReady(false);
        }
        onOpenChangeComplete?.(next);
      }}
      container={host}
    >
      <DialogBackdrop
        data-preview={preview || undefined}
        className="fixed inset-0 z-400 bg-black/74 transition-opacity duration-280 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-300 motion-reduce:duration-150"
      />
      <DialogContent
        aria-label={preview ? 'Preview image' : 'Annotate image'}
        data-preview={preview || undefined}
        data-theme-scope={LIGHTBOX_SCOPE['data-theme-scope']}
        // The content fills the host and centers the lightbox; presses on its empty area fall through to the
        // backdrop, so they are outside presses.
        className={cn(LIGHTBOX_SCOPE.className, 'group/lightbox pointer-events-none fixed inset-0 z-400 grid place-items-center font-sans text-foreground outline-none [container-type:size]')}
      >
        <div data-slot="image-annotator" className="pointer-events-auto flex max-w-[90cqw] flex-col gap-2.5">
          {Engine ? <Engine>{layout}</Engine> : layout(canvas === undefined ? null : { canvas })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
