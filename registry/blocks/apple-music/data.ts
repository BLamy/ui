/* Sample library. Every artist, album, song, label and lyric here is invented; artwork is generated from
   each album's palette and pattern (see artwork.tsx) — no images. */

export type Pattern = 'sun' | 'rings' | 'stripes' | 'grid' | 'blobs' | 'triangles' | 'waves' | 'dots' | 'arch' | 'bars';

export interface Track { title: string; dur: number; explicit?: boolean }
export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  label: string;
  /** Background gradient (two stops), the accent the page tints with, and the pattern's ink. */
  colors: [string, string, string, string];
  pattern: Pattern;
  tracks: Track[];
  added: number;
}
export interface Playlist { id: string; title: string; curator: string; description: string; songs: [string, number][] }
export interface Station { id: string; title: string; subtitle: string; album: string }

const t = (title: string, dur: string, explicit?: boolean): Track => {
  const [m, s] = dur.split(':').map(Number);
  return { title, dur: m * 60 + s, explicit };
};

export const ALBUMS: Album[] = [
  {
    id: 'neon-tidewater', title: 'Neon Tidewater', artist: 'Harbor Lights', year: 2026, genre: 'Electronic', label: 'Tidewater Records',
    colors: ['#1B1F5E', '#E0457B', '#FF6F91', '#FFD3A5'], pattern: 'sun', added: 1,
    tracks: [
      t('Low Tide Signal', '3:42'), t('Neon Tidewater', '4:05'), t('Pier Lights', '3:18'), t('Saltwater Static', '3:57'),
      t('Undertow (feat. Juno Vale)', '4:21'), t('Harbor Glow', '3:33'), t('Riptide Radio', '3:49'), t('Breakwater', '5:02'),
      t('Last Ferry Home', '4:40'),
    ],
  },
  {
    id: 'paper-satellites', title: 'Paper Satellites', artist: 'Juno Vale', year: 2025, genre: 'Indie Pop', label: 'Kiteline',
    colors: ['#F6E7C1', '#F29E4C', '#E4572E', '#2B2D42'], pattern: 'dots', added: 2,
    tracks: [
      t('Paper Satellites', '3:21'), t('Tin Can Telephone', '2:58'), t('Orbit', '3:44'), t('Kitchen Light', '3:05'),
      t('Somewhere Warmer', '3:37'), t('Cartwheels', '2:49'), t('Folded Stars', '4:12'), t('Postcards to the Moon', '3:26'),
    ],
  },
  {
    id: 'low-orbit', title: 'Low Orbit Lullabies', artist: 'The Quiet Radials', year: 2024, genre: 'Ambient', label: 'Stillwater',
    colors: ['#0B132B', '#1C2541', '#5BC0BE', '#E0FBFC'], pattern: 'rings', added: 5,
    tracks: [
      t('Perigee', '6:12'), t('Soft Telemetry', '5:48'), t('Night Side', '7:03'), t('Drift Correction', '4:55'),
      t('Blue Marble', '6:30'), t('Apogee', '8:14'),
    ],
  },
  {
    id: 'copperline', title: 'Copperline', artist: 'Marisol Reyes', year: 2025, genre: 'Americana', label: 'Dry Creek',
    colors: ['#7F3B08', '#C8702A', '#F4C27A', '#2E1503'], pattern: 'stripes', added: 3,
    tracks: [
      t('Copperline', '3:55'), t('Red Dirt Letters', '4:02'), t('Mesa Wind', '3:29'), t('Borrowed Porch', '3:48'),
      t('Rattlesnake Moon', '4:17'), t('Mile Marker 9', '3:12'), t('Honey & Rust', '3:40'), t('Long Way Down to Tucson', '5:05'),
    ],
  },
  {
    id: 'velvet-static', title: 'Velvet Static', artist: 'Night Bureau', year: 2026, genre: 'Synthwave', label: 'Afterhours Dept.',
    colors: ['#12002E', '#6A00F4', '#F72585', '#4CC9F0'], pattern: 'grid', added: 0,
    tracks: [
      t('Velvet Static', '4:11', true), t('Cold Neon', '3:52'), t('Signal Loss', '4:26'), t('Rearview', '3:38'),
      t('Midnight Protocol', '4:48', true), t('Chrome Hearts', '3:59'), t('Afterglow Avenue', '4:33'), t('Dial Tone', '2:47'),
      t('Static Bloom', '5:16'),
    ],
  },
  {
    id: 'glasshouse', title: 'Glasshouse Sessions', artist: 'Tomás Ekwueme Trio', year: 2023, genre: 'Jazz', label: 'Blue Fern',
    colors: ['#0F3D3E', '#3F8E7E', '#E2DCC8', '#F1C40F'], pattern: 'blobs', added: 8,
    tracks: [
      t('Greenhouse Stomp', '5:44'), t('Fern & Brass', '6:21'), t('Condensation', '7:02'), t('Late Bloomer', '5:15'),
      t('Terrarium Waltz', '6:48'), t('Morning Glass', '4:59'),
    ],
  },
  {
    id: 'kites-kowloon', title: 'Kites Over Kowloon', artist: 'Mira Chen', year: 2025, genre: 'Electronic', label: 'Harbourfront',
    colors: ['#FFE66D', '#FF6B6B', '#4ECDC4', '#1A535C'], pattern: 'triangles', added: 4,
    tracks: [
      t('Kites Over Kowloon', '3:48'), t('Star Ferry', '4:03'), t('Typhoon Signal No. 3', '3:36'), t('Neon Market', '3:57'),
      t('Rooftop Garden', '4:20'), t('Night Tram', '3:44'), t('Mid-Levels', '4:31'),
    ],
  },
  {
    id: 'salt-ember', title: 'Salt & Ember', artist: 'The Wild Hours', year: 2024, genre: 'Alternative', label: 'Bonfire',
    colors: ['#2B2118', '#B33F40', '#F2A541', '#F4E9CD'], pattern: 'arch', added: 9,
    tracks: [
      t('Salt & Ember', '3:39'), t('Coastline Fever', '3:14', true), t('Driftwood Crown', '4:01'), t('Kerosene Heart', '3:47'),
      t('Undertow Choir', '4:25'), t('Ashes on the Shore', '3:58'), t('Firebreak', '3:22'), t('Wild Hours', '5:11'),
    ],
  },
  {
    id: 'midnight-arcade', title: 'Midnight Arcade', artist: 'Pixel Choir', year: 2026, genre: 'Pop', label: 'Insert Coin',
    colors: ['#08090A', '#00F5D4', '#F15BB5', '#FEE440'], pattern: 'bars', added: 0,
    tracks: [
      t('Insert Coin', '2:51'), t('High Score Heart', '3:18'), t('Level Select', '3:02'), t('Continue?', '3:34'),
      t('Boss Fight Ballad', '4:07'), t('8-Bit Sunrise', '3:11'), t('Game Over (Not Yet)', '3:45'),
    ],
  },
  {
    id: 'blue-hour', title: 'Blue Hour Drive', artist: 'Harbor Lights', year: 2023, genre: 'Electronic', label: 'Tidewater Records',
    colors: ['#03045E', '#0077B6', '#90E0EF', '#CAF0F8'], pattern: 'waves', added: 12,
    tracks: [
      t('Blue Hour Drive', '4:18'), t('Coast Road', '3:51'), t('Sodium Lamps', '4:06'), t('Overpass', '3:29'),
      t('Headlights on the Water', '4:44'), t('Exit 12', '3:37'), t('Dawn Patrol', '5:20'),
    ],
  },
  {
    id: 'soft-machinery', title: 'Soft Machinery', artist: 'Oona Park', year: 2026, genre: 'R&B/Soul', label: 'Velour',
    colors: ['#FAD2E1', '#C77DFF', '#7B2CBF', '#240046'], pattern: 'rings', added: 1,
    tracks: [
      t('Soft Machinery', '3:44'), t('Porcelain', '3:21'), t('Satellite Heart', '4:02', true), t('Slow Burn', '3:58'),
      t('Chamomile', '3:15'), t('Gravity Games', '3:49'), t('Pillow Talk Protocol', '4:10'), t('Afterparty Hymn', '4:36'),
    ],
  },
  {
    id: 'field-notes', title: 'Field Notes', artist: 'Aster & Birch', year: 2024, genre: 'Folk', label: 'Woodgrain',
    colors: ['#DDE5B6', '#A98467', '#6C584C', '#F0EAD2'], pattern: 'sun', added: 15,
    tracks: [
      t('Field Notes', '3:33'), t('Birch Bark Letters', '3:58'), t('Hollow Oak', '4:12'), t('Wren Song', '2:56'),
      t('Frost on the Fence', '3:41'), t('River Stones', '4:05'), t('Lantern Walk', '3:27'),
    ],
  },
];

export const PLAYLISTS: Playlist[] = [
  {
    id: 'late-night', title: 'Late Night Drive', curator: 'June Okafor', description: 'Neon, reverb, and empty highways.',
    songs: [['velvet-static', 0], ['blue-hour', 0], ['neon-tidewater', 1], ['midnight-arcade', 4], ['velvet-static', 3], ['blue-hour', 4], ['neon-tidewater', 7], ['kites-kowloon', 5]],
  },
  {
    id: 'focus', title: 'Deep Focus', curator: 'June Okafor', description: 'Long, quiet pieces for heads-down work.',
    songs: [['low-orbit', 0], ['low-orbit', 2], ['glasshouse', 2], ['low-orbit', 4], ['glasshouse', 5], ['field-notes', 6]],
  },
  {
    id: 'sunday', title: 'Sunday Morning', curator: 'June Okafor', description: 'Coffee, open windows, nowhere to be.',
    songs: [['field-notes', 0], ['paper-satellites', 3], ['glasshouse', 1], ['copperline', 6], ['soft-machinery', 4], ['field-notes', 3]],
  },
  {
    id: 'run', title: 'Run Club', curator: 'June Okafor', description: 'Fast enough to keep up with.',
    songs: [['midnight-arcade', 0], ['salt-ember', 1], ['kites-kowloon', 2], ['neon-tidewater', 6], ['salt-ember', 6], ['midnight-arcade', 1]],
  },
];

export const STATIONS: Station[] = [
  { id: 'tidewater', title: 'Tidewater Radio', subtitle: 'Live · Electronic after dark', album: 'neon-tidewater' },
  { id: 'porch', title: 'Front Porch', subtitle: 'Americana and new folk', album: 'copperline' },
  { id: 'arcade', title: 'Arcade FM', subtitle: 'Bright, loud, new pop', album: 'midnight-arcade' },
  { id: 'still', title: 'Stillwater Hours', subtitle: 'Ambient for slow evenings', album: 'low-orbit' },
  { id: 'velour', title: 'Velour Live', subtitle: 'R&B, soul and slow jams', album: 'soft-machinery' },
];

export const ALBUM = Object.fromEntries(ALBUMS.map((a) => [a.id, a])) as Record<string, Album>;
export const ARTISTS = [...new Set(ALBUMS.map((a) => a.artist))].sort();

export interface Song { album: Album; index: number; track: Track; key: string }
export const song = (albumId: string, index: number): Song => {
  const album = ALBUM[albumId];
  return { album, index, track: album.tracks[index], key: `${albumId}:${index}` };
};
export const albumSongs = (a: Album) => a.tracks.map((_, i) => song(a.id, i));
export const playlistSongs = (p: Playlist) => p.songs.map(([id, i]) => song(id, i));
export const ALL_SONGS = ALBUMS.flatMap(albumSongs).sort((a, b) => a.track.title.localeCompare(b.track.title));

export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const minutes = (songs: Song[]) => Math.round(songs.reduce((n, s) => n + s.track.dur, 0) / 60);

/* Lyrics: invented lines, spread evenly across the song. */
const LINES = [
  'Streetlights hum a note I used to know', 'Every window keeps a little glow', 'We were running on the last of summer',
  'Counting headlights like a slow drummer', 'Hold the static, let it ring', 'I can hear the ocean in everything',
  'Turn it up until the morning finds us', 'All the quiet that we left behind us', 'Oh, the tide comes in', 'Oh, the tide comes in again',
  'Paper boats on a neon river', 'Every promise that we tried to deliver', 'Say my name like a radio station',
  'Half a song and a long conversation', 'Hold the static, let it ring', 'I can hear the ocean in everything',
  'Oh, the tide comes in', 'And I let it take me under',
];
export function lyricsFor(s: Song) {
  const seed = s.key.length + s.index * 3;
  const n = 14;
  const lines = Array.from({ length: n }, (_, i) => LINES[(i + seed) % LINES.length]);
  const step = (s.track.dur - 12) / n;
  return lines.map((text, i) => ({ text, at: 8 + i * step }));
}
