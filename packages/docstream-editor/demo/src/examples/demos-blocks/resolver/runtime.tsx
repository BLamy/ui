/* A stand-in InlineDemoRuntime. The real one, createAlmostNodeDemoRuntime() from
   @brett_lamy/docstream/playground, bundles the block's files in the browser and runs them; it needs
   @agent-wasm/core, which this site doesn't install. This one shows exactly what a runtime receives. */
import type { InlineDemoRuntime } from "@brett_lamy/docstream/demo"

export const demoRuntime: InlineDemoRuntime = ({ src, title, files, entry, variant, dependencies }) => (
  <div data-demo-runtime="" style={{ padding: 16, fontSize: 13, lineHeight: 1.6 }}>
    <strong>demoRuntime(&#123; … &#125;) was called</strong>
    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
      <li>src: <code>{src || "(empty)"}</code>, title: <code>{title || "(none)"}</code></li>
      <li>entry: <code>{entry}</code>{variant ? <>, variant: <code>{variant}</code></> : null}</li>
      <li>files: {files.map((f) => <code key={f.path} style={{ marginRight: 6 }}>{f.path} ({f.content.length} chars)</code>)}</li>
      <li>dependencies: <code>{JSON.stringify(dependencies ?? {})}</code></li>
    </ul>
    <p style={{ margin: "8px 0 0", opacity: 0.7 }}>A real runtime would bundle and run these files here.</p>
  </div>
)
