export const code = `import { createCliRenderer, TextRenderable } from "@opentui/core"

const renderer = await createCliRenderer({ exitOnCtrlC: false })
const screen = new TextRenderable(renderer, {
  id: "keyboard-demo",
  content: "Docstream + OpenTUI\\n\\nClick the terminal, then press any key.",
  fg: "#a5f3fc",
})
renderer.root.add(screen)
renderer.keyInput.on("keypress", (key) => {
  screen.content = "Docstream + OpenTUI\\n\\nYou pressed: " + key.name
})`
