import './styles.css';

// lib
export { cn, FONT, EASE, BARH } from './lib/utils';
export { Haptics, PAT } from './lib/haptics';
export type { HapticEvent, HapticImpactStyle, HapticNotificationKind } from './lib/haptics';
export {
  loadMotion, useMotion, springs, springCss, direction, useDirection, fades, useSpringTransition, useReducedMotion, type SpringName,
} from './lib/motion';
export { TextMorph } from './components/text-morph';
export type { TextMorphProps } from './components/text-morph';
export { NumberMorph } from './components/number-morph';
export type { NumberMorphProps } from './components/number-morph';
export { IconSwap, Chevron } from './components/icon-swap';
export type { IconSwapProps, ChevronProps, ChevronDirection } from './components/icon-swap';
export { AnimatedHeight, ContentSwap } from './components/animated-height';
export type { AnimatedHeightProps, ContentSwapProps } from './components/animated-height';
export { Celebrate } from './components/celebrate';
export type { CelebrateProps } from './components/celebrate';
export {
  BLProvider, BLSafeCtx, BLStickyCtx, chromeStore, useChromeHidden, chromeOffset,
  AppearanceContext, AppearanceProvider, useAppearance, darkVars as blDarkVars, lightVars as blLightVars,
} from './lib/theme';
export type { BLProviderProps, Appearance } from './lib/theme';
export { useContainerWidth, defineSlot, collectSlots } from './lib/container';
export { useSheetDrag, SHEET_TAP_SLOP, SHEET_MINIMIZE_TRAVEL, SHEET_OPEN_THRESHOLD } from './lib/sheet-drag';
export type { SheetDragOptions, SheetDragState } from './lib/sheet-drag';
export type { SlotComponent, SlotProps } from './lib/container';
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
export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';
export { PillButton } from './components/pill-button';
export type { PillButtonProps } from './components/pill-button';
export { QRSvg } from './components/qr-svg';
export type { QRSvgProps } from './components/qr-svg';
export { List, ListSection, ListRow } from './components/list';
export type { ListProps, ListSectionProps, ListRowProps } from './components/list';
export { IndexBar, AL, indexBarVariants } from './components/index-bar';
export type { IndexBarProps, IndexBarItem, IndexBarKey } from './components/index-bar';
export { TabBar } from './components/tab-bar';
export type { TabBarProps, TabBarItem } from './components/tab-bar';
export {
  TabView, TabViewBar, TabViewList, TabViewTab, TabViewIndicator, TabViewSeparator, TabViewAction,
  TabViewHeader, TabViewFooter, TabViewPanels, TabViewPanel, useTabView, useTabViewTab,
  tabViewVariants, tabViewBarVariants, tabViewListVariants, tabViewTabVariants, tabViewIndicatorVariants,
  tabViewActionVariants,
} from './components/tab-view';
export type {
  TabViewProps, TabViewBarProps, TabViewTabProps, TabViewIndicatorProps, TabViewActionProps,
  TabViewPlacement, TabViewOrientation, TabViewBarVariant,
} from './components/tab-view';
export { EditBar } from './components/edit-bar';
export type { EditBarProps } from './components/edit-bar';
export { NavigationStack, ScreenWrap } from './components/navigation-stack';
export type { NavigationStackProps, Screen, ScreenWrapProps } from './components/navigation-stack';
export {
  SplitView, SplitViewSidebar, SplitViewSupplementary, SplitViewDetail, SplitViewHeader, SplitViewContent, SplitViewToggle,
  SplitViewItem, SplitViewEmpty, useSplitView, useSplitViewColumn,
} from './components/split-view';
export type {
  SplitViewProps, SplitViewColumnProps, SplitViewHeaderProps, SplitViewToggleProps, SplitViewItemProps, SplitViewEmptyProps,
  SplitViewState, SplitViewColumn, SplitViewWidthClass, SplitViewSidebarBehavior, SplitViewSelection,
} from './components/split-view';
export { Credenza } from './components/credenza';
export type { CredenzaProps } from './components/credenza';
export { SideDrawer } from './components/side-drawer';
export type { SideDrawerProps } from './components/side-drawer';
export { EdgeDrawer } from './components/edge-drawer';
export type { EdgeDrawerProps } from './components/edge-drawer';
export { AdaptivePane } from './components/adaptive-pane';
export {
  Sidebar, SidebarProvider, SidebarHeader, SidebarContent, SidebarFooter, SidebarWorkspace, SidebarSearch,
  SidebarSection, SidebarItem, SidebarTrigger, SidebarInset, SidebarNav, useSidebar, SBCtx, SBCollapsedCtx, SIDEBAR_ICONS,
} from './components/sidebar';
export type {
  SidebarContextValue, SidebarProviderProps, SidebarVariant, SidebarProps, SidebarWorkspaceProps, SidebarSearchProps,
  SidebarSectionProps, SidebarItemProps, SidebarNavProps,
} from './components/sidebar';
export type { AdaptivePaneProps, AdaptivePaneMode } from './components/adaptive-pane';

// demos
export { SidebarDemo, sidebarDarkVars } from './demos/sidebar-demo';
export {
  SplitViewMailDemo, SplitViewNotesDemo, SplitViewSettingsDemo, SplitViewResizableDemo, DemoGlyph,
} from './demos/split-view-demos';
export type { SplitViewResizableDemoProps } from './demos/split-view-demos';
export {
  HapticsPlayground, ShowMagicRow, BrightnessSlider, HapticSlider, SlideToUnlock, WheelDrum, Sun,
} from './demos/haptics-playground';

// ── shadcn primitives (react-aria-components + Tailwind + cva) ──
export { Badge, badgeVariants } from './components/badge';
export type { BadgeProps } from './components/badge';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants } from './components/card';
export type { CardProps } from './components/card';
export { Separator, separatorVariants } from './components/separator';
export type { SeparatorProps } from './components/separator';
export { Label, labelVariants } from './components/label';
export type { LabelProps } from './components/label';
export { Kbd, KbdGroup } from './components/kbd';
export { Skeleton, skeletonVariants } from './components/skeleton';
export type { SkeletonProps } from './components/skeleton';
export { ScrollArea, scrollAreaVariants } from './components/scroll-area';
export type { ScrollAreaProps } from './components/scroll-area';
export { Input, inputVariants } from './components/input';
export type { InputProps } from './components/input';
export { Textarea, textareaVariants } from './components/textarea';
export type { TextareaProps } from './components/textarea';
export { TextField, FieldDescription, FieldError } from './components/text-field';
export type { TextFieldProps } from './components/text-field';
export { Checkbox, CheckboxGroup, checkboxVariants } from './components/checkbox';
export type { CheckboxProps, CheckboxGroupProps } from './components/checkbox';
export { RadioGroup, Radio, radioGroupVariants, radioVariants } from './components/radio-group';
export type { RadioGroupProps, RadioProps } from './components/radio-group';
export { Toggle, toggleVariants } from './components/toggle';
export type { ToggleProps } from './components/toggle';
export { ToggleGroup, ToggleGroupItem, toggleGroupVariants } from './components/toggle-group';
export type { ToggleGroupProps, ToggleGroupItemProps } from './components/toggle-group';
export { Tabs, TabList, Tab, TabPanel, tabsListVariants, tabVariants } from './components/tabs';
export type { TabsProps } from './components/tabs';
export {
  DialogTrigger, DialogContent, Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
  DialogAction, DialogClose, dialogVariants, dialogActionVariants, dialogOverlayClass,
} from './components/dialog';
export type { DialogContentProps, DialogFooterProps, DialogActionProps } from './components/dialog';
export {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter, SheetClose, sheetVariants,
} from './components/sheet';
export type { SheetContentProps } from './components/sheet';
export { Popover, PopoverTrigger, PopoverContent } from './components/popover';
export type { PopoverProps, PopoverContentProps } from './components/popover';
export {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSection, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuShortcut, DropdownMenuSub, dropdownMenuItemVariants,
} from './components/dropdown-menu';
export type { DropdownMenuContentProps, DropdownMenuItemProps, DropdownMenuSectionProps } from './components/dropdown-menu';
export { Tooltip, TooltipTrigger } from './components/tooltip';
export type { TooltipProps } from './components/tooltip';
export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSection, selectTriggerVariants } from './components/select';
export type { SelectProps, SelectTriggerProps, SelectContentProps } from './components/select';
export { ComboBox, ComboBoxInput, ComboBoxContent, ComboBoxItem, ComboBoxSection } from './components/combobox';
export type { ComboBoxProps, ComboBoxInputProps, ComboBoxContentProps } from './components/combobox';
export { Slider, SliderTrack, SliderThumb } from './components/slider';
export type { SliderProps } from './components/slider';
export { ListBox, ListBoxItem, ListBoxSection, ListBoxHeader, listBoxVariants, listBoxItemVariants } from './components/list-box';
export type { ListBoxProps, ListBoxItemProps, ListBoxSectionProps } from './components/list-box';
export {
  Disclosure, DisclosureGroup, DisclosureTrigger, DisclosurePanel, disclosureGroupVariants,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from './components/disclosure';
export type { DisclosureGroupProps, DisclosureTriggerProps } from './components/disclosure';
export { Progress, progressVariants, progressIndicatorVariants } from './components/progress';
export type { ProgressProps } from './components/progress';
export { Form, FormSection } from './components/form';
export type { FormSectionProps } from './components/form';
// ── end shadcn primitives ──
