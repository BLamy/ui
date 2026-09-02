/*
 * A scripted "agent" for the map chat demo. It parses a message into an intent,
 * emits the tool calls a real model would make, and drafts a markdown reply that
 * references places as `@place-id` chips. There is no model behind it — swap
 * `planTurn` for a transport that yields the same `AgentToolStep`s to go live.
 */
import { distanceMeters, formatDistance, formatMinutes, walkingMinutes, type LatLng } from './geo';
import { AREAS, CATEGORY_META, PLACES, type Place, type PlaceCategory } from './places';

export type MapToolName = 'search_places' | 'show_on_map' | 'plan_route' | 'save_trip' | 'clear_map';

export interface Trip {
  id: string;
  name: string;
  /** Start point when the walk begins from the user; omitted for far-away areas. */
  from?: LatLng;
  stops: Place[];
  totalMeters: number;
  totalMinutes: number;
}

/** What the tools are allowed to do to the map. Implemented by the host UI. */
export interface MapToolHost {
  userPosition: LatLng;
  showPlaces(places: Place[], options?: { focus?: boolean; selectedId?: string }): void;
  showRoute(trip: Trip | null): void;
  saveTrip(trip: Trip): void;
  clear(): void;
}

export interface AgentToolStep {
  name: MapToolName;
  args: Record<string, unknown>;
  /** Applies the tool to the host and returns a one-line result for the transcript. */
  run(host: MapToolHost): string;
}

export interface AgentMemory {
  lastResults: Place[];
  lastArea?: string;
  lastTrip?: Trip;
}

export interface AgentTurnPlan {
  steps: AgentToolStep[];
  reply: string;
  /** Status shown in the collapsed composer while the tools run. */
  working: string;
  memory: AgentMemory;
}

export const TOOL_META: Record<MapToolName, { label: string; icon: 'search' | 'pin' | 'route' | 'bookmark' | 'eraser' }> = {
  search_places: { label: 'Search places', icon: 'search' },
  show_on_map: { label: 'Show on map', icon: 'pin' },
  plan_route: { label: 'Plan route', icon: 'route' },
  save_trip: { label: 'Save trip', icon: 'bookmark' },
  clear_map: { label: 'Clear map', icon: 'eraser' },
};

const CATEGORY_WORDS: Array<[RegExp, PlaceCategory]> = [
  [/\b(coffee|cafes?|caf[eé]s?|espresso|lattes?|cappuccino|cortado|caffeine)\b/, 'coffee'],
  [/\b(pizza|pizzas|slice|slices|pizzerias?)\b/, 'pizza'],
  [/\b(ice ?cream|desserts?|sweets?|gelato|chocolate|sundaes?|treats?)\b/, 'dessert'],
  [/\b(books?|bookstores?|bookshops?|reading)\b/, 'books'],
  [/\b(shops?|shopping|stores?|boutiques?|toys?|clothes|souvenirs?)\b/, 'shopping'],
  [/\b(museums?|art|galler(?:y|ies)|exhibits?)\b/, 'museum'],
  [/\b(parks?|green space|outdoors?|picnic|lawn|gardens?|nature)\b/, 'park'],
  [/\b(markets?|food halls?|groceries|farmers)\b/, 'market'],
  [/\b(landmarks?|sights?|sightseeing|views?|photos?|iconic|tourist|attractions?|skyline)\b/, 'landmark'],
  [/\b(food|eat|eats|dinner|lunch|brunch|restaurants?|hungry|steak|italian|bite|dining)\b/, 'food'],
];

const CLEAR_RE = /\b(clear|reset|start over|remove (?:the )?(?:pins|route)|clean up)\b/;
const ROUTE_RE = /\b(how far|how long|directions?|route|walk(?:ing)? to|get to|take me|navigate|way to|distance|far is|from here)\b/;
const PLAN_RE = /\b(plan|itinerary|afternoon|morning|evening|night|day out|trip|tour|date|weekend|a few hours|things to do)\b/;
const SEARCH_RE = /\b(find|show|where|near|nearby|looking for|any|search|recommend|best|good|suggest|what'?s|options?|around)\b/;
const REFER_BACK_RE = /\b(there|it|that|those|them|the first|first one|closest|nearest|second|last one)\b/;

function normalize(text: string) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

function detectCategory(text: string): PlaceCategory | undefined {
  for (const [re, category] of CATEGORY_WORDS) if (re.test(text)) return category;
  return undefined;
}

function detectArea(text: string): string | undefined {
  let best: { key: string; length: number } | undefined;
  for (const [key, area] of Object.entries(AREAS)) {
    for (const kw of area.keywords) {
      if (text.includes(kw) && (!best || kw.length > best.length)) best = { key, length: kw.length };
    }
  }
  return best?.key;
}

const wordCounts = new Map<string, number>();
for (const place of PLACES) {
  for (const w of new Set(normalize(place.name).replace(/[^a-z0-9' ]/g, ' ').split(' ').filter(Boolean))) {
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  }
}

function aliasesFor(place: Place): string[] {
  const name = normalize(place.name).replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = name.split(' ').filter((w) => w.length >= 4 && wordCounts.get(w) === 1);
  return [name, name.replace(/'/g, ''), ...words];
}

function detectPlace(text: string): Place | undefined {
  const cleaned = text.replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ');
  let best: { place: Place; length: number } | undefined;
  for (const place of PLACES) {
    for (const alias of aliasesFor(place)) {
      if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(cleaned)) {
        if (!best || alias.length > best.length) best = { place, length: alias.length };
      }
    }
  }
  return best?.place;
}

function byDistance(from: LatLng) {
  return (a: Place, b: Place) => distanceMeters(from, a.position) - distanceMeters(from, b.position);
}

function buildTrip(name: string, stops: Place[], user: LatLng): Trip {
  const from = distanceMeters(user, stops[0].position) < 3000 ? user : undefined;
  const points = [...(from ? [from] : []), ...stops.map((s) => s.position)];
  let meters = 0;
  for (let i = 1; i < points.length; i++) meters += distanceMeters(points[i - 1], points[i]);
  return { id: `trip-${Date.now().toString(36)}`, name, from, stops, totalMeters: meters, totalMinutes: walkingMinutes(meters) };
}

/** Greedy nearest-neighbour ordering from the user (or the first stop). */
function orderStops(stops: Place[], user: LatLng): Place[] {
  const remaining = [...stops];
  const ordered: Place[] = [];
  let cursor: LatLng = distanceMeters(user, stops[0].position) < 3000 ? user : stops[0].position;
  while (remaining.length) {
    remaining.sort(byDistance(cursor));
    const next = remaining.shift() as Place;
    ordered.push(next);
    cursor = next.position;
  }
  return ordered;
}

function refChip(place: Place) {
  return `@${place.id}`;
}

function walkLine(from: LatLng, place: Place) {
  const meters = distanceMeters(from, place.position);
  return `${formatDistance(meters)} · ${formatMinutes(walkingMinutes(meters))} walk`;
}

export function planTurn(rawInput: string, memory: AgentMemory, userPosition: LatLng): AgentTurnPlan {
  const text = normalize(rawInput);
  const category = detectCategory(text);
  const areaKey = detectArea(text);
  const namedPlace = detectPlace(text);
  const area = areaKey ? AREAS[areaKey] : undefined;

  if (CLEAR_RE.test(text)) {
    return {
      steps: [{ name: 'clear_map', args: {}, run: (host) => { host.clear(); return 'Removed pins and route'; } }],
      reply: 'Cleared the map. Where to next? Try **coffee nearby**, **plan an afternoon in DUMBO**, or **how far is Barclays Center**.',
      working: 'Clearing the map…',
      memory: { lastResults: [] },
    };
  }

  // Directions to a named place, the nearest of a category, or something from the last answer.
  if (ROUTE_RE.test(text)) {
    let destination = namedPlace;
    if (!destination && category) {
      const pool = area ? PLACES.filter((p) => p.area === areaKey && p.category === category) : PLACES.filter((p) => p.category === category);
      destination = [...pool].sort(byDistance(userPosition))[0];
    }
    if (!destination && REFER_BACK_RE.test(text) && memory.lastResults.length) {
      const idx = /\bsecond\b/.test(text) ? 1 : /\blast one\b/.test(text) ? memory.lastResults.length - 1 : 0;
      destination = memory.lastResults[Math.min(idx, memory.lastResults.length - 1)];
    }
    if (destination) {
      const trip = buildTrip(`Walk to ${destination.name}`, [destination], userPosition);
      const meters = distanceMeters(userPosition, destination.position);
      const far = meters > 4000;
      return {
        steps: [
          {
            name: 'plan_route',
            args: { from: 'current location', to: destination.name, mode: 'walking' },
            run: (host) => {
              host.showPlaces([destination as Place], { focus: false, selectedId: destination?.id });
              host.showRoute(trip);
              return `${formatDistance(meters)} · ${formatMinutes(trip.totalMinutes)} on foot`;
            },
          },
        ],
        reply: far
          ? `${refChip(destination)} is **${formatDistance(meters)}** from you — about **${formatMinutes(trip.totalMinutes)}** on foot, so you'd probably want the subway for most of it. I drew the straight-line route so you can see the direction. ${destination.blurb}`
          : `${refChip(destination)} is **${formatDistance(meters)}** away — about **${formatMinutes(trip.totalMinutes)}** on foot from where you are. The route is on the map. ${destination.blurb} #directions`,
        working: 'Planning your route…',
        memory: { ...memory, lastResults: [destination], lastTrip: trip },
      };
    }
  }

  // Multi-stop plans.
  if (PLAN_RE.test(text)) {
    const key = areaKey ?? memory.lastArea ?? 'fort-greene';
    const target = AREAS[key];
    const evening = /\b(evening|night|date|dinner)\b/.test(text);
    const morning = /\b(morning|breakfast|brunch)\b/.test(text);
    const order: PlaceCategory[] = evening
      ? ['food', 'dessert', 'landmark', 'park', 'coffee']
      : morning
        ? ['coffee', 'park', 'market', 'books', 'landmark']
        : ['coffee', 'landmark', 'park', 'museum', 'books', 'dessert', 'food'];
    if (category) order.unshift(category);
    const inArea = PLACES.filter((p) => p.area === key);
    const picks: Place[] = [];
    for (const cat of order) {
      const match = inArea.find((p) => p.category === cat && !picks.includes(p));
      if (match) picks.push(match);
      if (picks.length === 4) break;
    }
    for (const p of inArea) if (picks.length < 4 && !picks.includes(p)) picks.push(p);
    const stops = orderStops(picks, userPosition);
    const label = evening ? 'An evening' : morning ? 'A morning' : 'An afternoon';
    const trip = buildTrip(`${label} in ${target.label}`, stops, userPosition);
    const list = stops.map((s, i) => `${i + 1}. ${refChip(s)} — ${s.blurb}`).join('\n');
    return {
      steps: [
        {
          name: 'search_places',
          args: { near: target.label, categories: order.slice(0, 4), limit: 4 },
          run: (host) => { host.showPlaces(stops, { focus: true }); return `${stops.length} stops in ${target.label}`; },
        },
        {
          name: 'plan_route',
          args: { stops: stops.map((s) => s.name), mode: 'walking', optimize: true },
          run: (host) => { host.showRoute(trip); return `${formatDistance(trip.totalMeters)} · ${formatMinutes(trip.totalMinutes)} total walking`; },
        },
        {
          name: 'save_trip',
          args: { name: trip.name },
          run: (host) => { host.saveTrip(trip); return `Saved “${trip.name}”`; },
        },
      ],
      reply: `Here's **${trip.name.toLowerCase()}** — ${formatMinutes(trip.totalMinutes)} of walking${trip.from ? ' starting from where you are' : ''}:\n\n${list}\n\nI saved it as **${trip.name}** and drew the route. Want me to swap a stop or add ${category ? 'something else' : 'a dessert'}? #itinerary`,
      working: 'Planning your trip…',
      memory: { lastResults: stops, lastArea: key, lastTrip: trip },
    };
  }

  // Category search, optionally scoped to an area.
  if (category && (SEARCH_RE.test(text) || area || text.split(' ').length <= 3)) {
    const pool = PLACES.filter((p) => p.category === category);
    let results: Place[];
    let where: string;
    if (area) {
      results = pool.filter((p) => p.area === areaKey).sort(byDistance(area.center));
      where = area.label;
      if (!results.length) results = [...pool].sort(byDistance(area.center)).slice(0, 3);
    } else {
      const near = pool.filter((p) => distanceMeters(userPosition, p.position) < 2600).sort(byDistance(userPosition));
      results = near.length >= 2 ? near : [...pool].sort(byDistance(userPosition)).slice(0, 4);
      where = near.length >= 2 ? 'near you' : 'within a short ride';
    }
    results = results.slice(0, 5);
    const meta = CATEGORY_META[category];
    const closest = [...results].sort(byDistance(userPosition))[0];
    const others = results.filter((p) => p !== closest).slice(0, 3);
    return {
      steps: [
        {
          name: 'search_places',
          args: { query: meta.label, near: area ? area.label : 'current location', limit: 5 },
          run: () => `${results.length} ${results.length === 1 ? 'result' : 'results'}`,
        },
        {
          name: 'show_on_map',
          args: { ids: results.map((p) => p.id) },
          run: (host) => { host.showPlaces(results, { focus: true }); return `Pinned ${results.length}`; },
        },
      ],
      reply: results.length
        ? `Found **${results.length} ${results.length === 1 ? meta.label : meta.plural}** ${where}. Closest is ${refChip(closest)} (${walkLine(userPosition, closest)}) — ${closest.blurb}${others.length ? `\n\nAlso worth a look: ${others.map(refChip).join(', ')}.` : ''}\n\nTap a pin or ask me for directions to any of them. #${category}`
        : `I couldn't find any ${meta.plural} ${where}. Try another neighborhood — DUMBO, Williamsburg, or Midtown.`,
      working: 'Searching nearby…',
      memory: { lastResults: results, lastArea: areaKey ?? memory.lastArea, lastTrip: memory.lastTrip },
    };
  }

  // A specific place.
  if (namedPlace) {
    return {
      steps: [
        {
          name: 'show_on_map',
          args: { ids: [namedPlace.id] },
          run: (host) => { host.showPlaces([namedPlace], { focus: true, selectedId: namedPlace.id }); return `Pinned ${namedPlace.name}`; },
        },
      ],
      reply: `${refChip(namedPlace)} is in **${AREAS[namedPlace.area].label}**, ${walkLine(userPosition, namedPlace)}. ${namedPlace.blurb}\n\nWant directions, or should I plan a few hours around it? #${namedPlace.category}`,
      working: 'Looking that up…',
      memory: { lastResults: [namedPlace], lastArea: namedPlace.area, lastTrip: memory.lastTrip },
    };
  }

  // An area on its own.
  if (area) {
    const results = PLACES.filter((p) => p.area === areaKey).sort(byDistance(area.center)).slice(0, 6);
    const highlights = results.slice(0, 3).map(refChip).join(', ');
    return {
      steps: [
        { name: 'search_places', args: { near: area.label, limit: 6 }, run: () => `${results.length} results` },
        { name: 'show_on_map', args: { ids: results.map((p) => p.id) }, run: (host) => { host.showPlaces(results, { focus: true }); return `Pinned ${results.length}`; } },
      ],
      reply: `Here's what I know in **${area.label}** — ${results.length} spots on the map. Highlights: ${highlights}.\n\nSay **plan an afternoon in ${area.label}** and I'll string them into a walk. #${areaKey}`,
      working: 'Searching…',
      memory: { lastResults: results, lastArea: areaKey, lastTrip: memory.lastTrip },
    };
  }

  return {
    steps: [],
    reply: `I can search the map and plan walks around Brooklyn and Manhattan. Try one of these:\n\n- **coffee near me**\n- **plan an afternoon in DUMBO**\n- **how far is Barclays Center?**\n- **best pizza in Williamsburg**\n\nOr tap a #coffee or #pizza tag to search that category.`,
    working: 'Thinking…',
    memory,
  };
}

export const SUGGESTIONS = [
  'Coffee near me',
  'Plan an afternoon in DUMBO',
  'How far is Barclays Center?',
  'Best pizza in Williamsburg',
  'Shopping in Midtown',
];
