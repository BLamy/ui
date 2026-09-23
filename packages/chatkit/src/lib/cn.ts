/** Minimal className joiner (avoids a hard dep while @brett_lamy/ui is built in parallel). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
