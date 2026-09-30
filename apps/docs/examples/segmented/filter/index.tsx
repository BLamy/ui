import { useState } from 'react'
import { Segmented } from '@/components/ui/segmented'

const inbox = [
  { id: 1, from: 'Maya Lindqvist', subject: 'Roadmap review moved', unread: true, flagged: false },
  { id: 2, from: 'Jonas Ito', subject: 'Invoice 4412', unread: false, flagged: true },
  { id: 3, from: 'Priya Raman', subject: 'Design crit notes', unread: true, flagged: true },
  { id: 4, from: 'Leo Okafor', subject: 'Lunch on Friday?', unread: false, flagged: false },
]

const filters = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'flagged', label: 'Flagged' },
]

// Sized through `className`: the control fills its container by default
// (segments share the width equally), and a fixed width or `w-fit` narrows it.
export default function Filter() {
  const [filter, setFilter] = useState('all')
  const [density, setDensity] = useState('comfortable')
  const rows = inbox.filter(
    (m) => filter === 'all' || (filter === 'unread' ? m.unread : m.flagged),
  )
  return (
    <div className="mx-auto grid max-w-sm gap-3">
      <Segmented
        aria-label="Filter messages"
        options={filters}
        value={filter}
        onChange={setFilter}
      />
      <Segmented
        aria-label="Density"
        className="w-fit"
        options={[
          { id: 'comfortable', label: 'Comfortable' },
          { id: 'compact', label: 'Compact' },
        ]}
        value={density}
        onChange={setDensity}
      />
      <ul className="m-0 grid list-none gap-px overflow-hidden rounded-card bg-border p-0">
        {rows.map((m) => (
          <li key={m.id} className={`flex items-center gap-2 bg-card px-4 ${density === 'compact' ? 'py-1.5' : 'py-3'}`}>
            <span
              className={
                m.unread
                  ? 'size-2 shrink-0 rounded-full bg-primary'
                  : 'size-2 shrink-0'
              }
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-subhead font-semibold">{m.from}</div>
              <div className="truncate text-footnote text-muted-foreground">
                {m.subject}
              </div>
            </div>
            {m.flagged && <span className="text-footnote text-warning">Flagged</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
