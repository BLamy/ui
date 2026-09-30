import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { QRSvg } from '@/components/ui/qr-svg'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'

type Level = 'L' | 'M' | 'Q' | 'H'

// A real QR code: point a phone camera at it. The card supplies the quiet zone
// scanners need (padding here; `margin` does the same inside the SVG), and a
// light ground, so the code stays readable in dark mode.
export default function Share() {
  const [value, setValue] = useState('https://example.com/albums/summer-2026')
  const [level, setLevel] = useState<Level>('M')
  const [rounded, setRounded] = useState(true)
  return (
    <div className="mx-auto flex flex-wrap items-center justify-center gap-8">
      <div className="rounded-card bg-white p-4 text-black">
        <QRSvg
          value={value || ' '}
          size={176}
          level={level}
          rounded={rounded}
          title="Open shared album"
        />
      </div>
      <div className="grid w-64 gap-4">
        <Input
          aria-label="Text to encode"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Segmented
          aria-label="Error correction level"
          value={level}
          onChange={(v) => setLevel(v as Level)}
          options={(['L', 'M', 'Q', 'H'] as const).map((l) => ({ id: l, label: l }))}
        />
        <label className="flex items-center gap-3 text-subhead">
          <Switch checked={rounded} onChange={setRounded} aria-label="Rounded modules" />
          rounded modules
        </label>
      </div>
    </div>
  )
}
