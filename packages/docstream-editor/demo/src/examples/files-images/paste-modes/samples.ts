/* Sample files for readers without one at hand, and the real paste / drop events that carry them
   into the editor: the buttons go through exactly the code path a Cmd+V or a drag from Finder does. */
import type { GitbookEditorProps } from "@brett_lamy/docstream-editor"

export type EditorInstance = NonNullable<Parameters<NonNullable<GitbookEditorProps["onEditorReady"]>>[0]>

/** A small PNG "screenshot", different each time. */
export function sampleImage(n: number): Promise<File> {
  const canvas = document.createElement("canvas")
  canvas.width = 480
  canvas.height = 300
  const ctx = canvas.getContext("2d")!
  const hue = (n * 67) % 360
  const bg = ctx.createLinearGradient(0, 0, 480, 300)
  bg.addColorStop(0, `hsl(${hue} 80% 62%)`)
  bg.addColorStop(1, `hsl(${(hue + 50) % 360} 70% 38%)`)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 480, 300)
  ctx.fillStyle = "rgba(255,255,255,.9)"
  ctx.fillRect(28, 28, 424, 40)
  ctx.fillRect(28, 88, 200, 170)
  ctx.fillRect(248, 88, 204, 76)
  ctx.fillRect(248, 182, 204, 76)
  ctx.fillStyle = "#16161d"
  ctx.font = "600 20px system-ui, sans-serif"
  ctx.fillText(`Screenshot ${n}`, 42, 55)
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob!], `screenshot-${n}.png`, { type: "image/png" })), "image/png"),
  )
}

function transfer(files: File[]): DataTransfer {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  return data
}

/** Dispatches a real `paste` event with these files on the editor, at the caret. */
export function pasteFiles(editor: EditorInstance, files: File[]): void {
  if (!editor.isFocused) editor.commands.focus("end")
  const data = transfer(files)
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data })
  if (!event.clipboardData) Object.defineProperty(event, "clipboardData", { value: data })
  editor.view.dom.dispatchEvent(event)
}

/** Dispatches a real `drop` event with these files just below the last block. */
export function dropFiles(editor: EditorInstance, files: File[]): void {
  const dom = editor.view.dom
  const last = (dom.lastElementChild ?? dom).getBoundingClientRect()
  const data = transfer(files)
  const init = { bubbles: true, cancelable: true, clientX: last.right - 4, clientY: last.bottom - 2, dataTransfer: data }
  const event = new DragEvent("drop", init)
  if (!event.dataTransfer) Object.defineProperty(event, "dataTransfer", { value: data })
  dom.dispatchEvent(event)
}
