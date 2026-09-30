import './styles.css';

// lib
export { cn, FONT, EASE, BARH, pressable, brandTile } from './lib/utils';
export {
  loadMotion, useMotion, springs, springCss, direction, useDirection, fades, useSpringTransition, useReducedMotion, type SpringName,
  prefersReducedMotion, flipSnapshot, flipPlay, type FlipSnapshot,
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
  AppearanceContext, AppearanceProvider, useAppearance,
  ThemeScope, ThemeScopeContext, useThemeScopeProps, themeScopeProps, themeScopeClass, tintVars, themeVarStyle, readThemeVars, THEME_VARS,
} from './lib/theme';
export type { BLProviderProps, Appearance, ThemeScopeProps, ThemeScopeName, ThemeScopeState, ThemeVars, ThemeVar } from './lib/theme';
export { useContainerWidth, useContainerSize, defineSlot, collectSlots } from './lib/container';
export { useSheetDrag, SHEET_TAP_SLOP, SHEET_MINIMIZE_TRAVEL } from './lib/sheet-drag';
export type { SheetDragOptions, SheetDragState } from './lib/sheet-drag';
export type { SlotComponent, SlotProps, ContainerSize } from './lib/container';
export { Icon, IC, ICON_NAMES, ICON_ALIASES, ICON_CATEGORIES, ICON_KEYWORDS, ICON_WEIGHTS } from './lib/icon';
export type { IconProps, IconName, IconCanonicalName, IconShape, IconWeight, IconCategory } from './lib/icon';

// components
export { Avatar } from './components/avatar';
export type { AvatarProps } from './components/avatar';
export { Switch } from './components/switch';
export type { SwitchProps } from './components/switch';
export { Segmented } from './components/segmented';
export type { SegmentedProps, SegmentedOption } from './components/segmented';
export { Spinner } from './components/spinner';
export type { SpinnerProps } from './components/spinner';
export { SearchField } from './components/search-field';
export type { SearchFieldProps } from './components/search-field';
export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';
export { QRSvg } from './components/qr-svg';
export type { QRSvgProps } from './components/qr-svg';
export { List, ListSection, ListRow, listRowVariants } from './components/list';
export type { ListProps, ListSectionProps, ListRowProps, ListRowAction } from './components/list';
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
export { NavigationStack, ScreenWrap, navigationPush } from './components/navigation-stack';
export type { NavigationStackProps, NavigationStackRootBack, Screen, ScreenWrapProps } from './components/navigation-stack';
export {
  SplitView, SplitViewSidebar, SplitViewSupplementary, SplitViewDetail, SplitViewHeader, SplitViewContent, SplitViewToggle,
  SplitViewItem, SplitViewEmpty, useSplitView, useSplitViewColumn, useSplitViewBack,
  SplitViewSection, SplitViewStack, useSplitViewStack, splitViewItemVariants, splitViewSectionLabelVariants,
} from './components/split-view';
export type {
  SplitViewProps, SplitViewColumnProps, SplitViewHeaderProps, SplitViewToggleProps, SplitViewItemProps, SplitViewEmptyProps,
  SplitViewState, SplitViewColumn, SplitViewWidthClass, SplitViewSidebarBehavior, SplitViewSelection,
  SplitViewSectionProps, SplitViewStackProps, SplitViewStackApi, SplitViewItemTint,
} from './components/split-view';
export { Credenza, credenzaVariants } from './components/credenza';
export type { CredenzaProps } from './components/credenza';
export { SideDrawer, sideDrawerVariants } from './components/side-drawer';
export type { SideDrawerProps } from './components/side-drawer';
export { EdgeDrawer, edgeDrawerVariants } from './components/edge-drawer';
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
export { Skeleton, SkeletonText, skeletonVariants } from './components/skeleton';
export type { SkeletonProps, SkeletonTextProps } from './components/skeleton';
export { ScrollArea, scrollAreaVariants } from './components/scroll-area';
export type { ScrollAreaProps } from './components/scroll-area';
export { Input, inputVariants } from './components/input';
export type { InputProps } from './components/input';
export { Textarea, textareaVariants } from './components/textarea';
export type { TextareaProps } from './components/textarea';
export { MarkdownEditor, markdownEditorVariants, looksLikeMarkdown, insertMarkdown } from './components/markdown-editor';
export type {
  MarkdownEditorProps, MarkdownEditorHandle, MarkdownEditorInstance, MarkdownEditorAttachment, MarkdownEditorClassNames,
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
export { Slider, SliderTrack, SliderThumb, sliderVariants } from './components/slider';
export type { SliderProps, SliderTone } from './components/slider';
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
export {
  SyntaxHighlighting, SyntaxHighlightingHeader, SyntaxHighlightingTitle, SyntaxHighlightingCopyButton,
  SyntaxHighlightingContent, SyntaxTokens, syntaxHighlightingVariants, useSyntaxTokens, useSyntaxHighlighting,
} from './components/syntax-highlighting';
export type {
  SyntaxHighlightingProps, SyntaxHighlightingContentProps, SyntaxHighlightingCopyButtonProps, SyntaxLineRange,
  UseSyntaxTokensOptions, SyntaxTokensState,
} from './components/syntax-highlighting';
export { lexSyntax, webgpuSupported, probeWebGPU, languageFromPath, tokenizeLines } from './lib/syntax';
export type { SyntaxToken, SyntaxTokenType, SyntaxSpan, SyntaxHighlighter, SyntaxResult, SyntaxEngine, WebGPUProbe } from './lib/syntax';
// ── end shadcn primitives ──

// ── Workbench: IDE-style agent workspace — composer, chat, terminal dock, surface panel, WorkbenchShell ──
export { IconButton, iconButtonVariants, type IconButtonProps } from './components/icon-button';
export { PlainButton, PlainToggleButton, type PlainButtonProps, type PlainToggleButtonProps } from './components/plain-button';
export {
  MarkdownView,
  FbMd,
  HlPre,
  hlTokens,
  DocstreamRefContext,
  type MarkdownViewProps,
  type DocstreamRefContextValue,
  type ReferenceNode,
} from './components/markdown-view';
export { MessageScroller, type MessageScrollerProps, type MessageScrollerItem } from './components/message-scroller';
export { SnapSheet, type SnapSheetProps } from './components/snap-sheet';
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
  ComposerAdd,
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
  type ComposerAttachmentKind,
  type ComposerAttachOptions,
  type ComposerFileSource,
  type ComposerFileRejection,
  type ComposerAddProps,
  type ComposerAttachProps,
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
} from './components/composer/composer';
export {
  ComposerAnnotatorProvider,
  useComposerAnnotator,
  type ComposerAnnotator,
  type ComposerAnnotatorProps,
  type ComposerAnnotatorSurface,
} from './components/composer/annotator';
export { WbPopover, type WbPopoverProps } from './components/composer/composer-popover';

// ── Chat: floating/artifact chat containers (ChatShell and the Discord-style parts live in the discord-clone block) ──
export {
  FloatingSheet,
  useFloatingSheet,
  type FloatingSheetProps,
  type FloatingSheetContextValue,
  type FloatingSheetFabPosition,
  type FloatingSheetAppearance,
  type FloatingSheetTone,
} from './components/floating-sheet';
export {
  FloatingChat,
  useFloatingChat,
  type FloatingChatProps,
  type FloatingChatContextValue,
  type FloatingChatFabPosition,
} from './components/floating-chat';
export { ChatColumn, ChatColumnTranscript, ChatColumnComposer, type ChatColumnProps } from './components/chat-column';
export {
  ArtifactChatContainer,
  useArtifactChatContainer,
  type ArtifactChatContainerProps,
  type ArtifactChatContainerContextValue,
  type ArtifactChatContainerSlotChildren,
  type ArtifactChatFabPosition,
  type ArtifactChatLayout,
} from './components/artifact-chat-container';
export { ProgressStepper, progressStepperVariants, type ProgressStepperProps, type ProgressStep, type ProgressStepState } from './components/progress-stepper';

// PencilKit — freehand drawing on perfect-freehand (formerly @brett_lamy/pencilkit)
export {
  PK_TOOLS,
  PK_INKS,
  PK_W,
  PK_TOOL_ICONS,
} from './components/pencilkit/constants';
export type {
  PencilTool,
  PencilDrawTool,
  PencilToolDef,
  PencilPoint,
  PencilStroke,
} from './components/pencilkit/constants';
export { outlinePath, StrokePath, MemoStroke } from './components/pencilkit/stroke-path';
export type { StrokePathProps } from './components/pencilkit/stroke-path';
export { PencilCanvas } from './components/pencilkit/pencil-canvas';
export type { PencilCanvasProps, PencilStrokesChangeSource } from './components/pencilkit/pencil-canvas';
export {
  PencilToolButton,
  pencilToolButtonVariants,
  PencilToolbar,
  PencilToolbarDivider,
  ToolPicker,
  InkPicker,
  WidthPicker,
  PencilActions,
} from './components/pencilkit/pencil-toolbar';
export type {
  PencilToolButtonProps,
  PencilToolbarProps,
  ToolPickerProps,
  InkPickerProps,
  WidthPickerProps,
  PencilActionsProps,
} from './components/pencilkit/pencil-toolbar';
export { usePencilHistory } from './components/pencilkit/use-pencil-history';
export type { PencilHistory } from './components/pencilkit/use-pencil-history';
export { PencilKitAnnotator } from './components/pencilkit/pencilkit-annotator';

// ── feedback, media and morph primitives ──
export {
  Toaster, ToastProvider, ToastQueue, toast, toastApi, useToast, createToastQueue, defaultToastQueue, toastVariants, toastIconVariants,
} from './components/toast';
export type {
  ToastData, ToastOptions, ToastVariant, ToastTone, ToastApi, ToasterProps, ToasterPlacement,
} from './components/toast';
export { ProgressRing, CountdownRing, useCountdown, progressRingVariants, countdownRingLabelVariants } from './components/progress-ring';
export type { ProgressRingProps, ProgressRingTone, CountdownRingProps, CountdownRingLabelSize, UseCountdownOptions, Countdown } from './components/progress-ring';
// ReplayPreview lives in docstream; re-exported here (see components/replay-preview.tsx)
export {
  ReplayPreview, formatReplayTime, replayDemoEvents, getReplayMarkers, getReplayMeta, getReplayPointerTrack, replayPointerAt,
} from './components/replay-preview';
export type {
  ReplayPreviewHandle, ReplayPreviewProps, ReplayEvent, ReplayMarker, ReplayMarkerKind, ReplayMeta, ReplayPointerTrack,
} from './components/replay-preview';
export { NowPlayingBars } from './components/now-playing-bars';
export type { NowPlayingBarsProps } from './components/now-playing-bars';
export { MorphGroup, Morph, MorphPresence, useMorphTransition } from './components/morph';
export type { MorphGroupProps, MorphProps, MorphPresenceProps } from './components/morph';
export { encodeQR } from './lib/qr';
export type { QRCode, QRLevel, QROptions } from './lib/qr';
export {
  CommandMenu, CommandInput, CommandList, CommandPage, CommandGroup, CommandItem, CommandEmpty, CommandSeparator,
  CommandFooter, CommandHighlight, useCommandMenu, useCommandActive, useHotkey, matchesHotkey, commandMatch,
} from './components/command-menu';
export type {
  CommandMenuProps, CommandInputProps, CommandListProps, CommandPageProps, CommandGroupProps, CommandItemProps,
  CommandFooterProps, CommandLegendItem, CommandMenuApi, CommandMatch,
} from './components/command-menu';

// ── Workbench surface theme and AI transcript parts (used by the Composer, FloatingChat and several blocks) ──
export { useWorkbenchAppearance, WorkbenchTheme, WorkbenchAppearanceProvider, type WorkbenchThemeProps } from './components/workbench-theme';
export {
  Conversation, ConversationEmpty, ConversationGreeting, ConversationMessages, ConversationComposer, ConversationSuggestions,
  Suggestion, UserMessage, AssistantMessage, MessageMarkdown, ConversationTyping, WorkLog, ToolCall, SettledBanner,
  type ConversationProps, type ConversationGreetingProps, type ConversationMessagesProps, type UserMessageProps,
  type WorkLogProps, type ToolCallProps, type SettledBannerProps,
} from './components/conversation';
