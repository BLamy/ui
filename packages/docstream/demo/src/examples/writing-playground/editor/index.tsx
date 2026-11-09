import { useMemo, useState } from "react"
import {
  DocsRenderer,
  DocumentProperties,
  parseMarkdown,
  serializeMarkdown,
  type ListItemNode,
  type TaskState,
} from "@brett_lamy/docstream"
import { SAMPLES, type SampleId } from "./samples"
import "./editor.css"

/** Writes a task state onto a list item the way the parser would have read it. */
function setTaskState(item: ListItemNode, state: TaskState) {
  delete item.checkMark
  item.checked = state === "verified"
  if (state === "pending" || state === "verified") delete item.state
  else item.state = state
}

/**
 * Markdown on the left, docstream on the right. Both directions are live: typing re-parses the
 * source, and clicking a task box or editing a property writes the change back into the source
 * through `serializeMarkdown`.
 */
export default function MarkdownPlayground({ variant = "basics" }: { variant?: string }) {
  const id = (variant in SAMPLES ? variant : "basics") as SampleId
  const [shown, setShown] = useState(id)
  const [source, setSource] = useState<string>(SAMPLES[id].markdown)
  if (shown !== id) {
    // The variant switch picks a fresh starting document.
    setShown(id)
    setSource(SAMPLES[id].markdown)
  }

  const doc = useMemo(() => parseMarkdown(source), [source])
  const roundTrips = useMemo(() => serializeMarkdown(doc) === source, [doc, source])

  const onTaskStateChange = (item: ListItemNode, state: TaskState) => {
    setTaskState(item, state) // `item` belongs to `doc`
    setSource(serializeMarkdown(doc))
  }

  return (
    <div className="wpg">
      <label className="wpg-pane wpg-source">
        <span className="wpg-head">
          Markdown
          <span className="wpg-badge" data-ok={roundTrips || undefined}>
            {roundTrips ? "round-trips byte-for-byte" : "normalized on save"}
          </span>
        </span>
        <textarea
          value={source}
          spellCheck={false}
          aria-label="Markdown source"
          onChange={(event) => setSource(event.currentTarget.value)}
        />
      </label>
      <div className="wpg-pane wpg-preview">
        <span className="wpg-head">
          Preview
          <span className="wpg-count">{doc.children.length} blocks</span>
        </span>
        <div className="wpg-render">
          {doc.properties ? (
            <DocumentProperties
              properties={doc.properties}
              defaultOpen
              onChange={(properties) => setSource(serializeMarkdown({ ...doc, properties }))}
            />
          ) : null}
          <DocsRenderer doc={doc} documentProperties={false} onTaskStateChange={onTaskStateChange} />
        </div>
      </div>
    </div>
  )
}
