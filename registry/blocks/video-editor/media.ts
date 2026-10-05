import { FfmpegError, type Ffmpeg } from '@/lib/ffmpeg';
import { probeMedia } from '@/lib/ffmpeg/react';
import { timelineId } from '@/lib/video-timeline';
import type { MediaItem } from './store';

/* Bringing files in: each gets an id and an object URL for the preview, then a probe for its kind, length and size.
   FFmpeg probes when it can run here (it reads anything the build decodes, HEVC and MKV included); otherwise the
   browser's own media elements do, for what the browser can play, so editing works even where FFmpeg can't. */

/** How long a still lasts when it's added. */
export const STILL_SECONDS = 4;

const EXT_KIND: Record<string, MediaItem['kind']> = {
  mp4: 'video', m4v: 'video', mov: 'video', webm: 'video', mkv: 'video', ts: 'video', gif: 'video',
  mp3: 'audio', m4a: 'audio', aac: 'audio', wav: 'audio', ogg: 'audio', opus: 'audio', flac: 'audio',
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image',
};

/** A file's kind from its type or extension, or null for something an editor can't use. */
export function kindOf(file: Blob): MediaItem['kind'] | null {
  const type = file.type.split('/')[0];
  if (type === 'video' || type === 'audio') return type;
  if (type === 'image') return file.type === 'image/gif' ? 'video' : 'image';
  const name = file instanceof File ? file.name : '';
  return EXT_KIND[/\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? ''] ?? null;
}

/** A library entry for a file, still loading. */
export function newMediaItem(file: File, kind: MediaItem['kind']): MediaItem {
  return {
    id: timelineId('media'),
    name: file.name.replace(/\.[^.]+$/, '') || 'Untitled',
    file,
    url: URL.createObjectURL(file),
    kind,
    duration: kind === 'image' ? STILL_SECONDS : 0,
    hasAudio: kind !== 'image',
    status: 'loading',
  };
}

/** What a media element says about a file the browser can play. */
function probeWithElement(item: MediaItem): Promise<Partial<MediaItem>> {
  return new Promise((resolve, reject) => {
    if (item.kind === 'image') {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, hasAudio: false });
      img.onerror = () => reject(new Error('This browser can’t open that image.'));
      img.src = item.url;
      return;
    }
    const el = document.createElement(item.kind === 'audio' ? 'audio' : 'video');
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      const v = el as HTMLVideoElement;
      resolve({ duration: Number.isFinite(el.duration) ? el.duration : 0, width: v.videoWidth || undefined, height: v.videoHeight || undefined });
    };
    el.onerror = () => reject(new Error('This browser can’t play that file.'));
    el.src = item.url;
  });
}

/** Fills in a new entry's kind, length, size and audio, by FFmpeg when there is one, else by the browser. */
export async function probeItem(item: MediaItem, ffmpeg: Ffmpeg | null): Promise<Partial<MediaItem>> {
  if (ffmpeg) {
    try {
      const info = await probeMedia(ffmpeg, item.file);
      return {
        kind: info.kind,
        duration: info.kind === 'image' ? STILL_SECONDS : info.duration,
        width: info.video?.displayWidth,
        height: info.video?.displayHeight,
        hasAudio: !!info.audio,
        status: info.duration > 0 || info.kind === 'image' ? 'ready' : 'error',
        error: info.duration > 0 || info.kind === 'image' ? undefined : 'FFmpeg found no media in this file.',
      };
    } catch (e) {
      // Only an engine that can't run here falls back; a file FFmpeg can't read is an error.
      if (!(e instanceof FfmpegError) || (e.code !== 'unsupported' && e.code !== 'missing')) {
        return { status: 'error', error: e instanceof Error ? e.message : String(e) };
      }
    }
  }
  try {
    return { ...(await probeWithElement(item)), status: 'ready' };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}
