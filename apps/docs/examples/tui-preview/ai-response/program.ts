export const program = `import { BoxRenderable, TextRenderable, createCliRenderer } from "@opentui/core"

const renderer = await createCliRenderer({ exitOnCtrlC: true })
const panel = new BoxRenderable(renderer, {
  border: true, padding: 1, height: 7, width: "100%", flexDirection: "column",
})
const counter = new TextRenderable(renderer, { content: "Count 0" })
panel.add(new TextRenderable(renderer, { content: "Left / Right: change count · q: quit" }))
panel.add(counter)
renderer.root.add(panel)

let count = 0
renderer.keyInput.on("keypress", (key) => {
  if (key.name === "q") return renderer.destroy()
  if (key.name === "left") count--
  else if (key.name === "right") count++
  else return
  counter.content = "Count " + count
})`
