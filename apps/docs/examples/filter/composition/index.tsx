import { Button } from '@/components/ui/button'
import { FilterChip, FilterMenu, useFilters } from '@/components/ui/filter'
import { Icon } from '@/lib/icon'
import { serializeFilters, type Filter, type FilterField } from '@/lib/filter'

const fields: FilterField[] = [
  { id: 'plan', label: 'Plan', icon: 'tag', kind: 'select', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'team', label: 'Team' }] },
  { id: 'region', label: 'Region', icon: 'globe', kind: 'multiselect', options: [{ value: 'us', label: 'United States' }, { value: 'eu', label: 'Europe' }, { value: 'apac', label: 'Asia Pacific' }] },
  { id: 'seats', label: 'Seats', icon: 'people', kind: 'number' },
]

// The parts work without a FilterBar too: useFilters() holds the state, FilterMenu adds to it (with a trigger of your
// own), and FilterChip draws and edits one filter. You give up what the bar adds: the toolbar's arrow keys, the live
// announcements and Clear all. Backspace and Delete on a chip still remove it.
export default function Composition() {
  const state = useFilters({
    defaultValue: [{ id: 'seed', field: 'plan', operator: 'is_any_of', value: ['pro', 'team'] } satisfies Filter],
  })
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu fields={fields} state={state} hotkey="g">
          <Button variant="secondary" size="sm" aria-keyshortcuts="G">
            <Icon name="plus" size={14} sw={2.4} />
            Add filter
          </Button>
        </FilterMenu>
        {state.filters.map((filter) => (
          <FilterChip
            key={filter.id}
            filter={filter}
            field={fields.find((f) => f.id === filter.field)}
            onChange={(next) => state.update(filter.id, { operator: next.operator, value: next.value })}
            onRemove={() => state.remove(filter.id)}
          />
        ))}
      </div>
      <p className="m-0 px-1 font-mono text-caption break-all text-foreground/70">{serializeFilters(state.filters) || '(no filters)'}</p>
    </div>
  )
}
