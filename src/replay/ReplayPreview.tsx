import { Suspense, lazy, useEffect, useState } from 'react';
import type { ReplayEvent } from './types';
import { normalizeReplayEmbedUrl } from './url';

export interface ReplayPageSource {
  kind: 'url';
  url: string;
  title?: string;
}

export interface ReplayEventsSource {
  kind: 'events';
  events: ReplayEvent[];
}

export interface ReplayEventsUrlSource {
  kind: 'events-url';
  url: string;
  fetchInit?: RequestInit;
}

export type ReplaySource =
  | string
  | ReplayEvent[]
  | ReplayPageSource
  | ReplayEventsSource
  | ReplayEventsUrlSource;

export interface ReplayPreviewProps {
  /** A public Loop QA URL, a public event endpoint, or an in-memory rrweb event list. */
  source: ReplaySource;
  /** Avoid mounting the rrweb player until the editor block is visible. */
  active?: boolean;
  /** Public-page embeds default to lazy loading; native rrweb playback defaults to paused. */
  autoplay?: boolean;
  loop?: boolean;
  className?: string;
  title?: string;
  /** Playback speed options mirror the Loop QA player. */
  speeds?: number[];
}

const DEFAULT_SPEEDS = [0.5, 1, 2, 4, 8];

function sourcePage(source: ReplaySource): ReplayPageSource | null {
  if (typeof source === 'string') return { kind: 'url', url: source };
  if (Array.isArray(source)) return null;
  return source.kind === 'url' ? source : null;
}

function sourceEvents(source: ReplaySource): ReplayEventsSource | null {
  if (Array.isArray(source)) return { kind: 'events', events: source };
  if (typeof source === 'string') return null;
  return source.kind === 'events' ? source : null;
}

function sourceEventsUrl(source: ReplaySource): ReplayEventsUrlSource | null {
  if (Array.isArray(source) || typeof source === 'string') return null;
  return source.kind === 'events-url' ? source : null;
}

function ReplayFrame({ source, title }: { source: ReplayPageSource; title?: string }) {
  const url = normalizeReplayEmbedUrl(source.url);
  if (!url) {
    return (
      <a className="replay-preview__invalid" href={source.url} target="_blank" rel="noreferrer">
        Open replay
      </a>
    );
  }
  return (
    <iframe
      className="replay-preview__frame"
      src={url}
      title={title ?? source.title ?? 'Replay preview'}
      loading="lazy"
      allow="autoplay; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

// rrweb (and its stylesheet) load on first use of an event-based source.
const LazyNativeReplay = lazy(() => import('./NativeReplay'));

function NativeReplay(props: { events: ReplayEvent[]; autoplay?: boolean; loop?: boolean; speeds?: number[] }) {
  return (
    <Suspense fallback={<div className="replay-preview__empty">Loading replay…</div>}>
      <LazyNativeReplay {...props} />
    </Suspense>
  );
}

function RemoteReplay({
  source,
  autoplay,
  loop,
  speeds,
}: {
  source: ReplayEventsUrlSource;
  autoplay?: boolean;
  loop?: boolean;
  speeds?: number[];
}) {
  const [events, setEvents] = useState<ReplayEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setEvents(null);
    setError(null);
    fetch(source.url, { ...source.fetchInit, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Replay event request failed (${response.status})`);
        const body = (await response.json()) as unknown;
        const value = Array.isArray(body)
          ? body
          : body && typeof body === 'object' && Array.isArray((body as { events?: unknown }).events)
            ? (body as { events: unknown[] }).events
            : null;
        if (!value) throw new Error('Replay event endpoint must return an event array or { events }');
        return value as ReplayEvent[];
      })
      .then(setEvents)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Unable to load replay data');
      });
    return () => controller.abort();
  }, [source.url, source.fetchInit]);

  if (error) return <div className="replay-preview__error" role="alert">{error}</div>;
  if (!events) return <div className="replay-preview__empty">Loading replay…</div>;
  return <NativeReplay events={events} autoplay={autoplay} loop={loop} speeds={speeds} />;
}

export function ReplayPreview({
  source,
  active = true,
  autoplay = false,
  loop = false,
  className,
  title,
  speeds = DEFAULT_SPEEDS,
}: ReplayPreviewProps) {
  if (!active) return <div className={`replay-preview ${className ?? ''}`.trim()} data-replay-preview="paused" />;

  const page = sourcePage(source);
  const events = sourceEvents(source);
  const eventsUrl = sourceEventsUrl(source);
  const rootClass = `replay-preview ${className ?? ''}`.trim();

  if (page) {
    return (
      <div className={rootClass} data-replay-preview="iframe">
        <ReplayFrame source={page} title={title} />
      </div>
    );
  }
  if (events) {
    return (
      <div className={rootClass} data-replay-preview="rrweb">
        <NativeReplay events={events.events} autoplay={autoplay} loop={loop} speeds={speeds} />
      </div>
    );
  }
  if (eventsUrl) {
    return (
      <div className={rootClass} data-replay-preview="rrweb">
        <RemoteReplay source={eventsUrl} autoplay={autoplay} loop={loop} speeds={speeds} />
      </div>
    );
  }
  return null;
}

/** Semantic alias for markdown/document renderers. */
export const ReplayEmbed = ReplayPreview;
