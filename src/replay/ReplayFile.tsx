import { useEffect, useRef, useState } from 'react';
import { useAsset } from '../asset-resolver';
import { ReplayPreview } from './ReplayPreview';
import type { ReplayPlayerOptions } from './ReplayPlayer';

export interface ReplayFileProps extends Omit<ReplayPlayerOptions, 'url'> {
  /** The `.rrweb` file as written in the document; the host's asset resolver maps it to a loadable URL. */
  url: string;
}

/**
 * An rrweb recording file (a JSON event array, or `{ events }`), played in the replay browser frame.
 * The URL goes through `AssetResolverProvider`, and the file is fetched only once the frame nears the
 * viewport, so a page of recordings doesn't download them all up front. A media fragment on the URL,
 * `recording.rrweb#t=4.7,7.4` (seconds), is its `timeWindow`.
 */
export function ReplayFile({ url, ...options }: ReplayFileProps) {
  const { file, segment } = splitReplayFragment(url);
  const src = useAsset(file);
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '240px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (!near || src === undefined) return <div ref={ref} className="docstream-asset-pending" data-slot="replay-file" aria-busy="true" />;
  return <ReplayPreview source={{ kind: 'events-url', url: src }} chrome="browser" timeWindow={segment} {...options} />;
}

/** Splits `#t=start,end` (a media fragment, in seconds; `#t=start` runs to the end) off a recording's URL. */
export function splitReplayFragment(url: string): { file: string; segment?: [number, number] } {
  const hash = url.indexOf('#');
  if (hash < 0) return { file: url };
  const m = url.slice(hash + 1).match(/(?:^|&)t=(?:npt:)?([\d.]*)(?:,([\d.]+))?(?:&|$)/);
  if (!m) return { file: url };
  const start = m[1] ? Number(m[1]) * 1000 : 0;
  const end = m[2] ? Number(m[2]) * 1000 : Infinity;
  return { file: url.slice(0, hash), segment: Number.isFinite(start) && end > start ? [start, end] : undefined };
}

const RRWEB = /\.rrweb(?:[?#]|$)/i;

/** True for an rrweb recording file: a URL whose path ends in `.rrweb`. */
export function isRrwebUrl(url: string): boolean {
  return RRWEB.test(url.trim());
}
