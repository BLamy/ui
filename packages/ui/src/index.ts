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
export { MarkdownEditor, markdownEditorVariants, looksLikeMarkdown, insertMarkdown } from './components/markdown-editor';
export type {
  MarkdownEditorProps, MarkdownEditorHandle, MarkdownEditorInstance, MarkdownEditorAttachment,
} from './components/markdown-editor';
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

// ── Workbench: IDE-style agent workspace — composer, chat, terminal dock, surface panel, WorkbenchShell ──
// (EASE is the same curve as the core EASE above.)
export { WFONT, MONO } from './lib/workbench/util';
export {
  workbenchVars,
  workbenchAppearanceClass,
  useWorkbenchAppearance,
  WorkbenchTheme,
  type WorkbenchThemeProps,
} from './lib/workbench/theme';
export { vib, tick } from './lib/workbench/haptics';
export { WIcon, IconBtn, iconBtnVariants, type WIconName, type WIconProps, type IconBtnProps } from './lib/workbench/icons';
export {
  MarkdownView,
  FbMd,
  HlPre,
  hlTokens,
  DocstreamRefContext,
  type MarkdownViewProps,
  type DocstreamRefContextValue,
  type ReferenceNode,
} from './components/workbench/markdown';
export { MessageScroller, type MessageScrollerProps, type MessageScrollerItem } from './components/workbench/message-scroller';
export { SnapSheet, type SnapSheetProps } from './components/workbench/snap-sheet';
export { useSpringSheetDrag, MorphText, type SpringSheetDragOptions, type SpringSheetDragState, type MorphTextProps } from './lib/workbench/motion';
export {
  ThreadSidebar,
  type ThreadSidebarProps,
  type WorkbenchThread,
  type WorkbenchMessage,
  type WorkbenchTrace,
} from './components/workbench/thread-sidebar';
export {
  TerminalDock,
  TermHeader,
  TermBody,
  fakeShell,
  TERM_FILES,
  type TermLine,
  type TerminalDockProps,
  type TermHeaderProps,
  type TermBodyProps,
} from './components/workbench/terminal';
export {
  SURFACES,
  SurfaceEmpty,
  SurfaceBrowser,
  SurfaceFiles,
  SurfaceDiff,
  SurfaceAgents,
  SurfacePanel,
  SurfaceTabBar,
  type SurfaceKind,
  type SurfaceMeta,
  type SurfacePanelProps,
  type SurfaceTabBarProps,
} from './components/workbench/surfaces';
export {
  Composer,
  ComposerOutlet,
  ComposerCard,
  ComposerAddon,
  ComposerFooter,
  ComposerSpacer,
  ComposerSeparator,
  ComposerText,
  ComposerButton,
  ComposerPillLabel,
  ComposerSelect,
  ComposerMenuItem,
  ComposerSend,
  ComposerStop,
  ComposerAttach,
  ComposerExpand,
  ComposerAttachments,
  ComposerInput,
  ComposerBump,
  ComposerBumpHandle,
  ComposerBumpContent,
  ComposerFab,
  ComposerOptions,
  ComposerOptionsOutlet,
  composerFabVariants,
  AnnotateLightbox,
  useComposer,
  useComposerBump,
  composerCardVariants,
  composerAddonVariants,
  composerButtonVariants,
  composerBumpVariants,
  composerMenuItemVariants,
  type ComposerProps,
  type ComposerCollapse,
  type ComposerFabProps,
  type ComposerContextValue,
  type ComposerAttachment,
  type ComposerOutletProps,
  type ComposerCardProps,
  type ComposerAddonProps,
  type ComposerButtonProps,
  type ComposerSelectProps,
  type ComposerSelectOption,
  type ComposerSendProps,
  type ComposerStopProps,
  type ComposerInputProps,
  type ComposerBumpProps,
  type ComposerBumpProgress,
  type ComposerBumpContextValue,
  type ComposerBumpHandleProps,
  type ComposerBumpContentProps,
  type AnnotateLightboxProps,
} from './components/workbench/composer';
export {
  ComposerAnnotatorProvider,
  useComposerAnnotator,
  type ComposerAnnotator,
  type ComposerAnnotatorProps,
  type ComposerAnnotatorSurface,
} from './components/workbench/annotator';
export { ModelPicker, modelRowVariants, type ModelPickerProps } from './components/workbench/model-picker';
export {
  AnthropicGlyph,
  OpenAIGlyph,
  SparkleGlyph,
  WORKBENCH_MODELS,
  WORKBENCH_PROVIDERS,
  type ModelOption,
  type ModelProvider,
} from './components/workbench/models';
export {
  WorkbenchComposer,
  WORKBENCH_EFFORTS,
  WORKBENCH_ACCESS,
  stripAttachmentRefs,
  type WorkbenchComposerProps,
} from './components/workbench/workbench-composer';
export { WbPopover, readWbTokens, type WbPopoverProps } from './components/workbench/wb-popover';
export {
  ChatView,
  EmptyThread,
  SettledBanner,
  WorkTrace,
  type ChatViewProps,
  type EmptyThreadProps,
  type SettledBannerProps,
  type WorkTraceProps,
} from './components/workbench/chat';
export {
  WorkbenchShell,
  useWorkbenchShell,
  workbenchWidthClass,
  type WorkbenchShellProps,
  type WorkbenchShellContextValue,
  type WorkbenchWidthClass,
} from './templates/workbench-shell';
export {
  WBHeader,
  WBSidebarSlot,
  WBMainSlot,
  WBDockSlot,
  WBDockSheetSlot,
  WBPanelSlot,
  WBTabsSlot,
  type WBHeaderProps,
  type WBSidebarSlotProps,
  type WBMainSlotProps,
  type WBPanelSlotProps,
} from './templates/workbench-slots';
export {
  WorkbenchDemo,
  SEED_THREADS,
  TERM_SEED,
  REPLIES,
  REPLY_SERVERS,
  REPLY_COMPONENT,
  REPLY_REVIEW,
  type WorkbenchDemoProps,
} from './demos/workbench-demo';

// ── Chat: team-chat parts, floating/artifact chat containers, ChatShell, and the chat demos ──
export { ChatIcon, chatIconPaths, type ChatIconProps } from './lib/chat/chat-icon';
export {
  chatTokens,
  chatTokenVars,
  chatLightTokens,
  chatLightTokenVars,
  chatVars,
  K,
  KFONT,
  KMONO,
  KEASE,
  type ChatTokens,
} from './lib/chat/chat-tokens';
export { kvib } from './lib/chat/kvib';
export {
  ChatUsersProvider,
  useChatUsers,
  type ChatUser,
  type ChatUsers,
  type ChatUsersProviderProps,
  type ChatReaction,
  type ChatThreadReply,
  type ChatThreadData,
  type ChatMessageData,
  type ChatChannel,
  type ChatChannels,
} from './lib/chat/chat-users';
export { ChatAvatar, type ChatAvatarProps } from './components/chat/chat-avatar';
export { RichText, type RichTextProps } from './components/chat/rich-text';
export { ThreadPreview, type ThreadPreviewProps } from './components/chat/thread-preview';
export { Message, type MessageProps } from './components/chat/message';
export { ChatComposer, type ChatComposerProps } from './components/chat/chat-composer';
export { ChannelList, type ChannelListProps } from './components/chat/channel-list';
export { WorkspaceRail, type WorkspaceRailProps, type WorkspaceRailHome, type Workspace } from './components/chat/workspace-rail';
export {
  ChatShell,
  useChatShell,
  type ChatShellProps,
  type ChatShellContextValue,
  type ChatShellSlotChildren,
} from './templates/chat-shell';
export {
  FloatingSheet,
  useFloatingSheet,
  type FloatingSheetProps,
  type FloatingSheetContextValue,
  type FloatingSheetFabPosition,
  type FloatingSheetAppearance,
  type FloatingSheetTone,
} from './components/chat/floating-sheet';
export {
  FloatingChat,
  useFloatingChat,
  type FloatingChatProps,
  type FloatingChatContextValue,
  type FloatingChatFabPosition,
} from './components/chat/floating-chat';
export { ChatColumn, type ChatColumnProps } from './components/chat/chat-column';
export {
  ArtifactChatContainer,
  useArtifactChatContainer,
  type ArtifactChatContainerProps,
  type ArtifactChatContainerContextValue,
  type ArtifactChatContainerSlotChildren,
  type ArtifactChatFabPosition,
  type ArtifactChatLayout,
} from './templates/artifact-chat-container';
export {
  ChatDemo,
  ChannelNav,
  ChannelMain,
  seed,
  USERS,
  type ChatDemoProps,
  type ChatThreadState,
  type ChannelNavProps,
  type ChannelMainProps,
} from './demos/chat-demo';
export {
  TileMap,
  esriDarkGrayTiles,
  esriLightGrayTiles,
  ESRI_ATTRIBUTION,
  osmTiles,
  OSM_ATTRIBUTION,
  cartoDarkTiles,
  cartoVoyagerTiles,
  CARTO_ATTRIBUTION,
  type TileMapProps,
  type MapPin,
  type MapRoute,
  type TileUrlFn,
} from './demos/map-chat/tile-map';
export {
  project,
  unproject,
  resolveView,
  distanceMeters,
  walkingMinutes,
  formatDistance,
  formatMinutes,
  type LatLng,
  type MapView,
  type MapTarget,
  type MapBoundsTarget,
  type MapPadding,
} from './demos/map-chat/geo';
export { MAP_ICONS, type MapIconName } from './demos/map-chat/map-icons';
export { PLACES, PLACE_BY_ID, AREAS, CATEGORY_META, USER_POSITION, type Place, type PlaceCategory } from './demos/map-chat/places';
export {
  planTurn,
  SUGGESTIONS,
  TOOL_META,
  type MapToolName,
  type MapToolHost,
  type AgentToolStep,
  type AgentTurnPlan,
  type AgentMemory,
  type Trip,
} from './demos/map-chat/map-agent';
export { MapChatDemo, type MapChatDemoProps } from './demos/map-chat/map-chat-demo';
export { ProgressStepper, progressStepperVariants, type ProgressStepperProps, type ProgressStep, type ProgressStepState } from './components/chat/progress-stepper';
export {
  DeliveryTrackingDemo,
  DELIVERY_STAGES,
  type DeliveryTrackingDemoProps,
  type DeliveryStage,
} from './demos/delivery/delivery-tracking-demo';
