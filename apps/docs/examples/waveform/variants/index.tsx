import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { Waveform } from '@/components/ui/waveform'

// Peaks for 20 s of audio at 40 slices a second (in an app, from
// useMediaPeaks). `mirror` grows from the middle, `bottom` rises from the floor;
// the tone is the text colour; `gain` follows a clip's volume.
const PEAKS = Float32Array.from({ length: 20 * 40 }, (_, i) =>
  Math.min(1, (0.15 + 0.7 * Math.abs(Math.sin(i / 7))) * (0.55 + 0.45 * Math.sin(i / 61)) + (i % 37 === 0 ? 0.3 : 0)),
)

export default function WaveformVariants() {
  const [gain, setGain] = useState(1)
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 p-4">
      <div className="h-14 rounded-ctl bg-secondary px-1">
        <Waveform peaks={PEAKS} rate={40} gain={gain} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="h-12 rounded-ctl bg-primary/12 px-1"><Waveform peaks={PEAKS} rate={40} gain={gain} tone="primary" variant="bottom" /></div>
        <div className="h-12 rounded-ctl bg-success/12 px-1"><Waveform peaks={PEAKS} rate={40} gain={gain} tone="success" from={5} to={10} /></div>
        <div className="h-12 rounded-ctl bg-secondary px-1"><Waveform peaks={PEAKS} rate={40} gain={gain} tone="muted" from={0} to={2} /></div>
      </div>
      <Slider label={`Gain: ${Math.round(gain * 100)}%`} minValue={0} maxValue={2} step={0.05} value={gain}
        onChange={(v) => setGain(v as number)} />
    </div>
  )
}
