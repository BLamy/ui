/* Colors the builder offers beside the theme's: the iOS system colors, and gradients for Image placeholders. Kept out
   of the .tsx files, which style themselves with theme utilities only. */

/** iOS system colors (light). */
export const SYSTEM_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#30B0C7', '#32ADE6', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E',
] as const;

/** Pairs for an Image's gradient. */
export const ART_GRADIENTS: readonly [string, string][] = [
  ['#A8E063', '#56AB2F'],
  ['#FFD86F', '#FC6262'],
  ['#89F7FE', '#66A6FF'],
  ['#F6D365', '#FDA085'],
  ['#C471F5', '#FA71CD'],
  ['#43E97B', '#38F9D7'],
  ['#E0C3FC', '#8EC5FC'],
  ['#2C3E50', '#4CA1AF'],
];

/** The storyboard's own ink: segue arrows, the entry arrow, the scene dock. */
export const SEGUE_INK = '#8E8E93';

/** Scene dock icons, Xcode's: the component (yellow), the first responder (orange), Exit (red). */
export const DOCK_COLORS = { component: '#FFB000', responder: '#FF7A00', exit: '#FF3B30' } as const;

/** A node's shadow presets. */
export const SHADOWS = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.12)',
  md: '0 4px 14px rgba(0, 0, 0, 0.14)',
  lg: '0 12px 36px rgba(0, 0, 0, 0.2)',
} as const;
