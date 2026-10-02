/* Browser file helpers for lib/pglite-transfer: save a File to disk, ask the user for one. These touch the DOM, so they
   live apart from the pure export / import functions (which also run in Node, workers and tests). Call them from event
   handlers; nothing runs at import time. */

/** Saves a `Blob` / `File` through a temporary link (the download attribute). */
export function downloadFile(file: Blob & { name?: string }, name?: string): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name ?? file.name ?? 'download';
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Revoke after the browser has had the chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Opens the file picker and resolves with the chosen file, or `null` if it was dismissed. Call it from a click handler. */
export function pickFile(accept?: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    // `cancel` fires where supported; without it a dismissed picker simply never resolves, which is harmless.
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}
