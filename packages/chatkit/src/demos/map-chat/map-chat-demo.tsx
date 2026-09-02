import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Haptics } from '@touchkit/ui';
import { Composer, MarkdownView, type ReferenceNode } from '@touchkit/workbench';
import { ArtifactChatContainer, type ArtifactChatContainerProps } from '../../lib/artifact-chat-container';
import { cn } from '../../lib/cn';
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
import { TileMap, type MapPin, type MapRoute } from './tile-map';

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
  className?: string;
  style?: CSSProperties;
}

const HOME_VIEW: MapView = { center: { lat: 40.6893, lng: -73.9742 }, zoom: 14.7 };
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
  "Hey — I'm your guide around **Fort Greene** and the rest of the city. Ask me to find places, get walking directions, or plan a few hours.\n\nTry #coffee, #pizza, or #museum — or tap a suggestion below.";

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

function ToolRow({ call }: { call: ToolCallState }) {
  const meta = TOOL_META[call.name];
  return (
    <div className="ck-map-chat__tool" data-status={call.status}>
      <span className="ck-map-chat__tool-icon">
        <Icon name={meta.icon} size={14} />
      </span>
      <span className="ck-map-chat__tool-name">{meta.label}</span>
      <span className="ck-map-chat__tool-args">{summarizeArgs(call.args)}</span>
      <span className="ck-map-chat__tool-result">
        {call.status === 'running' ? <span className="ck-map-chat__spinner" aria-label="Running" /> : call.result}
      </span>
    </div>
  );
}

export function MapChatDemo({
  layout = 'floating',
  peek = 236,
  greeting = DEFAULT_GREETING,
  initialPrompt,
  className,
  style,
}: MapChatDemoProps) {
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
        <button
          type="button"
          className="ck-map-chat__ref"
          style={{ '--ck-ref-color': meta.color } as CSSProperties}
          onClick={() => focusPlace(place)}
        >
          <span className="ck-map-chat__ref-icon">
            <Icon name={meta.icon} size={11} stroke={2.4} />
          </span>
          {place.name}
        </button>
      );
    },
    [focusPlace],
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
      className={cn('ck-map-chat', className)}
      style={style}
    >
      <ArtifactChatContainer.Content>
        <TileMap
          className="ck-map-chat__map"
          view={view}
          pins={pins}
          route={route}
          controls
          tileFilter="brightness(.72) saturate(.85) contrast(1.05)"
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
            <div className="ck-map-chat__banner" data-map-ui>
              <span className="ck-map-chat__banner-icon">
                <Icon name={savedTrips.some((t) => t.id === trip.id) ? 'bookmark' : 'walk'} size={18} />
              </span>
              <span className="ck-map-chat__banner-text">
                <strong>{trip.name}</strong>
                <span>
                  {trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'} · {formatMinutes(trip.totalMinutes)} · {formatDistance(trip.totalMeters)}
                </span>
              </span>
              <button type="button" className="ck-map-chat__banner-close" aria-label="Clear route" onClick={() => setTrip(null)}>
                <Icon name="x" size={14} stroke={2.4} />
              </button>
            </div>
          )}
        </TileMap>
      </ArtifactChatContainer.Content>

      <ArtifactChatContainer.Chat>
        <div ref={scrollerRef} className="ck-map-chat__transcript ck-scroll" aria-live="polite">
          {turns.map((turn) =>
            turn.role === 'user' ? (
              <div key={turn.id} className="ck-map-chat__user">
                {turn.text}
              </div>
            ) : (
              <div key={turn.id} className="ck-map-chat__assistant" data-live={turn.live || undefined}>
                {turn.parts.map((part, idx) =>
                  part.type === 'tool' ? (
                    <ToolRow key={part.call.id} call={part.call} />
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
                {turn.live && turn.parts.length === 0 && <span className="ck-map-chat__spinner" aria-label="Thinking" />}
              </div>
            ),
          )}
        </div>
      </ArtifactChatContainer.Chat>

      <ArtifactChatContainer.Composer>
        <div className="ck-map-chat__composer">
          {showSuggestions && (
            <div className="ck-map-chat__suggestions" role="list">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" role="listitem" className="ck-map-chat__suggestion" onClick={() => void send(s)}>
                  {s}
                </button>
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
