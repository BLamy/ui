import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TextMorph } from '@/components/ui/text-morph'

// A string child morphs on change: shared letters (C, o, n, i) slide into
// place, the rest blur out and in, and the button springs to its new width.
export default function SendButton() {
  const [ready, setReady] = useState(false)
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: 14,
        justifyItems: 'center',
      }}
    >
      <Button
        size="lg"
        onPress={() => setReady((r) => !r)}
      >
        {ready ? 'Confirm' : 'Continue'}
      </Button>
      {/* Any text, outside a button too */}
      <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: -0.4 }}>
        <TextMorph>
          {ready ? 'Review and confirm' : 'Review and continue'}
        </TextMorph>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--muted-foreground)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Press the button. Letters the two words share stay and slide; the rest
        cross through a blur.
      </div>
    </div>
  )
}
