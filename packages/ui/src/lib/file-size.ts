import { formatFileSize as formatUnits } from '@ui-sdk/core/file-input';

/** A file size the way every part of the kit writes it: decimal units in the reader's locale ("280 B", "627 kB",
 *  "1.3 MB"), the same steps as UI SDK's `formatFileSize`, with "B" under a kilobyte (Intl spells it "byte").
 *  Empty when the size is unknown (`undefined`, negative or not finite). */
export function formatFileSize(bytes: number | undefined, locale?: string): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  return Math.round(bytes) < 1000 ? `${Math.round(bytes)} B` : formatUnits(bytes, locale);
}
