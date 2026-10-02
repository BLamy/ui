import { useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { Spinner, spinnerAnimations, type SpinnerAnimation, type SpinnerVariant } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

// Pick an animation and a variant, then size, speed and pause. The code below the stage is what you would write.
export default function Playground() {
  const [animation, setAnimation] = useState<SpinnerAnimation>('orbit')
  const [variant, setVariant] = useState<string | undefined>(undefined)
  const [size, setSize] = useState(48)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)

  const info = spinnerAnimations.find((a) => a.id === animation) ?? spinnerAnimations[0]
  const isIos = animation === 'ios'
  const active = info.variants.includes(variant ?? '') ? variant : info.variants[0]

  const props = [
    animation !== 'ios' && `animation="${animation}"`,
    active && active !== info.variants[0] && `variant="${active}"`,
    isIos ? 'spin' : null,
    size !== (isIos ? 22 : 32) && `size={${size}}`,
    !isIos && speed !== 1 && `speed={${speed}}`,
    !isIos && paused && 'paused',
  ].filter(Boolean)

  return (
    <div className="mx-auto grid max-w-lg gap-5">
      <div className="grid h-40 place-items-center rounded-card bg-card text-foreground shadow-hairline">
        <Spinner
          animation={animation}
          variant={active as SpinnerVariant | undefined}
          spin={isIos}
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
            onChange={(id) => { setAnimation(id as SpinnerAnimation); setVariant(undefined) }}
            options={spinnerAnimations.map((a) => ({ id: a.id, label: a.label }))}
          />
        </div>

        {info.variants.length ? (
          <div className="grid gap-1.5">
            <span className="text-footnote font-semibold text-foreground">Variant</span>
            <Segmented
              aria-label="Variant"
              value={active ?? ''}
              onChange={setVariant}
              options={info.variants.map((v) => ({ id: v, label: v }))}
            />
          </div>
        ) : null}

        <Slider label={<span className="text-foreground">Size · {size}px</span>} value={size} onChange={(v) => setSize(v as number)} minValue={12} maxValue={160} step={2} aria-label="Size" />
        <Slider label={<span className="text-foreground">Speed · {speed}×</span>} value={speed} onChange={(v) => setSpeed(v as number)} minValue={0.25} maxValue={3} step={0.25} isDisabled={isIos} aria-label="Speed" />
        <label className="flex items-center gap-3 text-subhead text-foreground">
          <Switch checked={paused} onChange={setPaused} aria-label="Paused" />
          paused
        </label>
      </div>

      <pre className="m-0 overflow-x-auto rounded-ctl bg-secondary px-3 py-2 text-footnote text-foreground">{`<Spinner ${props.join(' ')} />`}</pre>
    </div>
  )
}
