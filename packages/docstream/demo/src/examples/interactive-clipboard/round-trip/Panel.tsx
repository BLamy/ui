import type { ReactNode } from "react"
import "./round-trip.css"

export function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rt-panel">
      <header>
        <strong>{title}</strong>
        <span className="rt-actions">{actions}</span>
      </header>
      {children}
    </section>
  )
}
