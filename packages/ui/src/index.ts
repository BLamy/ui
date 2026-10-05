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
export { Canvas, CanvasFrame, CanvasHandles, CanvasMarquee, CanvasGuides, useCanvas } from './components/canvas';
export type { CanvasProps, CanvasPointerInfo, CanvasContextValue, CanvasFrameProps } from './components/canvas';
export {
  toBoard, toScreen, zoomAt, fitCamera, clampZoom, MIN_ZOOM, MAX_ZOOM, MIN_SIZE,
  rotatePt, centerOf, dist, cornersOf, rectOf, unionRect, intersects, inFrame, distToSegment, distToPolyline,
  frameHandles, handleCursor, resizeFrame, rotateFrame, snapMove, HANDLE_DIR, ALL_HANDLES, EDGE_HANDLES,
} from './lib/canvas-math';
export type { Camera, Frame, Guide, Handle, HandleId, Pt, Rect } from './lib/canvas-math';
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
export { LocalStreams, StreamFullError, pack, unpack } from './lib/append-stream';
export { DurableStreamsClient, CloudSync, useCloud, deviceId } from './lib/durable-streams';
export type { DurableStreamsConfig, CloudSettings, CloudStatus } from './lib/durable-streams';
export { useSessionRecording, startSessionRecording, useSessions, useSessionCloud, sessionCloud, readSession, deleteSession, clearSessions, currentSessionId, storageUsage } from './lib/session-recorder';
export type { SessionInfo, SessionRecordingOptions, RecordedEvent, IndexRecord } from './lib/session-recorder';
export { useSheetDrag, SHEET_TAP_SLOP, SHEET_MINIMIZE_TRAVEL } from './lib/sheet-drag';
export { useEdgeSwipe } from './lib/edge-swipe';
export type { EdgeSwipeConfig } from './lib/edge-swipe';
export { usePersistentState, loadJSON, saveJSON } from './lib/persistent-state';
export { useControllableState } from './lib/controllable-state';
export { useScrollHidden } from './lib/scroll-hidden';
export type { SheetDragOptions, SheetDragState } from './lib/sheet-drag';
export type { SlotComponent, SlotProps, ContainerSize } from './lib/container';
export { Icon, IC, ICON_NAMES, ICON_ALIASES, ICON_CATEGORIES, ICON_KEYWORDS, ICON_WEIGHTS } from './lib/icon';
export type { IconProps, IconName, IconCanonicalName, IconShape, IconWeight, IconCategory } from './lib/icon';

// components
export { Avatar, AvatarGroup, avatarVariants, avatarStatusVariants, avatarGroupVariants } from './components/avatar';
export type { AvatarProps, AvatarGroupProps, AvatarStatus } from './components/avatar';
export { Switch } from './components/switch';
export type { SwitchProps } from './components/switch';
export { Segmented } from './components/segmented';
export type { SegmentedProps, SegmentedOption } from './components/segmented';
export { Spinner, spinnerAnimations } from './components/spinner';
export type { SpinnerProps, SpinnerAnimation, SpinnerVariant, SpinnerAnimationInfo } from './components/spinner';
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
export {
  Breadcrumb, BreadcrumbItem, BreadcrumbSeparator, BreadcrumbEllipsis, breadcrumbVariants, breadcrumbItemVariants, fitBreadcrumbs,
} from './components/breadcrumb';
export type {
  BreadcrumbProps, BreadcrumbItemProps, BreadcrumbItemData, BreadcrumbEntry, BreadcrumbEllipsisProps, BreadcrumbFit, BreadcrumbFitOptions,
} from './components/breadcrumb';


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
export {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSection, ContextMenuLabel, ContextMenuSeparator,
  ContextMenuShortcut, ContextMenuSub,
} from './components/context-menu';
export type { ContextMenuProps } from './components/context-menu';
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
export {
  ComposerCards,
  ComposerMorphCard,
  ComposerQueue,
  type ComposerCardsProps,
  type ComposerMorphCardProps,
  type ComposerQueueProps,
  type ComposerQueueItem,
  type ComposerQueueActions,
} from './components/composer/composer-cards';

// ── Chat: floating/artifact chat containers (ChatShell and the Discord-style parts live in the discord-clone block) ──
export {
  FloatingSheet,
  useFloatingSheet,
  type FloatingSheetProps,
  type FloatingSheetContextValue,
  type FloatingSheetFabPosition,
  type FloatingSheetAppearance,
  type FloatingSheetTone,
  type FloatingSheetSize,
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

// ── Calendar / DateField / DatePicker / ColorField / ColorPicker ──
export {
  Calendar, RangeCalendar, CalendarHeader, CalendarGrid, CalendarCell, calendarVariants,
  type CalendarProps, type RangeCalendarProps, type CalendarCellProps,
} from './components/calendar';
export {
  DateField, TimeField, DateInput, DateSegment, dateInputVariants,
  type DateFieldProps, type TimeFieldProps, type DateInputProps,
} from './components/date-field';
export {
  DatePicker, DatePickerField, DatePickerContent, DateRangePicker, DateRangePickerField, DateRangePickerContent, datePickerFieldVariants,
  type DatePickerProps, type DatePickerContentProps, type DateRangePickerProps, type DateRangePickerContentProps,
} from './components/date-picker';
export {
  ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch, ColorSwatch, colorFieldGroupVariants,
  type ColorFieldProps, type ColorFieldGroupProps, type ColorSwatchProps,
} from './components/color-field';
export {
  ColorPicker, ColorPickerTrigger, ColorPickerContent, ColorArea, ColorSlider, ColorThumb, ColorSwatchPicker, ColorSwatchPickerItem,
  type ColorPickerProps, type ColorPickerTriggerProps, type ColorPickerContentProps, type ColorAreaProps, type ColorSliderProps,
  type ColorThumbProps, type ColorSwatchPickerProps, type ColorSwatchPickerItemProps,
} from './components/color-picker';
export {
  FontPicker, FontList, FontStackPicker, fontPickerTriggerVariants, fontListItemVariants, fontStackPickerVariants,
  type FontPickerProps, type FontListProps, type FontStackPickerProps,
} from './components/font-picker';
export {
  GOOGLE_FONTS, FONT_CATEGORIES, findGoogleFont, fontStack, googleFontsUrl, loadGoogleFont, useGoogleFont, useGoogleFontStatus,
  type GoogleFont, type FontCategory, type GoogleFontOptions, type GoogleFontStatus,
} from './lib/google-fonts';

// ── TimeInput / CronEditor ──
export { TimeInput, timeInputVariants, type TimeInputProps, type TimeInputChange } from './components/time-input';
export { CronEditor, cronEditorVariants, CRON_PRESETS, type CronEditorProps, type CronPreset } from './components/cron-editor';
export {
  useTimeParse, parseTime, loadGpuTime, formatOccurrence, timeTextSegments, describeRecurrence, rruleLine,
  type TimeParseOptions, type UseTimeParseOptions, type TimeParseState, type TimeParseResult, type TimeOccurrence,
  type TimeDiagnostic, type TimeSpan, type FormatOccurrenceOptions, type TimeTextSegment,
} from './lib/gpu-time';
export {
  useCronParse, parseCronText, gpuCronAvailable, describeCronError,
  type UseCronParseOptions, type CronParseState, type GpuCronMatch,
} from './lib/gpu-cron';
export {
  validateCron, cronProblems, nextCronRuns, describeCron, splitCron, CRON_FIELDS,
  type CronValidation, type CronFieldName, type CronFieldInfo, type NextCronRunsOptions, type DescribeCronOptions,
} from './lib/cron';

// ── Passkey vault ──
export {
  PasskeyError, detectPasskeySupport, createPasskey, getPrfSecret, passkeyUnsupportedReason, bytesToBase64Url, base64UrlToBytes, wipe,
} from './lib/passkey';
export type {
  Bytes, PasskeyEnv, PasskeyErrorReason, PasskeySupport, CreatePasskeyOptions, CreatePasskeyResult, GetPrfSecretOptions, PasskeyCredentialRef, PrfSecret,
} from './lib/passkey';
export { createVault, VaultError } from './lib/vault';
export type {
  Vault, VaultOptions, VaultState, VaultStatus, VaultBusy, VaultErrorReason, VaultUnsupportedReason, VaultPasskeyInfo, EnrollOptions, AddPasskeyOptions,
  QuarantineEntry, BroadcastChannelLike,
} from './lib/vault';
export { indexedDbStorage, localStorageStorage, memoryStorage, VaultStorageError } from './lib/vault-storage';
export type { VaultStorage, IndexedDbOptions, LocalStorageOptions } from './lib/vault-storage';
export { VaultProvider, useVault, useVaultState, useWebAuthnSupport, usePasskey, useEncryptedState, vaultErrorMessage } from './lib/vault-react';
export type { VaultProviderProps, UsePasskey, EncryptedStateMeta, EncryptedStateSetter } from './lib/vault-react';
export { PasskeyEnrollDialog, RecoveryKey, recoveryKeyVariants } from './components/passkey-enroll-dialog';
export type { PasskeyEnrollDialogProps, RecoveryKeyProps } from './components/passkey-enroll-dialog';
export { VaultGate, VaultUnlock, VaultSetup, VaultUnsupported, VaultStatusBadge, unsupportedMessage } from './components/vault-gate';
export type { VaultGateProps, VaultUnlockProps, VaultSetupProps, VaultUnsupportedProps, VaultStatusBadgeProps } from './components/vault-gate';

// ── PGlite ──
export {
  PGliteProvider, usePGlite, useReadyDatabase, useDatabaseStatus, useQuery, useLiveQuery, useExec, useTransaction,
} from './lib/pglite';
export type {
  PGliteProviderProps, DatabaseState, DatabaseStatus, QueryState, UseQueryOptions, LiveQueryState, UseLiveQueryOptions, MutationState,
} from './lib/pglite';
export {
  openDatabase, runMigrations, runSql, toSqlError, parseDataDir, peekDataDirVersion, deleteDatabase, readServerInfo,
  runtimePostgresMajor, identifier, quoteIdent, quoteLiteral, PGliteError, DataDirVersionError, MigrationError,
} from './lib/pglite-core';
export type {
  Database, DatabaseInfo, OpenDatabaseOptions, OpenedDatabase, PGliteAssets, Migration, MigrationOptions, MigrationResult,
  MigrationErrorKind, PGliteErrorCode, ParsedDataDir, DataDirKind, RunOutcome, StatementResult, SqlError, SqlField, SqlResult,
  SqlRunner, SqlTransaction, LiveNamespace, LiveQueryHandle,
} from './lib/pglite-core';
export { useTabLock, SingleTabGate } from './lib/tab-lock';
export type { TabLock, TabLockStatus, SingleTabGateProps } from './lib/tab-lock';
export {
  exportDatabase, importDatabase, detectImportFormat, readArchiveVersion, dumpVersion,
} from './lib/pglite-transfer';
export type { ExportFormat, ExportOptions, ExportResult, ImportResult } from './lib/pglite-transfer';
export { downloadFile, pickFile } from './lib/pglite-files';
export { loadSchema, useSchema } from './lib/pglite-schema';
export type {
  SchemaInfo, SchemaNode, SchemaTable, SchemaColumn, ColumnReference, RelationKind, LoadSchemaOptions, UseSchemaState,
} from './lib/pglite-schema';
export { usePersistenceSupport, detectPersistenceSupport } from './lib/pglite-storage';
export type { PersistenceSupport } from './lib/pglite-storage';
export { sqlSpans, splitStatements, positionToLineColumn } from './lib/sql-lex';
export type { SqlSpan, SqlSpanType, SqlStatement } from './lib/sql-lex';
export { formatCell, toCsv, toJson, pgTypeName, formatDuration, pluralRows, PG_TYPE } from './lib/sql-format';
export type { FormattedCell, CellKind, TabularResult } from './lib/sql-format';
export { SqlEditor, useSqlHistory, sqlEditorVariants } from './components/sql-editor';
export type { SqlEditorProps, SqlEditorHandle, SqlHistory } from './components/sql-editor';
export { ResultTable, resultTableVariants } from './components/result-table';
export type { ResultTableProps, ResultSet, ResultField } from './components/result-table';
export { SchemaTree, schemaTreeVariants } from './components/schema-tree';
export type { SchemaTreeProps } from './components/schema-tree';
export { SqlConsole, sqlConsoleVariants } from './components/sql-console';
export type { SqlConsoleProps } from './components/sql-console';


// ── Filters ──
export {
  DATE_PRESETS, FILTER_OPERATORS, RELATIVE_UNITS, coerceFilter, createFilter, createFilterId, dateRange, defaultOperator, describeFilter, describeValue,
  emptyValue, isDateValue, isFilterComplete, matchFilters, matchesFilters, operatorLabel, operatorsFor, parseFilters, serializeFilters, toTime,
  withOperator, withValue,
} from './lib/filter';
export type {
  DateOptions, DatePreset, DateValue, Filter, FilterField, FilterKind, FilterOperator, FilterOption, FilterValue, MatchOptions, RelativeUnit,
} from './lib/filter';
export {
  FilterBar, FilterToolbar, FilterMenu, FilterList, FilterChip, FilterClear, FilterMatch, FilterValueEditor, useFilters, useFilterBar, useOptionalFilterBar,
  filterBarVariants, filterToolbarVariants, filterChipVariants,
} from './components/filter';
export type {
  FilterBarProps, FilterToolbarProps, FilterMenuProps, FilterListProps, FilterChipProps, FilterClearProps, FilterValueEditorProps,
  FilterBarContextValue, FilterState, FilterActions, UseFiltersOptions,
} from './components/filter';
export { FilterInput, filterInputVariants } from './components/filter-input';
export type { FilterInputProps } from './components/filter-input';
export {
  useFilterQuery, warmFilterQuery, interpretQuery, buildQuerySchema, clausesToFilters, matchOption, parseDateText,
} from './lib/filter-query';
export type { FilterQueryResult, UseFilterQueryOptions, Interpretation, Unresolved, QuerySchema, Trace } from './lib/filter-query';


// ── FileUpload ──
export {
  FileUpload, FileDropZone, FileUploadButton, FileList, FileItem, FileThumbnail, fileDropZoneVariants, fileItemVariants, useFileUploadContext,
} from './components/file-upload';
export type {
  FileUploadProps, FileDropZoneProps, FileUploadButtonProps, FileListProps, FileItemProps, FileUploadContextValue, FilesInfo,
} from './components/file-upload';
export {
  useFileUpload, useFilePreview, xhrUpload, matchesAccept, describeAccept, describeRules, fileKind, validateFiles,
  readDropItems, entriesFromFileList, rejectionMessage,
} from './lib/file-upload';
export type {
  UseFileUploadOptions, FileUploadState, UploadFile, UploadFn, UploadContext, UploadResult, FileStatus, FileEntry, FileRules,
  RejectionCode, RejectionContext, RejectionMessages, XhrUploadOptions, ReadDropOptions, FileKind,
} from './lib/file-upload';

export { formatBytes } from './lib/format-bytes';


// ── Tailscale ──
export {
  createTailscale, createTailscaleFetch, toTailscaleRequest, toResponse, isSafeLoginUrl, tailscaleErrorMessage, TailscaleError,
  memoryTailscalePersistence, webStorageTailscalePersistence, vaultTailscalePersistence,
} from './lib/tailscale';
export type {
  Tailscale, TailscaleOptions, TailscaleSnapshot, TailscaleStatus, TailscaleAuth, TailscaleEnv, TailscalePopup, TailscalePeer,
  TailscaleClient, TailscaleClientEvent, TailscaleClientStartOptions, TailscaleClientState, TailscaleNetMap, TailscaleNode,
  TailscaleRequest, TailscaleResponse, TailscaleSession, TailscalePersistence, TailscaleVaultLike, TailscaleErrorReason,
} from './lib/tailscale';
export {
  resolveTailscalePolicy, matchTailscalePolicy, encodeTailscalePolicy, decodeTailscalePolicy, describeTailscalePolicy,
  isTailnetHost, isTailnetAddress, TailscalePolicyError,
} from './lib/tailscale-policy';
export type {
  TailscalePolicy, ResolvedTailscalePolicy, TailscaleIntercept, TailscaleUnavailable, TailscaleMatch, TailscaleMatchReason,
} from './lib/tailscale-policy';
export { pickExitNode, exitNodePeers, exitNodeOnline, exitNodeName } from './lib/tailscale-exit';
export type { PickExitNodeOptions } from './lib/tailscale-exit';
export { TailscaleProvider, useTailscale, useTailscaleStatus, useTailscaleFetch, useOptionalTailscale } from './lib/tailscale-react';
export type { TailscaleProviderProps } from './lib/tailscale-react';
export { createTailscaleConnectClient } from './lib/tailscale-connect';
export type { TailscaleConnectOptions, TailscaleConnectModule, TailscaleIpn } from './lib/tailscale-connect';
export { createFakeTailscaleClient } from './lib/tailscale-fake';
export type { FakeTailscale, FakeTailscaleOptions, FakeTailnetHandler } from './lib/tailscale-fake';
export { registerTailscaleRouter, tailscaleServiceWorkerUrl, tailscaleRouterUnsupportedReason } from './lib/tailscale-router/bridge';
export type {
  TailscaleRouterHandle, TailscaleRouterOptions, TailscaleRouterState, TailscaleRouterStatus, TailscaleRouteTarget,
  TailscaleRoutedRequest,
} from './lib/tailscale-router/bridge';
export { TailscaleRouter, useTailscaleRouter } from './lib/tailscale-router/react';
export type { TailscaleRouterProps, UseTailscaleRouterOptions } from './lib/tailscale-router/react';
export {
  TailscaleLoginButton, TailscaleStatusBadge, TailscaleMark, tailscaleLoginButtonVariants, tailscaleStatusBadgeVariants,
} from './components/tailscale-login-button';
export type { TailscaleLoginButtonProps, TailscaleLoginButtonLabels, TailscaleStatusBadgeProps } from './components/tailscale-login-button';
export {
  TailscaleMenu, TailscaleMenuSummary, TailscaleExitNodes, tailscaleMenuVariants, tailscaleExitNodesVariants,
} from './components/tailscale-menu';
export type {
  TailscaleMenuProps, TailscaleMenuSummaryProps, TailscaleExitNodesProps, TailscaleExitNodeLabels, TailscaleExitNodeState, TailscaleMenuVariant,
} from './components/tailscale-menu';
