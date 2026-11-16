import { useEffect, useState } from "react"
import { ChevronRight, Plus, X } from "lucide-react"
import { parseDocument, stringify } from "yaml"
import type { DocumentPropertiesNode } from "../gitbook/ast"
import { readDocumentProperties, removeDocumentProperty, setDocumentProperty, type DocumentPropertyValue } from "../gitbook/properties"

export interface DocumentPropertiesProps {
  properties: DocumentPropertiesNode
  /** Omit for read-only properties. Edits retain the YAML document's comments and formatting. */
  onChange?: (properties: DocumentPropertiesNode) => void
  defaultOpen?: boolean
  className?: string
}

function textValue(value: DocumentPropertyValue): string {
  return value === null ? "" : typeof value === "object" ? stringify(value).trimEnd() : String(value)
}

function PropertyField({ name, value, onChange }: { name: string; value: DocumentPropertyValue; onChange: (value: DocumentPropertyValue) => void }) {
  const rendered = textValue(value)
  const [draft, setDraft] = useState(rendered)
  const [error, setError] = useState<string>()
  useEffect(() => { setDraft(rendered); setError(undefined) }, [rendered])
  if (typeof value === "boolean") return <input type="checkbox" aria-label={name} checked={value} onChange={(event) => onChange(event.currentTarget.checked)} />
  const complex = value !== null && typeof value === "object"
  const multiline = complex || (typeof value === "string" && value.includes("\n"))
  const change = (text: string) => {
    setDraft(text)
    if (!complex && typeof value !== "number") onChange(text)
    else if (typeof value === "number" && text !== "" && Number.isFinite(Number(text))) onChange(Number(text))
  }
  const commit = () => {
    if (!complex) return
    try {
      const yaml = parseDocument(draft)
      if (yaml.errors.length) throw yaml.errors[0]
      const next = yaml.toJS({ maxAliasCount: 100 }) as DocumentPropertyValue
      JSON.stringify(next)
      setError(undefined)
      onChange(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <div className="docs-property-field">
    {multiline ? <textarea aria-label={name} value={draft} rows={Math.min(6, draft.split("\n").length)} aria-invalid={!!error || undefined}
      onChange={(event) => change(event.currentTarget.value)} onBlur={commit} />
      : <input type={typeof value === "number" ? "number" : "text"} aria-label={name} value={draft} placeholder="Empty"
        onChange={(event) => change(event.currentTarget.value)} />}
    {error ? <span role="alert" className="docs-properties-error">{error}</span> : null}
  </div>
}

/** The shared, accessible property sheet used by the renderer and the editor. */
export function DocumentProperties({ properties, onChange, defaultOpen = false, className }: DocumentPropertiesProps) {
  const { values, error } = readDocumentProperties(properties)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const keys = Object.keys(values)
  return <details className={["docs-document-properties", className].filter(Boolean).join(" ")} data-document-properties="" open={defaultOpen || undefined}>
    <summary><ChevronRight size={13} aria-hidden="true" /><span>Properties</span><span className="docs-properties-count">{keys.length}</span></summary>
    {error ? <div className="docs-properties-error" role="alert">
      <p>{error}</p>
      {onChange ? <textarea aria-label="Document properties YAML" value={properties.yaml} onChange={(event) => onChange({ ...properties, yaml: event.currentTarget.value })} />
        : <pre>{properties.yaml}</pre>}
    </div> : <>
      <dl className="docs-properties-list">
        {keys.map((key) => <div key={key} className="docs-property-row">
          <dt>{key}</dt>
          <dd>{onChange ? <PropertyField name={key} value={values[key]} onChange={(value) => onChange(setDocumentProperty(properties, key, value))} />
            : <span className="docs-property-value">{values[key] === null ? "Empty" : typeof values[key] === "boolean" ? String(values[key]) : textValue(values[key])}</span>}</dd>
          {onChange ? <button type="button" className="docs-property-remove" aria-label={`Remove ${key} property`} onClick={() => onChange(removeDocumentProperty(properties, key))}><X size={13} /></button> : null}
        </div>)}
      </dl>
      {onChange ? adding ? <form className="docs-property-add" onSubmit={(event) => {
        event.preventDefault()
        const key = name.trim()
        if (!key || Object.hasOwn(values, key)) return
        onChange(setDocumentProperty(properties, key, "")); setName(""); setAdding(false)
      }}><input aria-label="Property name" placeholder="Property name" autoFocus value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <button type="submit" disabled={!name.trim() || Object.hasOwn(values, name.trim())}>Add</button>
        <button type="button" onClick={() => { setAdding(false); setName("") }}>Cancel</button></form>
        : <button type="button" className="docs-property-add" onClick={() => setAdding(true)}><Plus size={13} />Add property</button> : null}
    </>}
  </details>
}
