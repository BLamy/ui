import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Composer, ComposerBump, ComposerBumpHandle, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerStop, ComposerText } from '@/components/ui/composer/composer'
import { Progress } from '@/components/ui/progress'
import { WorkbenchTheme } from '@/components/ui/workbench-theme'

const STEP = 10
const COST = 12 // credits a reply uses

/**
 * The bottom bump as a usage meter: "Project Credit Limit", a progress bar of
 * what's been spent, and a button on the right that raises the limit in +10
 * steps. Each reply spends credits; near the limit the bar turns red and
 * sending stops until the limit goes up.
 */
function CreditLimit() {
  const [limit, setLimit] = useState(100)
  const [used, setUsed] = useState(64)
  const [streaming, setStreaming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const left = limit - used
  const exhausted = left < COST
  const tone = exhausted ? 'destructive' : used / limit > 0.8 ? 'destructive' : 'default'

  return (
    <div style={{ maxWidth: 580, margin: '0 auto', paddingTop: 24 }}>
      <Composer
        defaultValue="Refactor the billing page to read the new usage endpoint."
        streaming={streaming}
        onSubmit={() => {
          if (exhausted) return
          setStreaming(true)
          setUsed((u) => Math.min(limit, u + COST))
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setStreaming(false), 1600)
        }}
        onStop={() => {
          clearTimeout(timer.current)
          setStreaming(false)
        }}
      >
        <ComposerCard size="lg">
          <ComposerInput placeholder={exhausted ? 'Raise the limit to keep going' : 'Ask anything'} />
          <ComposerFooter>
            <ComposerSpacer />
            <ComposerStop variant="solid" />
            <ComposerSend morph={false} />
          </ComposerFooter>
        </ComposerCard>
        <ComposerBump side="bottom">
          <ComposerBumpHandle>
            <ComposerText className="shrink-0">Project Credit Limit</ComposerText>
            <Progress
              aria-label="Project credit limit"
              value={used}
              minValue={0}
              maxValue={limit}
              valueLabel={`${used} of ${limit} credits`}
              size="sm"
              tone={tone}
              className="min-w-0 flex-1"
            />
            <ComposerText className="shrink-0 tabular-nums">
              {used} / {limit}
            </ComposerText>
            <Button
              size="sm"
              variant="secondary"
              className="h-6 rounded-md px-2 text-caption"
              aria-label={`Increase the limit by ${STEP}`}
              onPress={() => setLimit((l) => l + STEP)}
            >
              +{STEP}
            </Button>
          </ComposerBumpHandle>
        </ComposerBump>
      </Composer>
    </div>
  )
}

export default function CreditLimitExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <CreditLimit />
    </WorkbenchTheme>
  )
}
