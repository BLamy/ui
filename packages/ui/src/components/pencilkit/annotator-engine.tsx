'use client';
/* @internal: the drawing engine in effect for ImageAnnotator and the Composer: the nearest ImageAnnotatorProvider's,
   else `PencilKitAnnotator`. Registry installs copy it with PencilKit; it has no npm entry
   (tools/registry/package-exports.mjs skips modules marked `@internal`). */
import * as React from 'react';
import type { ImageAnnotatorEngine } from '@/components/ui/pencilkit/image-annotator';
import { PencilKitAnnotator } from '@/components/ui/pencilkit/pencilkit-annotator';

export const EngineContext = React.createContext<ImageAnnotatorEngine | null>(PencilKitAnnotator);

/** The engine in effect: the nearest ImageAnnotatorProvider's, else `PencilKitAnnotator`; `null` if opted out. */
export function useImageAnnotatorEngine(): ImageAnnotatorEngine | null {
  return React.useContext(EngineContext);
}
