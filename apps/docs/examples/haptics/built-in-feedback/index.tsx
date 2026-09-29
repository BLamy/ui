import { useState } from 'react'
import {
  List,
  ListRow,
  ListSection,
  Segmented,
  Slider,
  Switch,
} from '@brett_lamy/ui'

export default function BuiltInFeedback() {
  const [size, setSize] = useState('m')
  const [notify, setNotify] = useState(true)
  const [speed, setSpeed] = useState(3)
  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '10px 0' }}>
      {/* No haptics calls here: these components tick on their own */}
      <List inset>
        <ListSection
          title="Text size"
          footer="Segmented: one selection tick per change."
        >
          <div style={{ padding: 10, background: 'var(--bl-card)' }}>
            <Segmented
              aria-label="Text size"
              value={size}
              onChange={setSize}
              options={[
                { id: 's', label: 'Small' },
                { id: 'm', label: 'Medium' },
                { id: 'l', label: 'Large' },
              ]}
            />
          </div>
        </ListSection>
        <ListSection
          footer={'Switch: a light impact. Slider: a tick at ' + 'every step.'}
        >
          <ListRow
            title="Notifications"
            trailing={
              <Switch
                aria-label="Notifications"
                checked={notify}
                onChange={setNotify}
              />
            }
          />
          <div style={{ padding: '12px 16px', background: 'var(--bl-card)' }}>
            <Slider
              label="Playback speed"
              showValue
              minValue={1}
              maxValue={5}
              value={speed}
              onChange={setSpeed}
            />
          </div>
        </ListSection>
      </List>
    </div>
  )
}
