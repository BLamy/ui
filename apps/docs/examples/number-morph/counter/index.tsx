import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { NumberMorph } from '@/components/ui/number-morph'

// `format` takes Intl.NumberFormat options, so currency, percent and compact
// notation all roll the same way. Digits roll up as the value rises and down as
// it falls; separators slide to their new place as the number grows a digit.
export default function Counter() {
  const [balance, setBalance] = useState(1249.5)
  const [rate, setRate] = useState(0.42)
  const bump = (by: number) => setBalance((b) => Math.max(0, b + by))
  return (
    <div className="mx-auto grid w-full max-w-md gap-7">
      <div className="grid justify-items-center gap-3">
        <NumberMorph
          value={balance}
          format={{ style: 'currency', currency: 'USD' }}
          className="text-title font-semibold"
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onPress={() => bump(-1000)}>
            −1,000
          </Button>
          <Button variant="secondary" size="sm" onPress={() => bump(-50)}>
            −50
          </Button>
          <Button variant="secondary" size="sm" onPress={() => bump(50)}>
            +50
          </Button>
          <Button variant="secondary" size="sm" onPress={() => bump(10000)}>
            +10,000
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-title font-semibold">
            <NumberMorph value={rate} format={{ style: 'percent' }} />
          </div>
          <div className="text-caption2 text-muted-foreground">percent</div>
        </div>
        <div>
          <div className="text-title font-semibold">
            <NumberMorph value={balance * 1000} format={{ notation: 'compact' }} />
          </div>
          <div className="text-caption2 text-muted-foreground">compact</div>
        </div>
        <div>
          <div className="text-title font-semibold">
            <NumberMorph
              value={balance}
              locales="de-DE"
              format={{ style: 'currency', currency: 'EUR' }}
            />
          </div>
          <div className="text-caption2 text-muted-foreground">de-DE</div>
        </div>
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="secondary" size="sm" onPress={() => setRate((r) => Math.max(0, r - 0.07))}>
          Rate −7%
        </Button>
        <Button variant="secondary" size="sm" onPress={() => setRate((r) => Math.min(1, r + 0.07))}>
          Rate +7%
        </Button>
      </div>
    </div>
  )
}
