import type { TimelineClip, TimelineFormat } from '@/lib/video-timeline';

/* Titles: a title clip plays no file (its media is TITLE_MEDIA) and keeps its text and style in `clip.data`. One SVG
   draws it, at the project's size: the preview shows that SVG as an image, and a render rasterizes the same SVG to a
   transparent PNG that FFmpeg lays over the picture, so the two match. Text uses the system font stack, which an SVG
   image can reach without loading anything. */

export const TITLE_MEDIA = '@title';

export type TitleStyle = 'lower-third' | 'center' | 'caption';

export interface TitleData {
  text: string;
  style: TitleStyle;
}

export const titleStyles: { id: TitleStyle; label: string }[] = [
  { id: 'lower-third', label: 'Lower third' },
  { id: 'center', label: 'Centered' },
  { id: 'caption', label: 'Caption' },
];

export const isTitle = (clip: TimelineClip) => clip.media === TITLE_MEDIA;

export function titleData(clip: TimelineClip): TitleData {
  const d = (clip.data ?? {}) as Partial<TitleData>;
  return { text: typeof d.text === 'string' ? d.text : 'Title', style: d.style ?? 'lower-third' };
}

/** The inks a title is drawn in: they become pixels in the video, so they're fixed, not themed. */
const INK = { text: '#ffffff', shadow: '#000000', plate: '#0b0b0f', accent: '#0a84ff' } as const;
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);

/** The title as an SVG document, `width`×`height`, transparent around the text. */
export function titleSvg({ text, style }: TitleData, { width: W, height: H }: Pick<TimelineFormat, 'width' | 'height'>): string {
  const lines = (text.trim() || ' ').split('\n').slice(0, 3);
  const u = Math.min(W, H) / 100;
  const tspans = (x: number, size: number, anchor: string) =>
    lines.map((l, i) => `<tspan x="${x}" dy="${i ? size * 1.15 : 0}" text-anchor="${anchor}">${esc(l)}</tspan>`).join('');
  let body: string;
  if (style === 'center') {
    const size = u * 9;
    const y = H / 2 - ((lines.length - 1) * size * 1.15) / 2 + size * 0.35;
    body = `<text y="${y}" font-size="${size}" font-weight="800" fill="${INK.text}" filter="url(#s)">${tspans(W / 2, size, 'middle')}</text>`;
  } else if (style === 'caption') {
    const size = u * 4.6;
    const longest = Math.max(...lines.map((l) => l.length));
    const bw = Math.min(W * 0.9, longest * size * 0.56 + size * 1.6);
    const bh = lines.length * size * 1.15 + size * 0.9;
    const by = H - bh - u * 6;
    body = `<rect x="${(W - bw) / 2}" y="${by}" width="${bw}" height="${bh}" rx="${size * 0.35}" fill="${INK.shadow}" fill-opacity=".62"/>`
      + `<text y="${by + size * 1.2}" font-size="${size}" font-weight="600" fill="${INK.text}">${tspans(W / 2, size, 'middle')}</text>`;
  } else {
    const size = u * 5.4;
    const longest = Math.max(...lines.map((l) => l.length));
    const bw = Math.min(W * 0.8, longest * size * 0.6 + size * 2);
    const bh = lines.length * size * 1.15 + size;
    const bx = u * 6, by = H - bh - u * 8;
    body = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${size * 0.3}" fill="${INK.plate}" fill-opacity=".72"/>`
      + `<rect x="${bx}" y="${by}" width="${size * 0.22}" height="${bh}" rx="${size * 0.11}" fill="${INK.accent}"/>`
      + `<text y="${by + size * 1.25}" font-size="${size}" font-weight="700" fill="${INK.text}">${tspans(bx + size * 0.9, size, 'start')}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(FONT)}">`
    + `<defs><filter id="s" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="${u * 0.4}" stdDeviation="${u * 0.8}" flood-color="${INK.shadow}" flood-opacity=".55"/></filter></defs>`
    + `${body}</svg>`;
}

export const titleUrl = (data: TitleData, format: Pick<TimelineFormat, 'width' | 'height'>) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(titleSvg(data, format))}`;

/** The title as a transparent PNG at the project's size, for a render. */
export async function titlePng(data: TitleData, format: Pick<TimelineFormat, 'width' | 'height'>): Promise<Blob> {
  const img = new Image();
  img.decoding = 'async';
  img.src = titleUrl(data, format);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('This browser can’t draw the title.');
  g.drawImage(img, 0, 0, format.width, format.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t draw the title.'))), 'image/png'));
}

/** A title as the preview draws it. */
export function TitleView({ clip, format }: { clip: TimelineClip; format: Pick<TimelineFormat, 'width' | 'height'> }) {
  return <img src={titleUrl(titleData(clip), format)} alt="" className="size-full" draggable={false} />;
}
