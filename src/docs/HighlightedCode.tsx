import { useMemo } from "react"
import { common, createLowlight } from "lowlight"
import { toHtml } from "hast-util-to-html"

const lowlight = createLowlight(common)

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml",
}

function normalizeLanguage(language: string | null) {
  if (!language) return null
  const normalized = language.toLowerCase()
  return LANGUAGE_ALIASES[normalized] ?? normalized
}

function highlightedHtml(code: string, language: string | null) {
  const normalized = normalizeLanguage(language)
  if (normalized && lowlight.registered(normalized)) {
    try {
      return toHtml(lowlight.highlight(normalized, code))
    } catch {
      /* fall through to plain */
    }
  }
  return null
}

export function HighlightedCode({
  code,
  language,
  lineNumbers = false,
}: {
  code: string
  language: string | null
  lineNumbers?: boolean
}) {
  const lines = useMemo(() => code.split("\n"), [code])
  const html = useMemo(() => {
    if (lineNumbers) {
      return lines.map((line) => highlightedHtml(line || " ", language))
    }
    return highlightedHtml(code, language)
  }, [code, language, lineNumbers, lines])

  if (lineNumbers) {
    return (
      <code className="hljs">
        {(html as Array<string | null>).map((lineHtml, index) => (
          <span key={index} className="docs-code-line">
            <span className="docs-code-lineno">{index + 1}</span>
            {lineHtml === null ? (
              <span>{lines[index]}</span>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: lineHtml }} />
            )}
          </span>
        ))}
      </code>
    )
  }

  if (html === null) return <code>{code}</code>
  return <code className="hljs" dangerouslySetInnerHTML={{ __html: html as string }} />
}
