import { useEffect, useState } from "react"
import { Glyph } from "../ui/glyph"
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox"
import { DetailsCollapsible } from "../ui/details-collapsible"
import { Input } from "@ui-sdk/react/input"
import { Textarea } from "@ui-sdk/react/textarea"
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
  if (typeof value === "boolean") return <Checkbox className="docs-property-checkbox" aria-label={name} checked={value} onCheckedChange={(next) => onChange(next === true)}>
    <CheckboxIndicator><Glyph name="check" size={11} sw={3} /></CheckboxIndicator>
  </Checkbox>
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
    {multiline ? <Textarea aria-label={name} value={draft} rows={Math.min(6, draft.split("\n").length)} aria-invalid={!!error || undefined}
      onValueChange={change} onBlur={commit} />
      : <Input type={typeof value === "number" ? "number" : "text"} aria-label={name} value={draft} placeholder="Empty" onValueChange={change} />}
    {error ? <span role="alert" className="docs-properties-error">{error}</span> : null}
  </div>
}

/** The shared, accessible property sheet used by the renderer and the editor. */
export function DocumentProperties({ properties, onChange, defaultOpen = false, className }: DocumentPropertiesProps) {
  const { values, error } = readDocumentProperties(properties)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const keys = Object.keys(values)
  return <DetailsCollapsible defaultOpen={defaultOpen} className={["docs-document-properties", className].filter(Boolean).join(" ")} data-document-properties=""
    triggerClassName="docs-properties-trigger" panelClassName="docs-properties-panel"
    summary={<><Glyph name="chevron-right" size={13} /><span>Properties</span><span className="docs-properties-count">{keys.length}</span></>}>
    {error ? <div className="docs-properties-error" role="alert">
      <p>{error}</p>
      {onChange ? <Textarea aria-label="Document properties YAML" value={properties.yaml} onValueChange={(yaml) => onChange({ ...properties, yaml })} />
        : <pre>{properties.yaml}</pre>}
    </div> : <>
      <dl className="docs-properties-list">
        {keys.map((key) => <div key={key} className="docs-property-row">
          <dt>{key}</dt>
          <dd>{onChange ? <PropertyField name={key} value={values[key]} onChange={(value) => onChange(setDocumentProperty(properties, key, value))} />
            : <span className="docs-property-value">{values[key] === null ? "Empty" : typeof values[key] === "boolean" ? String(values[key]) : textValue(values[key])}</span>}</dd>
          {onChange ? <button type="button" className="docs-property-remove" aria-label={`Remove ${key} property`} onClick={() => onChange(removeDocumentProperty(properties, key))}><Glyph name="xmark" size={13} /></button> : null}
        </div>)}
      </dl>
      {onChange ? adding ? <form className="docs-property-add" onSubmit={(event) => {
        event.preventDefault()
        const key = name.trim()
        if (!key || Object.hasOwn(values, key)) return
        onChange(setDocumentProperty(properties, key, "")); setName(""); setAdding(false)
      }}><Input aria-label="Property name" placeholder="Property name" autoFocus value={name} onValueChange={setName} />
        <button type="submit" disabled={!name.trim() || Object.hasOwn(values, name.trim())}>Add</button>
        <button type="button" onClick={() => { setAdding(false); setName("") }}>Cancel</button></form>
        : <button type="button" className="docs-property-add" onClick={() => setAdding(true)}><Glyph name="plus" size={13} />Add property</button> : null}
    </>}
  </DetailsCollapsible>
}
