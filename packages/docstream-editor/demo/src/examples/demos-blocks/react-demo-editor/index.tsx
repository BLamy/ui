import { useState } from "react"
import { ReactDemoEditor } from "@brett_lamy/docstream-editor"
import { LogPane, Pane, useLog } from "./ui"
import { toyLiveRenderer } from "./toy-renderer"

const FILES = {
  "/src/App.js": `import { useState } from "react"
import Greeting from "./Greeting.js"

export default function App() {
  const [name, setName] = useState("docs reader")
  return h("div", { style: { padding: 16, display: "grid", gap: 8 } },
    h(Greeting, { name }),
    h("input", { value: name, onChange: (e) => setName(e.target.value) }),
  )
}
`,
  "/src/Greeting.js": `export default function Greeting({ name }) {
  return h("h3", { style: { margin: 0, color: "#5b5bd6" } }, "Hello, " + name + "!")
}
`,
}

/** ReactDemoEditor: a file list, a code pane, and whatever preview the host's `liveRenderer` draws. */
export default function ReactDemoEditorDemo({ variant = "live" }: { variant?: string }) {
  const [entries, log] = useLog()
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Pane title={<>ReactDemoEditor{variant === "none" ? " · no liveRenderer" : variant === "manual" ? " · autoPreview={false}" : " · liveRenderer"}</>}>
        <ReactDemoEditor
          key={variant}
          files={FILES}
          entry="/src/App.js"
          height={160}
          {...(variant === "none" ? {} : { liveRenderer: toyLiveRenderer })}
          autoPreview={variant !== "manual"}
          onChange={(files) => log(`onChange({ ${Object.entries(files).map(([p, c]) => `"${p}": ${c.length} chars`).join(", ")} })`)}
        />
      </Pane>
      <LogPane entries={entries} empty="Edit a file: onChange fires on every keystroke." />
    </div>
  )
}
