import { useState } from 'react'
import { Button, Haptics, Icon, NumberMorph } from '@brett_lamy/ui'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫']
const MAX = 9_999_999_999

export default function Amount() {
  const [cents, setCents] = useState(123456)
  const press = (k: string) => {
    Haptics.selection()
    setCents((c) => {
      const next =
        k === '⌫'
          ? Math.floor(c / 10)
          : c * (k === '00' ? 100 : 10) + (k === '00' ? 0 : Number(k))
      if (next > MAX) {
        Haptics.notification('warning')
        return c
      }
      return next
    })
  }
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: 14,
        justifyItems: 'center',
      }}
    >
      {/* Digits keep their place: typing slides the comma one digit left;
          changed digits roll. */}
      <div
        style={{
          fontSize: 44,
          fontWeight: 750,
          letterSpacing: -1,
          lineHeight: 1.15,
        }}
      >
        <NumberMorph
          value={cents / 100}
          format={{ style: 'currency', currency: 'USD' }}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 76px)',
          gap: 8,
        }}
      >
        {KEYS.map((k) => (
          <Button
            key={k}
            variant="secondary"
            size="lg"
            aria-label={k === '⌫' ? 'Delete' : k}
            onPress={() => press(k)}
          >
            {k === '⌫' ? <Icon name="chevL" size={20} sw={2.4} /> : k}
          </Button>
        ))}
      </div>
    </div>
  )
}
