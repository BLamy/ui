/* Freeform's content colors: they are drawn into items, so they don't follow the theme. */

export const STICKY_COLORS = ['#FFE27A', '#FFB7C5', '#A8DCFF', '#B5EBB0', '#D7C3FF', '#FFC999'];

/** Fill, border, text and connector swatches. */
export const SWATCHES = ['#FF453A', '#FF9F0A', '#FFD60A', '#30D158', '#40C8E0', '#0A84FF', '#BF5AF2', '#FF375F', '#8E8E93', '#FFFFFF', '#1C1C1E'];

/** Soft fills a new shape can start with. */
export const SHAPE_FILLS = ['#A8DCFF', '#D7C3FF', '#B5EBB0', '#FFE27A', '#FFB7C5', '#FFC999'];

/** Ink that follows the theme: black on light boards, white on dark. Stored as this so a stroke stays legible. */
export const AUTO_INK = 'currentColor';

/** The generated pictures: a sky gradient and a scene drawn over it (see ImageArt). */
export const ART: { from: string; to: string; scene: 'sun' | 'hills' | 'city' | 'waves' | 'moon' | 'torii' }[] = [
  { from: '#FF9A8B', to: '#6A5ACD', scene: 'city' },
  { from: '#A1E3FF', to: '#3B8EEA', scene: 'torii' },
  { from: '#FFD27F', to: '#FF7E5F', scene: 'sun' },
  { from: '#9BE7C4', to: '#2E8B9A', scene: 'hills' },
  { from: '#7F8CFF', to: '#1B1B4B', scene: 'moon' },
  { from: '#8EDCF0', to: '#2F6DDB', scene: 'waves' },
];

/** Text sizes in the Format panel. */
export const TEXT_SIZES = [
  { label: 'Title', size: 48 },
  { label: 'Heading', size: 32 },
  { label: 'Body', size: 22 },
  { label: 'Caption', size: 15 },
];

/** The link card's accent. */
export const LINK_ACCENT = '#0A84FF';

/** Colors drawn into the generated pictures. */
export const SCENE = { skyline: '#1B1B3A', torii: '#D7263D', moon: '#FFF7D6' };
