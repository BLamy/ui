/* Everything Settings shows, as data: panes (title, icon, sections of rows), the sidebar groups, the account
   and every setting's starting value. The renderers in rows.tsx turn each row kind into the matching control. */
import type { IconName, IconShape } from '@brett_lamy/ui';

/** Apple app marks the library icon set has no symbol for, drawn with the same 24px stroke system. */
export const MARKS = {
  appstore: [{ d: 'M9.6 5.2l5.6 9.8M14.4 5.2L7 17.8M5.4 15h8.2M16.6 15h2.2M16.6 15l1.6 2.8' }],
  airdrop: [{ c: [12, 12, 1.6], f: 1 }, { d: 'M8.6 15.4a4.8 4.8 0 1 1 6.8 0M6 18a8.5 8.5 0 1 1 12 0' }],
  photos: [{ c: [12, 7.2, 3], f: 1 }, { c: [16.4, 10.4, 3], f: 1 }, { c: [14.8, 15.6, 3], f: 1 }, { c: [9.2, 15.6, 3], f: 1 }, { c: [7.6, 10.4, 3], f: 1 }],
  standby: [{ r: [3.5, 6.1, 17, 11.8, 1.4] }, { d: 'M7 12h3.5M13.5 10v4M16.5 10v4' }],
} satisfies Record<string, IconShape[]>;

/** A library icon name, or one of the marks above. */
export type Glyph = IconName | keyof typeof MARKS;

export type Value = string | number | boolean;
export type Values = Record<string, Value>;

/** Apple system colors (light mode values; the tiles keep them in dark mode too). */
export const C = {
  blue: '#007AFF', green: '#34C759', orange: '#FF9500', red: '#FF3B30', pink: '#FF2D55', indigo: '#5856D6',
  purple: '#AF52DE', teal: '#30B0C7', cyan: '#32ADE6', yellow: '#FFCC00', gray: '#8E8E93', dark: '#636366',
  siri: 'linear-gradient(135deg,#FF3CAC 0%,#784BA0 45%,#2B86C5 100%)',
  wallpaper: 'linear-gradient(135deg,#34C8E8 0%,#4E72F0 55%,#8E5CF5 100%)',
};

export type Row =
  | { t: 'toggle'; id: string; title: string; subtitle?: string; glyph?: Glyph; color?: string }
  /** Drill-down. Title and icon default to the target pane's. `value` is the gray detail text. */
  | { t: 'link'; to: string; title?: string; subtitle?: string; value?: string | ((v: Values) => string); icon?: boolean }
  | { t: 'value'; title: string; value: string }
  /** A choice: iOS pushes a checkmark list, macOS shows a pop-up menu. */
  | { t: 'select'; id: string; title: string; options: string[]; glyph?: Glyph; color?: string }
  | { t: 'option'; id: string; option: string }
  | { t: 'slider'; id: string; lo: Glyph | string; hi: Glyph | string; min?: number; max?: number; step?: number }
  | { t: 'segmented'; id: string; options: string[] }
  | { t: 'network'; name: string; secure: boolean; bars: 1 | 2 | 3 }
  | { t: 'connected' }
  | { t: 'device'; name: string; glyph: Glyph }
  | { t: 'action'; title: string; destructive?: boolean }
  | { t: 'appearance' }
  | { t: 'usage'; title: string; total: string; days: number[][]; legend: [string, string][]; caption: string }
  | { t: 'meter'; title: string; used: string; cap: number; parts: [string, string, number][] }
  | { t: 'login'; to: string; site: string; user: string; color: string }
  | { t: 'secret'; title: string; value: string };

export interface Section { title?: string; footer?: string; rows: Row[]; /** Shown only while this setting is on. */ when?: string }
export interface Pane { id: string; title: string; glyph?: Glyph; color?: string; /** Header card text (top-level panes). */ blurb?: string; sections: Section[] }

export const ACCOUNT = { first: 'Brett', last: 'Lamy', email: 'brett.lamy@icloud.com', phone: '+1 (415) 555-0142' };

export const DEFAULTS: Values = {
  airplane: false,
  'wifi.on': true, 'wifi.network': 'Lamy Home', 'wifi.ask': 'Notify', 'wifi.hotspot': 'Ask to Join',
  'bt.on': true, 'bt.AirPods Pro': true, 'bt.Apple Watch': true, 'bt.Magic Keyboard': false, 'bt.Model Y': false,
  'cell.data': true, 'cell.roaming': false, 'cell.voice': '5G Auto', 'cell.lowData': false, 'cell.wifiAssist': true,
  'hotspot.on': false, 'hotspot.compat': false,
  'battery.percent': true, 'battery.low': false, 'battery.charging': '80% Limit',
  'general.airdrop': 'Contacts Only', 'general.refresh': 'Wi-Fi & Cellular Data', 'dt.auto': true, 'dt.24h': false,
  'kb.autocorrect': true, 'kb.caps': true, 'kb.predictive': true, 'kb.period': true,
  'ax.bold': false, 'ax.shapes': false, 'ax.motion': false, 'ax.contrast': false, 'ax.zoom': false,
  'cam.grid': true, 'cam.level': false, 'cam.mirror': true, 'cam.format': 'High Efficiency', 'cam.video': '4K at 30 fps',
  'cc.apps': true, 'cc.home': true,
  'display.brightness': 62, 'display.trueTone': true, 'display.auto': false, 'display.nightShift': 'Sunset to Sunrise',
  'display.autolock': '2 Minutes', 'display.raise': true, 'display.alwaysOn': true, 'display.textSize': 3, 'display.bold': false,
  'home.layout': 'App Library Only', 'home.badges': true, 'home.search': true,
  'search.suggest': true, 'search.recent': true, 'search.lock': true,
  'siri.listen': '“Siri” or “Hey Siri”', 'siri.side': true, 'siri.locked': true, 'siri.voice': 'American (Voice 4)',
  'standby.on': true, 'standby.night': true,
  'notif.previews': 'When Unlocked', 'notif.style': 'Stack', 'notif.summary': false, 'notif.sharing': true,
  'sound.volume': 68, 'sound.buttons': false, 'sound.ringtone': 'Reflection', 'sound.text': 'Note', 'sound.keyboard': true,
  'sound.lock': true,
  'focus.share': true, 'focus.dnd': false, 'focus.sleep': true, 'focus.personal': false, 'focus.work': false,
  'st.share': true, 'st.downtime': false, 'st.limits': true, 'st.distance': true,
  'face.unlock': true, 'face.store': true, 'face.pay': true, 'face.autofill': true, 'face.attention': true, 'face.stolen': true,
  'sos.hold': true, 'sos.press': true, 'sos.crash': true, 'sos.sound': true,
  'privacy.location': true, 'privacy.track': false, 'privacy.lockdown': false, 'privacy.analytics': false, 'privacy.sensitive': true,
  'store.apps': true, 'store.updates': true, 'store.video': 'Wi-Fi Only', 'store.ratings': true,
  'wallet.double': true, 'wallet.express': 'Apple Card',
  'pw.autofill': true, 'pw.verify': true, 'pw.passkeys': true,
  'account.find': true, 'account.shareLocation': true, 'account.twofa': true,
  'icloud.photos': true, 'icloud.drive': true, 'icloud.passwords': true, 'icloud.messages': true, 'icloud.backup': true, 'icloud.health': true,
};

const onOff = (id: string) => (v: Values) => (v[id] ? 'On' : 'Off');

const NOTIF_APPS: [string, Glyph, string, string][] = [
  ['Messages', 'message-fill', C.green, 'Banners, Sounds, Badges'],
  ['Mail', 'envelope-fill', C.blue, 'Banners, Badges'],
  ['Calendar', 'calendar', C.red, 'Banners, Sounds'],
  ['Phone', 'phone-fill', C.green, 'Banners, Sounds, Badges'],
  ['Photos', 'photos', C.orange, 'Off'],
  ['Music', 'music-notes', C.pink, 'Banners'],
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const LOGINS: { site: string; user: string; color: string; pw: string; updated: string }[] = [
  { site: 'airbnb.com', user: 'brett.lamy@icloud.com', color: '#FF5A5F', pw: 'plum-orbit-Canyon-42', updated: 'Aug 14, 2026' },
  { site: 'figma.com', user: 'brett@lamy.design', color: '#A259FF', pw: 'vector-Drift-9-otter', updated: 'Jul 2, 2026' },
  { site: 'github.com', user: 'blamy', color: '#24292F', pw: 'kQ7-maple-Harbor-lint', updated: 'Sep 21, 2026' },
  { site: 'linear.app', user: 'brett.lamy@icloud.com', color: '#5E6AD2', pw: 'triage-Moss-58-cycle', updated: 'Jun 30, 2026' },
  { site: 'netflix.com', user: 'lamy.family@icloud.com', color: '#E50914', pw: 'popcorn-Sable-7-reel', updated: 'Mar 3, 2026' },
  { site: 'nytimes.com', user: 'brett.lamy@icloud.com', color: '#121212', pw: 'crossword-Fen-31-ink', updated: 'Jan 9, 2026' },
  { site: 'stripe.com', user: 'brett@lamy.design', color: '#635BFF', pw: 'ledger-Quartz-66-api', updated: 'Sep 2, 2026' },
];

const BASE: Pane[] = [
  /* ── Apple Account ── */
  {
    id: 'account', title: 'Apple Account', sections: [
      { rows: [
        { t: 'link', to: 'personal', title: 'Personal Information' },
        { t: 'link', to: 'security', title: 'Sign-In & Security' },
        { t: 'value', title: 'Payment & Shipping', value: 'Visa' },
        { t: 'link', to: 'subscriptions', title: 'Subscriptions' },
      ] },
      { rows: [
        { t: 'link', to: 'icloud', value: '200 GB' },
        { t: 'value', title: 'Family', value: '3 Members' },
        { t: 'link', to: 'findmy' },
        { t: 'value', title: 'Media & Purchases', value: 'Brett' },
      ] },
      { title: 'Devices', rows: [
        { t: 'value', title: 'Brett’s iPhone', value: 'This iPhone 16 Pro' },
        { t: 'value', title: 'Brett’s MacBook Pro', value: 'MacBook Pro 14″' },
        { t: 'value', title: 'Brett’s Apple Watch', value: 'Apple Watch Series 10' },
      ] },
      { rows: [{ t: 'action', title: 'Sign Out', destructive: true }] },
    ],
  },
  { id: 'personal', title: 'Personal Information', sections: [
    { rows: [{ t: 'value', title: 'Name', value: `${ACCOUNT.first} ${ACCOUNT.last}` }, { t: 'value', title: 'Birthday', value: 'March 12, 1990' }] },
    { title: 'Communication Preferences', footer: 'Get announcements, recommendations, and updates about Apple products, services, and software.', rows: [
      { t: 'toggle', id: 'personal.news', title: 'Announcements' }, { t: 'toggle', id: 'personal.apps', title: 'Apps, Music, TV, and More' },
    ] },
  ] },
  { id: 'security', title: 'Sign-In & Security', sections: [
    { title: 'Email & Phone Numbers', rows: [{ t: 'value', title: ACCOUNT.email, value: 'Primary' }, { t: 'value', title: ACCOUNT.phone, value: 'Trusted' }] },
    { footer: 'Your trusted devices and phone numbers are used to verify your identity when signing in.', rows: [
      { t: 'toggle', id: 'account.twofa', title: 'Two-Factor Authentication' }, { t: 'value', title: 'Account Recovery', value: '1 Contact' }, { t: 'value', title: 'Legacy Contact', value: 'Set Up' },
    ] },
  ] },
  { id: 'subscriptions', title: 'Subscriptions', sections: [
    { title: 'Active', rows: [
      { t: 'value', title: 'Apple One Family', value: '$25.95/mo' }, { t: 'value', title: 'iCloud+ 200 GB', value: 'Included' },
      { t: 'value', title: 'Things 3 Cloud', value: '$4.99/yr' }, { t: 'value', title: 'Overcast Premium', value: '$9.99/yr' },
    ] },
  ] },
  { id: 'icloud', title: 'iCloud', glyph: 'cloud-fill', color: C.cyan, sections: [
    { rows: [{ t: 'meter', title: 'iCloud+', used: '118.4 GB of 200 GB used', cap: 200, parts: [['Photos', C.orange, 64], ['Backups', C.purple, 24], ['Drive', C.blue, 18], ['Messages', C.green, 12]] }] },
    { title: 'Saved to iCloud', rows: [
      { t: 'toggle', id: 'icloud.photos', title: 'Photos', glyph: 'photos', color: C.orange },
      { t: 'toggle', id: 'icloud.drive', title: 'iCloud Drive', glyph: 'cloud-fill', color: C.cyan },
      { t: 'toggle', id: 'icloud.passwords', title: 'Passwords & Keychain', glyph: 'key', color: C.gray },
      { t: 'toggle', id: 'icloud.messages', title: 'Messages in iCloud', glyph: 'message-fill', color: C.green },
      { t: 'toggle', id: 'icloud.health', title: 'Health', glyph: 'hand', color: C.pink },
    ] },
    { title: 'Device Backups', rows: [{ t: 'toggle', id: 'icloud.backup', title: 'iCloud Backup', subtitle: 'Last backup: Today at 3:12 AM' }] },
  ] },
  { id: 'findmy', title: 'Find My', glyph: 'location-fill', color: C.green, sections: [
    { rows: [{ t: 'toggle', id: 'account.find', title: 'Find My iPhone' }], footer: 'Locate, lock, or erase your iPhone and supported accessories. Your iPhone can be found even when it’s offline or powered off.' },
    { rows: [{ t: 'toggle', id: 'account.shareLocation', title: 'Share My Location' }, { t: 'value', title: 'My Location', value: 'This Device' }] },
  ] },

  /* ── Connectivity ── */
  {
    id: 'wifi', title: 'Wi-Fi', glyph: 'wifi', color: C.blue,
    blurb: 'Connect to Wi-Fi, view available networks, and manage settings for joining networks and nearby hotspots.',
    sections: [
      { rows: [{ t: 'toggle', id: 'wifi.on', title: 'Wi-Fi' }, { t: 'connected' }] },
      { title: 'My Networks', when: 'wifi.on', rows: [
        { t: 'network', name: 'Lamy Home', secure: true, bars: 3 }, { t: 'network', name: 'Lamy Home 5G', secure: true, bars: 3 },
        { t: 'network', name: 'Studio', secure: true, bars: 2 }, { t: 'network', name: 'Blue Bottle Guest', secure: false, bars: 2 },
      ] },
      { title: 'Other Networks', when: 'wifi.on', rows: [
        { t: 'network', name: 'NETGEAR-4F2C', secure: true, bars: 2 }, { t: 'network', name: 'xfinitywifi', secure: false, bars: 1 },
        { t: 'network', name: 'Pixel Palace', secure: true, bars: 1 },
      ] },
      { footer: 'Known networks will be joined automatically. If no known networks are available, you will be notified of available networks.', rows: [
        { t: 'select', id: 'wifi.ask', title: 'Ask to Join Networks', options: ['Off', 'Notify', 'Ask'] },
        { t: 'select', id: 'wifi.hotspot', title: 'Auto-Join Hotspot', options: ['Never', 'Ask to Join', 'Automatic'] },
      ] },
    ],
  },
  {
    id: 'bluetooth', title: 'Bluetooth', glyph: 'bluetooth', color: C.blue,
    blurb: 'Connect to accessories you can use for activities such as streaming music, typing, and gaming.',
    sections: [
      { rows: [{ t: 'toggle', id: 'bt.on', title: 'Bluetooth' }], footer: 'This iPhone is discoverable as “Brett’s iPhone” while Bluetooth Settings is open.' },
      { title: 'My Devices', when: 'bt.on', rows: [
        { t: 'device', name: 'AirPods Pro', glyph: 'headphones' }, { t: 'device', name: 'Apple Watch', glyph: 'applewatch' },
        { t: 'device', name: 'Magic Keyboard', glyph: 'keyboard' }, { t: 'device', name: 'Model Y', glyph: 'car' },
      ] },
      { title: 'Other Devices', when: 'bt.on', footer: 'To pair an Apple Watch with your iPhone, go to the Apple Watch app.', rows: [] },
    ],
  },
  {
    id: 'cellular', title: 'Cellular', glyph: 'antenna', color: C.green,
    blurb: 'Manage your cellular plans, data usage, and how your iPhone connects when you’re away from Wi-Fi.',
    sections: [
      { rows: [
        { t: 'toggle', id: 'cell.data', title: 'Cellular Data' },
        { t: 'select', id: 'cell.voice', title: 'Voice & Data', options: ['5G On', '5G Auto', 'LTE'] },
        { t: 'toggle', id: 'cell.roaming', title: 'Data Roaming' },
        { t: 'toggle', id: 'cell.lowData', title: 'Low Data Mode' },
      ], footer: 'Low Data Mode helps reduce cellular data usage. When Low Data Mode is turned on, automatic updates and background tasks are paused.' },
      { title: 'Cellular Data Usage', rows: [
        { t: 'value', title: 'Current Period', value: '14.2 GB' }, { t: 'value', title: 'Current Period Roaming', value: '0 bytes' },
        { t: 'value', title: 'Maps', value: '2.1 GB' }, { t: 'value', title: 'Music', value: '1.8 GB' }, { t: 'value', title: 'Safari', value: '1.4 GB' },
      ] },
      { rows: [{ t: 'toggle', id: 'cell.wifiAssist', title: 'Wi-Fi Assist' }], footer: 'Automatically use cellular data when Wi-Fi connectivity is poor.' },
    ],
  },
  {
    id: 'hotspot', title: 'Personal Hotspot', glyph: 'hotspot', color: C.green,
    blurb: 'Share your iPhone’s internet connection with nearby devices and your Family Sharing group.',
    sections: [
      { rows: [{ t: 'toggle', id: 'hotspot.on', title: 'Allow Others to Join' }, { t: 'value', title: 'Wi-Fi Password', value: 'plum-canyon-42' }],
        footer: 'Allow other users or devices not signed into iCloud to look for your shared network “Brett’s iPhone” when you are in Personal Hotspot settings or when you turn it on in Control Center.' },
      { rows: [{ t: 'toggle', id: 'hotspot.compat', title: 'Maximize Compatibility' }], footer: 'Internet performance may be reduced for devices connected to your hotspot when turned on.' },
    ],
  },
  {
    id: 'battery', title: 'Battery', glyph: 'battery', color: C.green,
    blurb: 'View your battery level, usage, and health, and manage how your iPhone charges.',
    sections: [
      { rows: [{ t: 'toggle', id: 'battery.percent', title: 'Battery Percentage' }, { t: 'toggle', id: 'battery.low', title: 'Low Power Mode' }],
        footer: 'Low Power Mode temporarily reduces background activity like downloads and mail fetch until you can fully charge your iPhone.' },
      { rows: [{ t: 'usage', title: 'Last 10 Days', total: '87%', caption: 'Screen on 4h 51m · Screen off 1h 12m', days: [[42, 18], [55, 20], [38, 12], [61, 22], [47, 16], [52, 19], [70, 24], [44, 15], [58, 21], [49, 14]], legend: [['Screen On', C.green], ['Screen Off', '#A7E3B4']] }] },
      { rows: [{ t: 'value', title: 'Battery Health', value: 'Normal' }, { t: 'select', id: 'battery.charging', title: 'Charging', options: ['Optimized', '80% Limit', 'None'] }] },
    ],
  },
  { id: 'vpn', title: 'VPN', glyph: 'globe', color: C.blue, blurb: 'Route your traffic through a virtual private network.', sections: [
    { title: 'VPN Configurations', rows: [{ t: 'value', title: 'Status', value: 'Not Connected' }, { t: 'value', title: 'Mullvad', value: 'WireGuard' }] },
  ] },

  /* ── General group ── */
  {
    id: 'general', title: 'General', glyph: 'gear', color: C.gray,
    blurb: 'Manage your overall setup and preferences for iPhone, such as software updates, device language, AirDrop, and more.',
    sections: [
      { rows: [{ t: 'link', to: 'about', icon: true }, { t: 'link', to: 'update', icon: true }] },
      { rows: [{ t: 'link', to: 'airdrop', icon: true, value: (v) => String(v['general.airdrop']) }] },
      { rows: [{ t: 'link', to: 'storage', icon: true }, { t: 'select', id: 'general.refresh', title: 'Background App Refresh', options: ['Off', 'Wi-Fi', 'Wi-Fi & Cellular Data'] }] },
      { rows: [{ t: 'link', to: 'datetime', icon: true }, { t: 'link', to: 'keyboard', icon: true }, { t: 'value', title: 'Language & Region', value: 'English' }] },
      { rows: [{ t: 'action', title: 'Transfer or Reset iPhone' }, { t: 'action', title: 'Shut Down' }] },
    ],
  },
  { id: 'about', title: 'About', glyph: 'info', color: C.gray, sections: [
    { rows: [{ t: 'value', title: 'Name', value: 'Brett’s iPhone' }, { t: 'value', title: 'iOS Version', value: '26.0.1' }, { t: 'value', title: 'Model Name', value: 'iPhone 16 Pro' }, { t: 'value', title: 'Model Number', value: 'MYMH3LL/A' }, { t: 'value', title: 'Serial Number', value: 'K7Q2X9VJ4M' }] },
    { rows: [{ t: 'value', title: 'Songs', value: '4,812' }, { t: 'value', title: 'Photos', value: '31,406' }, { t: 'value', title: 'Applications', value: '142' }, { t: 'value', title: 'Capacity', value: '512 GB' }, { t: 'value', title: 'Available', value: '188.6 GB' }] },
    { rows: [{ t: 'value', title: 'Carrier', value: 'Verizon 62.0' }, { t: 'value', title: 'Wi-Fi Address', value: '5C:1B:F4:0A:9E:22' }, { t: 'value', title: 'Bluetooth', value: '5C:1B:F4:0A:9E:23' }] },
  ] },
  { id: 'update', title: 'Software Update', glyph: 'arrow-clockwise', color: C.gray, sections: [
    { rows: [{ t: 'value', title: 'Automatic Updates', value: 'On' }, { t: 'value', title: 'Beta Updates', value: 'Off' }] },
    { footer: 'Your software is up to date. iOS 26.0.1 was installed on Sep 22, 2026.', rows: [{ t: 'value', title: 'iOS 26.0.1', value: 'Up to Date' }] },
  ] },
  { id: 'airdrop', title: 'AirDrop', glyph: 'airdrop', color: C.blue, sections: [
    { footer: 'AirDrop lets you share instantly with people nearby. You can be discoverable in AirDrop to receive from everyone or only people in your contacts.', rows: [
      { t: 'option', id: 'general.airdrop', option: 'Receiving Off' }, { t: 'option', id: 'general.airdrop', option: 'Contacts Only' }, { t: 'option', id: 'general.airdrop', option: 'Everyone for 10 Minutes' },
    ] },
  ] },
  { id: 'storage', title: 'iPhone Storage', glyph: 'internaldrive', color: C.gray, sections: [
    { rows: [{ t: 'meter', title: 'iPhone', used: '323.4 GB of 512 GB used', cap: 512, parts: [['Apps', C.red, 120], ['Photos', C.orange, 110], ['Media', C.purple, 38], ['iOS', C.gray, 22], ['System Data', '#C7C7CC', 33]] }] },
    { title: 'Apps', rows: [{ t: 'value', title: 'Photos', value: '109.8 GB' }, { t: 'value', title: 'Messages', value: '31.2 GB' }, { t: 'value', title: 'Logic Remote', value: '8.4 GB' }, { t: 'value', title: 'Figma', value: '1.9 GB' }] },
  ] },
  { id: 'datetime', title: 'Date & Time', glyph: 'calendar', color: C.gray, sections: [
    { rows: [{ t: 'toggle', id: 'dt.24h', title: '24-Hour Time' }] },
    { rows: [{ t: 'toggle', id: 'dt.auto', title: 'Set Automatically' }, { t: 'value', title: 'Time Zone', value: 'Cupertino' }] },
  ] },
  { id: 'keyboard', title: 'Keyboard', glyph: 'keyboard', color: C.gray, sections: [
    { rows: [{ t: 'value', title: 'Keyboards', value: '3' }, { t: 'value', title: 'Text Replacement', value: '14' }] },
    { title: 'All Keyboards', rows: [
      { t: 'toggle', id: 'kb.caps', title: 'Auto-Capitalization' }, { t: 'toggle', id: 'kb.autocorrect', title: 'Auto-Correction' },
      { t: 'toggle', id: 'kb.predictive', title: 'Predictive Text' }, { t: 'toggle', id: 'kb.period', title: '“.” Shortcut' },
    ], footer: 'Double tapping the space bar will insert a period followed by a space.' },
  ] },
  {
    id: 'accessibility', title: 'Accessibility', glyph: 'accessibility', color: C.blue,
    blurb: 'Personalize iPhone in ways that work best for you with accessibility features for vision, mobility, hearing, and more.',
    sections: [
      { title: 'Vision', rows: [{ t: 'toggle', id: 'ax.zoom', title: 'Zoom' }, { t: 'toggle', id: 'ax.bold', title: 'Bold Text' }, { t: 'toggle', id: 'ax.shapes', title: 'Button Shapes' }, { t: 'toggle', id: 'ax.contrast', title: 'Increase Contrast' }] },
      { title: 'Motion', rows: [{ t: 'toggle', id: 'ax.motion', title: 'Reduce Motion' }], footer: 'Reduce the motion of the user interface, including the parallax effect of icons.' },
    ],
  },
  {
    id: 'camera', title: 'Camera', glyph: 'camera-fill', color: C.gray,
    blurb: 'Adjust camera formats, video recording, composition, and photo capture.',
    sections: [
      { rows: [{ t: 'select', id: 'cam.format', title: 'Formats', options: ['High Efficiency', 'Most Compatible'] }, { t: 'select', id: 'cam.video', title: 'Record Video', options: ['1080p at 30 fps', '1080p at 60 fps', '4K at 30 fps', '4K at 60 fps'] }] },
      { title: 'Composition', rows: [{ t: 'toggle', id: 'cam.grid', title: 'Grid' }, { t: 'toggle', id: 'cam.level', title: 'Level' }, { t: 'toggle', id: 'cam.mirror', title: 'Mirror Front Camera' }] },
    ],
  },
  {
    id: 'control', title: 'Control Center', glyph: 'switch-2', color: C.gray,
    blurb: 'Swipe down from the top-right edge to open Control Center. Touch and hold to customize controls.',
    sections: [
      { rows: [{ t: 'toggle', id: 'cc.apps', title: 'Access Within Apps' }], footer: 'Allow access to Control Center within apps. When disabled, you can still access Control Center from the Home Screen.' },
      { rows: [{ t: 'toggle', id: 'cc.home', title: 'Show Home Controls' }], footer: 'Include recommended controls for Home accessories and scenes.' },
    ],
  },
  {
    id: 'display', title: 'Display & Brightness', glyph: 'sun-fill', color: C.blue,
    blurb: 'Adjust the brightness of your display, choose a light or dark appearance, and change text size.',
    sections: [
      { title: 'Appearance', rows: [{ t: 'appearance' }, { t: 'toggle', id: 'display.auto', title: 'Automatic' }] },
      { title: 'Brightness', rows: [{ t: 'slider', id: 'display.brightness', lo: 'sun', hi: 'sun-fill' }, { t: 'toggle', id: 'display.trueTone', title: 'True Tone' }],
        footer: 'Automatically adapt iPhone display based on ambient lighting conditions to make colors appear consistent in different environments.' },
      { rows: [{ t: 'select', id: 'display.nightShift', title: 'Night Shift', options: ['Off', 'Sunset to Sunrise', 'Custom Schedule'] }] },
      { rows: [
        { t: 'select', id: 'display.autolock', title: 'Auto-Lock', options: ['30 Seconds', '1 Minute', '2 Minutes', '5 Minutes', 'Never'] },
        { t: 'toggle', id: 'display.raise', title: 'Raise to Wake' }, { t: 'toggle', id: 'display.alwaysOn', title: 'Always On Display' },
      ] },
      { title: 'Text Size', rows: [{ t: 'slider', id: 'display.textSize', lo: 'A', hi: 'A', min: 0, max: 6, step: 1 }, { t: 'toggle', id: 'display.bold', title: 'Bold Text' }] },
    ],
  },
  { id: 'home', title: 'Home Screen & App Library', glyph: 'grid-fill', color: C.indigo, blurb: 'Choose where new apps go, and show app badges and Search on your Home Screen.', sections: [
    { title: 'Newly Downloaded Apps', rows: [{ t: 'option', id: 'home.layout', option: 'Add to Home Screen' }, { t: 'option', id: 'home.layout', option: 'App Library Only' }] },
    { rows: [{ t: 'toggle', id: 'home.badges', title: 'Show in App Library' }, { t: 'toggle', id: 'home.search', title: 'Show on Home Screen' }] },
  ] },
  { id: 'search', title: 'Search', glyph: 'magnifyingglass', color: C.gray, blurb: 'Choose what shows when you search, and which apps can suggest content.', sections: [
    { rows: [{ t: 'toggle', id: 'search.suggest', title: 'Show Suggestions' }, { t: 'toggle', id: 'search.recent', title: 'Show Recent Searches' }, { t: 'toggle', id: 'search.lock', title: 'Show on Lock Screen' }] },
  ] },
  { id: 'siri', title: 'Siri', glyph: 'waveform', color: C.siri, blurb: 'Ask Siri to get things done, just by using your voice.', sections: [
    { rows: [
      { t: 'select', id: 'siri.listen', title: 'Talk to Siri', options: ['Off', '“Hey Siri”', '“Siri” or “Hey Siri”'] },
      { t: 'toggle', id: 'siri.side', title: 'Press Side Button for Siri' }, { t: 'toggle', id: 'siri.locked', title: 'Allow Siri When Locked' },
      { t: 'select', id: 'siri.voice', title: 'Siri Voice', options: ['American (Voice 1)', 'American (Voice 4)', 'British (Voice 2)', 'Australian (Voice 1)'] },
    ] },
  ] },
  { id: 'standby', title: 'StandBy', glyph: 'standby', color: '#1C1C1E', blurb: 'Turn your iPhone into a bedside clock when it’s charging on its side.', sections: [
    { rows: [{ t: 'toggle', id: 'standby.on', title: 'StandBy' }, { t: 'toggle', id: 'standby.night', title: 'Night Mode' }], footer: 'Night Mode turns StandBy red in low ambient light.' },
  ] },
  { id: 'wallpaper', title: 'Wallpaper', glyph: 'flower', color: C.wallpaper, blurb: 'Personalize your Lock Screen and Home Screen with photos, colors, and emoji.', sections: [
    { rows: [{ t: 'value', title: 'Current', value: 'Astronomy · Earth' }, { t: 'action', title: 'Add New Wallpaper' }] },
  ] },

  /* ── Notifications group ── */
  {
    id: 'notifications', title: 'Notifications', glyph: 'bell-fill', color: C.red,
    blurb: 'Manage notifications, including how they look on the Lock Screen and which apps can send them.',
    sections: [
      { title: 'Display As', rows: [{ t: 'segmented', id: 'notif.style', options: ['Count', 'Stack', 'List'] }] },
      { rows: [
        { t: 'toggle', id: 'notif.summary', title: 'Scheduled Summary' },
        { t: 'select', id: 'notif.previews', title: 'Show Previews', options: ['Always', 'When Unlocked', 'Never'] },
        { t: 'toggle', id: 'notif.sharing', title: 'Screen Sharing', subtitle: 'Notifications Off' },
      ] },
      { title: 'Notification Style', rows: NOTIF_APPS.map(([name]) => ({ t: 'link' as const, to: 'notif-' + slug(name), icon: true, subtitle: undefined })) },
    ],
  },
  {
    id: 'sounds', title: 'Sounds', glyph: 'speaker-high-fill', color: C.pink,
    blurb: 'Change the sounds you hear for calls, alerts, and system interactions.',
    sections: [
      { title: 'Ringtone and Alert Volume', rows: [{ t: 'slider', id: 'sound.volume', lo: 'speaker-fill', hi: 'speaker-high-fill' }, { t: 'toggle', id: 'sound.buttons', title: 'Change with Buttons' }],
        footer: 'The volume of the ringer and alerts can be adjusted using the volume buttons.' },
      { title: 'Sounds and Patterns', rows: [
        { t: 'select', id: 'sound.ringtone', title: 'Ringtone', options: ['Reflection', 'Radar', 'Opening', 'Chimes', 'Silk', 'Uplift'] },
        { t: 'select', id: 'sound.text', title: 'Text Tone', options: ['Note', 'Aurora', 'Bamboo', 'Chord', 'Tri-tone'] },
      ] },
      { rows: [{ t: 'toggle', id: 'sound.keyboard', title: 'Keyboard Feedback' }, { t: 'toggle', id: 'sound.lock', title: 'Lock Sound' }] },
    ],
  },
  {
    id: 'focus', title: 'Focus', glyph: 'moon-fill', color: C.indigo,
    blurb: 'Silence notifications and calls, and share when you’re busy, by setting up a Focus.',
    sections: [
      { rows: [
        { t: 'toggle', id: 'focus.dnd', title: 'Do Not Disturb', glyph: 'moon-fill', color: C.indigo },
        { t: 'toggle', id: 'focus.personal', title: 'Personal', glyph: 'person-bust-fill', color: C.purple },
        { t: 'toggle', id: 'focus.sleep', title: 'Sleep', glyph: 'bed', color: C.teal },
        { t: 'toggle', id: 'focus.work', title: 'Work', glyph: 'briefcase-fill', color: '#30B0C7' },
      ], footer: 'Focus lets you customize your device and silence calls and notifications. Turn it on and off in Control Center.' },
      { rows: [{ t: 'toggle', id: 'focus.share', title: 'Share Across Devices' }], footer: 'Focus is shared across your devices, and turning one on for this device will turn it on for all of them.' },
    ],
  },
  {
    id: 'screentime', title: 'Screen Time', glyph: 'hourglass', color: C.indigo,
    blurb: 'Understand how you use your devices and set limits for apps, websites, and communication.',
    sections: [
      { rows: [{ t: 'usage', title: 'Daily Average', total: '3h 12m', caption: 'Updated today at 9:41 AM', days: [[70, 40, 22], [52, 46, 30], [88, 34, 18], [60, 52, 26], [44, 38, 40], [96, 28, 54], [62, 30, 36]], legend: [['Social', C.blue], ['Productivity & Finance', C.teal], ['Entertainment', C.orange]] }] },
      { title: 'Limit Usage', rows: [
        { t: 'toggle', id: 'st.downtime', title: 'Downtime', subtitle: 'Schedule time away from the screen', glyph: 'hourglass', color: C.indigo },
        { t: 'toggle', id: 'st.limits', title: 'App Limits', subtitle: 'Set time limits for apps', glyph: 'hourglass', color: C.orange },
        { t: 'toggle', id: 'st.distance', title: 'Screen Distance', subtitle: 'Reduce eye strain', glyph: 'person-bust-fill', color: C.blue },
      ] },
      { rows: [{ t: 'toggle', id: 'st.share', title: 'Share Across Devices' }], footer: 'You can enable this on any device signed in to iCloud to sync your Screen Time settings.' },
    ],
  },

  /* ── Security group ── */
  {
    id: 'faceid', title: 'Face ID & Passcode', glyph: 'faceid', color: C.green,
    blurb: 'Set up Face ID and a passcode to unlock iPhone, make purchases, and sign in to apps.',
    sections: [
      { title: 'Use Face ID For', rows: [
        { t: 'toggle', id: 'face.unlock', title: 'iPhone Unlock' }, { t: 'toggle', id: 'face.store', title: 'iTunes & App Store' },
        { t: 'toggle', id: 'face.pay', title: 'Wallet & Apple Pay' }, { t: 'toggle', id: 'face.autofill', title: 'Password AutoFill' },
      ] },
      { rows: [{ t: 'toggle', id: 'face.attention', title: 'Require Attention for Face ID' }], footer: 'TrueDepth camera provides an additional level of security by verifying that you’re looking at iPhone before authenticating.' },
      { rows: [{ t: 'toggle', id: 'face.stolen', title: 'Stolen Device Protection' }], footer: 'When iPhone is away from familiar locations, some actions require Face ID and a security delay.' },
      { rows: [{ t: 'action', title: 'Change Passcode' }] },
    ],
  },
  {
    id: 'sos', title: 'Emergency SOS', glyph: 'sos', color: C.red,
    blurb: 'Quickly call emergency services and notify your emergency contacts.',
    sections: [
      { rows: [{ t: 'toggle', id: 'sos.hold', title: 'Call with Hold and Release' }, { t: 'toggle', id: 'sos.press', title: 'Call with 5 Button Presses' }, { t: 'toggle', id: 'sos.sound', title: 'Call Quietly' }] },
      { title: 'Crash Detection', rows: [{ t: 'toggle', id: 'sos.crash', title: 'Call After Severe Crash' }], footer: 'iPhone will automatically call emergency services if it detects a severe car crash.' },
    ],
  },
  {
    id: 'privacy', title: 'Privacy & Security', glyph: 'hand', color: C.blue,
    blurb: 'Control which apps can access your data, location, camera, and microphone, and manage safety protections.',
    sections: [
      { rows: [
        { t: 'toggle', id: 'privacy.location', title: 'Location Services', glyph: 'location-fill', color: C.blue },
        { t: 'toggle', id: 'privacy.track', title: 'Allow Apps to Request to Track', glyph: 'hand', color: C.orange },
      ] },
      { rows: [
        { t: 'value', title: 'Contacts', value: '12' }, { t: 'value', title: 'Calendars', value: '5' }, { t: 'value', title: 'Photos', value: '18' },
        { t: 'value', title: 'Camera', value: '9' }, { t: 'value', title: 'Microphone', value: '7' },
      ] },
      { title: 'Security', rows: [{ t: 'toggle', id: 'privacy.sensitive', title: 'Sensitive Content Warning' }, { t: 'toggle', id: 'privacy.analytics', title: 'Share iPhone Analytics' }, { t: 'toggle', id: 'privacy.lockdown', title: 'Lockdown Mode' }] },
    ],
  },

  /* ── Services group ── */
  { id: 'appstore', title: 'App Store', glyph: 'appstore', color: C.blue, blurb: 'Manage automatic downloads, updates, and in-app ratings.', sections: [
    { title: 'Automatic Downloads', rows: [{ t: 'toggle', id: 'store.apps', title: 'App Downloads' }, { t: 'toggle', id: 'store.updates', title: 'App Updates' }] },
    { rows: [{ t: 'select', id: 'store.video', title: 'Video Autoplay', options: ['On', 'Wi-Fi Only', 'Off'] }, { t: 'toggle', id: 'store.ratings', title: 'In-App Ratings & Reviews' }] },
  ] },
  { id: 'wallet', title: 'Wallet & Apple Pay', glyph: 'wallet', color: '#1C1C1E', blurb: 'Add cards, choose a default, and set up Express Mode for transit.', sections: [
    { rows: [{ t: 'value', title: 'Apple Card', value: 'Default' }, { t: 'value', title: 'Apple Cash', value: '$48.20' }, { t: 'value', title: 'Visa ···· 4012', value: '' }] },
    { rows: [{ t: 'toggle', id: 'wallet.double', title: 'Double-Click Side Button' }, { t: 'select', id: 'wallet.express', title: 'Express Transit Card', options: ['None', 'Apple Card', 'Clipper'] }] },
  ] },
  {
    id: 'passwords', title: 'Passwords', glyph: 'key', color: C.gray,
    blurb: 'Save and AutoFill passwords, passkeys, and verification codes across your devices.',
    sections: [
      { rows: [{ t: 'toggle', id: 'pw.autofill', title: 'AutoFill Passwords and Passkeys' }, { t: 'toggle', id: 'pw.verify', title: 'Verification Codes' }, { t: 'toggle', id: 'pw.passkeys', title: 'Use Passkeys' }] },
      { title: 'Saved Passwords', rows: LOGINS.map((l) => ({ t: 'login' as const, to: 'login-' + slug(l.site), site: l.site, user: l.user, color: l.color })) },
    ],
  },
];

/* Per-app notification panes and per-login password panes, generated from their lists. */
const GENERATED: Pane[] = [
  ...NOTIF_APPS.map(([name, glyph, color, summary]): Pane => ({
    id: 'notif-' + slug(name), title: name, glyph, color, sections: [
      { rows: [{ t: 'toggle', id: `notif.${slug(name)}.allow`, title: 'Allow Notifications' }] },
      { title: 'Alerts', when: `notif.${slug(name)}.allow`, rows: [
        { t: 'toggle', id: `notif.${slug(name)}.lock`, title: 'Lock Screen' }, { t: 'toggle', id: `notif.${slug(name)}.center`, title: 'Notification Center' },
        { t: 'toggle', id: `notif.${slug(name)}.banners`, title: 'Banners' },
        { t: 'select', id: `notif.${slug(name)}.style`, title: 'Banner Style', options: ['Temporary', 'Persistent'] },
      ] },
      { when: `notif.${slug(name)}.allow`, rows: [{ t: 'toggle', id: `notif.${slug(name)}.sounds`, title: 'Sounds' }, { t: 'toggle', id: `notif.${slug(name)}.badges`, title: 'Badges' }], footer: summary === 'Off' ? undefined : `Currently: ${summary}.` },
    ],
  })),
  ...LOGINS.map((l): Pane => ({
    id: 'login-' + slug(l.site), title: l.site, sections: [
      { rows: [{ t: 'value', title: 'User Name', value: l.user }, { t: 'secret', title: 'Password', value: l.pw }] },
      { footer: `Last modified ${l.updated}.`, rows: [{ t: 'value', title: 'Website', value: l.site }] },
      { rows: [{ t: 'action', title: 'Delete Password', destructive: true }] },
    ],
  })),
];
for (const [name, , , summary] of NOTIF_APPS) {
  const s = slug(name), on = summary !== 'Off';
  Object.assign(DEFAULTS, {
    [`notif.${s}.allow`]: on, [`notif.${s}.lock`]: true, [`notif.${s}.center`]: true, [`notif.${s}.banners`]: summary.includes('Banners'),
    [`notif.${s}.style`]: 'Temporary', [`notif.${s}.sounds`]: summary.includes('Sounds'), [`notif.${s}.badges`]: summary.includes('Badges'),
  });
}
Object.assign(DEFAULTS, { 'personal.news': true, 'personal.apps': false });

export const PANES: Record<string, Pane> = Object.fromEntries([...BASE, ...GENERATED].map((p) => [p.id, p]));

/** Notification app rows show their summary as the subtitle, live. */
export const notifSummary = (v: Values, paneId: string) => {
  const s = paneId.replace('notif-', '');
  if (!v[`notif.${s}.allow`]) return 'Off';
  return [v[`notif.${s}.banners`] && 'Banners', v[`notif.${s}.sounds`] && 'Sounds', v[`notif.${s}.badges`] && 'Badges'].filter(Boolean).join(', ') || 'Notification Center';
};

/** The sidebar / root list, in iOS order. Airplane Mode is a switch right in the list. */
export const GROUPS: Row[][] = [
  [
    { t: 'toggle', id: 'airplane', title: 'Airplane Mode', glyph: 'airplane', color: C.orange },
    { t: 'link', to: 'wifi', icon: true, value: (v) => (v.airplane || !v['wifi.on'] ? 'Off' : String(v['wifi.network'])) },
    { t: 'link', to: 'bluetooth', icon: true, value: onOff('bt.on') },
    { t: 'link', to: 'cellular', icon: true, value: (v) => (v.airplane ? 'Airplane Mode' : '') },
    { t: 'link', to: 'hotspot', icon: true, value: onOff('hotspot.on') },
    { t: 'link', to: 'battery', icon: true },
    { t: 'link', to: 'vpn', icon: true, value: 'Not Connected' },
  ],
  [
    { t: 'link', to: 'general', icon: true }, { t: 'link', to: 'accessibility', icon: true }, { t: 'link', to: 'camera', icon: true },
    { t: 'link', to: 'control', icon: true }, { t: 'link', to: 'display', icon: true }, { t: 'link', to: 'home', icon: true },
    { t: 'link', to: 'search', icon: true }, { t: 'link', to: 'siri', icon: true }, { t: 'link', to: 'standby', icon: true },
    { t: 'link', to: 'wallpaper', icon: true },
  ],
  [
    { t: 'link', to: 'notifications', icon: true }, { t: 'link', to: 'sounds', icon: true },
    { t: 'link', to: 'focus', icon: true }, { t: 'link', to: 'screentime', icon: true },
  ],
  [{ t: 'link', to: 'faceid', icon: true }, { t: 'link', to: 'sos', icon: true }, { t: 'link', to: 'privacy', icon: true }],
  [{ t: 'link', to: 'appstore', icon: true }, { t: 'link', to: 'wallet', icon: true }],
  [{ t: 'link', to: 'passwords', icon: true }],
];

/** Parent of every pane reachable by a link — so a search result can open with its whole path (back works). */
export const PARENT: Record<string, string> = {};
for (const p of Object.values(PANES)) {
  for (const s of p.sections) for (const r of s.rows) {
    if ((r.t === 'link' || r.t === 'login') && !PARENT[r.to]) PARENT[r.to] = p.id;
  }
}
export const pathTo = (id: string): string[] => (PARENT[id] ? [...pathTo(PARENT[id]), id] : [id]);

/** One searchable entry per titled row (and per pane). */
export interface SearchHit { pane: string; title: string; trail: string }
export const SEARCH: SearchHit[] = Object.values(PANES).flatMap((p) => {
  const trail = pathTo(p.id).slice(0, -1).map((id) => PANES[id].title).join(' › ');
  const rows = p.sections.flatMap((s) => s.rows).flatMap((r) =>
    'title' in r && r.title && r.t !== 'value' && r.t !== 'secret' ? [{ pane: p.id, title: r.title, trail: [trail, p.title].filter(Boolean).join(' › ') }] : []);
  return [{ pane: p.id, title: p.title, trail }, ...rows.filter((r) => r.title !== p.title)];
});

/* Every `select` row, so iOS can push its checkmark list as a pane of its own (`choose:<setting id>`). */
const SELECTS: Record<string, Extract<Row, { t: 'select' }>> = {};
for (const p of Object.values(PANES)) for (const s of p.sections) for (const r of s.rows) if (r.t === 'select') SELECTS[r.id] = r;

export function getPane(id: string): Pane | undefined {
  if (id.startsWith('choose:')) {
    const r = SELECTS[id.slice(7)];
    return r && { id, title: r.title, sections: [{ rows: r.options.map((o): Row => ({ t: 'option', id: r.id, option: o })) }] };
  }
  return PANES[id];
}

/** The nearest pane (itself or an ancestor) with an icon — search results lead with it. */
export function iconFor(id: string): Pane | undefined {
  return pathTo(id).reverse().map((p) => PANES[p]).find((p) => p?.glyph);
}
