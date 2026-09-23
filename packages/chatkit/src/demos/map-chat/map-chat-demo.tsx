import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn, Haptics, useAppearance, type Appearance } from '@brett_lamy/ui';
import { Button } from 'react-aria-components';
import { Composer, MarkdownView, type ReferenceNode } from '@brett_lamy/workbench';
import { ArtifactChatContainer, type ArtifactChatContainerProps } from '../../lib/artifact-chat-container';
import { formatDistance, formatMinutes, type MapTarget, type MapView } from './geo';
import {
  planTurn,
  SUGGESTIONS,
  TOOL_META,
  type AgentMemory,
  type MapToolHost,
  type MapToolName,
  type Trip,
} from './map-agent';
import { MAP_ICONS, type MapIconName } from './map-icons';
import { AREAS, CATEGORY_META, PLACE_BY_ID, USER_POSITION, type Place, type PlaceCategory } from './places';
import { esriLightGrayTiles, TileMap, type MapPin, type MapRoute } from './tile-map';

interface ToolCallState {
  id: string;
  name: MapToolName;
  args: Record<string, unknown>;
  status: 'running' | 'done';
  result?: string;
}

type TurnPart = { type: 'tool'; call: ToolCallState } | { type: 'text'; md: string; live: boolean };

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  parts: TurnPart[];
  live?: boolean;
}

export interface MapChatDemoProps {
  /** Forwarded to the container; the map wants `floating`, which is the default here. */
  layout?: ArtifactChatContainerProps['layout'];
  /** Transcript height that peeks above the composer. */
  peek?: number;
  /** Opening message from the guide; pass `null` to start empty. */
  greeting?: string | null;
  /** Send a message on mount, e.g. to seed a story. */
  initialPrompt?: string;
  /** Light or dark map and chat. Defaults to the ambient `AppearanceProvider` value, else dark. */
  appearance?: Appearance;
  className?: string;
  style?: CSSProperties;
}

const HOME_VIEW: MapView = { center: { lat: 40.7300, lng: -73.9985 }, zoom: 14.7 };
const TOOL_LATENCY: Record<MapToolName, number> = {
  search_places: 760,
  show_on_map: 420,
  plan_route: 920,
  save_trip: 380,
  clear_map: 300,
};
/* Keeps framed pins clear of the top banner and the floating chat glass. */
const FIT_PADDING = { top: 96, right: 44, bottom: 390, left: 44 };
const DEFAULT_GREETING =
  "Hey — I'm your guide around **Greenwich Village** and the rest of the city. Ask me to find places, get walking directions, or plan a few hours.\n\nTry #coffee, #pizza, or #museum — or tap a suggestion below.";

let uidCounter = 0;
const uid = (prefix: string) => `${prefix}-${(uidCounter++).toString(36)}-${Date.now().toString(36)}`;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function summarizeArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        const shown = value.slice(0, 3).map(String).join(', ');
        return `${key}: ${shown}${value.length > 3 ? ` +${value.length - 3}` : ''}`;
      }
      return `${key}: ${String(value)}`;
    })
    .join(' · ');
}

function Icon({ name, size = 16, stroke = 2 }: { name: MapIconName; size?: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={MAP_ICONS[name]} />
    </svg>
  );
}

/** `font: inherit` for buttons, leaving size, weight and line-height to the caller. */
const FONT_INHERIT = '[font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit]';
const SPINNER =
  'inline-block size-3 animate-[ck-map-chat-spin_.8s_linear_infinite] rounded-[50%] border-2 border-[rgba(255,255,255,.18)] border-t-[#f5f5f7] align-middle';

/* The demo's own chrome per appearance; dark is the original look. */
const CHROME = {
  dark: {
    spinner: SPINNER,
    tool: 'border-[rgba(255,255,255,.07)] bg-[rgba(255,255,255,.06)]',
    toolDone: 'bg-[rgba(48,209,88,.16)] text-[#5ad67a]',
    toolRunning: 'bg-[rgba(10,132,255,.2)] text-[#7fb6ff]',
    banner: 'border-[rgba(255,255,255,.12)] bg-[rgba(24,24,30,.82)] shadow-[0_8px_24px_rgba(0,0,0,.35)]',
    bannerClose: 'bg-[rgba(255,255,255,.1)] text-[#f5f5f7] data-hovered:bg-[rgba(255,255,255,.18)]',
    chip: 'border-[rgba(255,255,255,.14)] bg-[rgba(255,255,255,.08)] data-hovered:bg-[rgba(255,255,255,.16)]',
    ref: 'text-white',
  },
  light: {
    spinner:
      'inline-block size-3 animate-[ck-map-chat-spin_.8s_linear_infinite] rounded-[50%] border-2 border-[rgba(0,0,0,.12)] border-t-[#1c1c1e] align-middle',
    tool: 'border-[rgba(0,0,0,.06)] bg-[rgba(0,0,0,.035)]',
    toolDone: 'bg-[rgba(52,199,89,.16)] text-[#1f8a3c]',
    toolRunning: 'bg-[rgba(10,132,255,.13)] text-[#0a64d6]',
    banner: 'border-[rgba(0,0,0,.08)] bg-[rgba(255,255,255,.88)] text-[#1c1c1e] shadow-[0_8px_24px_rgba(0,0,0,.14)]',
    bannerClose: 'bg-[rgba(0,0,0,.06)] text-[#1c1c1e] data-hovered:bg-[rgba(0,0,0,.1)]',
    chip: 'border-[rgba(0,0,0,.1)] bg-[rgba(255,255,255,.9)] data-hovered:bg-[rgba(0,0,0,.05)]',
    ref: 'text-[#1c1c1e]',
  },
};
type Chrome = (typeof CHROME)['dark'];

function ToolRow({ call, chrome }: { call: ToolCallState; chrome: Chrome }) {
  const meta = TOOL_META[call.name];
  const done = call.status === 'done';
  return (
    <div
      data-slot="map-chat-tool"
      data-status={call.status}
      className={cn(
        'flex min-w-0 animate-[ck-in_.22s_ease] items-center gap-2 rounded-[10px] border py-[5px] pr-2.5 pl-2 text-[12.5px] leading-[1.3] text-bl-label2',
        chrome.tool,
      )}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-[6px]',
          done ? chrome.toolDone : chrome.toolRunning,
        )}
      >
        <Icon name={meta.icon} size={14} />
      </span>
      <span className="shrink-0 font-semibold text-bl-label">{meta.label}</span>
      <span className="min-w-0 flex-1 overflow-hidden font-[family-name:var(--bl-mono,ui-monospace,SFMono-Regular,Menlo,monospace)] text-[11.5px] text-ellipsis whitespace-nowrap">
        {summarizeArgs(call.args)}
      </span>
      <span className="max-w-[40%] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums">
        {call.status === 'running' ? <span className={chrome.spinner} aria-label="Running" /> : call.result}
      </span>
    </div>
  );
}

export function MapChatDemo({
  layout = 'floating',
  peek = 236,
  greeting = DEFAULT_GREETING,
  initialPrompt,
  appearance,
  className,
  style,
}: MapChatDemoProps) {
  const ambient = useAppearance();
  const light = (appearance ?? ambient) === 'light';
  const chrome = light ? CHROME.light : CHROME.dark;
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [view, setView] = useState<MapTarget>(HOME_VIEW);
  const [turns, setTurns] = useState<ChatTurn[]>(() =>
    greeting ? [{ id: 'greeting', role: 'assistant', parts: [{ type: 'text', md: greeting, live: false }] }] : [],
  );
  const [working, setWorking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const memoryRef = useRef<AgentMemory>({ lastResults: [] });
  const cameraRef = useRef<MapView>(HOME_VIEW);
  const aliveRef = useRef(true);
  const cancelRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [turns]);

  const patchTurn = useCallback((id: string, update: (turn: ChatTurn) => ChatTurn) => {
    if (!aliveRef.current) return;
    setTurns((prev) => prev.map((turn) => (turn.id === id ? update(turn) : turn)));
  }, []);

  const focusPlaces = useCallback((targets: Place[]) => {
    const points = targets.map((p) => p.position);
    const nearUser = targets.some((p) => Math.abs(p.position.lat - USER_POSITION.lat) < 0.03 && Math.abs(p.position.lng - USER_POSITION.lng) < 0.03);
    if (nearUser) points.push(USER_POSITION);
    if (points.length === 1) setView({ center: points[0], zoom: Math.max(cameraRef.current.zoom, 16) });
    else setView({ bounds: points, padding: FIT_PADDING, maxZoom: 16 });
  }, []);

  const host = useMemo<MapToolHost>(
    () => ({
      userPosition: USER_POSITION,
      showPlaces(next, options) {
        setPlaces(next);
        setSelectedId(options?.selectedId ?? null);
        if (options?.focus !== false) focusPlaces(next);
      },
      showRoute(nextTrip) {
        setTrip(nextTrip);
        if (nextTrip) {
          setPlaces((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            return [...prev, ...nextTrip.stops.filter((s) => !ids.has(s.id))];
          });
          setView({ bounds: [...(nextTrip.from ? [nextTrip.from] : []), ...nextTrip.stops.map((s) => s.position)], padding: FIT_PADDING, maxZoom: 16 });
        }
      },
      saveTrip(nextTrip) {
        setSavedTrips((prev) => [nextTrip, ...prev.filter((t) => t.id !== nextTrip.id)]);
      },
      clear() {
        setPlaces([]);
        setTrip(null);
        setSelectedId(null);
        setView({ ...HOME_VIEW });
      },
    }),
    [focusPlaces],
  );

  const streamText = useCallback(
    async (turnId: string, markdown: string) => {
      const tokens = markdown.split(/(\s+)/);
      let acc = '';
      patchTurn(turnId, (turn) => ({ ...turn, parts: [...turn.parts, { type: 'text', md: '', live: true }] }));
      for (let i = 0; i < tokens.length; i += 2) {
        if (cancelRef.current || !aliveRef.current) break;
        acc += tokens[i] + (tokens[i + 1] ?? '');
        const snapshot = acc;
        patchTurn(turnId, (turn) => ({
          ...turn,
          parts: turn.parts.map((part, idx) => (idx === turn.parts.length - 1 && part.type === 'text' ? { ...part, md: snapshot } : part)),
        }));
        await sleep(26);
      }
      patchTurn(turnId, (turn) => ({
        ...turn,
        live: false,
        parts: turn.parts.map((part) => (part.type === 'text' ? { ...part, live: false, md: cancelRef.current ? part.md : markdown } : part)),
      }));
    },
    [patchTurn],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      cancelRef.current = false;
      setBusy(true);
      Haptics.selection();
      const plan = planTurn(trimmed, memoryRef.current, USER_POSITION);
      memoryRef.current = plan.memory;
      const assistantId = uid('a');
      setTurns((prev) => [
        ...prev,
        { id: uid('u'), role: 'user', text: trimmed, parts: [] },
        { id: assistantId, role: 'assistant', parts: [], live: true },
      ]);
      if (plan.steps.length) setWorking(plan.working);
      for (const step of plan.steps) {
        if (cancelRef.current || !aliveRef.current) break;
        const callId = uid('t');
        patchTurn(assistantId, (turn) => ({
          ...turn,
          parts: [...turn.parts, { type: 'tool', call: { id: callId, name: step.name, args: step.args, status: 'running' } }],
        }));
        await sleep(TOOL_LATENCY[step.name]);
        if (cancelRef.current || !aliveRef.current) break;
        const result = step.run(host);
        patchTurn(assistantId, (turn) => ({
          ...turn,
          parts: turn.parts.map((part) =>
            part.type === 'tool' && part.call.id === callId ? { type: 'tool', call: { ...part.call, status: 'done', result } } : part,
          ),
        }));
        await sleep(160);
      }
      if (aliveRef.current) setWorking(null);
      if (!cancelRef.current) await streamText(assistantId, plan.reply);
      else patchTurn(assistantId, (turn) => ({ ...turn, live: false }));
      if (aliveRef.current) setBusy(false);
    },
    [busy, host, patchTurn, streamText],
  );

  const stop = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const initialSent = useRef(false);
  useEffect(() => {
    if (!initialPrompt || initialSent.current) return;
    initialSent.current = true;
    void send(initialPrompt);
    // Fire once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusPlace = useCallback(
    (place: Place) => {
      Haptics.selection();
      setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [...prev, place]));
      setSelectedId(place.id);
      setView({ center: place.position, zoom: Math.max(cameraRef.current.zoom, 16) });
    },
    [],
  );

  const onReferenceClick = useCallback(
    (ref: ReferenceNode) => {
      if (ref.kind === 'mention') {
        const place = PLACE_BY_ID[ref.id];
        if (place) focusPlace(place);
        return;
      }
      if (ref.kind === 'tag') {
        if (ref.id in CATEGORY_META) void send(`Find ${CATEGORY_META[ref.id as PlaceCategory].plural} near me`);
        else if (ref.id in AREAS) void send(`What's in ${AREAS[ref.id].label}?`);
      }
    },
    [focusPlace, send],
  );

  const renderReference = useCallback(
    (ref: ReferenceNode): ReactNode | null => {
      if (ref.kind !== 'mention') return null;
      const place = PLACE_BY_ID[ref.id];
      if (!place) return null;
      const meta = CATEGORY_META[place.category];
      return (
        <Button
          data-slot="map-chat-ref"
          className={cn(
            'mx-px inline-flex cursor-pointer items-center gap-[5px] rounded-[999px] border py-px pr-2 pl-1 align-baseline text-[.92em] leading-[1.35] font-semibold',
            chrome.ref,
            FONT_INHERIT,
            'border-[color:color-mix(in_srgb,var(--ck-ref-color,#0a84ff)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--ck-ref-color,#0a84ff)_16%,transparent)]',
            'transition-[background] duration-160 ease-[ease] data-hovered:bg-[color:color-mix(in_srgb,var(--ck-ref-color,#0a84ff)_30%,transparent)]',
          )}
          style={{ '--ck-ref-color': meta.color } as CSSProperties}
          onPress={() => focusPlace(place)}
        >
          <span className="grid size-4 place-items-center rounded-[50%] bg-[color:var(--ck-ref-color,#0a84ff)] text-white">
            <Icon name={meta.icon} size={11} stroke={2.4} />
          </span>
          {place.name}
        </Button>
      );
    },
    [focusPlace, chrome],
  );

  const stopIndex = useMemo(() => new Map(trip?.stops.map((s, i) => [s.id, i + 1]) ?? []), [trip]);
  const pins = useMemo<MapPin[]>(() => {
    const placePins = places.map<MapPin>((place) => {
      const meta = CATEGORY_META[place.category];
      const stop = stopIndex.get(place.id);
      return {
        id: place.id,
        position: place.position,
        label: place.name,
        color: stop ? undefined : meta.color,
        icon: meta.icon,
        badge: stop,
        kind: stop ? 'stop' : 'place',
        selected: place.id === selectedId,
      };
    });
    return [{ id: 'you', position: USER_POSITION, kind: 'user', label: 'You' }, ...placePins];
  }, [places, selectedId, stopIndex]);

  const route = useMemo<MapRoute | null>(
    () => (trip ? { points: [...(trip.from ? [trip.from] : []), ...trip.stops.map((s) => s.position)] } : null),
    [trip],
  );

  const showSuggestions = turns.length <= 1 && !busy;

  return (
    <ArtifactChatContainer
      layout={layout}
      peek={peek}
      working={working != null}
      workingLabel={working ?? undefined}
      hideOnScroll={false}
      tone={appearance}
      className={cn('ck-map-chat group/map-chat', className)}
      style={style}
    >
      <ArtifactChatContainer.Content>
        <TileMap
          className="absolute inset-0"
          view={view}
          pins={pins}
          route={route}
          controls
          {...(light ? { tileUrl: esriLightGrayTiles, scheme: 'light' as const } : { tileFilter: 'brightness(.72) saturate(.85) contrast(1.05)' })}
          onViewChange={(cam) => {
            cameraRef.current = cam;
          }}
          onPinClick={(pin) => {
            const place = PLACE_BY_ID[pin.id];
            if (place) focusPlace(place);
            else if (pin.id === 'you') setView({ center: USER_POSITION, zoom: Math.max(cameraRef.current.zoom, 15.5) });
          }}
          onMapClick={() => setSelectedId(null)}
          onLocate={() => setView({ center: USER_POSITION, zoom: 15.5 })}
        >
          {trip && (
            <div
              data-slot="map-chat-banner"
              className={cn(
                'pointer-events-auto absolute top-3.5 right-[70px] left-3.5 z-3 flex max-w-[380px] animate-[ck-in_.3s_ease] items-center gap-3 rounded-[16px] border py-2.5 pr-3 pl-3.5 backdrop-blur-[14px]',
                chrome.banner,
              )}
              data-map-ui
            >
              <span className="grid size-[34px] shrink-0 place-items-center rounded-[50%] bg-bl-tint text-white">
                <Icon name={savedTrips.some((t) => t.id === trip.id) ? 'bookmark' : 'walk'} size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13px] leading-[1.25]">
                <strong className="overflow-hidden text-[14px] font-[650] text-ellipsis whitespace-nowrap">{trip.name}</strong>
                <span className="text-bl-label2">
                  {trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'} · {formatMinutes(trip.totalMinutes)} · {formatDistance(trip.totalMeters)}
                </span>
              </span>
              <Button
                aria-label="Clear route"
                className={cn('grid size-7 shrink-0 cursor-pointer place-items-center rounded-[50%] border-0 p-0', chrome.bannerClose)}
                onPress={() => setTrip(null)}
              >
                <Icon name="x" size={14} stroke={2.4} />
              </Button>
            </div>
          )}
        </TileMap>
      </ArtifactChatContainer.Content>

      <ArtifactChatContainer.Chat>
        <div
          ref={scrollerRef}
          data-slot="map-chat-transcript"
          className="ck-scroll box-border flex h-full min-h-0! flex-col gap-3 overflow-y-auto overscroll-contain px-3.5 pt-3.5 pb-2.5 text-[14.5px] leading-[1.45] [&>:first-child]:mt-auto"
          aria-live="polite"
        >
          {turns.map((turn) =>
            turn.role === 'user' ? (
              <div
                key={turn.id}
                className="max-w-[82%] animate-[ck-in_.24s_ease] self-end rounded-[18px_18px_6px_18px] bg-bl-tint px-[13px] py-2 text-[14.5px] leading-[1.35] [word-break:break-word] whitespace-pre-wrap text-white"
              >
                {turn.text}
              </div>
            ) : (
              <div key={turn.id} className="flex min-w-0 animate-[ck-in_.24s_ease] flex-col gap-1.5" data-live={turn.live || undefined}>
                {turn.parts.map((part, idx) =>
                  part.type === 'tool' ? (
                    <ToolRow key={part.call.id} call={part.call} chrome={chrome} />
                  ) : (
                    <MarkdownView
                      key={`${turn.id}-text-${idx}`}
                      className="ck-map-chat__md"
                      markdown={part.md}
                      streaming={part.live}
                      onReferenceClick={onReferenceClick}
                      renderReference={renderReference}
                    />
                  ),
                )}
                {turn.live && turn.parts.length === 0 && <span className={chrome.spinner} aria-label="Thinking" />}
              </div>
            ),
          )}
        </div>
      </ArtifactChatContainer.Chat>

      <ArtifactChatContainer.Composer>
        <div className="flex min-w-0 flex-col">
          {showSuggestions && (
            <div
              data-slot="map-chat-suggestions"
              role="list"
              className="flex gap-2 overflow-x-auto px-3 pt-2 pb-0.5 [scrollbar-width:none] [-webkit-mask-image:linear-gradient(to_right,#000_calc(100%_-_28px),transparent)] [mask-image:linear-gradient(to_right,#000_calc(100%_-_28px),transparent)] [&::-webkit-scrollbar]:hidden group-data-[layout=split]/map-chat:px-3.5 group-data-[layout=split]/map-chat:pt-2.5 group-data-[layout=split]/map-chat:pb-0"
            >
              {SUGGESTIONS.map((s) => (
                <div key={s} role="listitem" className="contents">
                  <Button
                    className={cn(
                      'shrink-0 cursor-pointer rounded-[999px] border px-3 py-1.5 text-[13px] leading-[1.2] font-medium whitespace-nowrap text-bl-label',
                      FONT_INHERIT,
                      'transition-[background] duration-160 ease-[ease]',
                      chrome.chip,
                    )}
                    onPress={() => void send(s)}
                  >
                    {s}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Composer
            wide
            showOptions={false}
            showCheckout={false}
            placeholder="Find places, get directions, plan a trip…"
            streaming={busy}
            onStop={stop}
            onSend={(text) => void send(text)}
          />
        </div>
      </ArtifactChatContainer.Composer>
    </ArtifactChatContainer>
  );
}
