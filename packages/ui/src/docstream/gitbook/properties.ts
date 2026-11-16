import { isMap, isScalar, parseDocument } from "yaml"
import type { DocumentPropertiesNode } from "./ast"

export type DocumentPropertyValue = string | number | boolean | null | DocumentPropertyValue[] | { [key: string]: DocumentPropertyValue }
export interface ParsedDocumentProperties {
  values: Record<string, DocumentPropertyValue>
  error?: string
}

/** Read properties without throwing on an incomplete or invalid document. YAML is never executed. */
export function readDocumentProperties(properties: DocumentPropertiesNode): ParsedDocumentProperties {
  try {
    const doc = parseDocument(properties.yaml)
    if (doc.errors.length) return { values: {}, error: doc.errors[0].message }
    if (doc.contents && !isMap(doc.contents)) return { values: {}, error: "Document properties must be a YAML mapping." }
    const values = (doc.toJS({ maxAliasCount: 100 }) ?? {}) as Record<string, DocumentPropertyValue>
    // Cyclic aliases can be preserved as YAML, but cannot be represented by editable JSON-like values.
    JSON.stringify(values)
    return { values }
  } catch (error) {
    return { values: {}, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Change one property while retaining the other keys, comments, scalar styles and frontmatter delimiters. */
export function setDocumentProperty(properties: DocumentPropertiesNode, key: string, value: DocumentPropertyValue): DocumentPropertiesNode {
  const doc = parseDocument(properties.yaml)
  const parsed = readDocumentProperties(properties)
  if (parsed.error) throw new Error(parsed.error)
  const previous = doc.get(key, true)
  const range = isScalar(previous) ? previous.range : undefined
  doc.set(key, value)
  const yaml = doc.toString().replace(/\n$/, "")
  const next = parseDocument(yaml).get(key, true)
  // A scalar edit is a source-range patch, leaving every other byte (including flow-list spacing) alone.
  if (range && isScalar(next) && next.range) {
    return { ...properties, yaml: properties.yaml.slice(0, range[0]) + yaml.slice(next.range[0], next.range[1]) + properties.yaml.slice(range[1]) }
  }
  return { ...properties, yaml }
}

/** Remove one property; the frontmatter remains available for adding more. */
export function removeDocumentProperty(properties: DocumentPropertiesNode, key: string): DocumentPropertiesNode {
  const doc = parseDocument(properties.yaml)
  const parsed = readDocumentProperties(properties)
  if (parsed.error) throw new Error(parsed.error)
  doc.delete(key)
  return { ...properties, yaml: doc.toString().replace(/\n$/, "") }
}
