/** Tiny haptics helper — matches the prototype's `kvib`. */
export const kvib = (p: number | number[]) => {
  try {
    navigator.vibrate && navigator.vibrate(p);
  } catch {
    /* noop */
  }
};
