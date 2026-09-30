import * as React from 'react';
import { PencilKitAnnotator } from '../pencilkit/pencilkit-annotator';

/* ══ Image annotation — pluggable ══
   An annotator is a component that hands the AnnotateLightbox a drawing surface (laid over the image) and optional
   tools (under it) through its render-prop child; Save rasterizes the image and the surface's first <svg> into one
   flattened PNG. The default is `PencilKitAnnotator`; override it for a subtree or per composer:

     <ComposerAnnotatorProvider annotator={MyAnnotator}>…</ComposerAnnotatorProvider>
     <Composer annotator={MyAnnotator}>…</Composer>

   `null` (either way) opts out: pressing an attachment then opens a plain preview of the image. */
export interface ComposerAnnotatorSurface {
  /** The drawing surface, stretched over the image. Its first <svg> is flattened into the image on save. */
  canvas: React.ReactNode;
  /** Tools, in a bar under the image so they never cover it. */
  toolbar?: React.ReactNode;
  /** The lightbox's heading (default "Annotate — strokes flatten into the image on save"). */
  title?: string;
}
export interface ComposerAnnotatorProps {
  /** Lays the surface out in the lightbox: call it with the canvas and tools and return the result. */
  children: (surface: ComposerAnnotatorSurface) => React.ReactNode;
}
export type ComposerAnnotator = React.ComponentType<ComposerAnnotatorProps>;

const ComposerAnnotatorContext = React.createContext<ComposerAnnotator | null>(PencilKitAnnotator);

/** Swaps the annotator for every Composer (and AnnotateLightbox) below it; `null` opts them out (plain preview). */
export function ComposerAnnotatorProvider({ annotator, children }: { annotator: ComposerAnnotator | null; children?: React.ReactNode }) {
  return <ComposerAnnotatorContext.Provider value={annotator}>{children}</ComposerAnnotatorContext.Provider>;
}

/** The annotator in effect: the nearest ComposerAnnotatorProvider's, else `PencilKitAnnotator`; `null` if opted out. */
export function useComposerAnnotator(): ComposerAnnotator | null {
  return React.useContext(ComposerAnnotatorContext);
}
