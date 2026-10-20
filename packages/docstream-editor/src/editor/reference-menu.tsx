import { Extension, type Editor, type Range } from "@tiptap/core"
import Suggestion from "@tiptap/suggestion"
import { PluginKey } from "@tiptap/pm/state"
import { AtSign, FolderGit2, Hash, type LucideIcon } from "lucide-react"

import { createSuggestionRender, type SuggestionMenuItem } from "./suggestion-menu"

export type ReferenceTrigger = "@" | "#" | "$"

/** One pickable reference: the chip stores `id`; the rest only decorates the menu. */
export interface ReferenceOption {
  id: string
  /** Display name shown next to the id (e.g. "Luna" for `@luna`). */
  label?: string
  /** Secondary line (e.g. an email, "agent · claude-code", a topic). */
  description?: string
  /** Section header; consecutive options with the same group are listed together. */
  group?: string
}

/**
 * Where a trigger's options come from: a static list (filtered by the editor), or a
 * function the host answers per query — sync or async, already filtered.
 */
export type ReferenceSource =
  | readonly (string | ReferenceOption)[]
  | ((query: string) => readonly ReferenceOption[] | Promise<readonly ReferenceOption[]>)

export interface ReferenceSuggestionOptions {
  char: ReferenceTrigger
  /** Options offered in the picker; free-form entry works unless disabled. */
  items?: ReferenceSource
  /** Offer inserting the raw query when nothing matches exactly (default true). */
  allowFreeForm?: boolean
}

interface ReferenceItem extends SuggestionMenuItem {
  id: string
}

const KIND: Record<ReferenceTrigger, "mention" | "tag" | "codebase"> = {
  "@": "mention",
  "#": "tag",
  $: "codebase",
}
const ICON: Record<ReferenceTrigger, LucideIcon> = { "@": AtSign, "#": Hash, $: FolderGit2 }
const EMPTY: Record<ReferenceTrigger, string> = {
  "@": "Type a name to mention",
  "#": "Type a channel or tag",
  $: "Type a codebase",
}
const MAX_OPTIONS = 50

function normalize(option: string | ReferenceOption): ReferenceOption {
  return typeof option === "string" ? { id: option } : option
}

function matches(option: ReferenceOption, query: string): boolean {
  if (!query) return true
  return [option.id, option.label ?? ""].some((value) => value.toLowerCase().includes(query))
}

/** Resolve a source for a query into options (exported for hosts' tests). */
export async function resolveReferenceOptions(
  source: ReferenceSource | undefined,
  query: string,
): Promise<ReferenceOption[]> {
  if (source === undefined) return []
  if (typeof source === "function") return [...(await source(query))].slice(0, MAX_OPTIONS)
  const q = query.toLowerCase()
  return source.map(normalize).filter((option) => matches(option, q)).slice(0, MAX_OPTIONS)
}

/**
 * An `@mention` / `#tag` / `$codebase` picker built on @tiptap/suggestion. Options come
 * from the host (static or async) and the raw query is offered as a free-form entry,
 * so `@anything⏎` works with no source configured.
 */
export function createReferenceSuggestion({
  char,
  items,
  allowFreeForm = true,
}: ReferenceSuggestionOptions) {
  const kind = KIND[char]
  const icon = ICON[char]
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
          items: async ({ query }) => {
            let options: ReferenceOption[]
            try {
              options = await resolveReferenceOptions(items, query)
            } catch {
              options = []
            }
            const menu: ReferenceItem[] = options.map((option) => ({
              id: option.id,
              title: `${char}${option.id}`,
              icon,
              ...(option.label || option.description
                ? { description: [option.label, option.description].filter(Boolean).join(" · ") }
                : {}),
              ...(option.group ? { group: option.group } : {}),
            }))
            const exact = options.some((option) => option.id.toLowerCase() === query.toLowerCase())
            return allowFreeForm && query && !exact
              ? [...menu, { id: query, title: `${char}${query}`, icon }]
              : menu
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
          render: createSuggestionRender<ReferenceItem>(EMPTY[char]),
        }),
      ]
    },
  })
}
