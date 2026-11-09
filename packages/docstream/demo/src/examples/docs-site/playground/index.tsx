/* DocsSite on a live, editable VFS: change a file and the sidebar, outline, search and page
   rebuild. `routing="memory"` keeps its navigation out of this page's URL, and `palette={false}`
   lets it take its colors (and light / dark) from the page around it. */
import { useMemo, useState } from "react"
import { DocsSite } from "@brett_lamy/docstream/site"
import { AUTO_TREE, WITH_SUMMARY, type Files } from "./files"
import "./playground.css"

export default function DocsSitePlayground({ variant = "auto" }: { variant?: string }) {
  const initial = variant === "summary" ? WITH_SUMMARY : AUTO_TREE
  return <Playground key={variant} initial={initial} />
}

function Playground({ initial }: { initial: Files }) {
  const [files, setFiles] = useState<Files>(initial)
  const paths = useMemo(() => Object.keys(files).sort(), [files])
  const [open, setOpen] = useState(paths.find((p) => p === "SUMMARY.md") ?? "README.md")

  const addPage = () => {
    let n = 1
    while (files[`01-guides/0${n + 2}-new-page.md`]) n++
    const path = `01-guides/0${n + 2}-new-page.md`
    setFiles((f) => ({ ...f, [path]: "# A new page\n\nIt appears in the sidebar as soon as it exists.\n\n## A section\n\nAnd its headings join the outline and search.\n" }))
    setOpen(path)
  }

  return (
    <div className="dsp">
      <div className="dsp-files">
        <div className="dsp-files-head">
          <span>Files</span>
          <button type="button" onClick={addPage}>+ Page</button>
        </div>
        <ul>
          {paths.map((p) => (
            <li key={p}>
              <button type="button" aria-current={p === open || undefined} data-md={/\.md$/.test(p) || undefined} onClick={() => setOpen(p)}>
                {p}
              </button>
            </li>
          ))}
        </ul>
        <textarea
          aria-label={`Contents of ${open}`}
          spellCheck={false}
          value={files[open] ?? ""}
          onChange={(e) => setFiles((f) => ({ ...f, [open]: e.target.value }))}
        />
      </div>
      <div className="dsp-site">
        <DocsSite files={files} title="Rocket" routing="memory" height="100%" themeToggle={false} palette={false} />
      </div>
    </div>
  )
}
