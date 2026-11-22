import { useEffect, useState } from 'react'
import { FullStackReplay } from '@/components/ui/replay-debugger'
import type { ReplaySession } from '@/components/ui/replay-debugger'
import { loadSession, SESSION_URLS } from '@/components/blocks/replay-debugger/sessions'

// A browser and four services, each recorded on its own and lined up on one clock: the page as rrweb saw it, the
// session's timeline, and each request a backend answered with its code at the step the playhead is on. Scrub and the
// line moves step by step; pass into the next request and it opens as this one closes. On a phone the page floats in a
// corner you can drag it out of, and the timeline is a rail on the edge.
export default function RequestPoints() {
  const [session, setSession] = useState<ReplaySession | null>(null)
  useEffect(() => {
    let live = true
    void loadSession(SESSION_URLS.checkout).then((loaded) => live && setSession(loaded))
    return () => {
      live = false
    }
  }, [])
  return (
    <div className="h-[640px] overflow-hidden rounded-card bg-card shadow-hairline">
      {session ? <FullStackReplay session={session} /> : <div className="grid h-full place-items-center text-caption text-muted-foreground">Loading the session…</div>}
    </div>
  )
}
