`opencode-preview-sw.txt` is the unchanged `dist/__sw__.js` from
`@agent-wasm/core` 0.4.0 (MIT, https://github.com/BLamy/agent-wasm).
It is served under a per-session scope on this separate origin. The preview
bootstrap transfers a MessagePort from the host page directly to that worker.
HTTP requests use AlmostNode's existing worker protocol and `ServerBridge`;
app files and responses stay in the browser and are never uploaded here.

Refresh the vendored file when updating the core dependency. Keep it identical
to the package's worker so the preview retains its resource rewriting and HMR
behavior. The bootstrap itself stores no credentials or app contents.

The optional `path` fragment selects a path inside the selected virtual port;
fragments and app query parameters are never sent to the static host. The
bootstrap rejects paths outside that port's prefix. MCP navigation and reload
always create a fresh worker scope and repeat the handshake before opening the
target, so a terminated worker cannot reuse a closed MessagePort.
