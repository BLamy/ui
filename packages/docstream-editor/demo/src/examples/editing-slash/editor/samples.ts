import { SLASH_ITEMS, type SlashItem } from "@brett_lamy/docstream-editor"
import type { Sample } from "./Workbench"

const icon = (title: string) => SLASH_ITEMS.find((item) => item.title === title)!.icon

/** A trimmed menu: four of the built-in items, plus two of our own. */
const ITEMS: SlashItem[] = [
  ...SLASH_ITEMS.filter((item) => ["Heading 2", "Bullet list", "Code block", "Table"].includes(item.title)),
  {
    title: "Warning",
    keywords: "caution careful hint callout",
    icon: icon("Hint"),
    run: (editor) =>
      editor
        .chain()
        .focus()
        .insertContent({
          type: "gbHint",
          attrs: { style: "warning" },
          content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Careful:" }, { type: "text", text: " " }] }],
        })
        .run(),
  },
  {
    title: "Today's date",
    keywords: "now time stamp",
    icon: icon("Updates"),
    run: (editor) => editor.chain().focus().insertContent(new Date().toISOString().slice(0, 10)).run(),
  },
]

export const SAMPLES = {
  default: {
    label: "Built-in menu",
    markdown: "# Slash menu\n\nClick at the end of this line, press Enter and type `/`.\n",
    tip: "Type / then a few letters — hint, tab, math, cite — and press Enter.",
  },
  custom: {
    label: "Custom items",
    markdown: "# A custom menu\n\nThis editor's menu has six items: four built-ins and two of its own. Start a new line and type `/`.\n",
    tip: "slashMenu={{ items }}: try /warning or /date.",
    props: { slashMenu: { items: ITEMS } },
  },
} satisfies Record<string, Sample>

export type SampleId = keyof typeof SAMPLES
