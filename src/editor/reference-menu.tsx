import { Extension, type Editor, type Range } from "@tiptap/core"
import Suggestion from "@tiptap/suggestion"
import { PluginKey } from "@tiptap/pm/state"
import { AtSign, Hash } from "lucide-react"

import { createSuggestionRender, type SuggestionMenuItem } from "./suggestion-menu"

export type ReferenceTrigger = "@" | "#"

interface ReferenceItem extends SuggestionMenuItem {
  id: string
}

export interface ReferenceSuggestionOptions {
  char: ReferenceTrigger
  /** Known ids offered in the picker; free-form entry always works. */
  items?: string[]
}

const KIND: Record<ReferenceTrigger, "mention" | "tag"> = { "@": "mention", "#": "tag" }

/**
 * An `@mention` / `#tag` picker built on @tiptap/suggestion. Filters the host's
 * known ids and always offers inserting the raw query, so typing `@anything⏎`
 * works with no list configured.
 */
export function createReferenceSuggestion({ char, items = [] }: ReferenceSuggestionOptions) {
  const kind = KIND[char]
  const icon = char === "@" ? AtSign : Hash
  return Extension.create({
    name: `${kind}Suggestion`,
    addProseMirrorPlugins() {
      return [
        Suggestion<ReferenceItem>({
          editor: this.editor,
          char,
          startOfLine: false,
          allowSpaces: false,
          // Each Suggestion plugin needs its own key — the default is shared
          // with the slash menu and would collide.
          pluginKey: new PluginKey(`${kind}Suggestion`),
          items: ({ query }) => {
            const q = query.toLowerCase()
            const matches = items
              .filter((id) => id.toLowerCase().includes(q))
              .map((id) => ({ id, title: `${char}${id}`, icon }))
            const freeForm = query && !items.some((id) => id.toLowerCase() === q)
            return freeForm ? [...matches, { id: query, title: `${char}${query}`, icon }] : matches
          },
          command: ({ editor, range, props }) => {
            ;(editor as Editor)
              .chain()
              .focus()
              .deleteRange(range as Range)
              .insertContent([
                { type: "gbReference", attrs: { kind, id: props.id } },
                { type: "text", text: " " },
              ])
              .run()
          },
          render: createSuggestionRender<ReferenceItem>(
            char === "@" ? "Type a name to mention" : "Type a tag"
          ),
        }),
      ]
    },
  })
}
