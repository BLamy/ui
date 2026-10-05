import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileUploadButton } from '@/components/ui/file-upload'
import { Progress } from '@/components/ui/progress'
import { FfmpegError, mediaFileName } from '@/lib/ffmpeg'
import { FfmpegProvider, useFfmpeg, useFfmpegSupport, useMediaInfo } from '@/lib/ffmpeg/react'
import { formatBytes } from '@/lib/format-bytes'
import { formatTimecode } from '@/lib/video-timeline'

// FFmpeg in a worker, like a command line: probe a file, then turn it into an
// MP3, a GIF or a poster frame, with FFmpeg's own progress. The file never
// leaves the page.
export default function Convert() {
  return (
    <FfmpegProvider>
      <Converter />
    </FfmpegProvider>
  )
}

const JOBS = {
  mp3: { label: 'MP3', out: 'audio.mp3', type: 'audio/mpeg', args: (i: string) => ['-i', i, '-vn', '-b:a', '160k', 'audio.mp3'] },
  gif: {
    label: 'GIF', out: 'clip.gif', type: 'image/gif',
    args: (i: string) => ['-t', '4', '-i', i, '-filter_complex', 'fps=12,scale=360:-2,split[a][b];[a]palettegen[p];[b][p]paletteuse', 'clip.gif'],
  },
  poster: { label: 'Poster', out: 'poster.png', type: 'image/png', args: (i: string) => ['-ss', '1', '-i', i, '-frames:v', '1', 'poster.png'] },
} as const
type Job = keyof typeof JOBS

function Converter() {
  const ffmpeg = useFfmpeg()
  const reason = useFfmpegSupport()
  const [file, setFile] = useState<File | null>(null)
  const info = useMediaInfo(reason === null ? file : null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ url: string; type: string; name: string; size: number; command: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A five-second test clip from FFmpeg's own test sources.
  const makeTestClip = async () => {
    if (!ffmpeg) return
    setBusy('Making a test clip…')
    try {
      const { files } = await ffmpeg.run({
        args: ['-f', 'lavfi', '-i', 'testsrc2=size=480x270:rate=30:duration=5', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
          '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '16', '-c:a', 'opus', '-strict', 'experimental', 'test.webm'],
      })
      setFile(new File([files['test.webm'] as Uint8Array<ArrayBuffer>], 'test.webm', { type: 'video/webm' }))
    } finally {
      setBusy(null)
    }
  }

  const run = async (job: Job) => {
    if (!ffmpeg || !file) return
    const name = mediaFileName(file)
    const args = JOBS[job].args(name)
    setBusy(`Making ${JOBS[job].label}…`)
    setProgress(0)
    setError(null)
    try {
      const { files } = await ffmpeg.run({
        args, inputs: { [name]: file }, duration: job === 'gif' ? 4 : info.data?.duration,
        onProgress: (p) => setProgress(p.fraction ?? 0),
      })
      const out = files[JOBS[job].out]
      if (result) URL.revokeObjectURL(result.url)
      setResult({
        url: URL.createObjectURL(new Blob([out as Uint8Array<ArrayBuffer>], { type: JOBS[job].type })),
        type: JOBS[job].type, name: JOBS[job].out, size: out.byteLength, command: `ffmpeg ${args.join(' ')}`,
      })
    } catch (e) {
      setError(e instanceof FfmpegError ? `${e.message}` : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (reason) {
    return <p className="m-0 max-w-prose p-4 text-footnote text-muted-foreground">{reason}</p>
  }
  const v = info.data?.video
  const a = info.data?.audio
  return (
    <div className="flex w-full max-w-xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <FileUploadButton variant="secondary" size="sm" multiple={false} accept={['video/*', 'audio/*']}
          onFiles={(entries) => setFile(entries[0]?.file ?? null)}>
          Choose a file…
        </FileUploadButton>
        <Button variant="secondary" size="sm" isDisabled={!ffmpeg || !!busy} onPress={makeTestClip}>Use a test clip</Button>
      </div>
      {file ? (
        <div className="rounded-panel bg-secondary px-3 py-2 text-footnote">
          <div className="font-semibold">{file.name}</div>
          <div className="text-muted-foreground tabular-nums">
            {info.loading ? 'Probing…' : info.error ? info.error.message : [
              formatBytes(file.size),
              info.data && formatTimecode(info.data.duration),
              v && `${v.codec} ${v.displayWidth}×${v.displayHeight} ${Math.round(v.fps)} fps`,
              a && `${a.codec} ${a.sampleRate / 1000} kHz ${a.channels === 1 ? 'mono' : `${a.channels} ch`}`,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        {(Object.keys(JOBS) as Job[]).map((job) => (
          <Button key={job} size="sm" isDisabled={!info.data || !!busy || (job !== 'mp3' && !v) || (job === 'mp3' && !a)} onPress={() => run(job)}>
            {JOBS[job].label}
          </Button>
        ))}
      </div>
      {busy ? <Progress label={busy} value={Math.round(progress * 100)} showValue size="sm" /> : null}
      {error ? <p role="alert" className="m-0 text-footnote text-destructive">{error}</p> : null}
      {result ? (
        <div className="flex flex-col gap-2">
          {result.type.startsWith('audio/') ? <audio src={result.url} controls className="w-full" />
            : <img src={result.url} alt={result.name} className="max-h-48 self-start rounded-ctl" />}
          <div className="flex items-center gap-3 text-footnote text-muted-foreground">
            <span>{result.name} · {formatBytes(result.size)}</span>
            <a href={result.url} download={result.name} className="text-primary">Download</a>
          </div>
          <code className="block rounded-ctl bg-secondary p-2 text-caption break-all">{result.command}</code>
        </div>
      ) : null}
    </div>
  )
}
