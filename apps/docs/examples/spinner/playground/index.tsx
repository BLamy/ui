import { useState } from 'react'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { Spinner, spinnerAnimations, type SpinnerAnimation, type SpinnerProps } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

// Pick an animation and a pattern, then size, speed and pause. The code below the stage is what you would write.
export default function Playground() {
  const [animation, setAnimation] = useState<SpinnerAnimation>('orbit')
  const [pattern, setPattern] = useState<string | undefined>(undefined)
  const [size, setSize] = useState(48)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)

  const info = spinnerAnimations.find((a) => a.id === animation) ?? spinnerAnimations[0]
  const isIos = animation === 'ios'
  const active = info.patterns.includes(pattern ?? '') ? pattern : info.patterns[0]

  const props = [
    animation !== 'ios' && `animation="${animation}"`,
    active && active !== info.patterns[0] && `pattern="${active}"`,
    size !== (isIos ? 22 : 32) && `size={${size}}`,
    !isIos && speed !== 1 && `speed={${speed}}`,
    paused && 'paused',
  ].filter(Boolean)

  return (
    <div className="mx-auto grid max-w-lg gap-5">
      <div className="grid h-40 place-items-center rounded-card bg-card text-foreground shadow-hairline">
        <Spinner
          {...({ animation, pattern: active } as SpinnerProps)}
          size={size}
          speed={speed}
          paused={paused}
          label="Preview"
        />
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <span id="pg-animation" className="text-footnote font-semibold text-foreground">Animation</span>
          <Segmented
            aria-label="Animation"
            className="flex-wrap"
            value={animation}
            onValueChange={(id) => { if (id) { setAnimation(id as SpinnerAnimation); setPattern(undefined) } }}
          >
            {spinnerAnimations.map((a) => <SegmentedItem key={a.id} value={a.id}>{a.label}</SegmentedItem>)}
          </Segmented>
        </div>

        {info.patterns.length ? (
          <div className="grid gap-1.5">
            <span className="text-footnote font-semibold text-foreground">Pattern</span>
            <Segmented
              aria-label="Pattern"
              value={active ?? null}
              onValueChange={(v) => v && setPattern(v)}
            >
              {info.patterns.map((v) => <SegmentedItem key={v} value={v}>{v}</SegmentedItem>)}
            </Segmented>
          </div>
        ) : null}

        <Slider label={<span className="text-foreground">Size · {size}px</span>} value={size} onValueChange={(v) => setSize(v as number)} min={12} max={160} step={2} aria-label="Size" />
        <Slider label={<span className="text-foreground">Speed · {speed}×</span>} value={speed} onValueChange={(v) => setSpeed(v as number)} min={0.25} max={3} step={0.25} disabled={isIos} aria-label="Speed" />
        <label className="flex items-center gap-3 text-subhead text-foreground">
          <Switch checked={paused} onCheckedChange={setPaused} aria-label="Paused" />
          paused
        </label>
      </div>

      <pre className="m-0 overflow-x-auto rounded-ctl bg-secondary px-3 py-2 text-footnote text-foreground">{`<Spinner ${props.join(' ')} />`}</pre>
    </div>
  )
}
