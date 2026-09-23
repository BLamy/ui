import { Haptics } from '@brett_lamy/ui';

/* Standalone haptic helpers — cooperate with @brett_lamy/ui's Haptics engine,
   falling back to navigator.vibrate when it is unavailable. */
export const vib = (p: number[]) => {
  try {
    if (Haptics) return p.length > 1 ? Haptics.notification('success') : Haptics.impact('light');
    if (navigator.vibrate) navigator.vibrate(p);
  } catch {
    /* haptics are best-effort */
  }
};
export const tick = () => {
  try {
    if (Haptics) return Haptics.selection();
    if (navigator.vibrate) navigator.vibrate([4]);
  } catch {
    /* haptics are best-effort */
  }
};
