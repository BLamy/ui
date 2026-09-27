import type { LatLng } from './geo';
import type { MapIconName } from './map-icons';

export type PlaceCategory =
  | 'coffee'
  | 'food'
  | 'pizza'
  | 'park'
  | 'museum'
  | 'books'
  | 'shopping'
  | 'dessert'
  | 'landmark'
  | 'market';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  area: string;
  position: LatLng;
  blurb: string;
  tags?: string[];
}

export const CATEGORY_META: Record<PlaceCategory, { label: string; plural: string; color: string; icon: MapIconName }> = {
  coffee: { label: 'coffee', plural: 'coffee spots', color: '#c97b3a', icon: 'coffee' },
  food: { label: 'restaurant', plural: 'restaurants', color: '#ef6c4c', icon: 'food' },
  pizza: { label: 'pizza', plural: 'pizza places', color: '#f0a23a', icon: 'pizza' },
  park: { label: 'park', plural: 'parks', color: '#3fae5c', icon: 'park' },
  museum: { label: 'museum', plural: 'museums', color: '#b26ad0', icon: 'museum' },
  books: { label: 'bookstore', plural: 'bookstores', color: '#4c7fe0', icon: 'books' },
  shopping: { label: 'shop', plural: 'shops', color: '#e26aa5', icon: 'shopping' },
  dessert: { label: 'dessert', plural: 'dessert spots', color: '#f26d9b', icon: 'dessert' },
  landmark: { label: 'landmark', plural: 'landmarks', color: '#7b8aa3', icon: 'landmark' },
  market: { label: 'market', plural: 'markets', color: '#3ab8a2', icon: 'market' },
};

/** Where the demo pretends the user is standing: Washington Square Park, Greenwich Village. A public landmark,
    not anyone's real location — swap in the Geolocation API if a product needs the real one. */
export const USER_POSITION: LatLng = { lat: 40.7309, lng: -73.9973 };

export const AREAS: Record<string, { label: string; center: LatLng; keywords: string[] }> = {
  'greenwich-village': { label: 'Greenwich Village', center: { lat: 40.7320, lng: -74.0005 }, keywords: ['greenwich village', 'the village', 'village', 'near me', 'nearby', 'around here', 'close by', 'here', 'washington square'] },
  soho: { label: 'SoHo', center: { lat: 40.7235, lng: -73.9990 }, keywords: ['soho', 'nolita', 'prince street', 'spring street'] },
  'lower-east-side': { label: 'Lower East Side', center: { lat: 40.7205, lng: -73.9890 }, keywords: ['lower east side', 'les', 'orchard street', 'delancey'] },
  'lower-manhattan': { label: 'Lower Manhattan', center: { lat: 40.7075, lng: -74.0090 }, keywords: ['lower manhattan', 'financial district', 'fidi', 'battery', 'downtown'] },
  midtown: { label: 'Midtown Manhattan', center: { lat: 40.7545, lng: -73.9830 }, keywords: ['midtown', 'manhattan', 'times square', 'the city', 'city'] },
  chelsea: { label: 'Chelsea', center: { lat: 40.7440, lng: -74.0050 }, keywords: ['chelsea', 'high line', 'meatpacking', 'west village'] },
};

export const PLACES: Place[] = [
  // Greenwich Village
  { id: 'washington-square-park', name: 'Washington Square Park', category: 'park', area: 'greenwich-village', position: { lat: 40.7308, lng: -73.9973 }, blurb: 'The arch, the fountain, chess tables, and a piano player most afternoons.', tags: ['people watching', 'iconic'] },
  { id: 'joes-pizza-carmine', name: "Joe's Pizza", category: 'pizza', area: 'greenwich-village', position: { lat: 40.7305, lng: -74.0021 }, blurb: 'The Carmine Street original since 1975 — a plain slice, folded, standing up.', tags: ['slice', 'classic'] },
  { id: 'stumptown-village', name: 'Stumptown Coffee', category: 'coffee', area: 'greenwich-village', position: { lat: 40.7334, lng: -73.9985 }, blurb: 'Ace-era espresso bar on West 8th with a long bench and a fast line.', tags: ['espresso'] },
  { id: 'via-carota', name: 'Via Carota', category: 'food', area: 'greenwich-village', position: { lat: 40.7334, lng: -74.0035 }, blurb: 'Rustic Italian on Grove Street — the cacio e pepe and the green salad are the point.', tags: ['italian', 'walk-in'] },
  { id: 'three-lives', name: 'Three Lives & Company', category: 'books', area: 'greenwich-village', position: { lat: 40.7353, lng: -74.0015 }, blurb: 'Tiny corner bookshop with staff picks that never miss.', tags: ['indie'] },
  { id: 'blue-note', name: 'Blue Note Jazz Club', category: 'landmark', area: 'greenwich-village', position: { lat: 40.7308, lng: -74.0006 }, blurb: 'West 3rd Street jazz room since 1981; late sets are the locals’ move.', tags: ['music', 'night'] },
  { id: 'murrays-cheese', name: "Murray's Cheese", category: 'market', area: 'greenwich-village', position: { lat: 40.7308, lng: -74.0031 }, blurb: 'Bleecker Street cheese counter with caves downstairs and samples up front.', tags: ['cheese', 'deli'] },
  { id: 'magnolia-bakery', name: 'Magnolia Bakery', category: 'dessert', area: 'greenwich-village', position: { lat: 40.7359, lng: -74.0050 }, blurb: 'The Bleecker Street banana pudding. Grab a spoon and walk to Hudson River Park.', tags: ['bakery'] },
  { id: 'joe-coffee-waverly', name: 'Joe Coffee', category: 'coffee', area: 'greenwich-village', position: { lat: 40.7334, lng: -74.0003 }, blurb: 'Waverly Place corner shop — a cortado and a window seat.', tags: ['espresso'] },
  { id: 'third-rail-coffee', name: 'Third Rail Coffee', category: 'coffee', area: 'greenwich-village', position: { lat: 40.7300, lng: -73.9994 }, blurb: 'Sullivan Street espresso bar, two blocks from the park.', tags: ['espresso'] },
  { id: 'bleecker-street-pizza', name: 'Bleecker Street Pizza', category: 'pizza', area: 'greenwich-village', position: { lat: 40.7318, lng: -74.0035 }, blurb: 'The Nonna Maria slice on the corner of Seventh Avenue South.', tags: ['slice'] },

  // SoHo
  { id: 'balthazar', name: 'Balthazar', category: 'food', area: 'soho', position: { lat: 40.7226, lng: -73.9981 }, blurb: 'Spring Street brasserie — steak frites, a seafood tower, and the bread basket.', tags: ['french', 'brunch'] },
  { id: 'prince-street-pizza', name: 'Prince Street Pizza', category: 'pizza', area: 'soho', position: { lat: 40.7231, lng: -73.9945 }, blurb: 'Square pepperoni slices with crispy cups. The line moves.', tags: ['square slice'] },
  { id: 'mcnally-jackson', name: 'McNally Jackson', category: 'books', area: 'soho', position: { lat: 40.7234, lng: -73.9958 }, blurb: 'Two floors of fiction, design, and a café on Prince Street.', tags: ['indie', 'café'] },
  { id: 'dominique-ansel', name: 'Dominique Ansel Bakery', category: 'dessert', area: 'soho', position: { lat: 40.7252, lng: -74.0029 }, blurb: 'Home of the Cronut; the DKA is the better call.', tags: ['bakery', 'pastry'] },
  { id: 'la-colombe-soho', name: 'La Colombe', category: 'coffee', area: 'soho', position: { lat: 40.7240, lng: -73.9967 }, blurb: 'Draft lattes on Lafayette, poured from the tap.', tags: ['draft latte'] },
  { id: 'drawing-center', name: 'The Drawing Center', category: 'museum', area: 'soho', position: { lat: 40.7227, lng: -74.0033 }, blurb: 'Free-ish Wooster Street galleries devoted entirely to drawing.', tags: ['art'] },
  { id: 'soho-cast-iron', name: 'Cast-Iron Historic District', category: 'landmark', area: 'soho', position: { lat: 40.7224, lng: -74.0010 }, blurb: 'Greene Street’s cast-iron facades — look up between the shops.', tags: ['architecture', 'walk'] },
  { id: 'apple-soho', name: 'Apple SoHo', category: 'shopping', area: 'soho', position: { lat: 40.7250, lng: -73.9986 }, blurb: 'The old post office on Prince, with the glass staircase.', tags: ['tech'] },

  // Lower East Side
  { id: 'katzs', name: "Katz's Delicatessen", category: 'food', area: 'lower-east-side', position: { lat: 40.7223, lng: -73.9874 }, blurb: 'Hand-cut pastrami on rye since 1888. Hold on to your ticket.', tags: ['deli', 'classic'] },
  { id: 'russ-and-daughters', name: 'Russ & Daughters', category: 'market', area: 'lower-east-side', position: { lat: 40.7226, lng: -73.9882 }, blurb: 'Fourth-generation appetizing shop — lox, sable, and a bialy.', tags: ['appetizing'] },
  { id: 'essex-market', name: 'Essex Market', category: 'market', area: 'lower-east-side', position: { lat: 40.7184, lng: -73.9878 }, blurb: 'The city’s 1940 market hall, now under glass on Delancey.', tags: ['food hall'] },
  { id: 'tenement-museum', name: 'Tenement Museum', category: 'museum', area: 'lower-east-side', position: { lat: 40.7188, lng: -73.9900 }, blurb: 'Guided tours through restored apartments on Orchard Street.', tags: ['history', 'tours'] },
  { id: 'economy-candy', name: 'Economy Candy', category: 'dessert', area: 'lower-east-side', position: { lat: 40.7199, lng: -73.9893 }, blurb: 'Floor-to-ceiling candy on Rivington since 1937.', tags: ['candy'] },
  { id: 'sara-roosevelt-park', name: 'Sara D. Roosevelt Park', category: 'park', area: 'lower-east-side', position: { lat: 40.7208, lng: -73.9923 }, blurb: 'A long green strip with a community garden and courts.', tags: ['outdoors'] },
  { id: 'ludlow-coffee', name: 'Ludlow Coffee Supply', category: 'coffee', area: 'lower-east-side', position: { lat: 40.7210, lng: -73.9878 }, blurb: 'Neighborhood espresso bar with a barber in the back.', tags: ['espresso'] },

  // Lower Manhattan
  { id: 'brooklyn-bridge-manhattan', name: 'Brooklyn Bridge Walkway', category: 'landmark', area: 'lower-manhattan', position: { lat: 40.7061, lng: -73.9969 }, blurb: 'Start the 1883 span from City Hall — best at golden hour.', tags: ['walk', 'views'] },
  { id: '911-memorial', name: '9/11 Memorial & Museum', category: 'museum', area: 'lower-manhattan', position: { lat: 40.7115, lng: -74.0134 }, blurb: 'The reflecting pools in the footprints of the towers.', tags: ['memorial'] },
  { id: 'the-battery', name: 'The Battery', category: 'park', area: 'lower-manhattan', position: { lat: 40.7033, lng: -74.0170 }, blurb: 'Harbor gardens at the tip of the island, with ferries to the statue.', tags: ['waterfront', 'views'] },
  { id: 'stone-street', name: 'Stone Street', category: 'food', area: 'lower-manhattan', position: { lat: 40.7043, lng: -74.0103 }, blurb: 'Cobbled lane of taverns with picnic tables all summer.', tags: ['outdoor dining'] },

  // Midtown Manhattan
  { id: 'empire-state-building', name: 'Empire State Building', category: 'landmark', area: 'midtown', position: { lat: 40.7484, lng: -73.9857 }, blurb: '86th-floor open-air deck; book the first slot of the morning to skip the crush.', tags: ['views', 'iconic'] },
  { id: 'grand-central', name: 'Grand Central Terminal', category: 'landmark', area: 'midtown', position: { lat: 40.7527, lng: -73.9772 }, blurb: 'Look up at the constellation ceiling, then find the whispering gallery by the Oyster Bar.', tags: ['architecture'] },
  { id: 'bryant-park', name: 'Bryant Park', category: 'park', area: 'midtown', position: { lat: 40.7536, lng: -73.9832 }, blurb: 'Midtown’s lawn behind the library — free chairs, a carousel, and winter skating.', tags: ['lawn', 'skating'] },
  { id: 'nypl', name: 'New York Public Library', category: 'landmark', area: 'midtown', position: { lat: 40.7532, lng: -73.9822 }, blurb: 'Patience and Fortitude guard the Rose Main Reading Room — free to visit.', tags: ['architecture', 'free'] },
  { id: 'times-square', name: 'Times Square', category: 'landmark', area: 'midtown', position: { lat: 40.7580, lng: -73.9855 }, blurb: 'The screens, the crowds, the red BLTS steps. Go once, at night.', tags: ['iconic'] },
  { id: 'rockefeller-center', name: 'Rockefeller Center', category: 'landmark', area: 'midtown', position: { lat: 40.7587, lng: -73.9787 }, blurb: 'Art Deco plaza with the rink, Prometheus, and Top of the Rock above.', tags: ['views', 'skating'] },
  { id: 'macys-herald-square', name: "Macy's Herald Square", category: 'shopping', area: 'midtown', position: { lat: 40.7508, lng: -73.9893 }, blurb: 'The 1902 flagship — ride the original wooden escalators to the upper floors.', tags: ['department store'] },
  { id: 'moma', name: 'MoMA', category: 'museum', area: 'midtown', position: { lat: 40.7614, lng: -73.9776 }, blurb: 'Starry Night, the Monet water lilies, and a sculpture garden worth the ticket alone.', tags: ['art', 'modern'] },
  { id: 'morgan-library', name: 'The Morgan Library & Museum', category: 'museum', area: 'midtown', position: { lat: 40.7492, lng: -73.9814 }, blurb: 'J.P. Morgan’s jewel-box library with three Gutenberg Bibles.', tags: ['rare books'] },
  { id: 'joes-pizza-broadway', name: "Joe's Pizza", category: 'pizza', area: 'midtown', position: { lat: 40.7546, lng: -73.9870 }, blurb: 'The Broadway outpost of the Village slice standard. Open late.', tags: ['slice', 'late night'] },
  { id: 'blue-bottle-bryant-park', name: 'Blue Bottle Bryant Park', category: 'coffee', area: 'midtown', position: { lat: 40.7527, lng: -73.9840 }, blurb: 'Fast, precise espresso on W 40th when you need a Midtown reset.', tags: ['espresso'] },
  { id: 'fao-schwarz', name: 'FAO Schwarz', category: 'shopping', area: 'midtown', position: { lat: 40.7592, lng: -73.9790 }, blurb: 'The toy store with the big piano, back at Rockefeller Plaza.', tags: ['toys', 'kids'] },

  // Chelsea / West Village
  { id: 'high-line', name: 'The High Line', category: 'park', area: 'chelsea', position: { lat: 40.7480, lng: -74.0048 }, blurb: 'Elevated rail-trail from Gansevoort to 34th — enter at 23rd for the best plantings.', tags: ['walk', 'outdoors'] },
  { id: 'chelsea-market', name: 'Chelsea Market', category: 'market', area: 'chelsea', position: { lat: 40.7424, lng: -74.0061 }, blurb: 'Block-long food hall in the old Nabisco factory — Los Tacos No. 1 is the move.', tags: ['food hall', 'lunch'] },
  { id: 'whitney-museum', name: 'Whitney Museum', category: 'museum', area: 'chelsea', position: { lat: 40.7396, lng: -74.0089 }, blurb: 'Renzo Piano’s Meatpacking home for American art, with terraces over the High Line.', tags: ['art', 'views'] },
  { id: 'strand-bookstore', name: 'Strand Book Store', category: 'books', area: 'chelsea', position: { lat: 40.7333, lng: -73.9910 }, blurb: '18 miles of books off Union Square; the rare book room upstairs is the quiet part.', tags: ['used', 'iconic'] },
];

export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));
