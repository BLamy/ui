import './styles.css';

// lib
export { cn, FONT, EASE, BARH } from './lib/utils';
export { Haptics, PAT } from './lib/haptics';
export type { HapticEvent, HapticImpactStyle, HapticNotificationKind } from './lib/haptics';
export { loadMotion, useMotion } from './lib/motion';
export {
  TouchKitProvider, TKSafeCtx, TKStickyCtx, chromeStore, useChromeHidden, chromeOffset,
} from './lib/theme';
export type { TouchKitProviderProps } from './lib/theme';
export { Icon, IC } from './lib/icon';
export type { IconProps, IconName } from './lib/icon';

// components
export { Avatar } from './components/avatar';
export type { AvatarProps } from './components/avatar';
export { Switch } from './components/switch';
export type { SwitchProps } from './components/switch';
export { Segmented } from './components/segmented';
export type { SegmentedProps, SegmentedOption } from './components/segmented';
export { Spinner } from './components/spinner';
export type { SpinnerProps } from './components/spinner';
export { HapticIndicator } from './components/haptic-indicator';
export type { HapticIndicatorProps } from './components/haptic-indicator';
export { SearchField } from './components/search-field';
export type { SearchFieldProps } from './components/search-field';
export { PillButton } from './components/pill-button';
export type { PillButtonProps } from './components/pill-button';
export { QRSvg } from './components/qr-svg';
export type { QRSvgProps } from './components/qr-svg';
export { List, ListSection, ListRow } from './components/list';
export type { ListProps, ListSectionProps, ListRowProps } from './components/list';
export { IndexBar, AL } from './components/index-bar';
export type { IndexBarProps, IndexBarItem, IndexBarKey } from './components/index-bar';
export { TabBar } from './components/tab-bar';
export type { TabBarProps, TabBarItem } from './components/tab-bar';
export { EditBar } from './components/edit-bar';
export type { EditBarProps } from './components/edit-bar';
export { NavigationStack, ScreenWrap } from './components/navigation-stack';
export type { NavigationStackProps, Screen, ScreenWrapProps } from './components/navigation-stack';
export { SplitView } from './components/split-view';
export type { SplitViewProps } from './components/split-view';
export { Credenza } from './components/credenza';
export type { CredenzaProps } from './components/credenza';
export { SideDrawer } from './components/side-drawer';
export type { SideDrawerProps } from './components/side-drawer';

// demos
export {
  HapticsPlayground, ShowMagicRow, BrightnessSlider, HapticSlider, SlideToUnlock, WheelDrum, Sun,
} from './demos/haptics-playground';
