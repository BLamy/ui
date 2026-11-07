/** Stops are ordered by their indexed step, so actions sharing a millisecond stay distinct. */
export function stopFrom<T extends { step: number }>(
  stops: readonly T[],
  step: number,
  direction: number,
): T | null {
  if (direction > 0) return stops.find((stop) => stop.step > step) ?? null;
  for (let i = stops.length - 1; i >= 0; i--)
    if (stops[i].step < step) return stops[i];
  return null;
}

/** The last action announced at or before the selected step. */
export function stopAt<T extends { step: number }>(
  stops: readonly T[],
  step: number,
): T | null {
  for (let i = stops.length - 1; i >= 0; i--)
    if (stops[i].step <= step) return stops[i];
  return null;
}
