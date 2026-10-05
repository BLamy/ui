import { describe, expect, it } from 'vitest';
import { buildRender, type RenderMedia, type RenderOptions } from '@/lib/video-render';
import { layoutTrack, type Timeline, type TimelineClip, type TimelineTrack } from '@/lib/video-timeline';

const file = (name: string, type: string) => new File(['x'], name, { type });
const media: Record<string, RenderMedia> = {
  a: { file: file('a.mp4', 'video/mp4'), kind: 'video', hasAudio: true },
  b: { file: file('b.png', 'image/png'), kind: 'image', hasAudio: false },
  c: { file: file('c.mp3', 'audio/mpeg'), kind: 'audio', hasAudio: true },
  s: { file: file('s.webm', 'video/webm'), kind: 'video', hasAudio: false },
};
const FORMAT = { width: 1280, height: 720, fps: 30 };

/** A 4-second clip, unless told otherwise. */
const clip = (id: string, mediaId: string, p: Partial<TimelineClip> = {}): TimelineClip => ({ id, media: mediaId, start: 0, in: 0, out: 4, ...p });
const track = (id: string, clips: TimelineClip[], p: Partial<TimelineTrack> = {}): TimelineTrack => ({ id, kind: 'video', clips, ...p });
const magnetic = (id: string, clips: TimelineClip[]) => track(id, clips, { magnetic: true });
/** Tracks top to bottom, laid out the way edits leave them. */
const timeline = (...tracks: TimelineTrack[]): Timeline => ({ tracks: tracks.map(layoutTrack) });

/** The render plan, with its filter graph whole and split into chains. */
function render(tl: Timeline, options?: RenderOptions) {
  const plan = buildRender(tl, media, FORMAT, options);
  const graph = plan.args[plan.args.indexOf('-filter_complex') + 1];
  return { ...plan, graph, chains: graph.split(';') };
}
/** Each input: the six options before its `-i`, then its file. */
const inputsOf = (args: string[]) => args.flatMap((a, i) => (a === '-i' ? [[...args.slice(i - 6, i), args[i + 1]]] : []));
/** The value after an option that appears once. */
const option = (args: string[], name: string) => args[args.indexOf(name) + 1];
const mapsOf = (args: string[]) => args.flatMap((a, i) => (a === '-map' ? [args[i + 1]] : []));
/** The chain reading a stream, e.g. `[1:v]`. */
const chainFrom = (chains: string[], stream: string) => chains.find((c) => c.startsWith(stream)) ?? '';

describe('buildRender: inputs', () => {
  it('opens one input per clip, seeked to its in point and cut to its source length', () => {
    const { args } = render(timeline(magnetic('main', [clip('a1', 'a', { in: 1, out: 4 }), clip('a2', 'a', { in: 10, out: 12.5 })])));
    expect(args.slice(0, 3)).toEqual(['-hide_banner', '-loglevel', 'error']);
    expect(inputsOf(args)).toEqual([
      ['-threads', '2', '-ss', '1', '-t', '3', 'm0.mp4'],
      ['-threads', '2', '-ss', '10', '-t', '2.5', 'm0.mp4'],
    ]);
  });
  it('loops a still at the frame rate for as long as its clip lasts', () => {
    const { args } = render(timeline(track('v', [clip('p', 'b', { start: 1, out: 3 })])));
    expect(inputsOf(args)).toEqual([['-loop', '1', '-framerate', '30', '-t', '3', 'm0.png']]);
  });
  it('names one file per media, m0, m1… with its extension, and opens a media used twice as two inputs', () => {
    const { args, inputs } = render(timeline(
      track('titles', [clip('t', 'b', { start: 1, out: 2 })]),
      magnetic('main', [clip('a1', 'a'), clip('a2', 'a')]),
      track('music', [clip('m', 'c', { out: 8 })], { kind: 'audio' }),
    ));
    // the bottom track's clips come first
    expect(inputsOf(args).map((i) => i.at(-1))).toEqual(['m0.mp3', 'm1.mp4', 'm1.mp4', 'm2.png']);
    expect(Object.keys(inputs)).toEqual(['m0.mp3', 'm1.mp4', 'm2.png']);
    expect(inputs['m0.mp3']).toBe(media.c.file);
    expect(inputs['m1.mp4']).toBe(media.a.file);
    expect(inputs['m2.png']).toBe(media.b.file);
  });
});

describe('buildRender: pictures', () => {
  it('fits each picture to the frame, shifts it to its start and lays it over the background', () => {
    const { chains, duration } = render(timeline(magnetic('main', [clip('a1', 'a')])));
    expect(duration).toBe(4);
    expect(chains[0]).toBe('color=c=black:s=1280x720:r=30:d=4,format=yuv420p[bg]');
    expect(chainFrom(chains, '[0:v]')).toBe('[0:v]setpts=PTS-STARTPTS,format=yuva420p,'
      + 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black@0,'
      + 'setsar=1,fps=30,setpts=PTS+0/TB[v0]');
    expect(chains).toContain('[bg][v0]overlay=x=0:y=0:eof_action=pass[o0]');
    expect(chains).toContain('[o0]format=yuv420p[vout]');
  });
  it('overlays the bottom track first, so the top track (tracks[0]) lands on top', () => {
    const { chains } = render(timeline(
      track('titles', [clip('t', 'b', { start: 1, out: 2 })]),
      magnetic('main', [clip('a1', 'a')]),
    ));
    // input 0 is the main clip, input 1 the title, shifted to 1 s
    expect(chainFrom(chains, '[0:v]')).toMatch(/,setpts=PTS\+0\/TB\[v0\]$/);
    expect(chainFrom(chains, '[1:v]')).toMatch(/,setpts=PTS\+1\/TB\[v1\]$/);
    expect(chains.filter((c) => c.includes('overlay='))).toEqual([
      '[bg][v0]overlay=x=0:y=0:eof_action=pass[o0]',
      '[o0][v1]overlay=x=0:y=0:eof_action=pass[o1]',
    ]);
    expect(chains).toContain('[o1]format=yuv420p[vout]');
  });
  it('fades a picture in and out through its alpha', () => {
    const { chains } = render(timeline(track('v', [clip('a1', 'a', { start: 2, fadeIn: 0.5, fadeOut: 1 })])));
    expect(chainFrom(chains, '[0:v]')).toContain(',fade=t=in:st=0:d=0.5:alpha=1,fade=t=out:st=3:d=1:alpha=1,setpts=PTS+2/TB[v0]');
  });
  it('sets a picture in its frame: letterboxed by default, cropped to fill with cover', () => {
    const frame = { x: 0.5, y: 0.25, width: 0.5, height: 0.5 };
    const { chains } = render(timeline(track('pip', [clip('p1', 'a', { frame }), clip('p2', 'a', { frame, fit: 'cover', start: 4 })])));
    expect(chainFrom(chains, '[0:v]')).toContain(',scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black@0,');
    expect(chainFrom(chains, '[1:v]')).toContain(',scale=640:360:force_original_aspect_ratio=increase,crop=640:360,');
    expect(chains).toContain('[bg][v0]overlay=x=640:y=180:eof_action=pass[o0]');
  });
  it('gives a picture its look', () => {
    const { chains } = render(timeline(track('v', [clip('a1', 'a', { look: 'mono' })])));
    expect(chainFrom(chains, '[0:v]')).toContain(',fps=30,hue=s=0,format=yuva420p,setpts=PTS+0/TB[v0]');
  });
  it('draws nothing from a hidden track, whose sound still plays', () => {
    const { args, chains } = render(timeline(
      track('titles', [clip('t', 'b', { out: 2 })], { hidden: true }),
      track('main', [clip('a1', 'a')], { magnetic: true, hidden: true }),
    ));
    expect(inputsOf(args)).toHaveLength(1); // the still has nothing left to give
    expect(chains.some((c) => c.includes(':v]'))).toBe(false);
    expect(chains).toContain('[bg]format=yuv420p[vout]');
    expect(chainFrom(chains, '[0:a]')).not.toBe('');
  });
  it('keeps only colour characters in the background', () => {
    const tl = timeline(magnetic('main', [clip('a1', 'a')]));
    expect(render(tl, { background: 'red;rm' }).chains[0]).toMatch(/^color=c=redrm:s=/);
    expect(render(tl, { background: '#202020' }).chains[0]).toMatch(/^color=c=#202020:s=/);
    expect(render(tl, { background: ';[]' }).chains[0]).toMatch(/^color=c=black:s=/);
  });
});

describe('buildRender: dissolves', () => {
  it("turns a magnetic clip's transition into its fade-in, the clip before fading its sound out under it", () => {
    // a2 starts at 3, dissolving in over a1's last second
    const { chains } = render(timeline(magnetic('main', [clip('a1', 'a'), clip('a2', 'a', { out: 6, transition: 1 })])));
    expect(chainFrom(chains, '[0:v]')).not.toContain('fade=');
    expect(chainFrom(chains, '[1:v]')).toContain(',fade=t=in:st=0:d=1:alpha=1,setpts=PTS+3/TB[v1]');
    expect(chainFrom(chains, '[0:a]')).toContain(',afade=t=out:st=3:d=1[a0]');
    expect(chainFrom(chains, '[1:a]')).toContain(',afade=t=in:st=0:d=1,adelay=delays=3000:all=1[a1]');
  });
});

describe('buildRender: sound', () => {
  it('delays each sound to its start, and mixes them without normalising, padded or cut to the length', () => {
    const { chains } = render(timeline(
      magnetic('main', [clip('a1', 'a')]),
      track('music', [clip('m', 'c', { start: 2.5, out: 8 })], { kind: 'audio' }),
    ));
    // the music (bottom track) is input 0, the main clip input 1
    expect(chainFrom(chains, '[0:a]')).toBe('[0:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=delays=2500:all=1[a0]');
    expect(chainFrom(chains, '[1:a]')).not.toContain('adelay');
    expect(chains.at(-1)).toBe('[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,apad,atrim=end=10.5[aout]');
  });
  it('pads and cuts a single sound without a mix', () => {
    expect(render(timeline(magnetic('main', [clip('a1', 'a')]))).chains.at(-1)).toBe('[a0]apad,atrim=end=4[aout]');
  });
  it('levels and fades a sound', () => {
    const { chains } = render(timeline(track('v', [clip('a1', 'a', { start: 2, volume: 0.5, fadeIn: 0.5, fadeOut: 1 })])));
    expect(chainFrom(chains, '[0:a]')).toContain(':channel_layouts=stereo,volume=0.5,afade=t=in:st=0:d=0.5,afade=t=out:st=3:d=1,adelay=delays=2000:all=1[a0]');
  });
  it('takes no sound from a muted track, a muted clip, a clip at volume 0 or a still', () => {
    const { chains } = render(timeline(
      track('titles', [clip('t', 'b')]),
      magnetic('main', [clip('a1', 'a', { muted: true }), clip('a2', 'a', { volume: 0 }), clip('a3', 'a')]),
      track('music', [clip('m', 'c')], { kind: 'audio', muted: true }),
    ));
    // inputs: a1, a2, a3 (main), then the title; the muted music track isn't opened at all
    expect(chains.filter((c) => /^\[\d+:a\]/.test(c))).toEqual([expect.stringMatching(/^\[2:a\]/)]);
    expect(chains.at(-1)).toBe('[a0]apad,atrim=end=12[aout]');
  });
});

describe('buildRender: speed', () => {
  it('plays a fast clip faster: the picture’s timestamps and the sound’s tempo', () => {
    const { args, chains, duration } = render(timeline(track('v', [clip('fast', 'a', { out: 8, speed: 2 })])));
    expect(duration).toBe(4);
    expect(inputsOf(args)).toEqual([['-threads', '2', '-ss', '0', '-t', '8', 'm0.mp4']]);
    expect(chainFrom(chains, '[0:v]')).toMatch(/^\[0:v\]setpts=PTS-STARTPTS,setpts=PTS\/2,/);
    expect(chainFrom(chains, '[0:a]')).toMatch(/^\[0:a\]asetpts=PTS-STARTPTS,atempo=2,aresample=48000,/);
  });
  it('chains atempo below half speed', () => {
    const { chains } = render(timeline(track('v', [clip('slow', 'a', { out: 1, speed: 0.25 })])));
    expect(chainFrom(chains, '[0:v]')).toContain(',setpts=PTS/0.25,');
    expect(chainFrom(chains, '[0:a]')).toMatch(/^\[0:a\]asetpts=PTS-STARTPTS,atempo=0\.5,atempo=0\.5,aresample=48000,/);
  });

  it('reads a speed of 0 as 1, like the timeline does (and never loops on atempo)', () => {
    const { graph, duration } = render(timeline(track('v', [clip('s1', 's', { speed: 0 })])));
    expect(duration).toBe(4);
    expect(graph).not.toContain('setpts=PTS/0');
    const sound = render(timeline(track('v', [clip('a1', 'a', { speed: 0 })])));
    expect(sound.graph).not.toContain('atempo');
  });
});

describe('buildRender: containers', () => {
  const tl = timeline(magnetic('main', [clip('a1', 'a')]));

  it('mp4 (the default): MPEG-4 Part 2 and AAC, the index up front', () => {
    const { args, output, mime } = render(tl);
    expect(mapsOf(args)).toEqual(['[vout]', '[aout]']);
    expect(option(args, '-c:v')).toBe('mpeg4');
    expect(option(args, '-q:v')).toBe('4');
    expect(option(args, '-pix_fmt')).toBe('yuv420p');
    expect(option(args, '-c:a')).toBe('aac');
    expect(option(args, '-b:a')).toBe('160k');
    expect(option(args, '-movflags')).toBe('+faststart');
    expect(args.at(-1)).toBe('render.mp4');
    expect(output).toBe('render.mp4');
    expect(mime).toBe('video/mp4');
    expect(option(render(tl, { quality: 'high' }).args, '-q:v')).toBe('2');
  });
  it('webm: VP8 at a bitrate for the frame, and Opus', () => {
    const { args, mime } = render(tl, { container: 'webm' });
    expect(option(args, '-c:v')).toBe('libvpx');
    expect(option(args, '-b:v')).toBe('1935k'); // 1280 × 720 × 30 fps × 0.07 bits a pixel
    expect(option(args, '-c:a')).toBe('opus');
    expect(option(args, '-strict')).toBe('experimental');
    expect(args.at(-1)).toBe('render.webm');
    expect(mime).toBe('video/webm');
  });
  it('gif: its own palette, looping forever, no sound', () => {
    const { args, chains, graph } = render(tl, { container: 'gif' });
    expect(chains).toContain('[o0]fps=15,scale=480:-2:flags=lanczos,split[g1][g2]');
    expect(chains).toContain('[g1]palettegen=stats_mode=diff[pal]');
    expect(chains.at(-1)).toMatch(/^\[g2\]\[pal\]paletteuse=.*\[vout\]$/);
    expect(graph).not.toContain(':a]');
    expect(mapsOf(args)).toEqual(['[vout]']);
    expect(args).not.toContain('-c:a');
    expect(args.slice(-5)).toEqual(['-loop', '0', '-threads', '2', 'render.gif']);
  });
  it('mp3: LAME, sound only', () => {
    const { args, graph, mime } = render(tl, { container: 'mp3' });
    expect(graph).not.toContain('color=');
    expect(graph).not.toContain(':v]');
    expect(mapsOf(args)).toEqual(['[aout]']);
    expect(args).not.toContain('-c:v');
    expect(option(args, '-c:a')).toBe('libmp3lame');
    expect(args.at(-1)).toBe('render.mp3');
    expect(mime).toBe('audio/mpeg');
  });
  it('wav: 16-bit PCM, sound only', () => {
    const { args, mime } = render(tl, { container: 'wav' });
    expect(mapsOf(args)).toEqual(['[aout]']);
    expect(option(args, '-c:a')).toBe('pcm_s16le');
    expect(args.at(-1)).toBe('render.wav');
    expect(mime).toBe('audio/wav');
  });
});

describe('buildRender: nothing to render', () => {
  it('throws a RangeError for an empty timeline', () => {
    expect(() => render({ tracks: [] })).toThrow(RangeError);
    expect(() => render(timeline(magnetic('main', [])))).toThrow(/empty/);
  });
  it('throws a RangeError for a GIF with no picture, or an MP3 or WAV with no sound', () => {
    const music = timeline(track('music', [clip('m', 'c')], { kind: 'audio' }));
    expect(() => render(music, { container: 'gif' })).toThrow(RangeError);
    const pictures = timeline(track('v', [clip('p', 'b'), clip('s1', 's', { start: 4 })]));
    expect(() => render(pictures, { container: 'mp3' })).toThrow(RangeError);
    expect(() => render(pictures, { container: 'wav' })).toThrow(/sound/);
  });
});
