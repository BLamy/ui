/* Sample vault. Every name, site, username and password here is invented — the sites use the reserved
   `.example` domain and no value is a real credential. */

export type CategoryId = 'all' | 'passkeys' | 'codes' | 'wifi' | 'security' | 'deleted';
export type Severity = 'high' | 'medium' | 'low';

export interface Account {
  id: string;
  title: string;
  username: string;
  password?: string;
  /** Seed for the fake one-time code (Codes). */
  otp?: string;
  passkey?: string;
  websites: string[];
  notes?: string;
  /** Tile color for the site icon. */
  color: string;
  modified: string;
  group?: string;
  issue?: { severity: Severity; kind: string; detail: string };
  deleted?: string;
}

export interface WifiNetwork {
  id: string;
  ssid: string;
  password: string;
  security: string;
  modified: string;
}

export interface SharedGroup {
  id: string;
  name: string;
  members: { f: string; l: string }[];
}

export const GROUPS: SharedGroup[] = [
  { id: 'family', name: 'Family', members: [{ f: 'June', l: 'Okafor' }, { f: 'Theo', l: 'Okafor' }, { f: 'Ada', l: 'Okafor' }] },
  { id: 'studio', name: 'Studio Share', members: [{ f: 'Rui', l: 'Tanaka' }, { f: 'Mara', l: 'Lind' }] },
];

export const ACCOUNTS: Account[] = [
  {
    id: 'aurora', title: 'Aurora Bank', username: 'june.okafor@mail.example', password: 'vemjyh-9Pobke-rudqaw',
    otp: 'aurora', websites: ['aurorabank.example', 'secure.aurorabank.example'], color: '#1F6FEB', modified: 'Sep 12, 2026',
    notes: 'Joint checking. Branch number is on the back of the debit card.',
  },
  {
    id: 'basalt', title: 'Basalt Cloud', username: 'june@okafor.example', passkey: 'Sep 2, 2026', otp: 'basalt',
    websites: ['console.basalt.example'], color: '#2D3748', modified: 'Sep 2, 2026',
  },
  {
    id: 'bramble', title: 'Bramble Books', username: 'jokafor', password: 'reading123', websites: ['bramblebooks.example'],
    color: '#6B8E23', modified: 'Feb 3, 2021',
    issue: { severity: 'medium', kind: 'Reused Password', detail: 'This password is used on 3 other websites. Using a unique password makes an account harder to take over.' },
  },
  {
    id: 'canopy', title: 'Canopy Mail', username: 'june.okafor@mail.example', password: 'qykcu3-mydroj-Kanxen',
    otp: 'canopy', passkey: 'Mar 18, 2026', websites: ['mail.example', 'canopymail.example'], color: '#0EA5E9', modified: 'Mar 18, 2026',
  },
  {
    id: 'cinder', title: 'Cinder Arcade', username: 'junebug', password: 'Summer2019!', websites: ['cinderarcade.example'],
    color: '#E4572E', modified: 'Jul 9, 2019',
    issue: { severity: 'high', kind: 'Compromised Password', detail: 'This password has appeared in a data leak, which puts this account at high risk. Change it now.' },
  },
  {
    id: 'driftwood', title: 'Driftwood Rentals', username: 'june.okafor@mail.example', password: 'teshuq-sobvI4-gitbam',
    websites: ['driftwood.example'], color: '#B7791F', modified: 'Jun 30, 2026', group: 'family',
    notes: 'Cabin booking for August. Door code is set by the host each stay.',
  },
  {
    id: 'ember', title: 'Ember Energy', username: '7730 1142 09', password: 'reading123', websites: ['emberenergy.example'],
    color: '#F59E0B', modified: 'Nov 11, 2022', group: 'family',
    issue: { severity: 'medium', kind: 'Reused Password', detail: 'This password is used on 3 other websites. Using a unique password makes an account harder to take over.' },
  },
  {
    id: 'fernway', title: 'Fernway Airlines', username: 'FW 88213094', password: 'bivxo8-Tehpac-nomsuv',
    passkey: 'May 4, 2026', websites: ['fernway.example'], color: '#0F766E', modified: 'May 4, 2026',
  },
  {
    id: 'foundry', title: 'Foundry Design', username: 'june@studio.example', password: 'hapzi6-Cyrwot-fekwyd', otp: 'foundry',
    websites: ['foundry.example'], color: '#7C3AED', modified: 'Aug 22, 2026', group: 'studio',
  },
  {
    id: 'harbor', title: 'Harbor Health', username: 'jokafor1988', password: 'june1988', websites: ['myharbor.example'],
    color: '#DB2777', modified: 'Jan 14, 2020',
    issue: { severity: 'low', kind: 'Weak Password', detail: 'This password is short and contains a name and a year, which makes it easy to guess.' },
  },
  {
    id: 'kestrel', title: 'Kestrel Social', username: '@juneokafor', password: 'wirpaq-nyzfe2-Hodcux', otp: 'kestrel',
    passkey: 'Jan 27, 2026', websites: ['kestrel.example'], color: '#111827', modified: 'Jan 27, 2026',
  },
  {
    id: 'lattice', title: 'Lattice Notes', username: 'june@studio.example', password: 'xadmo7-rumSeq-copjiv',
    websites: ['lattice.example'], color: '#10B981', modified: 'Apr 2, 2026', group: 'studio',
  },
  {
    id: 'meridian', title: 'Meridian Insurance', username: 'OKAF-44120', password: 'reading123', websites: ['meridian-ins.example'],
    color: '#1E3A8A', modified: 'Oct 5, 2021',
    issue: { severity: 'medium', kind: 'Reused Password', detail: 'This password is used on 3 other websites. Using a unique password makes an account harder to take over.' },
  },
  {
    id: 'moss', title: 'Moss & Co.', username: 'june.okafor@mail.example', password: 'gumbys-4wodXe-pinnah',
    websites: ['mossandco.example'], color: '#4D7C0F', modified: 'Dec 19, 2025',
  },
  {
    id: 'parcelbox', title: 'Parcelbox', username: 'june.okafor@mail.example', password: 'nufkel-Wejpy5-zutdar', otp: 'parcelbox',
    websites: ['parcelbox.example'], color: '#EA580C', modified: 'Sep 20, 2026', group: 'family',
  },
  {
    id: 'quill', title: 'Quill Invoicing', username: 'billing@studio.example', password: 'topfaz-3Jubmi-rewkop',
    passkey: 'Jul 14, 2026', websites: ['quill.example'], color: '#9333EA', modified: 'Jul 14, 2026', group: 'studio',
  },
  {
    id: 'rivet', title: 'Rivet Hardware', username: 'june.okafor@mail.example', password: 'Password1', websites: ['rivet.example'],
    color: '#64748B', modified: 'Mar 3, 2018',
    issue: { severity: 'high', kind: 'Compromised Password', detail: 'This password has appeared in a data leak, which puts this account at high risk. Change it now.' },
  },
  {
    id: 'saltmarsh', title: 'Saltmarsh Streaming', username: 'okafor.family', password: 'dojwu2-Qebvix-malnog',
    websites: ['saltmarsh.example', 'tv.saltmarsh.example'], color: '#DC2626', modified: 'Jun 1, 2026', group: 'family',
  },
  {
    id: 'tidepool', title: 'Tidepool', username: 'june@okafor.example', password: 'kowsub-Rymqa6-fitdeh', otp: 'tidepool',
    websites: ['tidepool.example'], color: '#0891B2', modified: 'Aug 8, 2026',
  },
  {
    id: 'verso', title: 'Verso Press', username: 'june@studio.example', password: 'lafgi5-Noxwep-sydcur', websites: ['verso.example'],
    color: '#BE185D', modified: 'May 29, 2026',
  },
  {
    id: 'wren', title: 'Wren Grocery', username: 'june.okafor@mail.example', password: 'Wren2020', websites: ['wren.example'],
    color: '#15803D', modified: 'Feb 17, 2020',
    issue: { severity: 'low', kind: 'Weak Password', detail: 'This password is short and follows a common pattern, which makes it easy to guess.' },
  },
  {
    id: 'yarrow', title: 'Yarrow Fitness', username: 'june.okafor@mail.example', password: 'suvnix-6Tagry-hopwel', otp: 'yarrow',
    websites: ['yarrow.example'], color: '#F97316', modified: 'Jul 2, 2026',
  },
];

export const DELETED: Account[] = [
  {
    id: 'oldforum', title: 'Loom Forum', username: 'june_o', password: 'mygro4-Dawtiv-sejlek', websites: ['forum.loom.example'],
    color: '#6366F1', modified: 'Jan 8, 2024', deleted: '24 days remaining',
  },
  {
    id: 'pinecone', title: 'Pinecone Maps', username: 'june.okafor@mail.example', password: 'fyrzu9-Pomhax-tijder',
    websites: ['pinecone.example'], color: '#059669', modified: 'Nov 30, 2023', deleted: '9 days remaining',
  },
];

export const WIFI: WifiNetwork[] = [
  { id: 'home', ssid: 'Okafor Home', password: 'lantern-meadow-4417', security: 'WPA3 Personal', modified: 'Aug 1, 2026' },
  { id: 'studio', ssid: 'Studio 5G', password: 'kiln-and-copper-22', security: 'WPA2/WPA3 Personal', modified: 'Jun 12, 2026' },
  { id: 'cabin', ssid: 'Driftwood Cabin', password: 'saltwater-porch', security: 'WPA2 Personal', modified: 'Aug 14, 2026' },
  { id: 'cafe', ssid: 'Tidal Coffee Guest', password: 'flatwhite2026', security: 'WPA2 Personal', modified: 'Mar 9, 2026' },
];

/** Severity colors: `color` for the glyph and the badge wash; `ink` for list text and `badge` for the badge's
    text (the yellow darkened so it reads on a light background). */
export const SEVERITY: Record<Severity, { label: string; color: string; ink: string; badge: string; rank: number }> = {
  high: { label: 'High Priority', color: 'var(--destructive)', ink: 'var(--destructive)', badge: 'var(--destructive)', rank: 0 },
  medium: { label: 'Recommendation', color: '#FF9500', ink: '#FF9500', badge: '#FF9500', rank: 1 },
  low: { label: 'Recommendation', color: '#FFCC00', ink: '#C79A00', badge: '#A67C00', rank: 2 },
};

/** A fake six-digit code for a seed and a 30-second window — deterministic, not TOTP. */
export function codeFor(seed: string, window: number) {
  let h = 2166136261;
  for (const ch of seed + ':' + window) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % 1000000;
}
