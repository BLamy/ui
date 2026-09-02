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

/** Where the demo pretends the user is standing: DeKalb & Cumberland, Fort Greene. */
export const USER_POSITION: LatLng = { lat: 40.6879, lng: -73.9727 };

export const AREAS: Record<string, { label: string; center: LatLng; keywords: string[] }> = {
  'fort-greene': { label: 'Fort Greene', center: { lat: 40.6882, lng: -73.9742 }, keywords: ['fort greene', 'near me', 'nearby', 'around here', 'close by', 'here', 'clinton hill'] },
  'prospect-heights': { label: 'Prospect Heights', center: { lat: 40.6765, lng: -73.9685 }, keywords: ['prospect heights', 'prospect park', 'park slope', 'vanderbilt'] },
  'downtown-brooklyn': { label: 'Downtown Brooklyn', center: { lat: 40.6895, lng: -73.9845 }, keywords: ['downtown brooklyn', 'downtown', 'boerum hill'] },
  dumbo: { label: 'DUMBO', center: { lat: 40.7033, lng: -73.9918 }, keywords: ['dumbo', 'brooklyn bridge', 'waterfront', 'brooklyn heights'] },
  'cobble-hill': { label: 'Cobble Hill', center: { lat: 40.6845, lng: -73.9955 }, keywords: ['cobble hill', 'carroll gardens', 'smith street'] },
  williamsburg: { label: 'Williamsburg', center: { lat: 40.7150, lng: -73.9620 }, keywords: ['williamsburg', 'domino', 'bedford'] },
  midtown: { label: 'Midtown Manhattan', center: { lat: 40.7545, lng: -73.9830 }, keywords: ['midtown', 'manhattan', 'times square', 'the city', 'city'] },
  chelsea: { label: 'Chelsea', center: { lat: 40.7440, lng: -74.0050 }, keywords: ['chelsea', 'high line', 'meatpacking', 'west village'] },
};

export const PLACES: Place[] = [
  // Fort Greene
  { id: 'fort-greene-park', name: 'Fort Greene Park', category: 'park', area: 'fort-greene', position: { lat: 40.6913, lng: -73.9749 }, blurb: '30 hilltop acres designed by Olmsted & Vaux, with skyline views from the monument steps.', tags: ['views', 'outdoors'] },
  { id: 'greenlight-bookstore', name: 'Greenlight Bookstore', category: 'books', area: 'fort-greene', position: { lat: 40.6866, lng: -73.9744 }, blurb: 'Beloved indie on Fulton with a sharp staff-picks table and frequent author nights.', tags: ['indie', 'events'] },
  { id: 'hungry-ghost', name: 'Hungry Ghost Coffee', category: 'coffee', area: 'fort-greene', position: { lat: 40.6862, lng: -73.9714 }, blurb: 'Stumptown pours and a sunny corner room — the neighborhood laptop cafe.', tags: ['wifi', 'espresso'] },
  { id: 'romans', name: "Roman's", category: 'food', area: 'fort-greene', position: { lat: 40.6893, lng: -73.9694 }, blurb: 'Seasonal Italian from the Diner crew; the menu changes nightly and the negronis are dangerous.', tags: ['italian', 'dinner'] },
  { id: 'walters', name: "Walter's", category: 'food', area: 'fort-greene', position: { lat: 40.6899, lng: -73.9725 }, blurb: 'Corner bistro across from the park — brunch eggs, steak frites, sidewalk seats.', tags: ['brunch', 'bistro'] },
  { id: 'olea', name: 'Olea', category: 'food', area: 'fort-greene', position: { lat: 40.6885, lng: -73.9703 }, blurb: 'Mediterranean mezze in a candlelit room on Lafayette. Great for groups.', tags: ['mediterranean', 'dinner'] },
  { id: 'bam', name: 'BAM Howard Gilman Opera House', category: 'landmark', area: 'fort-greene', position: { lat: 40.6863, lng: -73.9776 }, blurb: 'Brooklyn Academy of Music’s 1908 opera house — dance, film, and the Next Wave Festival.', tags: ['theater', 'culture'] },
  { id: 'barclays-center', name: 'Barclays Center', category: 'landmark', area: 'fort-greene', position: { lat: 40.6826, lng: -73.9754 }, blurb: 'Home of the Nets and Liberty. The weathered-steel oculus is the Atlantic Ave landmark.', tags: ['arena', 'sports'] },
  { id: 'fort-greene-greenmarket', name: 'Fort Greene Greenmarket', category: 'market', area: 'fort-greene', position: { lat: 40.6902, lng: -73.9737 }, blurb: 'Saturday farmers market along the park’s southeast edge — apples, cider, and bread.', tags: ['saturday', 'produce'] },
  { id: 'dekalb-market-hall', name: 'DeKalb Market Hall', category: 'market', area: 'downtown-brooklyn', position: { lat: 40.6907, lng: -73.9820 }, blurb: 'Forty-vendor food hall under City Point, including the Katz’s outpost.', tags: ['food hall', 'lunch'] },

  // Prospect Heights
  { id: 'brooklyn-museum', name: 'Brooklyn Museum', category: 'museum', area: 'prospect-heights', position: { lat: 40.6712, lng: -73.9636 }, blurb: 'Egyptian galleries, Judy Chicago’s Dinner Party, and First Saturdays.', tags: ['art', 'free saturday'] },
  { id: 'brooklyn-botanic-garden', name: 'Brooklyn Botanic Garden', category: 'park', area: 'prospect-heights', position: { lat: 40.6676, lng: -73.9630 }, blurb: '52 acres of gardens — the cherry esplanade peaks in late April.', tags: ['gardens', 'outdoors'] },
  { id: 'grand-army-plaza', name: 'Grand Army Plaza', category: 'landmark', area: 'prospect-heights', position: { lat: 40.6739, lng: -73.9701 }, blurb: 'The Soldiers’ and Sailors’ Arch at the head of Prospect Park; Saturday greenmarket.', tags: ['arch', 'plaza'] },
  { id: 'prospect-park', name: 'Prospect Park Long Meadow', category: 'park', area: 'prospect-heights', position: { lat: 40.6688, lng: -73.9720 }, blurb: 'A mile-long meadow that feels like the countryside. Best picnic lawn in the borough.', tags: ['picnic', 'outdoors'] },
  { id: 'olmsted', name: 'Olmsted', category: 'food', area: 'prospect-heights', position: { lat: 40.6779, lng: -73.9684 }, blurb: 'Garden-to-table tasting plates with a backyard where the herbs grow.', tags: ['dinner', 'garden'] },
  { id: 'ample-hills', name: 'Ample Hills Creamery', category: 'dessert', area: 'prospect-heights', position: { lat: 40.6788, lng: -73.9686 }, blurb: 'The original Vanderbilt Ave scoop shop — get the Ooey Gooey Butter Cake.', tags: ['ice cream'] },
  { id: 'sit-and-wonder', name: 'Sit & Wonder', category: 'coffee', area: 'prospect-heights', position: { lat: 40.6773, lng: -73.9678 }, blurb: 'Tiny Washington Ave cafe with a big backyard and a solid cortado.', tags: ['backyard'] },

  // Downtown / Boerum Hill
  { id: 'devocion-downtown', name: 'Devoción', category: 'coffee', area: 'downtown-brooklyn', position: { lat: 40.6890, lng: -73.9838 }, blurb: 'Farm-direct Colombian beans roasted in Brooklyn; skylit room full of plants.', tags: ['roaster', 'wifi'] },
  { id: 'blue-bottle-boerum-hill', name: 'Blue Bottle Coffee', category: 'coffee', area: 'downtown-brooklyn', position: { lat: 40.6884, lng: -73.9868 }, blurb: 'Dean Street outpost — New Orleans iced coffee and a quiet back room.', tags: ['iced coffee'] },

  // Cobble Hill / Carroll Gardens
  { id: 'lucali', name: 'Lucali', category: 'pizza', area: 'cobble-hill', position: { lat: 40.6807, lng: -73.9990 }, blurb: 'Candlelit thin-crust legend on Henry Street. Cash only, BYOB, plan to wait.', tags: ['byob', 'cash only'] },
  { id: 'books-are-magic', name: 'Books Are Magic', category: 'books', area: 'cobble-hill', position: { lat: 40.6851, lng: -73.9926 }, blurb: 'Emma Straub’s Smith Street shop with the pink mural and a stellar kids’ nook.', tags: ['indie', 'kids'] },
  { id: 'brooklyn-farmacy', name: 'Brooklyn Farmacy & Soda Fountain', category: 'dessert', area: 'cobble-hill', position: { lat: 40.6836, lng: -73.9977 }, blurb: 'Restored 1920s apothecary serving egg creams and sundaes.', tags: ['sundaes', 'retro'] },

  // DUMBO / Brooklyn Heights
  { id: 'brooklyn-bridge-park', name: 'Brooklyn Bridge Park Pier 1', category: 'park', area: 'dumbo', position: { lat: 40.7013, lng: -73.9963 }, blurb: 'Lawns and granite steps straight onto the harbor — the classic Manhattan skyline shot.', tags: ['views', 'waterfront'] },
  { id: 'time-out-market', name: 'Time Out Market', category: 'food', area: 'dumbo', position: { lat: 40.7033, lng: -73.9908 }, blurb: 'Rooftop food hall in Empire Stores; grab a tray and head upstairs for the bridge view.', tags: ['food hall', 'rooftop'] },
  { id: 'julianas', name: "Juliana's Pizza", category: 'pizza', area: 'dumbo', position: { lat: 40.7027, lng: -73.9934 }, blurb: 'Patsy Grimaldi’s coal-oven return, under the bridge. Shorter line than next door.', tags: ['coal oven'] },
  { id: 'brooklyn-bridge', name: 'Brooklyn Bridge', category: 'landmark', area: 'dumbo', position: { lat: 40.7040, lng: -73.9945 }, blurb: 'Walk the 1883 span at golden hour — start from the Brooklyn side to face the skyline.', tags: ['walk', 'views'] },
  { id: 'janes-carousel', name: "Jane's Carousel", category: 'landmark', area: 'dumbo', position: { lat: 40.7043, lng: -73.9920 }, blurb: 'Restored 1922 carousel in a glass Jean Nouvel pavilion at the water’s edge.', tags: ['kids', 'waterfront'] },
  { id: 'powerhouse-arena', name: 'POWERHOUSE Arena', category: 'books', area: 'dumbo', position: { lat: 40.7031, lng: -73.9898 }, blurb: 'Art-book publisher’s cavernous shop and event space on Adams Street.', tags: ['art books'] },
  { id: 'brooklyn-roasting', name: 'Brooklyn Roasting Company', category: 'coffee', area: 'dumbo', position: { lat: 40.7040, lng: -73.9865 }, blurb: 'Warehouse roastery on Jay Street with long communal tables.', tags: ['roaster'] },
  { id: 'jacques-torres', name: 'Jacques Torres Chocolate', category: 'dessert', area: 'dumbo', position: { lat: 40.7032, lng: -73.9916 }, blurb: 'Wicked hot chocolate and fresh-dipped bonbons from the original Water Street shop.', tags: ['chocolate'] },
  { id: 'empire-stores', name: 'Empire Stores', category: 'shopping', area: 'dumbo', position: { lat: 40.7035, lng: -73.9905 }, blurb: 'Civil War-era coffee warehouses turned into shops, a rooftop, and the Brooklyn Historical Society annex.', tags: ['boutiques', 'rooftop'] },

  // Williamsburg
  { id: 'devocion-williamsburg', name: 'Devoción Williamsburg', category: 'coffee', area: 'williamsburg', position: { lat: 40.7160, lng: -73.9640 }, blurb: 'The flagship: a skylight, a living wall, and the freshest beans in the city.', tags: ['roaster', 'flagship'] },
  { id: 'lindustrie', name: "L'industrie Pizzeria", category: 'pizza', area: 'williamsburg', position: { lat: 40.7124, lng: -73.9584 }, blurb: 'Burrata slice with a swirl of basil oil. Worth the line every time.', tags: ['slice'] },
  { id: 'domino-park', name: 'Domino Park', category: 'park', area: 'williamsburg', position: { lat: 40.7140, lng: -73.9679 }, blurb: 'Six waterfront acres on the old sugar refinery site, with salvaged cranes and a taco stand.', tags: ['waterfront', 'views'] },
  { id: 'peter-luger', name: 'Peter Luger Steak House', category: 'food', area: 'williamsburg', position: { lat: 40.7098, lng: -73.9626 }, blurb: 'The 1887 porterhouse institution. Cash or debit, gruff waiters, thick bacon.', tags: ['steak', 'classic'] },
  { id: 'artists-and-fleas', name: 'Artists & Fleas', category: 'shopping', area: 'williamsburg', position: { lat: 40.7192, lng: -73.9590 }, blurb: 'Weekend maker market on N 7th — vintage, jewelry, prints.', tags: ['market', 'weekend'] },
  { id: 'spoonbill', name: 'Spoonbill & Sugartown', category: 'books', area: 'williamsburg', position: { lat: 40.7166, lng: -73.9589 }, blurb: 'Bedford Ave books with a deep art, design, and used section.', tags: ['art books', 'used'] },
  { id: 'oddfellows', name: 'OddFellows Ice Cream', category: 'dessert', area: 'williamsburg', position: { lat: 40.7205, lng: -73.9625 }, blurb: 'Rotating oddball flavors — miso cherry, cornbread — on Kent Ave.', tags: ['ice cream'] },

  // Midtown Manhattan
  { id: 'empire-state-building', name: 'Empire State Building', category: 'landmark', area: 'midtown', position: { lat: 40.7484, lng: -73.9857 }, blurb: '86th-floor open-air deck; book the first slot of the morning to skip the crush.', tags: ['views', 'iconic'] },
  { id: 'grand-central', name: 'Grand Central Terminal', category: 'landmark', area: 'midtown', position: { lat: 40.7527, lng: -73.9772 }, blurb: 'Look up at the constellation ceiling, then find the whispering gallery by the Oyster Bar.', tags: ['architecture'] },
  { id: 'bryant-park', name: 'Bryant Park', category: 'park', area: 'midtown', position: { lat: 40.7536, lng: -73.9832 }, blurb: 'Midtown’s lawn behind the library — free chairs, a carousel, and winter skating.', tags: ['lawn', 'skating'] },
  { id: 'nypl', name: 'New York Public Library', category: 'landmark', area: 'midtown', position: { lat: 40.7532, lng: -73.9822 }, blurb: 'Patience and Fortitude guard the Rose Main Reading Room — free to visit.', tags: ['architecture', 'free'] },
  { id: 'times-square', name: 'Times Square', category: 'landmark', area: 'midtown', position: { lat: 40.7580, lng: -73.9855 }, blurb: 'The screens, the crowds, the red TKTS steps. Go once, at night.', tags: ['iconic'] },
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
