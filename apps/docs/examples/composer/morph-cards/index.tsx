import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Composer, ComposerButton, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerText } from '@/components/ui/composer/composer'
import { ComposerCards, ComposerMorphCard } from '@/components/ui/composer/composer-cards'
import { Icon } from '@/lib/icon'
import { WorkbenchTheme } from '@/components/ui/workbench-theme'

// Cards grow out of the composer like a drop of liquid: they start inside the
// card, blurred, slide out with their outline necking in, and pinch off. Remove
// one and it sinks back in. The top tray suggests a connector; the bottom one
// shows the context the next message will carry.
function MorphCards() {
  const [suggest, setSuggest] = useState(true)
  const [context, setContext] = useState(false)
  return (
    <div className="mx-auto grid max-w-[520px] gap-6 py-10">
      <Composer>
        <ComposerCards side="top">
          {suggest ? (
            <ComposerMorphCard key="notion">
              <div className="flex items-center gap-2.5 py-2 ps-3 pe-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-[7px] border border-border bg-background text-footnote font-bold text-foreground">N</span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-caption2 text-foreground/70">MCP Connector</span>
                  <span className="truncate text-footnote font-semibold text-foreground">Notion</span>
                </span>
                <Button size="sm" variant="quiet" onPress={() => setSuggest(false)}>Skip</Button>
                <Button size="sm" variant="secondary" onPress={() => setSuggest(false)}>Connect</Button>
              </div>
            </ComposerMorphCard>
          ) : null}
        </ComposerCards>
        <ComposerCard>
          <ComposerInput placeholder="Ask anything…" />
          <ComposerFooter>
            <ComposerButton aria-label={context ? 'Hide context' : 'Show context'} onPress={() => setContext((c) => !c)}>
              <Icon name="sparkle" size={15} />
            </ComposerButton>
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
        <ComposerCards side="bottom">
          {context ? (
            <ComposerMorphCard key="context">
              <div className="flex items-center gap-2 px-3 py-2">
                <ComposerText className="flex-1 text-foreground/70">3 files and the open diff go with this message</ComposerText>
                <Button size="sm" variant="quiet" onPress={() => setContext(false)}>Clear</Button>
              </div>
            </ComposerMorphCard>
          ) : null}
        </ComposerCards>
      </Composer>
      <div className="flex justify-center gap-2">
        <Button variant="secondary" onPress={() => setSuggest((s) => !s)}>Toggle top card</Button>
        <Button variant="secondary" onPress={() => setContext((c) => !c)}>Toggle bottom card</Button>
      </div>
    </div>
  )
}

export default function MorphCardsExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <MorphCards />
    </WorkbenchTheme>
  )
}
