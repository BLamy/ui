import { useState } from 'react'
import { Fader, Knob, StepGrid } from '@/components/ui/strudel-rack'
import { parseMini } from '@/components/ui/strudel-syntax'

// The rack's hardware on its own. Wrap it in .strudel-rack for the
// brushed-steel panel and its colours. Drag (Shift for fine), arrow keys,
// double-click to reset. Click a step to rest it; double-click to type.
export default function Hardware() {
  const [cutoff, setCutoff] = useState(1200)
  const [pan, setPan] = useState(0.5)
  const [gain, setGain] = useState(0.8)
  const [steps, setSteps] = useState('bd ~ [~ bd] sd, hh*8')
  return (
    <div className="strudel-rack" style={{ width: '100%', maxWidth: 640 }}>
      <div className="strudel-device" data-kind="drums" style={{ display: 'flex', gap: 18, alignItems: 'center', padding: 18 }}>
        <Fader label="Gain" value={gain} min={0} max={1.5} defaultValue={1} onChange={setGain} format={(v) => `${Math.round(v * 100)}`} />
        <Knob label="Cutoff" value={cutoff} min={40} max={16000} log defaultValue={1200} onChange={setCutoff} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))} />
        <Knob label="Pan" value={pan} min={0} max={1} defaultValue={0.5} onChange={setPan} />
        <Knob size="lg" label="Drive" value={gain * 2} min={0} max={3} onChange={(v) => setGain(v / 2)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <StepGrid
            mini={parseMini(steps)}
            onAtomChange={(atom, text) => setSteps(steps.slice(0, atom.start) + text + steps.slice(atom.end))}
          />
          <code style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#9dff9a' }}>{steps}</code>
        </div>
      </div>
    </div>
  )
}
