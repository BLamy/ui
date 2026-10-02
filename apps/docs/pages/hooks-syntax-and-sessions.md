# Syntax, sessions and countdown hooks

Three groups of standalone hooks. `useSyntaxTokens` and `useSyntaxHighlighting` give you the tokens of highlighted code. `useCountdown` is a wall-clock timer. `useSessionRecording`, `useSessions`, `useSessionCloud` and `useCloud` record the page with rrweb into `localStorage`, list the recordings, and (optionally) sync them to a Durable Streams server. The other hooks are in the [Hooks overview](https://blamy.github.io/ui/#/hooks).

All seven are public.

```tsx
// npm
import {
  useSyntaxTokens, useSyntaxHighlighting, useCountdown, useSessionRecording, useSessions, useSessionCloud, useCloud,
} from '@brett_lamy/ui'

// shadcn registry (aliases)
import { useSyntaxTokens, useSyntaxHighlighting } from '@/components/ui/syntax-highlighting'  // …/r/syntax-highlighting.json
import { useCountdown } from '@/components/ui/progress-ring'                                  // …/r/progress-ring.json
import { useSessionRecording, useSessions, useSessionCloud } from '@/lib/session-recorder'    // …/r/session-recorder.json
import { useCloud } from '@/lib/durable-streams'                                              // …/r/durable-streams.json
```

## `useSyntaxTokens`

The lines of a piece of code as arrays of tokens, lexed on the GPU through the page's shared gpu-lexer. It returns plain lines at once and highlighted lines when the lexer answers. [SyntaxHighlighting](https://blamy.github.io/ui/#/syntax-highlighting) is built on it; use the hook to lay code out yourself (a diff with two gutters, an editor overlay).

- **Export:** public, with `SyntaxTokens`, which renders one line of tokens as `bl-tok-<type>` spans. Registry item `syntax-highlighting`.
- **Needs:** nothing.

```ts
function useSyntaxTokens(
  code: string,
  options?: { language?: string; enabled?: boolean; engine?: 'auto' | 'gpu' | 'fallback' },
): { lines: SyntaxToken[][]; highlighter: 'gpu' | 'fallback' | 'pending' | 'none' }

interface SyntaxToken { type: SyntaxTokenType; text: string }
```

| Option | Default | Effect |
| --- | --- | --- |
| `language` | none | `text`, `txt`, `plaintext`, `plain` and `none` skip lexing (`highlighter` is `'none'`). Any other value is informational: gpu-lexer recognizes the language itself. |
| `enabled` | `true` | `false` renders plain lines and never lexes. |
| `engine` | `'auto'` | `auto`: gpu-lexer on a hardware WebGPU adapter; the small fallback at once where there is no WebGPU, only a software adapter, or the one-time adapter probe takes over 2.5 seconds. `gpu`: gpu-lexer on any adapter, software included (slow there). `fallback`: always the fallback (tests, pages that must not touch the GPU). |

`lines` has one token array per line (a single trailing newline is dropped). `highlighter` says what produced them: `gpu`, `fallback`, `pending` (plain text is showing, the lexer has not answered) or `none`.

```tsx
function Code({ source }: { source: string }) {
  const { lines, highlighter } = useSyntaxTokens(source, { language: 'ts' })
  return (
    <pre data-highlighter={highlighter}>
      {lines.map((line, i) => (
        <div key={i}><SyntaxTokens tokens={line} /></div>
      ))}
    </pre>
  )
}
```

Behaviors to know:

- **No layout shift.** The plain text renders first in its final layout; token colors swap in. Results are cached by source (an LRU of 256), so a remount or a repeat is immediate.
- **Streaming.** While `code` grows by appending, the tokens of the lines that have not changed are kept until the new result lands, and `highlighter` reads `pending` meanwhile.
- **Server render.** On the server `webgpuSupported()` is `false`, so with `engine: 'auto'` the hook returns the **fallback** tokenizer's tokens synchronously. In a WebGPU browser the first client render has no result yet (plain text) until the lexer answers. If you server-render, that is a difference between the server HTML and the first client render; pass `engine="fallback"` for identical output on both. This is from reading the source, not from testing in an SSR app.
- Changing `engine` re-lexes; changing `code` re-lexes (the previous request's result is ignored once it is stale).

## `useSyntaxHighlighting`

The `code`, `language`, `variant`, `title` and `engine` of the enclosing `SyntaxHighlighting`, for custom parts inside it (a toolbar with its own copy button, a status chip).

- **Export:** public. Registry item `syntax-highlighting`.
- **Needs:** a `SyntaxHighlighting` ancestor. **Outside it:** returns `null` (it does not throw).

```ts
function useSyntaxHighlighting(): { code: string; language?: string; variant: 'default' | 'ghost' | 'inline'; title?: ReactNode; engine?: SyntaxEngine } | null
```

```tsx
function LineCount() {
  const ctx = useSyntaxHighlighting()
  if (!ctx) return null
  return <span>{ctx.code.split('\n').length} lines</span>
}
```

## `useCountdown`

A `duration`-second countdown on the wall clock. It reads `Date.now()`, so timers that are throttled or delayed catch up instead of drifting, and a frozen clock freezes it. It polls every 250ms but re-renders only when the whole second changes. [CountdownRing](https://blamy.github.io/ui/#/progress-ring) draws one; the hook has no UI of its own.

- **Export:** public. Registry item `progress-ring`.
- **Needs:** nothing.

```ts
function useCountdown(
  duration: number,
  options?: { running?: boolean; loop?: boolean; onEnd?: () => void; offset?: number },
): Countdown

interface Countdown {
  remaining: number   // whole seconds left in the current period
  period: number      // periods completed so far (0 at the start)
  elapsed: number     // whole seconds elapsed, offset included
  reset: () => void   // start over from the offset (period 0)
}
```

| Option | Default | Effect |
| --- | --- | --- |
| `running` | `true` | `false` pauses and freezes the time left. |
| `loop` | `true` | Restart from `duration` when it reaches zero, like a TOTP period. `false` stops at zero. |
| `onEnd` | none | Called each time it reaches zero: once per period that ended, even if the page was throttled meanwhile. It is read through a ref, so a new function each render is fine. |
| `offset` | `0` | Seconds already elapsed when it starts, to align a TOTP period with a clock. |

```tsx
// A code that rotates every 30 seconds, aligned to the clock
const [offset] = useState(() => Math.floor(Date.now() / 1000) % 30)   // fixed for the life of the component
const { remaining, period } = useCountdown(30, { offset, onEnd: refreshCode })
<CountdownRing remaining={remaining} duration={30} />
```

{% demo src="hooks-syntax-and-sessions/countdown" %}

Details, from the source:

- **`remaining` while looping runs `duration` down to `1`**, never `0`: at the exact moment a period ends it is already the next period's `duration`. Without `loop` it counts down to `0` and stays there; `period` then caps at `1`, and `onEnd` fires once.
- Pausing stops the clock, but the number on screen is the last value the 250ms poll saw, so it can be up to a quarter second behind the exact pause point. Resuming continues from the true time.
- `reset()` returns to `offset` and period `0` and does not call `onEnd`.
- **Keep `offset` constant.** It is added to the time that has run, so an `offset` you recompute from the clock on every render counts the same seconds twice. Compute it once (as above).
- Changing `duration` or `offset` restarts the timer but keeps the accumulated time; call `reset()` if you want a fresh start.
- `reset` is rebuilt each render. The state is initialized from `offset`, not the clock, so the first server and client renders match.

## `useSessionRecording`

Records the page with [rrweb](https://github.com/rrweb-io/rrweb) for as long as the component is mounted: one new session per mount (not per re-render). The events are appended to streams in `localStorage`, so a private browser is the whole system. If the cloud is switched on, it syncs meanwhile (see `useSessionCloud`).

- **Export:** public, with `startSessionRecording`, `useSessions`, `useSessionCloud`, `sessionCloud`, `readSession`, `deleteSession`, `clearSessions`, `currentSessionId` and `storageUsage`. Registry item `session-recorder` (`@/lib/session-recorder`), which depends on `rrweb`, `append-stream` and `durable-streams`.
- **Needs:** nothing. It does its work in an effect, so it does nothing on the server.

```ts
function useSessionRecording(options?: SessionRecordingOptions & { enabled?: boolean }): void

interface SessionRecordingOptions {
  blockClass?: string    // 'rr-block': elements with this class are recorded as empty placeholders
  ignoreClass?: string   // 'rr-ignore': elements with this class do not record input events
  maskAllInputs?: boolean // true: typed text is replaced with asterisks
  maxSessions?: number   // 30: how many sessions' events to keep in this browser; the oldest go first
  flushMs?: number       // 1500: how often buffered events are written
}
```

```tsx
function App() {
  const { consented } = usePrivacySettings()
  useSessionRecording({ enabled: consented })
  return <Routes />
}
```

Behaviors to know:

- **It records everything on the page.** Inputs are masked by default (`maskAllInputs`), but text in the DOM is recorded as it is. Mark anything private with `rr-block` (the element becomes an empty placeholder of the same size, nothing inside it is recorded) or `rr-ignore` (its input events are dropped). Put `rr-block` on anything that plays recordings (the Time Machine block's root has it), or it would record itself replaying. Gate the hook behind consent with `enabled`.
- **Nothing leaves the browser by default.** Only if you save a server URL and switch the cloud on do the streams go anywhere.
- **Storage is small.** `localStorage` holds about 5M characters. When a write does not fit, the oldest session's events are dropped from this browser to make room (the index, and the cloud, keep their record of it). If nothing can be dropped the recording stops early and its session is marked `truncated`.
- **Short sessions are not kept.** A recording that never got going (a remount, a page that closed at once, fewer than 4 events) leaves no session.
- **Calls share one recording.** Two components calling it share a recording by reference count; it ends when the last one unmounts.
- **Options are read when a recording starts.** The effect restarts when an option changes, but a recording that is already running keeps the options it started with: from the source, the restart attaches to the active recording instead of beginning a new one. Set the options once.
- rrweb is loaded with a dynamic `import('rrweb')` the first time recording starts.

## `useSessions`

Every recorded session, newest first, kept current while one records or another device syncs.

- **Export:** public. Registry item `session-recorder`.
- **Needs:** nothing.

```ts
function useSessions(): SessionInfo[]

interface SessionInfo {
  id: string
  startedAt: number
  endedAt?: number        // when it ended, if it ended cleanly
  events?: number         // recorded so far here, or in total (from the `end` record) for a session held only in the cloud
  url: string
  title: string
  width: number
  height: number
  device: string          // which browser recorded it
  live: boolean           // being recorded right now, by this tab
  local: boolean          // its events are in this browser
  truncated?: boolean     // storage ran out and recording stopped early
}
```

```tsx
function SessionList() {
  const sessions = useSessions()
  return (
    <ul>
      {sessions.map((s) => (
        <li key={s.id}>
          {s.title || s.url} · {new Date(s.startedAt).toLocaleString()} {s.live ? '(recording)' : ''}
          <Button onPress={() => deleteSession(s.id)} isDisabled={s.live}>Delete</Button>
        </li>
      ))}
    </ul>
  )
}
```

`readSession(id)` returns a session's events (a live session reads as far as it has got), ready for [ReplayPreview](https://blamy.github.io/ui/#/replay-preview). `deleteSession(id)` removes its events from this browser and adds a `delete` record to the index so every device agrees; it ignores the session being recorded. `clearSessions()` deletes all but the live one, and `storageUsage()` returns `{ used, quota }` in characters.

Behaviors to know:

- It starts from the last list the module built, which is empty until the first asynchronous read finishes (and on the server), then fills in once a component has subscribed.
- A session whose events are neither in this browser nor reachable by an enabled cloud is not listed.
- Sessions are merged from this browser's index and, with the cloud on, the server's.

## `useSessionCloud`

The session cloud's status and settings, live, with a `configure` function. The cloud is `sessionCloud`, a `CloudSync` that mirrors the session streams to a Durable Streams server (Rivet serves the protocol) when enabled, and lets another device list and replay this one's sessions.

- **Export:** public. Registry item `session-recorder`.
- **Needs:** nothing.

```ts
function useSessionCloud(): {
  status: CloudStatus
  settings: CloudSettings
  configure: (patch: Partial<CloudSettings>) => void
}

interface CloudSettings { enabled: boolean; url: string; token: string; prefix: string }
interface CloudStatus {
  state: 'off' | 'idle' | 'syncing' | 'offline' | 'error'
  pending: number        // records written here that the server has not acknowledged
  lastSyncAt?: number
  error?: string
}
```

```tsx
function CloudSwitch() {
  const { status, settings, configure } = useSessionCloud()
  return (
    <>
      <Switch aria-label="Sync sessions" checked={settings.enabled} onChange={(enabled) => configure({ enabled })} />
      <span>{status.state === 'error' ? status.error : `${status.pending} pending`}</span>
    </>
  )
}
```

Behaviors to know:

- **Off by default.** Nothing leaves the browser until a server URL is saved and `enabled` is on.
- `configure(patch)` merges into the settings, saves them to `localStorage`, and restarts syncing to match. **The settings, including `token`, are stored there in plain text** (`bl-cloud:settings`), as is each stream's sync cursor. Do not put a long-lived secret in it.
- Syncing retries after an error with exponential backoff (up to 60 seconds); `status.state` is `offline` while the browser is, and records are written as idempotent producer writes, so a retry does not duplicate anything.
- `configure` is rebuilt each render.

## `useCloud`

The same status and settings, for **any** `CloudSync` you build yourself, which is what `useSessionCloud` calls with `sessionCloud`.

- **Export:** public, with `CloudSync`, `DurableStreamsClient` and `deviceId`. Registry item `durable-streams` (`@/lib/durable-streams`).
- **Needs:** nothing.

```ts
function useCloud(cloud: CloudSync): { status: CloudStatus; settings: CloudSettings }
```

```tsx
import { CloudSync, LocalStreams, useCloud } from '@brett_lamy/ui'

// module scope: one engine for the whole app
const notes = new LocalStreams()
const notesCloud = new CloudSync(notes, ['notes-index'])

function NotesSync() {
  const { status, settings } = useCloud(notesCloud)
  return <span>{settings.enabled ? status.state : 'sync is off'}</span>
}
```

It subscribes with `useSyncExternalStore` to the engine you pass, so create the `CloudSync` outside the component (or memoize it): a new instance each render would resubscribe each time. It only reads. Start and configure the engine with `notesCloud.configure({ enabled: true, url, token })`, and `notesCloud.start()` to begin syncing from existing settings (`configure` starts it for you). `CloudSync`'s second argument names streams to pull from the server read-through, and `LocalStreams` is the append-only store the engine mirrors (both are exported from the package root with the rest of the stream helpers).
