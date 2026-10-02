import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Composer, ComposerBump, ComposerBumpHandle, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerText } from '@/components/ui/composer/composer'
import { ComposerCards, ComposerMorphCard } from '@/components/ui/composer/composer-cards'
import { WorkbenchTheme } from '@/components/ui/workbench-theme'

const STEPS = ['Read the billing page', 'Found the usage endpoint', 'Wrote a failing test']

// With a bump on the same side, cards come out of the bump instead of the card:
// each step the agent finishes grows out of the "Working" nub above the composer,
// and each new one out of the one before it.
function FromBump() {
  const [shown, setShown] = useState(1)
  return (
    <div className="mx-auto grid max-w-[520px] gap-6 py-10">
      <Composer>
        <ComposerCards side="top">
          {STEPS.slice(0, shown).map((step) => (
            <ComposerMorphCard key={step}>
              <div className="px-3 py-2 text-footnote text-foreground">{step}</div>
            </ComposerMorphCard>
          ))}
        </ComposerCards>
        <ComposerBump side="top">
          <ComposerBumpHandle>
            <ComposerText className="text-foreground/70">Working · {shown} of {STEPS.length} steps</ComposerText>
          </ComposerBumpHandle>
        </ComposerBump>
        <ComposerCard size="lg">
          <ComposerInput placeholder="Ask anything…" />
          <ComposerFooter>
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
      <div className="flex justify-center gap-2">
        <Button variant="secondary" isDisabled={shown >= STEPS.length} onPress={() => setShown((n) => n + 1)}>Add step</Button>
        <Button variant="secondary" isDisabled={shown === 0} onPress={() => setShown((n) => n - 1)}>Remove step</Button>
      </div>
    </div>
  )
}

export default function FromBumpExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <FromBump />
    </WorkbenchTheme>
  )
}
