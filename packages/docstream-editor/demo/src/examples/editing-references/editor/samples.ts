import type { ReferenceOption } from "@brett_lamy/docstream-editor"
import type { Sample } from "./Workbench"

const PEOPLE: ReferenceOption[] = [
  { id: "luna", label: "Luna Park", description: "luna@example.com", group: "People" },
  { id: "dana", label: "Dana Ortiz", description: "dana@example.com", group: "People" },
  { id: "sam", label: "Sam Lee", description: "sam@example.com", group: "People" },
  { id: "reviewer", label: "Reviewer", description: "agent · claude-code", group: "Agents" },
  { id: "release-bot", label: "Release bot", description: "agent · ci", group: "Agents" },
]

const CHANNELS: ReferenceOption[] = [
  { id: "general", description: "Company-wide", group: "Channels" },
  { id: "launch", description: "Q4 launch war room", group: "Channels" },
  { id: "design-system", description: "Tokens, components", group: "Channels" },
  { id: "bug", group: "Labels" },
  { id: "needs-review", group: "Labels" },
]

const REPOS: ReferenceOption[] = [
  { id: "BLamy/docstream", description: "renderer" },
  { id: "BLamy/docstream-editor", description: "this editor" },
  { id: "acme/web", description: "marketing site" },
]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** What a host's search endpoint does: filter on the server, answer later. */
const search = (options: ReferenceOption[]) => async (query: string) => {
  await wait(250)
  const q = query.toLowerCase()
  return options.filter((option) => `${option.id} ${option.label ?? ""} ${option.description ?? ""}`.toLowerCase().includes(q))
}

const NOTE = `# Launch notes

@luna owns the launch; ask in #launch before you merge into $acme/web.

Prices like $5 and addresses like brett@example.com stay plain text.

Type a chip below — @, # or $ — and pick from the menu.
`

export const SAMPLES = {
  freeform: {
    label: "Free-form",
    markdown: NOTE,
    tip: "The defaults: @ and # offer whatever you type. $ is off until the host gives it a source.",
  },
  directory: {
    label: "Host lists",
    markdown: NOTE,
    tip: "Static lists with labels, descriptions and groups — try @a (both Agents), #la or $docs.",
    props: { references: { mentions: PEOPLE, tags: CHANNELS, codebases: REPOS } },
  },
  async: {
    label: "Async search",
    markdown: NOTE,
    tip: "Each trigger asks a (fake, 250 ms) search function per keystroke; free-form entry is still offered.",
    props: { references: { mentions: search(PEOPLE), tags: search(CHANNELS), codebases: search(REPOS) } },
  },
  citations: {
    label: "Citations",
    markdown: `# Why round trips matter

An editor that rewrites Markdown on save turns every edit into a noisy diff[^1]. ProseMirror documents are trees with a schema, so every block needs a node[^2].

Put the caret after a sentence, type /cite and press Enter: the next free number is inserted.

[^1]: https://blamy.github.io/docstream/ "docstream"
[^2]: https://prosemirror.net/docs/guide/ "ProseMirror guide"
`,
    tip: "Hover a citation for its label. Definitions live in the Markdown — add [^3]: … on the right.",
  },
  off: {
    label: "Off",
    markdown: NOTE,
    tip: "references={false}: no menus, but chips already in the Markdown still load as chips.",
    props: { references: false },
  },
} satisfies Record<string, Sample>

export type SampleId = keyof typeof SAMPLES
