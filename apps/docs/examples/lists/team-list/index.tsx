import { useState } from 'react'
import {
  Avatar,
  Haptics,
  List,
  ListRow,
  ListSection,
  Switch,
} from '@brett_lamy/ui'

const people = [
  { f: 'Maya', l: 'Lindqvist', role: 'Industrial design' },
  { f: 'Jonas', l: 'Ito', role: 'Haptics engineering' },
]

export default function TeamList() {
  const [dnd, setDnd] = useState(true)
  return (
    <div style={{ maxWidth: 430, margin: '0 auto' }}>
      <List inset>
        <ListSection
          title="Team"
          footer="Rows are real buttons — arrow keys work too."
        >
          {people.map((p) => (
            <ListRow
              key={p.l}
              leading={<Avatar c={p} size={36} />}
              title={`${p.f} ${p.l}`}
              subtitle={p.role}
              accessory="chevron"
              onPress={() => Haptics.impact('light')}
            />
          ))}
          <ListRow
            title="Do Not Disturb"
            divider={false}
            trailing={
              <Switch
                aria-label="Do Not Disturb"
                checked={dnd}
                onChange={setDnd}
              />
            }
          />
        </ListSection>
      </List>
    </div>
  )
}
