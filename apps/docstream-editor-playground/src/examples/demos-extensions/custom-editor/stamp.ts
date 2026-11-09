/* A host extension appended after the GitBook set: Mod-Shift-H wraps the current block in a
   warning hint. Any TipTap extension works here (Collaboration, CharacterCount, your own marks). */
import { Extension } from "@tiptap/core"

export const HintShortcut = Extension.create({
  name: "hintShortcut",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-h": () => this.editor.commands.wrapIn("gbHint", { style: "warning" }),
    }
  },
})
