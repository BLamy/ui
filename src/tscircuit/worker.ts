// Keep compiler startup inside an opaque-origin worker. RunFrame receives only
// its URL; neither the compiler nor circuit source executes in the host page.
const compilerWorker = `
const pending = [];
const hold = (event) => {
  event.stopImmediatePropagation();
  pending.push(event);
};
self.addEventListener("message", hold);
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30000);
try {
  const response = await fetch("https://cdn.jsdelivr.net/npm/@tscircuit/eval@0.0.1675/dist/webworker/entrypoint.js", { signal: controller.signal });
  if (!response.ok) throw new Error("Compiler request failed (" + response.status + ")");
  // WebKit cannot read blobs in a data-URL worker (webkit.org/b/258443).
  // Encode the downloaded bytes directly, without a Blob or FileReader.
  const compiler = new Uint8Array(await response.arrayBuffer());
  const chunks = [];
  // A multiple of three keeps base64 padding in the final chunk only. Small
  // chunks also avoid argument-count limits with the ~19 MB compiler bundle.
  for (let offset = 0; offset < compiler.length; offset += 24576) {
    chunks.push(btoa(String.fromCharCode(...compiler.subarray(offset, offset + 24576))));
  }
  await import("data:application/javascript;base64," + chunks.join(""));
} catch (error) {
  // Report startup errors through RunFrame's Comlink requests so its normal
  // error callback, and the preview's retry control, can handle them.
  self.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object" || !("id" in event.data)) return;
    self.postMessage({ id: event.data.id, type: "HANDLER", name: "throw", value: {
      isError: true, value: { name: "Error", message: "Unable to load circuit compiler: " + String(error), stack: "" }
    } });
  });
} finally {
  clearTimeout(timer);
  self.removeEventListener("message", hold);
  for (const event of pending) {
    self.dispatchEvent(new MessageEvent("message", { data: event.data, ports: event.ports, origin: event.origin }));
  }
}
`

export const TSCIRCUIT_COMPILER_WORKER_URL = `data:application/javascript;charset=utf-8,${encodeURIComponent(compilerWorker)}`
