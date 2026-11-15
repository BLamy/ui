import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { QRCode } from '@/components/ui/qr-code'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'
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
        <QRCode
          value={value || ' '}
          size={176}
          level={level}
          shape={rounded ? 'rounded' : 'square'}
          aria-label="Open shared album"
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
          onValueChange={(v) => v && setLevel(v)}
        >
          {(['L', 'M', 'Q', 'H'] as const).map((l) => (
            <SegmentedItem key={l} value={l}>{l}</SegmentedItem>
          ))}
        </Segmented>
        <label className="flex items-center gap-3 text-subhead">
          <Switch checked={rounded} onCheckedChange={setRounded} aria-label="Rounded modules" />
          rounded modules
        </label>
      </div>
    </div>
  )
}
