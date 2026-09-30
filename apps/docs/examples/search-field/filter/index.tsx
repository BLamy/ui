import { useState } from 'react'
import { SearchField } from '@/components/ui/search-field'

const people = [
  { name: 'Ada Lovelace', role: 'Mathematician' },
  { name: 'Grace Hopper', role: 'Compiler pioneer' },
  { name: 'Katherine Johnson', role: 'Orbital mechanics' },
  { name: 'Margaret Hamilton', role: 'Flight software' },
  { name: 'Radia Perlman', role: 'Network protocols' },
  { name: 'Barbara Liskov', role: 'Type theory' },
]

// Controlled: the query is state, and the list is derived from it. Esc or the
// clear button resets it to ''. Enter calls onSubmit with the query.
export default function Filter() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState<string | null>(null)
  const q = query.trim().toLowerCase()
  const hits = people.filter((p) => `${p.name} ${p.role}`.toLowerCase().includes(q))
  return (
    <div className="mx-auto grid max-w-sm gap-3">
      <SearchField value={query} onChange={setQuery} onSubmit={setSubmitted} placeholder="Search people" aria-label="Search people" />
      <ul className="m-0 grid list-none gap-px overflow-hidden rounded-card bg-border p-0">
        {hits.map((p) => (
          <li key={p.name} className="flex items-baseline justify-between gap-3 bg-card px-4 py-2.5">
            <span className="text-body text-foreground">{p.name}</span>
            <span className="text-footnote text-muted-foreground">{p.role}</span>
          </li>
        ))}
        {hits.length === 0 ? <li className="bg-card px-4 py-6 text-center text-subhead text-muted-foreground">No results for “{query}”</li> : null}
      </ul>
      <p className="m-0 px-1 text-footnote text-muted-foreground">
        {submitted === null ? 'Press Enter to submit the query.' : `Submitted “${submitted}”.`}
      </p>
    </div>
  )
}
