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
 * viewport, so a page of recordings doesn't download them all up front.
 */
export function ReplayFile({ url, ...options }: ReplayFileProps) {
  const src = useAsset(url);
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
  return <ReplayPreview source={{ kind: 'events-url', url: src }} chrome="browser" {...options} />;
}

const RRWEB = /\.rrweb(?:[?#]|$)/i;

/** True for an rrweb recording file: a URL whose path ends in `.rrweb`. */
export function isRrwebUrl(url: string): boolean {
  return RRWEB.test(url.trim());
}
