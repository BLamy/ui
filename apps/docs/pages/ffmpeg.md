# FFmpeg

FFmpeg and FFprobe in the browser, built from [openclaw/ffmpeg-wasm](https://github.com/openclaw/ffmpeg-wasm) and run like a command line: `run({ args, inputs })` takes the arguments and the input files, and returns the files the run wrote, with its stdout and stderr. Each job runs in a worker, so the page stays responsive. Files you pass are mounted, not copied, and progress is FFmpeg's own `-progress` report. On top of that sit `probe` (what a file holds), filmstrip frames, waveform peaks and React hooks that do each once per file. It is what [VideoTimeline](https://blamy.github.io/ui/#/video-timeline), [VideoPreview](https://blamy.github.io/ui/#/video-preview) and the [Video Editor block](https://blamy.github.io/ui/#/blocks) read and render with.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/ffmpeg.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { createFfmpeg } from '@/lib/ffmpeg'
import {
  FfmpegProvider, useFfmpeg, useMediaInfo,
} from '@/lib/ffmpeg/react'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  createFfmpeg, FfmpegProvider, useFfmpeg, useMediaInfo,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Build and serve the wasm

openclaw/ffmpeg-wasm publishes source, not binaries, so you build the browser files once and serve them yourself. The build script in this repository (`tools/ffmpeg-wasm`; copy the folder into your project) runs openclaw's pinned FFmpeg 9.0.2, LAME and libvpx build in the `emscripten/emsdk` Docker image, for the browser only, with the extra filters an editor needs:

{% command %}node tools/ffmpeg-wasm/build.mjs --out public/ffmpeg{% endcommand %}

`--native` builds with an emsdk installed under `~/.cache/bl-ffmpeg-wasm` instead of Docker (it needs Python 3.10 or later). Either way the sources and objects are cached, so a rebuild only recompiles what changed. On an M-series Mac a full build takes about four minutes. The registry item puts `ffmpeg-worker.js` in `public/ffmpeg/`, and the build writes the rest next to it:

| File | Size | gzip | When it loads |
| --- | --- | --- | --- |
| `ffmpeg-worker.js` | 5 KB | 2.4 KB | the first job |
| `ffmpeg.js` + `ffmpeg_g.wasm` | 89 KB + 4.6 MB | 24 KB + 1.8 MB | the first FFmpeg job |
| `ffprobe.js` + `ffprobe_g.wasm` | 87 KB + 4.5 MB | 23 KB + 1.8 MB | the first probe |

`createFfmpeg({ baseURL })` points at that folder (default `ffmpeg/`, against the page's base URL). The build reads H.264, HEVC, MPEG-4, VP8, VP9, AAC, MP3, Opus, Vorbis, FLAC, ALAC, PCM, PNG, JPEG, WebP and GIF, in MP4/MOV, Matroska/WebM, MPEG-TS, HLS, MP3, WAV, Ogg, FLAC and still images. It writes MPEG-4 Part 2, VP8, AAC, Opus, MP3, PCM, PNG, JPEG and GIF. It has no H.264 encoder: x264 is GPL, and openclaw's build is LGPL.

## Cross-origin isolation

FFmpeg 9's command line runs on threads, and threads in WebAssembly need `SharedArrayBuffer`, which a browser only gives a **cross-origin isolated** page. There are two ways to get one:

- `Document-Isolation-Policy: isolate-and-credentialless` on the HTML response isolates just that document, in Chrome. Popups (an OAuth sign-in) keep their opener, iframes are unaffected, and cross-origin images and fonts load without cookies.
- `Cross-Origin-Opener-Policy: same-origin` with `Cross-Origin-Embedder-Policy: require-corp` works in every browser. Every cross-origin resource then needs CORS or `Cross-Origin-Resource-Policy`, a popup loses its opener, and the worker scripts (`ffmpeg-worker.js`, `ffmpeg.js`, `ffprobe.js`) must be served with the same COEP.

```ts
// vite.config.ts: isolate the dev server
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

`ffmpegUnsupportedReason()` returns null when FFmpeg can run, or a sentence saying what's missing; `run` rejects with code `unsupported` for the same reason. These docs send the Chrome header on every page and the pair on `?isolate` URLs and the video demos. Static hosts that can't set headers (GitHub Pages) can't run it.

## Running a command

```ts
import { createFfmpeg, mediaFileName } from '@/lib/ffmpeg'

const ffmpeg = createFfmpeg()           // workers start with the first job
const name = mediaFileName(file)        // 'My_clip.mov': safe, with its extension
const { files } = await ffmpeg.run({
  args: ['-i', name, '-vn', '-b:a', '160k', 'audio.mp3'],
  inputs: { [name]: file },             // a File or Blob is mounted; bytes are written
  duration: 12.5,                       // so progress has a fraction
  onProgress: ({ time, fraction, speed }) => {},
  signal,                               // aborting ends the job's worker
})
const mp3 = new Blob([files['audio.mp3']], { type: 'audio/mpeg' })
```

Every file the run writes comes back in `files`. A non-zero exit rejects with an `FfmpegError`: `code` is `failed`, and `exitCode` and `stderr` carry FFmpeg's own words. The other codes are `unsupported` (the page isn't isolated), `missing` (the worker or the wasm isn't at `baseURL`), `crashed` (the runtime died: out of memory, a trap) and `aborted`. Jobs queue: `concurrency` (2) of them run at once, each in its own worker. `dispose()` ends them all.

{% demo src="ffmpeg/convert" %}

## Probing

`probe(file)` runs FFprobe and returns a `MediaInfo`. `kind` is `video`, `audio` or `image` (a still, or a video stream with no time). It also has `duration` in seconds, the container `format`, `size` and `bitRate`. `video` holds the codec, the coded `width` and `height`, the `displayWidth` and `displayHeight` after the rotation a phone records (FFmpeg applies it when decoding), `fps` and the clockwise `rotation`. `audio` holds the codec, `sampleRate` and `channels`. Cover art in an MP3 or M4A isn't a video stream. `parseProbe` turns FFprobe JSON you got elsewhere into the same shape.

## Frames and peaks

`extractFrames(ffmpeg, file, { times, height })` grabs one small JPEG per time. A run seeks to a handful of times, each decoding from the nearest keyframe, so a long file is never decoded end to end. `frameTimes(duration, count)` spaces times evenly. `extractPeaks(ffmpeg, file, { rate })` decodes the audio once, to 8 kHz mono, and keeps the loudest sample of each slice, `rate` slices a second. It returns null for a file with no audio. They feed [Filmstrip](https://blamy.github.io/ui/#/filmstrip) and [Waveform](https://blamy.github.io/ui/#/waveform).

In React, `<FfmpegProvider>` makes one runner for its subtree, which ends when the provider unmounts. `useFfmpeg()` returns it, and `useFfmpegSupport()` returns the reason it can't run (undefined until mounted). `useMediaInfo(file)`, `useMediaFrames(file, { count, height })` and `useMediaPeaks(file, { rate })` return `{ data, error, loading }`. They are cached per file for the page's lifetime, so twenty clips cut from one recording ask FFmpeg once. `releaseMedia(file)` forgets a file and revokes its frame URLs.

{% demo src="ffmpeg/media" %}

## Threads and memory

Every FFmpeg thread is a Web Worker, and a decoder starts one thread per core by default. A command with ten inputs would start a hundred workers. So the helpers here give each input's decoder one or two threads (`-threads 1` before `-i`); do the same in your own commands with many inputs. Inputs are mounted with WORKERFS: FFmpeg reads a File in place, however big. Outputs are written to memory and copied out when the run ends, so a long 4K render needs the room. The wasm heap tops out at 2 GB.

## Speed

Each job starts a fresh FFmpeg instance, which is quick once the wasm is in the browser's cache, and then runs at WebAssembly speed. In Chrome on an M-series Mac the Video Editor's 12-second 720p sample edit exports to MP4 or WebM in about 5 seconds. Firefox runs the same build several times slower, and libvpx (VP8) most of all: a 3-second 720p WebM that takes under a second in Chrome takes about 13 there. Prefer `-deadline realtime -cpu-used 16` for VP8 (what the renderer's `medium` and `low` use), which in wasm is three to four times faster than the other realtime speeds for a few percent more bytes.

## Licensing

The worker and this library are MIT. The wasm build is FFmpeg (LGPL-2.1-or-later), LAME (LGPL) and libvpx (BSD); the build copies their licence files next to the binaries, and `BUILD.txt` names the exact sources. If you ship the binaries, ship those files and say where the source is: the build script and the pinned refs are enough.
