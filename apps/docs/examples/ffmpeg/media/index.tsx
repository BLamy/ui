import { useEffect, useState } from 'react'
import { Filmstrip } from '@/components/ui/filmstrip'
import { Waveform } from '@/components/ui/waveform'
import { FfmpegProvider, useFfmpeg, useFfmpegSupport, useMediaFrames, useMediaInfo, useMediaPeaks } from '@/lib/ffmpeg/react'
import { formatTimecode } from '@/lib/video-timeline'

// The hooks a media library or a timeline uses: what a file holds, filmstrip
// frames and waveform peaks. Each file is worked on once and shared, however
// many components ask. The clip is made by FFmpeg's test sources.
export default function MediaHooks() {
  return (
    <FfmpegProvider>
      <Clip />
    </FfmpegProvider>
  )
}

function Clip() {
  const ffmpeg = useFfmpeg()
  const reason = useFfmpegSupport()
  const [file, setFile] = useState<File | null>(null)
  useEffect(() => {
    if (!ffmpeg || reason !== null) return
    let live = true
    ffmpeg
      .run({
        args: ['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=8,hue=H=2*PI*t/8',
          '-f', 'lavfi', '-i', 'sine=frequency=220:beep_factor=6:duration=8,volume=5',
          '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '16', '-c:a', 'opus', '-strict', 'experimental', 'clip.webm'],
      })
      .then(({ files }) => {
        if (live) setFile(new File([files['clip.webm'] as Uint8Array<ArrayBuffer>], 'clip.webm', { type: 'video/webm' }))
      })
    return () => { live = false }
  }, [ffmpeg, reason])
  const info = useMediaInfo(file)
  const frames = useMediaFrames(file, { count: 16, height: 64 })
  const peaks = useMediaPeaks(file, { rate: 40 })

  if (reason) return <p className="m-0 max-w-prose p-4 text-footnote text-muted-foreground">{reason}</p>
  const v = info.data?.video
  return (
    <div className="flex w-full max-w-2xl flex-col gap-2 p-4">
      <div className="text-footnote text-foreground/70 tabular-nums">
        {!file ? 'Making a clip…' : info.data
          ? `${info.data.format} · ${formatTimecode(info.data.duration)} · ${v?.codec} ${v?.width}×${v?.height} · ${info.data.audio?.codec} ${info.data.audio?.sampleRate} Hz`
          : 'Probing…'}
      </div>
      <div className="h-14 overflow-hidden rounded-ctl bg-secondary">
        {frames.data ? <Filmstrip frames={frames.data} from={0} to={info.data?.duration} /> : null}
      </div>
      <div className="h-12 rounded-ctl bg-secondary px-1">
        {peaks.data ? <Waveform peaks={peaks.data.peaks} rate={peaks.data.rate} tone="primary" /> : null}
      </div>
    </div>
  )
}
