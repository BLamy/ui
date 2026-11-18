/* What each library weighs, when the build has measured it. `../library-sizes.generated.json` is written by the
   package's build (`{ libraries: { <library id>: { min, gzip } } }`, in bytes) and may not exist yet, so it is found
   with a glob, which matches nothing instead of failing, and every field is checked before it is shown. */
interface Measured { min?: unknown; gzip?: unknown }

const found = import.meta.glob('../library-sizes.generated.json', { eager: true, import: 'default' }) as Record<string, { libraries?: Record<string, Measured> } | undefined>;
const measured = Object.values(found)[0]?.libraries ?? {};

const bytes = (n: unknown): number | undefined => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined);

/** A library's gzipped size in bytes, or `undefined` when it hasn't been measured. */
export const gzipSize = (id: string): number | undefined => bytes(measured[id]?.gzip);

/** Bytes as a short size: `812 B`, `4.2 kB`, `38 kB`, `1.3 MB` (decimal units, as bundlers report them). */
export function formatSize(n: number): string {
  if (n < 1000) return `${Math.round(n)} B`;
  const kb = n / 1000;
  if (kb < 10) return `${kb.toFixed(1)} kB`;
  if (kb < 1000) return `${Math.round(kb)} kB`;
  return `${(kb / 1000).toFixed(1)} MB`;
}
