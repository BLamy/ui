/** Whether a press navigates in place: a key, or a plain left click. A modified or middle click is the browser's
 *  (a new tab, a download), so a link pressed that way is left alone. */
export function pressesInPlace(event: Event | undefined): boolean {
  if (!event || !("button" in event)) return true
  const e = event as MouseEvent
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}
