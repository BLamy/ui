import { storyOf, type ReplayCache, type StoryEntry } from '@/components/ui/replay-debugger'
import type { TraceLane, TraceRange, TraceStop } from '@/lib/trace-timeline-model'

/* A run told as a story, the way Wallaby and the Replay Tests extension tell a test: every line that ran, in order, how
   deep it was, and what its frame held. It all comes from a recording that was replayed once with the linker and written
   down as JSON, so scrubbing reads an array: no engine, nothing to wait for. */

export interface Story {
  entries: StoryEntry[]
  range: TraceRange
  lanes: TraceLane[]
  stops: Array<TraceStop<number>>
  /** The entry at or before a time: its position in `entries`. */
  at(time: number): number
}

export function buildStory(cache: ReplayCache): Story {
  const entries = storyOf(cache)
  const times = Float64Array.from(entries, (e) => e.ms)
  const range = { start: times[0], end: times[times.length - 1] }
  const lanes: TraceLane[] = [{
    key: 'run',
    title: cache.sources[0]?.url,
    density: { label: 'Depth', times, depths: Uint16Array.from(entries, (e) => e.depth + 1) },
    marks: [
      { key: 'console', times: Float64Array.from(entries.filter((e) => e.logged), (e) => e.ms), shape: 'dot', tint: 'var(--primary)' },
      { key: 'throws', times: Float64Array.from(entries.filter((e) => e.code.startsWith('throw')), (e) => e.ms), shape: 'bar', tone: 'destructive' },
    ],
  }]
  // Every step is a stop, so a scrub lands on lines and the rail's card says which. Calls and logs come first when there
  // isn't room for all of them.
  const stops = entries.map((e, i): TraceStop<number> => {
    const call = i === 0 || e.depth > entries[i - 1].depth
    return {
      key: e.step,
      time: e.ms,
      caption: e.logged ? `console.log: ${e.logged.text}` : `${e.functionName} · line ${e.line}`,
      preview: [e.code, ...e.values.map((v) => `${v.name} = ${v.text}`)].join('\n'),
      level: e.logged || e.code.startsWith('throw') ? 1 : call ? 2 : 3,
      tone: e.code.startsWith('throw') ? 'destructive' : e.logged ? 'success' : undefined,
    }
  })
  return {
    entries,
    range,
    lanes,
    stops,
    at(time) {
      let lo = 0
      let hi = times.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (times[mid] <= time) lo = mid + 1
        else hi = mid
      }
      return Math.max(0, lo - 1)
    },
  }
}

/** Time since the run's first step, as a test runner says it. */
export const sinceStart = (start: number) => (time: number) => `${(time - start).toFixed(time - start < 10 ? 2 : 1)} ms`
