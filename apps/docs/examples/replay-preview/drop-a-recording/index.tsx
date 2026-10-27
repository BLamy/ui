import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDropZone, FileUploadButton } from '@/components/ui/file-upload'
import { ReplayPreview, getReplayMeta, replayDemoEvents, type ReplayEvent } from '@/components/ui/replay-preview'
import { Icon } from '@/lib/icon'
import type { FileEntry } from '@/lib/file-upload'

// Drop an rrweb recording (.rrweb, .json, or either gzipped) on the frame and it
// plays. Drop another on the player to swap it. No file at hand? Download the
// demo recording below and drag it back in.
const ACCEPT = ['.rrweb', '.json', '.gz']

// rrweb leaves the file format to you: an event array, `{ events }`, or one
// event per line, sometimes gzipped.
async function readRecording(file: File): Promise<ReplayEvent[]> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  const text =
    head[0] === 0x1f && head[1] === 0x8b
      ? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : await file.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line))
  }
  const events = Array.isArray(data) ? data : (data as { events?: unknown })?.events
  if (!Array.isArray(events)) throw new Error('No rrweb events in this file.')
  if (!getReplayMeta(events as ReplayEvent[]).playable) throw new Error('This recording has no full snapshot to play.')
  return events as ReplayEvent[]
}

function downloadDemo() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(replayDemoEvents)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'checkout.rrweb' })
  a.click()
  URL.revokeObjectURL(url)
}

export default function DropARecording() {
  const [recording, setRecording] = useState<{ name: string; events: ReplayEvent[]; id: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async ([entry]: FileEntry[]) => {
    if (!entry) return
    try {
      const events = await readRecording(entry.file)
      setRecording((r) => ({ name: entry.file.name, events, id: (r?.id ?? 0) + 1 }))
      setError(null)
    } catch (e) {
      setError(`${entry.file.name}: ${e instanceof SyntaxError ? 'not JSON.' : (e as Error).message}`)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: 8 }}>
      <FileDropZone
        aria-label="Drop an rrweb recording"
        onFiles={load}
        multiple={false}
        rules={{ accept: ACCEPT }}
        title="Drop an rrweb recording"
        hint=".rrweb or .json, gzipped or not"
        icon="video"
        browseLabel="Choose a recording"
        isInvalid={!recording && !!error}
        error={error}
        className={recording ? 'block min-h-0 border-0 p-0' : 'min-h-72'}
      >
        {recording
          ? ({ isDropTarget }) => (
              <div style={{ position: 'relative' }}>
                {/* A new key remounts the player, so every drop starts from the top. */}
                <ReplayPreview key={recording.id} events={recording.events} autoplay />
                {isDropTarget ? (
                  <div className="absolute inset-0 grid place-items-center rounded-card border-2 border-dashed border-primary bg-background/80 text-subhead font-semibold">
                    Drop to play this recording instead
                  </div>
                ) : null}
              </div>
            )
          : undefined}
      </FileDropZone>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="text-footnote text-foreground/70">
        {recording ? (
          <>
            <Icon name="video" size={14} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {error ?? `${recording.name} · drop another on the player to swap it`}
            </span>
            <FileUploadButton variant="ghost" size="sm" accept={ACCEPT} multiple={false} onFiles={load}>
              Choose another
            </FileUploadButton>
            <Button variant="ghost" size="sm" onPress={() => { setRecording(null); setError(null) }}>
              Clear
            </Button>
          </>
        ) : (
          <>
            <span style={{ flex: 1 }}>No recording handy? Download the demo and drag it in.</span>
            <Button variant="ghost" size="sm" onPress={downloadDemo}>
              <Icon name="arrow-down" size={14} />
              checkout.rrweb
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
