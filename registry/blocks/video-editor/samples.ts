import type { Ffmpeg } from '@/lib/ffmpeg';
import { layoutTrack, timelineId, type Timeline } from '@/lib/video-timeline';
import { TITLE_MEDIA, type TitleData } from './titles';

/* Sample media, made in the browser by FFmpeg's own test sources, so the block ships no media files: three 6-second
   clips of the testsrc2 pattern (its burnt-in clock shows which source frame is playing, handy for checking trims and
   speed changes) with a tone each, and a 12-second chord with a pulse for a music bed. */

export interface SampleFile {
  key: 'bars' | 'rainbow' | 'night' | 'music';
  file: File;
}

const W = 640, H = 360, D = 6;
const video = (vf: string, tone: number) => [
  '-f', 'lavfi', '-i', `testsrc2=size=${W}x${H}:rate=30:duration=${D}${vf ? `,${vf}` : ''}`,
  '-f', 'lavfi', '-i', `sine=frequency=${tone}:sample_rate=48000:duration=${D}`,
  '-filter_complex', '[1:a]volume=0.18[a]', '-map', '0:v', '-map', '[a]',
  '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '16', '-b:v', '900k', '-pix_fmt', 'yuv420p',
  '-c:a', 'opus', '-strict', 'experimental', '-b:a', '64k', 'out.webm',
];

const SAMPLES: { key: SampleFile['key']; name: string; type: string; args: string[] }[] = [
  { key: 'bars', name: 'Test pattern.webm', type: 'video/webm', args: video('', 440) },
  { key: 'rainbow', name: 'Rainbow.webm', type: 'video/webm', args: video('hue=H=2*PI*t/6:s=1.3', 554.37) },
  { key: 'night', name: 'Night.webm', type: 'video/webm', args: video('hue=s=0,gblur=sigma=1.5', 659.25) },
  {
    key: 'music', name: 'Chord.mp3', type: 'audio/mpeg', args: [
      '-f', 'lavfi', '-i', 'sine=frequency=110:beep_factor=4:sample_rate=48000:duration=12',
      '-f', 'lavfi', '-i', 'sine=frequency=277.18:sample_rate=48000:duration=12',
      '-f', 'lavfi', '-i', 'sine=frequency=329.63:sample_rate=48000:duration=12',
      '-filter_complex', '[0:a][1:a][2:a]amix=inputs=3:normalize=0,volume=0.12,afade=t=in:d=1,afade=t=out:st=10:d=2[a]',
      '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '128k', 'out.mp3',
    ],
  },
];

/** Makes the sample files (a couple of seconds; FFmpeg must be able to run). */
export async function makeSamples(ffmpeg: Ffmpeg, signal?: AbortSignal): Promise<SampleFile[]> {
  return Promise.all(SAMPLES.map(async (s) => {
    const { files } = await ffmpeg.run({ args: ['-hide_banner', '-loglevel', 'error', ...s.args], signal });
    const bytes = files[s.args[s.args.length - 1]];
    return { key: s.key, file: new File([bytes as Uint8Array<ArrayBuffer>], s.name, { type: s.type }) };
  }));
}

/** A first edit of the samples: three clips on the main track with dissolves and a look, two titles over them, and the
 *  chord under it all, fading out. `ids` maps each sample to its media id. */
export function starterTimeline(ids: Record<SampleFile['key'], string>): Timeline {
  const title = (text: string, style: TitleData['style']) => ({ text, style });
  return {
    tracks: [
      {
        id: 'titles', kind: 'video', name: 'Titles',
        clips: [
          { id: timelineId(), media: TITLE_MEDIA, label: 'Title', start: 0.4, in: 0, out: 3, fadeIn: 0.4, fadeOut: 0.4, data: { ...title('BL UI Video', 'center') } },
          { id: timelineId(), media: TITLE_MEDIA, label: 'Lower third', start: 6.2, in: 0, out: 3.6, fadeIn: 0.3, fadeOut: 0.3, data: { ...title('Rendered by FFmpeg, in your browser', 'lower-third') } },
        ],
      },
      layoutTrack({
        id: 'main', kind: 'video', name: 'Main', magnetic: true,
        clips: [
          { id: timelineId(), media: ids.bars, start: 0, in: 0.5, out: 5, fadeIn: 0.6 },
          { id: timelineId(), media: ids.rainbow, start: 0, in: 0.5, out: 5.5, transition: 1 },
          { id: timelineId(), media: ids.night, start: 0, in: 1, out: 5.5, transition: 0.8, look: 'vintage', fadeOut: 1 },
        ],
      }),
      {
        id: 'music', kind: 'audio', name: 'Music',
        clips: [{ id: timelineId(), media: ids.music, start: 0, in: 0, out: 12, volume: 0.8, fadeOut: 1.5 }],
      },
    ],
  };
}
