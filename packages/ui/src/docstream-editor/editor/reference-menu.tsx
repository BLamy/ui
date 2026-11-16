import { Extension, type Editor } from "@tiptap/core"
import type { IconName } from "@brett_lamy/ui/lib/icon"
import type { TriggerMenuData, TriggerMenuDataItem } from "@ui-sdk/react/trigger-menu"

import { editorTriggerPlugin, matchesQuery, type EditorTrigger, type TriggerMenuEntry } from "./trigger-menu"

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

const KIND: Record<ReferenceTrigger, "mention" | "tag" | "codebase"> = {
  "@": "mention",
  "#": "tag",
  $: "codebase",
}
const ICON: Record<ReferenceTrigger, IconName> = { "@": "at", "#": "number", $: "folder-git" }
const EMPTY: Record<ReferenceTrigger, string> = {
  "@": "Type a name to mention",
  "#": "Type a channel or tag",
  $: "Type a codebase",
}
const LABEL: Record<ReferenceTrigger, string> = { "@": "Mentions", "#": "Tags", $: "Codebases" }
const MAX_OPTIONS = 50

function normalize(option: string | ReferenceOption): ReferenceOption {
  return typeof option === "string" ? { id: option } : option
}

/** Resolve a source for a query into options (exported for hosts' tests). */
export async function resolveReferenceOptions(
  source: ReferenceSource | undefined,
  query: string,
): Promise<ReferenceOption[]> {
  if (source === undefined) return []
  if (typeof source === "function") return [...(await source(query))].slice(0, MAX_OPTIONS)
  return source.map(normalize).filter((option) => matchesQuery(query, option.id, option.label)).slice(0, MAX_OPTIONS)
}

/** The trigger for `char`: options load for each query (from the host's source), grouped as the host groups them, with the raw query last. */
function referenceTrigger({ char, items, allowFreeForm = true }: ReferenceSuggestionOptions): EditorTrigger {
  const icon = ICON[char]
  // What the last load listed, by id, for rendering.
  let entries = new Map<string, TriggerMenuEntry>()
  return {
    char,
    label: LABEL[char],
    empty: EMPTY[char],
    type: KIND[char],
    items: async (query, context) => {
      let options: ReferenceOption[]
      try {
        options = await resolveReferenceOptions(items, query)
      } catch {
        options = []
      }
      const next = new Map<string, TriggerMenuEntry>()
      const data: TriggerMenuData = []
      type Group = { type: "group"; label: string; items: TriggerMenuDataItem[] }
      let group = null as Group | null
      for (const option of options) {
        if (next.has(option.id)) continue
        const description = [option.label, option.description].filter(Boolean).join(" · ")
        next.set(option.id, { title: `${char}${option.id}`, icon, ...(description ? { description } : {}) })
        const entry: TriggerMenuDataItem = { value: option.id, label: option.label ? `${option.id} ${option.label}` : option.id }
        if (!option.group) {
          group = null
          data.push(entry)
        } else if (group && group.label === option.group) group.items.push(entry)
        else {
          group = { type: "group", label: option.group, items: [entry] }
          data.push(group)
        }
      }
      const exact = options.some((option) => option.id.toLowerCase() === query.toLowerCase())
      if (allowFreeForm && query && !exact && !next.has(query)) {
        next.set(query, { title: `${char}${query}`, icon })
        data.push({ value: query, label: query })
      }
      // A newer query replaced this load: the menu drops its result, so it mustn't replace the map
      // the newer list renders from.
      if (context?.signal?.aborted) return []
      entries = next
      return data
    },
    entry: (value) => entries.get(value),
  }
}

/**
 * An `@mention` / `#tag` / `$codebase` picker. Options come from the host (static or async) and the
 * raw query is offered as a free-form entry, so `@anything⏎` works with no source configured.
 * Choosing one inserts a reference chip.
 */
export function createReferenceSuggestion(options: ReferenceSuggestionOptions) {
  const kind = KIND[options.char]
  return Extension.create({
    name: `${kind}Suggestion`,
    addProseMirrorPlugins() {
      return [editorTriggerPlugin(`${kind}Suggestion`, this.editor as Editor, () => referenceTrigger(options))]
    },
  })
}
