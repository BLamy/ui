import './styles.css';

// lib
export { cn, cx } from './lib/utils';
export {
  springs, springCss, direction, useDirection, fades, useSpringTransition, useReducedMotion, type SpringName,
  prefersReducedMotion,
} from './lib/motion';
export { usePresence, usePresenceList, useEnterExit } from './lib/presence';
export type { Presence, PresenceEntry, PresenceOptions } from './lib/presence';
export { TextMorph } from './components/text-morph';
export type { TextMorphProps } from './components/text-morph';
export { NumberMorph } from './components/number-morph';
export type { NumberMorphProps } from './components/number-morph';
export { Swap } from './components/swap';
export type { SwapProps, SwapEffect } from './components/swap';
export { AnimatedHeight } from './components/animated-height';
export { Canvas, CanvasFrame, CanvasHandles, CanvasMarquee, CanvasGuides, CanvasMiniMap, useCanvas, createCanvasController } from './components/canvas';
export type {
  CanvasProps, CanvasPointerInfo, CanvasContextValue, CanvasController, CanvasFitOptions, CanvasViewportChangeDetails, CanvasViewportReason,
  CanvasFrameProps, CanvasHandlesProps, CanvasMarqueeProps, CanvasGuidesProps, CanvasMiniMapProps, CanvasMiniMapItem, CanvasPointerLayer,
} from './components/canvas';
export {
  toBoard, toScreen, MIN_SIZE,
  dist, cornersOf, rectOf, unionRect, intersects, inFrame, distToSegment, distToPolyline,
  frameHandles, handleCursor, resizeFrame, rotateFrame, snapMove,
} from './lib/canvas-math';
export type { Viewport, Frame, Guide, Handle, HandleId, Pt, Rect } from './lib/canvas-math';
export type { AnimatedHeightProps } from './components/animated-height';
export { Celebrate } from './components/celebrate';
export type { CelebrateProps } from './components/celebrate';
export {
  BLProvider, useChromeHidden,
  AppearanceProvider, useAppearance,
  ThemeScope, useThemeScope, useScopeAppearance, useThemeScopeProps, themeScopeProps, readThemeVars, tintForeground, THEME_VARS,
  useLayerHost,
} from './lib/theme';
export type { BLProviderProps, Appearance, ThemeScopeProps, ThemeScopeName, ThemeScopeState, ThemeVars, ThemeVar } from './lib/theme';
export { useContainerWidth, useContainerSize, useSizeClass, useSizeClassScope, SizeClassProvider, usePresentation } from './lib/container';
export { bindSizeClass, sizeClassOf } from './lib/size-class';
export type { SizeClass, SizeClassBreakpoints, BindSizeClassOptions } from './lib/size-class';
export { createStack } from './lib/stack';
export type { Stack, StackExit, StackOptions, StackReason, StackChangeOptions } from './lib/stack';
export { bindBack } from './lib/back';
export type { BindBackOptions } from './lib/back';
export { bindEdgeSwipe } from './lib/edge-swipe';
export type { BindEdgeSwipeOptions, EdgeSwipeDetails, EdgeSwipeEndDetails } from './lib/edge-swipe';
export { bindPullToRefresh } from './lib/pull-to-refresh';
export type { BindPullToRefreshOptions, PullToRefreshDetails, PullToRefresh } from './lib/pull-to-refresh';
export { bindScrollEdge, useHideOnScroll } from './lib/scroll-edge';
export type { BindScrollEdgeOptions } from './lib/scroll-edge';
export { LocalStreams } from './lib/append-stream';
export { DurableStreamsClient, CloudSync, useCloud, deviceId } from './lib/durable-streams';
export type { DurableStreamsConfig, CloudSettings, CloudStatus } from './lib/durable-streams';
export { useSessionRecording, startSessionRecording, useSessions, useSessionCloud, sessionCloud, readSession, deleteSession, clearSessions, currentSessionId, storageUsage } from './lib/session-recorder';
export type { SessionInfo, SessionRecordingOptions, RecordedEvent, IndexRecord } from './lib/session-recorder';
export { usePersistentState, loadJSON, saveJSON } from './lib/persistent-state';
export { useControllableChange } from './lib/controllable-state';
export type { ContainerSize, UseSizeClassOptions } from './lib/container';
export { Icon, Chevron, ICON_NAMES, ICON_ALIASES, ICON_CATEGORIES, ICON_KEYWORDS } from './lib/icon';
export type { IconProps, IconName, IconCanonicalName, IconShape, IconWeight, IconCategory, ChevronProps, ChevronDirection } from './lib/icon';

// components
export { Avatar, AvatarImage, AvatarFallback, avatarVariants, avatarStatusVariants } from './components/avatar';
export type { AvatarProps, AvatarStatus } from './components/avatar';
export { AvatarGroup, avatarGroupVariants } from './components/avatar-group';
export type { AvatarGroupProps } from './components/avatar-group';
export { Switch, SwitchThumb, switchVariants, createSwitchController } from './components/switch';
export type { SwitchProps } from './components/switch';
export {
  Segmented, SegmentedItem, segmentTrackVariants, segmentItemVariants, segmentIndicatorVariants, segmentIndicatorSlide,
  createSegmentedControlController,
} from './components/segmented';
export type { SegmentedProps, SegmentedItemProps, SegmentSize } from './components/segmented';
export { Spinner, spinnerAnimations } from './components/spinner';
export type { SpinnerProps, SpinnerAnimation, SpinnerPattern, SpinnerPatternOf, SpinnerAnimationInfo } from './components/spinner';
export { SearchInput, searchInputVariants } from './components/search-input';
export type { SearchInputProps, SearchInputSubmitDetails } from './components/search-input';
export { Button, buttonVariants } from './components/button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/button';
export { QRCode } from './components/qr-code';
export type { QRCodeProps } from './components/qr-code';
export { List, ListSection, ListRow, listVariants, listRowVariants, createListRowController } from './components/list';
export type {
  ListProps, ListDensity, ListSectionProps, ListRowProps, ListRowAction, ListRowActionDetails, ListRowActionReason, ListRowController,
  ListRowFullSwipe, ListSectionOrderChangeDetails, ListSectionOrderChangeReason,
} from './components/list';
export { IndexBar, alphabetItems, indexBarVariants } from './components/index-bar';
export type { IndexBarProps, IndexBarItem, IndexBarValue, IndexBarJumpReason, IndexBarJumpDetails } from './components/index-bar';
export {
  Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator, ToolbarText, toolbarVariants, toolbarButtonVariants, useToolbar,
  createToolbarController,
} from './components/toolbar';
export type {
  ToolbarProps, ToolbarButtonProps, ToolbarGroupProps, ToolbarSeparatorProps, ToolbarTextProps, ToolbarVariant, ToolbarSize,
  ToolbarTone, ToolbarController,
} from './components/toolbar';
export {
  NavigationStack, NavigationStackPage, NavigationStackBar, NavigationStackTitle, NavigationStackBack, NavigationStackLeading,
  NavigationStackTrailing, NavigationStackContent, NavigationStackLargeTitle, NavigationStackSubheader,
  createNavigationStackController, useNavigationStack,
} from './components/navigation-stack';
export type {
  NavigationStackProps, NavigationStackRootBack, NavigationStackPageProps, NavigationStackBarProps, NavigationStackTitleProps,
  NavigationStackBackProps, NavigationStackLeadingProps, NavigationStackTrailingProps, NavigationStackContentProps,
  NavigationStackLargeTitleProps, NavigationStackSubheaderProps, NavigationStackController, NavigationStackChangeDetails,
  NavigationStackChangeOptions, NavigationStackReason, NavigationStackPageState,
} from './components/navigation-stack';
export {
  SplitView, SplitViewSidebar, SplitViewSupplementary, SplitViewDetail, SplitViewHeader, SplitViewContent, SplitViewSidebarTrigger,
  SplitViewItem, useSplitView, useSplitViewColumn, useSplitViewBack,
  SplitViewSection, splitViewItemVariants, createSplitViewController,
} from './components/split-view';
export type {
  SplitViewProps, SplitViewColumnProps, SplitViewSidebarProps, SplitViewHeaderProps, SplitViewContentProps, SplitViewSidebarTriggerProps, SplitViewItemProps,
  SplitViewState, SplitViewContextValue, SplitViewColumn, SplitViewSizeClass, SplitViewSidebarBehavior, SplitViewValue,
  SplitViewSectionProps, SplitViewItemTint,
  SplitViewController, SplitViewColumnWidths, SplitViewDefaultSidebarOpen, SplitViewColumnState, SplitViewItemState, SplitViewHeaderState,
  SplitViewSidebarOpenChangeDetails, SplitViewSidebarOpenChangeReason, SplitViewValueChangeDetails, SplitViewValueChangeReason,
  SplitViewCompactColumnChangeDetails, SplitViewCompactColumnChangeReason, SplitViewSupplementaryOpenChangeDetails,
  SplitViewSupplementaryOpenChangeReason, SplitViewColumnWidthsChangeDetails, SplitViewColumnWidthsChangeReason,
} from './components/split-view';
export {
  AdaptivePane, AdaptivePaneHeader, AdaptivePaneTitle, AdaptivePaneClose, adaptivePanePageClass, createAdaptivePaneController,
} from './components/adaptive-pane';
export { useKeptChildren } from './lib/kept-children';
export type { KeptChildren, KeptChildrenOptions } from './lib/kept-children';
export {
  Sidebar, SidebarProvider, SidebarHeader, SidebarContent, SidebarFooter, SidebarAccount, SidebarSearch,
  SidebarSection, SidebarItem, SidebarTrigger, SidebarInset, sidebarItemVariants, useSidebar, useSidebarCollapsed,
  createSidebarController,
} from './components/sidebar';
export type {
  SidebarContextValue, SidebarProviderProps, SidebarVariant, SidebarPresentation, SidebarState, SidebarProps,
  SidebarAccountProps, SidebarSearchProps, SidebarSectionProps, SidebarItemProps, SidebarTriggerProps, SidebarController, SidebarOpenChangeDetails, SidebarOpenChangeReason,
} from './components/sidebar';
export type {
  AdaptivePaneProps, AdaptivePaneState, AdaptivePaneCloseProps, AdaptivePanePresentation, AdaptivePaneController, AdaptivePaneOpenChangeDetails,
  AdaptivePaneOpenChangeReason, AdaptivePaneSide, AdaptivePaneWidths, AdaptivePaneWidthsChangeDetails, AdaptivePaneWidthsChangeReason,
} from './components/adaptive-pane';
export {
  Breadcrumb, BreadcrumbItem, BreadcrumbSeparator, BreadcrumbEllipsis, breadcrumbVariants, breadcrumbItemVariants, fitBreadcrumbs,
} from './components/breadcrumb';
export type {
  BreadcrumbProps, BreadcrumbItemProps, BreadcrumbItemData, BreadcrumbEntry, BreadcrumbEllipsisProps, BreadcrumbFit, BreadcrumbFitOptions,
} from './components/breadcrumb';


// ── shadcn primitives (UI SDK + Tailwind + cva) ──
export { Badge, badgeVariants } from './components/badge';
export type { BadgeProps } from './components/badge';
export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter, cardVariants } from './components/card';
export type { CardProps } from './components/card';
export { Separator, separatorVariants } from './components/separator';
export type { SeparatorProps } from './components/separator';
export { EmptyState, emptyStateVariants, renderEmptyState } from './components/empty-state';
export type { EmptyStateProps } from './components/empty-state';
export { Label, labelVariants } from './components/label';
export type { LabelProps } from './components/label';
export { Kbd, KbdGroup } from './components/kbd';
export type { KbdProps } from './components/kbd';
export { Skeleton, SkeletonText, skeletonVariants } from './components/skeleton';
export type { SkeletonProps, SkeletonTextProps } from './components/skeleton';
export {
  ScrollArea, ScrollAreaViewport, ScrollAreaContent, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner,
  ScrollAreaScrollToEnd, scrollAreaViewportVariants, createScrollAreaController,
} from './components/scroll-area';
export type {
  ScrollAreaProps, ScrollAreaViewportProps, ScrollAreaContentProps, ScrollAreaCornerProps, ScrollAreaScrollbarProps, ScrollAreaThumbProps, ScrollAreaScrollToEndProps,
} from './components/scroll-area';
export { Input, inputVariants, fieldSurfaceVariants, fieldFocusRing, createInputController } from './components/input';
export type { InputProps, InputController } from './components/input';
export { Textarea, textareaVariants } from './components/textarea';
export type { TextareaProps } from './components/textarea';
export { MarkdownEditor, MarkdownEditorToolbarButton, markdownEditorVariants, looksLikeMarkdown, insertMarkdown } from './components/markdown-editor';
export type {
  MarkdownEditorProps, MarkdownEditorHandle, MarkdownEditorInstance, MarkdownEditorAttachment, MarkdownEditorClassNames,
  MarkdownEditorValueChangeDetails, MarkdownEditorValueChangeReason, MarkdownEditorToolbarButtonProps,
} from './components/markdown-editor';
export { Field, FieldLabel, FieldDescription, FieldError, FieldSet, FieldLegend, FieldGroup, FieldControl, useFieldControl } from './components/field';
export type { FieldLabelProps } from './components/field';
export { Checkbox, CheckboxIndicator, CheckboxGroup, checkboxVariants, createCheckboxController, createCheckboxGroupController } from './components/checkbox';
export type { CheckboxProps, CheckboxIndicatorProps, CheckboxGroupProps } from './components/checkbox';
export { RadioGroup, Radio, RadioIndicator, radioGroupVariants, radioVariants, createRadioGroupController } from './components/radio-group';
export type { RadioGroupProps, RadioProps } from './components/radio-group';
export {
  Toggle, ToggleIcon, toggleVariants, createToggleController,
  ToggleGroup, ToggleGroupItem, toggleGroupVariants, createToggleGroupController,
} from './components/toggle';
export type { ToggleProps, ToggleVariant, ToggleSize, ToggleGroupProps, ToggleGroupItemProps, ToggleGroupVariant } from './components/toggle';
export {
  Tabs, TabsBar, TabsList, TabsTab, TabsTabIcon, TabsIndicator, TabsPill, TabsSeparator, TabsAction, TabsHeader,
  TabsFooter, TabsPanels, TabsPanel, useTabs, useTabsTab, createTabsController,
  tabsVariants, tabsBarVariants, tabsListVariants, tabsTabVariants, tabsIndicatorVariants, tabsPillVariants,
  tabsActionVariants,
} from './components/tabs';
export type {
  TabsProps, TabsBarProps, TabsListProps, TabsTabProps, TabsTabIconProps, TabsIndicatorProps, TabsPillProps,
  TabsSeparatorProps, TabsActionProps, TabsHeaderProps, TabsFooterProps, TabsPanelsProps, TabsPanelProps,
  TabsVariant, TabsSide, TabsOrientation, TabsPresentation, TabsController, TabsTabState, TabsValueChangeReason,
} from './components/tabs';
export {
  Dialog, DialogTrigger, DialogBackdrop, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
  DialogClose, DialogBack, DialogView, dialogVariants, createDialogController,
  surfaceHeaderVariants, surfaceTitleVariants, surfaceDescriptionVariants, surfaceBodyVariants, surfaceFooterVariants, closeButtonVariants,
  AlertDialog, AlertDialogTrigger, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogClose, alertDialogCloseVariants, createAlertDialogController, createConfirm,
} from './components/dialog';
export type {
  DialogProps, DialogContentProps, DialogHeaderProps, DialogFooterProps, DialogBackProps, DialogViewProps, DialogController,
  AlertDialogProps, AlertDialogContentProps, AlertDialogFooterProps, AlertDialogCloseProps, AlertDialogController,
} from './components/dialog';
export {
  Sheet, SheetTrigger, SheetBackdrop, SheetContent, SheetHandle, SheetHeader, SheetTitle, SheetDescription, SheetBody,
  SheetFooter, SheetClose, SheetBack, SheetView, sheetVariants, sheetGrabberVariants, createSheetController,
} from './components/sheet';
export type {
  SheetProps, SheetContentProps, SheetHeaderProps, SheetFooterProps, SheetBackProps, SheetViewProps, SheetController,
} from './components/sheet';
export {
  Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverTitle, PopoverDescription, PopoverClose,
  popoverContentVariants, createPopoverController,
} from './components/popover';
export type { PopoverProps, PopoverContentProps, PopoverController } from './components/popover';
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContextTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuGroup, DropdownMenuGroupLabel, DropdownMenuSeparator,
  DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuItems,
  dropdownMenuContentVariants, dropdownMenuItemVariants, createDropdownMenuController,
} from './components/dropdown-menu';
export type {
  DropdownMenuProps, DropdownMenuTriggerProps, DropdownMenuContextTriggerProps, DropdownMenuContentProps, DropdownMenuItemProps,
  DropdownMenuCheckboxItemProps, DropdownMenuRadioGroupProps, DropdownMenuRadioItemProps, DropdownMenuGroupProps,
  DropdownMenuSubProps, DropdownMenuSubTriggerProps, DropdownMenuController, DropdownMenuData, DropdownMenuDataItem,
} from './components/dropdown-menu';
export { useTriggerPalette } from './lib/trigger-palette';
export type { PopupPalette, TriggerPaletteProps } from './lib/trigger-palette';
export { Tooltip, TooltipTrigger, TooltipContent, TooltipArrow, TooltipShortcut, createTooltipController } from './components/tooltip';
export type { TooltipProps, TooltipContentProps, TooltipController } from './components/tooltip';
export {
  HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow, HoverCardHeader, createHoverCardController,
} from './components/hover-card';
export type { HoverCardProps, HoverCardContentProps, HoverCardHeaderProps, HoverCardController } from './components/hover-card';
export {
  Select, SelectLabel, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectGroupLabel, SelectSeparator,
  selectTriggerVariants, createSelectController,
} from './components/select';
export type {
  SelectProps, SelectLabelProps, SelectTriggerProps, SelectContentProps, SelectItemProps, SelectController,
} from './components/select';
export {
  Combobox, ComboboxLabel, ComboboxInputGroup, ComboboxInput, ComboboxTrigger, ComboboxClear, ComboboxChips, ComboboxContent, ComboboxList,
  ComboboxEmpty, ComboboxItem, ComboboxGroup, ComboboxGroupLabel, ComboboxSeparator, ComboboxChip, ComboboxChipRemove, ComboboxStatus,
  createComboboxController,
} from './components/combobox';
export type {
  ComboboxProps, ComboboxLabelProps, ComboboxInputGroupProps, ComboboxChipsProps, ComboboxContentProps, ComboboxItemProps, ComboboxChipProps,
  ComboboxEmptyProps, ComboboxController,
} from './components/combobox';
export { Slider, SliderValue, SliderControl, SliderTrack, SliderIndicator, SliderThumb, sliderVariants, createSliderController } from './components/slider';
export type { SliderProps, SliderVariant } from './components/slider';
export {
  Listbox, ListboxItem, ListboxGroup, ListboxGroupLabel, ListboxSeparator, listboxVariants, listboxItemVariants, createListboxController,
} from './components/listbox';
export type { ListboxProps, ListboxItemProps, ListData, ListboxController } from './components/listbox';
export {
  Tree, TreeItem, TreeItemLabel, TreeItemIndicator, TreeItemCheckbox, TreeGroup, treeVariants, treeRowVariants,
  createTreeController,
} from './components/tree';
export type {
  TreeProps, TreeDataProps, TreePartsProps, TreeDataOptions, TreeNode, TreeNodeActionDetails, TreeRowState, TreeDensity, TreeActionOn, TreeDropTarget,
  TreeGitStatus, TreeEditDetails, TreeEditingChangeDetails, TreeController, TreeItemData, TreeMode,
} from './components/tree';
export { FileTypeIcon, FileBadgeIcon, FolderIcon, fileTypeOf } from './lib/file-icons';
export { useCopy } from './lib/use-copy';
export type { UseCopy, UseCopyOptions } from './lib/use-copy';
export { usePaced } from './lib/use-paced';
export {
  Disclosure, DisclosureHeader, DisclosureTrigger, DisclosurePanel,
  DisclosureGroup, DisclosureGroupItem, DisclosureGroupHeader, DisclosureGroupTrigger, DisclosureGroupPanel,
  disclosureGroupVariants,
  createCollapsibleController, createAccordionController,
} from './components/disclosure';
export type {
  DisclosureProps, DisclosureHeaderProps, DisclosureTriggerProps, DisclosurePanelProps,
  DisclosureGroupProps, DisclosureGroupItemProps, DisclosureGroupHeaderProps, DisclosureGroupTriggerProps,
  DisclosureGroupPanelProps,
} from './components/disclosure';
export { Progress, ProgressLabel, ProgressValue, ProgressTrack, ProgressIndicator, progressVariants, progressIndicatorVariants } from './components/progress';
export type { ProgressProps } from './components/progress';
export { lexSyntax, webgpuSupported, probeWebGPU, languageFromPath, tokenizeLines } from './lib/syntax';
export type { CodeToken, CodeTokenType, SyntaxSpan, SyntaxHighlighter, SyntaxResult, SyntaxEngine, WebGPUProbe } from './lib/syntax';
// ── end shadcn primitives ──

// ── Workbench: IDE-style agent workspace — composer, chat, terminal dock, surface panel, WorkbenchShell ──
export {
  MarkdownView,
  type MarkdownViewProps,
  type ReferenceNode,
} from './components/markdown-view';
export { MessageScroller, MessageScrollerItem, type MessageScrollerProps, type MessageScrollerItemProps } from './components/message-scroller';
export {
  Composer,
  ComposerCard,
  ComposerAddon,
  ComposerFooter,
  ComposerSpacer,
  ComposerSeparator,
  ComposerText,
  ComposerPill,
  ComposerSelect,
  ComposerSend,
  ComposerStop,
  ComposerAdd,
  ComposerExpand,
  ComposerAttachments,
  ComposerInput,
  ComposerOptions,
  ComposerOptionsOutlet,
  ComposerBump,
  ComposerBumpHandle,
  ComposerBumpContent,
  useComposer,
  useComposerBump,
  composerCardVariants,
  composerAddonVariants,
  composerBumpVariants,
  type ComposerProps,
  type ComposerCollapse,
  type ComposerContextValue,
  type ComposerAttachment,
  type ComposerAttachmentKind,
  type ComposerAttachOptions,
  type ComposerFileSource,
  type FileRejection,
  type ComposerCardProps,
  type ComposerAddonProps,
  type ComposerPillProps,
  type ComposerSelectProps,
  type ComposerSelectItem,
  type ComposerSelectChangeDetails,
  type ComposerSendProps,
  type ComposerStopProps,
  type ComposerAddProps,
  type ComposerExpandProps,
  type ComposerInputProps,
  type ComposerOptionsProps,
  type ComposerOptionsOutletProps,
  type ComposerBumpProps,
  type ComposerBumpContextValue,
  type ComposerBumpHandleProps,
  type ComposerBumpContentProps,
  type ComposerValueChangeDetails,
  type ComposerAttachmentsChangeDetails,
  type ComposerExpandedChangeDetails,
  type ComposerCollapsedChangeDetails,
  type ComposerBumpOpenChangeDetails,
} from './components/composer/composer';
export {
  ComposerCards,
  ComposerMorphCard,
  ComposerQueue,
  type ComposerCardsProps,
  type ComposerMorphCardProps,
  type ComposerQueueProps,
  type ComposerQueueItem,
  type ComposerQueueActions,
  type ComposerQueueItemsChangeDetails,
} from './components/composer/composer-cards';

// ── Chat: floating/artifact chat containers (ChatShell and the Discord-style parts live in the discord-clone block) ──
export {
  FloatingSheet,
  FloatingSheetBody,
  FloatingSheetFooter,
  FloatingSheetFab,
  useFloatingSheet,
  floatingSheetVariants,
  floatingSheetSurfaceVariants,
  floatingSheetFabVariants,
  type FloatingSheetProps,
  type FloatingSheetBodyProps,
  type FloatingSheetFooterProps,
  type FloatingSheetFabProps,
  type FloatingSheetContextValue,
  type FloatingSheetChangeDetails,
  type FloatingSheetMinimizedChangeDetails,
  type FloatingSheetMinimizedChangeReason,
  type FloatingSheetVariant,
  type FloatingSheetAppearance,
  type FloatingSheetCollapse,
  type FloatingSheetFabSide,
  type FloatingSheetFabAlign,
  type FloatingSheetSize,
} from './components/floating-sheet';
export {
  ArtifactChatContainer,
  ArtifactChatContainerContent,
  ArtifactChatContainerChat,
  ArtifactChatContainerComposer,
  useArtifactChatContainer,
  artifactChatContainerVariants,
  type ArtifactChatContainerProps,
  type ArtifactChatContainerContentProps,
  type ArtifactChatContainerContextValue,
  type ArtifactChatContainerOpenChangeDetails,
  type ArtifactChatComposingChangeDetails,
  type ArtifactChatComposingChangeReason,
  type ArtifactChatLayout,
  type ArtifactChatSide,
} from './components/artifact-chat-container';
export {
  ProgressStepper, ProgressStep, ProgressStepIcon, ProgressStepTrack, ProgressStepLabel, ProgressStepDescription, progressStepperVariants,
  type ProgressStepperProps, type ProgressStepProps, type ProgressStepItem, type ProgressStepState,
} from './components/progress-stepper';

// PencilKit — freehand drawing on perfect-freehand (formerly @brett_lamy/pencilkit)
export type {
  PencilTool,
  PencilDrawTool,
  PencilPoint,
  PencilStroke,
  PencilInk,
  PencilWidth,
} from './components/pencilkit/constants';
export { StrokePath } from './components/pencilkit/stroke-path';
export type { StrokePathProps } from './components/pencilkit/stroke-path';
export { PencilCanvas } from './components/pencilkit/pencil-canvas';
export type { PencilCanvasProps, PencilStrokesChangeDetails, PencilStrokesChangeReason } from './components/pencilkit/pencil-canvas';
export {
  PencilToolbar,
  PencilToolbarPinned,
  PencilToolPicker,
  PencilInkPicker,
  PencilWidthPicker,
  PencilActions,
} from './components/pencilkit/pencil-toolbar';
export type {
  PencilToolbarProps,
  PencilToolbarPinnedProps,
  PencilToolPickerProps,
  PencilInkPickerProps,
  PencilWidthPickerProps,
  PencilActionsProps,
  PencilPickerPresentation,
} from './components/pencilkit/pencil-toolbar';
export { usePencilHistory } from './components/pencilkit/use-pencil-history';
export type { PencilHistory } from './components/pencilkit/use-pencil-history';
export { PencilKitAnnotator } from './components/pencilkit/pencilkit-annotator';
export { ImageAnnotator, ImageAnnotatorProvider } from './components/pencilkit/image-annotator';
export type {
  ImageAnnotatorProps, ImageAnnotatorProviderProps, ImageAnnotatorEngine, ImageAnnotatorEngineProps, ImageAnnotatorSurface,
} from './components/pencilkit/image-annotator';

// ── feedback, media and morph primitives ──
export {
  ToastRegion, Toast, ToastIcon, ToastTitle, ToastDescription, ToastAction, ToastClose, ToastProvider, toast, createToaster, hud, createHud,
  useToast, toastRegionVariants, toastVariants, toastIconVariants,
} from './components/toast';
export type {
  ToastRegionProps, ToastProps, ToastIconProps, ToastVariant, ToastExtras, Hud, Toaster, ToastData, ToastOptions, ToastType, ToastItem,
  ToastState, ToastRegionState, ToastActionData, ToastCancel, ToastDismissDetails, ToastDismissReason,
} from './components/toast';
export { ProgressRing, CountdownRing, useCountdown, progressRingVariants, countdownRingValueVariants } from './components/progress-ring';
export type { ProgressRingProps, ProgressRingSize, ProgressRingTone, CountdownRingProps, UseCountdownOptions, Countdown } from './components/progress-ring';
// ReplayPreview lives in docstream; re-exported here (see components/replay-preview.tsx)
export { ReplayPreview } from './components/replay-preview';
export type {
  ReplayPreviewProps, ReplayPreviewHandle, ReplaySource, ReplayChrome, ReplayEvent, ReplayMarker, ReplayMarkerKind,
  ReplayDevtools, ReplayDevtoolsTab, ReplayInspection, ReplayInspectionTab,
} from './components/replay-preview';
// The STL viewer and the Strudel player live in docstream; re-exported here (see components/stl-viewer.tsx, strudel-player.tsx)
export { StlViewer } from './components/stl-viewer';
export type { StlViewerProps } from './components/stl-viewer';
export { StrudelPlayer, playStrudel, stopStrudel, updateStrudel, subscribeStrudel, getStrudelSnapshot } from './components/strudel-player';
export type { StrudelPlayerProps, StrudelSnapshot } from './components/strudel-player';
export { NowPlayingBars } from './components/now-playing-bars';
export type { NowPlayingBarsProps } from './components/now-playing-bars';
export { MorphGroup, Morph, MorphPresence, useMorphTransition } from './components/morph';
export type { MorphGroupProps, MorphProps, MorphPresenceProps } from './components/morph';
export { encodeQR } from './lib/qr';
export type { QRMatrix, QRLevel, QROptions } from './lib/qr';
export {
  CommandMenu, CommandMenuInput, CommandMenuList, CommandMenuPage, CommandMenuGroup, CommandMenuGroupLabel, CommandMenuItem,
  CommandMenuItemIcon, CommandMenuItemText, CommandMenuItemDescription, CommandMenuShortcut, CommandMenuItems, CommandMenuEmpty,
  CommandMenuStatus, CommandMenuSeparator, CommandMenuFooter, CommandMenuDialog, CommandMenuDialogContent,
  createCommandMenuController, useCommandMenu, useCommandMenuValue,
} from './components/command-menu';
export type {
  CommandMenuProps, CommandMenuInputProps, CommandMenuListProps, CommandMenuPageProps, CommandMenuGroupProps, CommandMenuItemProps, CommandMenuEmptyProps,
  CommandMenuFooterProps, CommandMenuLegendItem, CommandMenuDialogProps, CommandMenuDialogContentProps, CommandMenuController,
  CommandMenuState, CommandMenuData, CommandMenuDataItem, CommandMenuDataGroup,
} from './components/command-menu';

// ── AI transcript parts (used by the Composer, ArtifactChatContainer and several blocks) ──
export {
  Conversation, ConversationEmpty, ConversationMessages, ConversationComposer, ConversationSuggestions, ConversationSuggestion,
  ConversationUserMessage, ConversationAssistantMessage, ConversationMarkdown, ConversationTyping, ConversationWorkLog, ConversationToolCall,
  type ConversationProps, type ConversationEmptyProps, type ConversationMessagesProps, type ConversationComposerProps,
  type ConversationSuggestionsProps, type ConversationSuggestionProps, type ConversationAssistantMessageProps, type ConversationUserMessageProps, type ConversationMarkdownProps, type ConversationTypingProps,
  type ConversationWorkLogProps, type ConversationToolCallProps,
} from './components/conversation';

// ── Calendar / DateInput / DatePicker / ColorPicker ──
export {
  Calendar, CalendarHeader, CalendarHeading, CalendarPrevious, CalendarNext, CalendarMonthSelect, CalendarYearSelect,
  CalendarMonths, CalendarGrid, CalendarWeekdays, CalendarWeekday, CalendarWeeks, CalendarDay, calendarVariants, createCalendarController,
  type CalendarProps, type CalendarMonthsProps, type CalendarDayProps, type CalendarController, type CalendarDayState, type CalendarGridCell,
  type CalendarMode, type CalendarValue, type DateMatcher, type DateMatchers,
} from './components/calendar';
export {
  DateInput, DateInputSegment, TimeInput, TimeInputSegment, dateInputVariants, createDateInputController, createTimeInputController,
  type DateInputProps, type TimeInputProps, type DateInputController, type TimeInputController, type DateInputSegmentData, type DateInputState,
} from './components/date-input';
export {
  DatePicker, DatePickerInputGroup, DatePickerInput, DatePickerTrigger, DatePickerClear, DatePickerHint, DatePickerPreset, DatePickerContent,
  datePickerInputGroupVariants, createDatePickerController,
  type DatePickerProps, type DatePickerInputGroupProps, type DatePickerContentProps, type DatePickerController, type DatePickerMode, type DatePickerValue,
} from './components/date-picker';
export {
  ColorPicker, ColorPickerTrigger, ColorPickerContent, ColorPickerArea, ColorPickerAreaThumb, ColorPickerAreaCanvas,
  ColorPickerSlider, ColorPickerSliderThumb, ColorPickerSwatches, ColorPickerSwatchItem, ColorPickerInputGroup, ColorPickerInput,
  ColorPickerChannelInput, ColorPickerSwatch, ColorPickerEyeDropper, ColorInput, ColorSwatch, colorPickerTriggerVariants,
  createColorPickerController,
  type ColorPickerProps, type ColorPickerTriggerProps, type ColorPickerContentProps, type ColorPickerSliderProps,
  type ColorPickerInputGroupProps, type ColorInputProps, type ColorSwatchProps, type ColorPickerController,
} from './components/color-picker';
export {
  FontPicker, FontPickerTrigger, FontPickerContent, FontList, FontStackPicker, FontStackPickerInputGroup, FontStackPickerContent,
  fontStackPickerInputGroupVariants,
  type FontPickerProps, type FontPickerTriggerProps, type FontPickerContentProps, type FontListProps, type FontStackPickerProps,
  type FontStackPickerInputGroupProps, type FontStackPickerContentProps, type FontPickerFormProps,
  type FontPickerChangeDetails, type FontPickerReason,
} from './components/font-picker';
export {
  GOOGLE_FONTS, findGoogleFont, fontStack, loadGoogleFont, useGoogleFont, useGoogleFontStatus,
  type GoogleFont, type FontCategory, type GoogleFontOptions, type GoogleFontStatus,
} from './lib/google-fonts';

// ── NaturalTimeInput / CronEditor ──
export { NaturalTimeInput, type NaturalTimeInputProps, type NaturalTimeInputChange, type NaturalTimeInputParseOptions } from './components/natural-time-input';
export { CronEditor, CRON_PRESETS, type CronEditorProps, type CronPreset, type CronEditorChangeDetails, type CronEditorChangeReason } from './components/cron-editor';
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
export {
  VaultGate, VaultUnlock, VaultSetup, VaultUnsupported, VaultStatusBadge, VaultEnrollDialog, VaultRecoveryKey, vaultRecoveryKeyVariants,
  unsupportedMessage,
} from './components/vault-gate';
export type {
  VaultGateProps, VaultUnlockProps, VaultSetupProps, VaultUnsupportedProps, VaultStatusBadgeProps, VaultEnrollDialogProps,
  VaultRecoveryKeyProps,
} from './components/vault-gate';

// ── PGlite ──
export {
  PGliteProvider, usePGlite, useReadyDatabase, useDatabaseStatus, useQuery, useLiveQuery, useExec, useTransaction,
} from './lib/pglite';
export type {
  PGliteProviderProps, DatabaseState, DatabaseStatus, QueryState, UseQueryOptions, LiveQueryState, UseLiveQueryOptions, MutationState,
} from './lib/pglite';
export {
  openDatabase, runMigrations, runSql, toSqlError, peekDataDirVersion, deleteDatabase,
  PGliteError, DataDirVersionError, MigrationError,
} from './lib/pglite-core';
export type {
  Database, DatabaseInfo, OpenDatabaseOptions, OpenedDatabase, PGliteAssets, Migration, MigrationOptions, MigrationResult,
  MigrationErrorKind, PGliteErrorCode, ParsedDataDir, DataDirKind, RunOutcome, StatementResult, SqlError, SqlField, SqlResult,
  SqlRunner, SqlTransaction, LiveNamespace, LiveQueryHandle,
} from './lib/pglite-core';
export { useTabLock, SingleTabGate } from './lib/tab-lock';
export type { TabLock, TabLockStatus, SingleTabGateProps } from './lib/tab-lock';
export {
  exportDatabase, importDatabase,
} from './lib/pglite-transfer';
export type { ExportFormat, ExportOptions, ExportResult, ImportResult } from './lib/pglite-transfer';
export { downloadFile, pickFile } from './lib/pglite-files';
export { loadSchema, useSchema, schemaTreeItems } from './lib/pglite-schema';
export type {
  SchemaInfo, SchemaNode, SchemaTable, SchemaColumn, ColumnReference, RelationKind, LoadSchemaOptions, UseSchemaState, SchemaTreeNode,
} from './lib/pglite-schema';
export { usePersistenceSupport } from './lib/pglite-storage';
export type { PersistenceSupport } from './lib/pglite-storage';
export {
  SqlConsole, SqlConsoleHeader, SqlConsoleDatabaseMenu, SqlConsoleSidebar, SqlConsoleEditor, SqlConsoleEditorFooter, SqlConsoleEditorRun,
  SqlConsoleResults, useSqlHistory,
} from './components/sql-console';
export type {
  SqlConsoleProps, SqlConsoleHeaderProps, SqlConsoleEditorProps, SqlConsoleEditorFooterProps, SqlConsoleEditorRunProps, SqlConsoleEditorHandle,
  SqlHistory,
} from './components/sql-console';

// Spreadsheet: a virtualized grid with GPU sorting and histograms, and the CSV reader it pairs with
export { Spreadsheet, spreadsheetVariants, createSpreadsheetController } from './components/spreadsheet';
export type {
  SpreadsheetProps, SpreadsheetController, SpreadsheetSortInfo, SpreadsheetSortChangeReason, SpreadsheetValueChangeReason, SpreadsheetColumnWidthsChangeReason,
} from './components/spreadsheet';
export {
  parseCellNumber, parseCellDate, columnNumbers, sortKeys, sortPermutationCpu, sortRows,
  selectionStats, columnHistogram,
} from './lib/spreadsheet-model';
export type {
  SpreadsheetColumnType, SpreadsheetSortDirection, SpreadsheetSort, SpreadsheetEngine, SpreadsheetRanOn, SpreadsheetSortResult,
  SpreadsheetEngineOptions, SelectionStats, SpreadsheetHistogram,
} from './lib/spreadsheet-model';
export { parseCsv, stringifyCsv, delimiterForPath } from './lib/csv';
export type { CsvDelimiter, CsvFormat, CsvParseResult, CsvParseOptions } from './lib/csv';


// ── Filters ──
export {
  coerceFilter, createFilter, dateRange, defaultOperator, describeFilter, describeValue,
  matchFilters, matchesFilters, operatorLabel, operatorsFor, parseFilters, serializeFilters, toTime,
  withOperator, withValue,
} from './lib/filter-model';
export type {
  DateValue, Filter, FilterField, FilterKind, FilterOperator, FilterOption, FilterValue, MatchOptions,
} from './lib/filter-model';
export {
  FilterBar, FilterToolbar, FilterMenu, FilterList, FilterChip, FilterClear, FilterMatch, FilterValueEditor, useFilters, useFilterBar, useOptionalFilterBar,
  filterChipVariants,
} from './components/filter';
export type {
  FilterBarProps, FilterToolbarProps, FilterMenuProps, FilterListProps, FilterChipProps, FilterClearProps, FilterMatchProps, FilterValueEditorProps,
  FilterBarContextValue, FilterState, FilterActions, UseFiltersOptions, FilterChangeDetails, FilterChangeReason, FilterMatchChangeDetails,
  FilterMatchChangeReason, FilterChangeOptions,
} from './components/filter';
export { FilterInput } from './components/filter-input';
export type { FilterInputProps } from './components/filter-input';
export {
  useFilterQuery, warmFilterQuery, interpretQuery, buildQuerySchema, clausesToFilters, matchOption, parseDateText,
} from './lib/filter-query';
export type { FilterQueryResult, UseFilterQueryOptions, Interpretation, Unresolved, QuerySchema, Trace } from './lib/filter-query';


// ── FileUpload ──
export {
  FileUpload, FileUploadDropzone, FileUploadTrigger, FileUploadList, FileUploadItem, FileUploadThumbnail, fileUploadDropzoneVariants, fileUploadItemVariants,
} from './components/file-upload';
export type {
  FileUploadProps, FileUploadDropzoneProps, FileUploadTriggerProps, FileUploadListProps, FileUploadItemProps, FileUploadThumbnailProps, FileUploadContextValue, FileUploadFilesHandler,
} from './components/file-upload';
export { xhrUpload, describeAccept, describeRules, fileKind, rejectionMessage } from './lib/file-upload-model';
export { formatFileSize } from './lib/file-size';
export type {
  UploadFile, UploadFn, UploadContext, UploadResult, FileStatus,
  FileUploadRules, RejectionReason, RejectionContext, RejectionMessages, XhrUploadOptions, FileKind,
} from './lib/file-upload-model';
export { fileUpload, createFileUploadController } from './lib/file-upload-primitive';
export type {
  FileUploadOptions, FileUploadController, FileUploadAddResult, FileUploadRootState,
  FileUploadValueChangeReason, FileUploadValueChangeDetails, FileUploadChangeOptions,
} from './lib/file-upload-primitive';
export { useFileUpload, useFilePreview } from './lib/use-file-upload';
export type { FileUploadState, FileUploadInputProps } from './lib/use-file-upload';



// ── Tailscale ──
export {
  createTailscale, tailscaleErrorMessage, TailscaleError,
  memoryTailscalePersistence, webStorageTailscalePersistence, vaultTailscalePersistence,
} from './lib/tailscale';
export type {
  Tailscale, TailscaleOptions, TailscaleSnapshot, TailscaleStatus, TailscaleAuth, TailscaleEnv, TailscalePopup, TailscalePeer,
  TailscaleClient, TailscaleClientEvent, TailscaleClientStartOptions, TailscaleClientState, TailscaleNetMap, TailscaleNode,
  TailscaleRequest, TailscaleResponse, TailscaleSession, TailscalePersistence, TailscaleVaultLike, TailscaleErrorReason,
} from './lib/tailscale';
export {
  resolveTailscalePolicy, matchTailscalePolicy,
  TailscalePolicyError,
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
export { registerTailscaleRouter } from './lib/tailscale-router/bridge';
export type {
  TailscaleRouterHandle, TailscaleRouterOptions, TailscaleRouterState, TailscaleRouterStatus, TailscaleRouteTarget,
  TailscaleRoutedRequest,
} from './lib/tailscale-router/bridge';
export { TailscaleRouter, useTailscaleRouter } from './lib/tailscale-router/react';
export type { TailscaleRouterProps, UseTailscaleRouterOptions } from './lib/tailscale-router/react';
export {
  TailscaleLoginButton, TailscaleStatusBadge, TailscaleMark, TailscaleSummary, TailscaleExitNodes, tailscaleStatusBadgeVariants,
} from './components/tailscale-controls';
export type {
  TailscaleLoginButtonProps, TailscaleLoginButtonLabels, TailscaleStatusBadgeProps, TailscaleSummaryProps,
  TailscaleExitNodesProps, TailscaleExitNodeLabels, TailscaleExitNodeState, TailscaleExitNodeChangeDetails,
} from './components/tailscale-controls';


// ── Video: FFmpeg, the timeline model, render, playback and the editing parts ──
export {
  createFfmpeg, ffmpegUnsupportedReason, FfmpegError, parseProbe, mediaFileName,
} from './lib/ffmpeg';
export type {
  Ffmpeg, FfmpegOptions, FfmpegJob, FfmpegResult, FfmpegProgress, FfmpegInput, FfmpegTool, FfmpegErrorCode, ProbeOptions,
  MediaInfo, MediaKind, VideoStreamInfo, AudioStreamInfo,
} from './lib/ffmpeg';
export { extractFrames, extractPeaks, frameTimes } from './lib/ffmpeg/media';
export type { MediaFrame, FramesOptions, MediaPeaks, PeaksOptions } from './lib/ffmpeg/media';
export {
  FfmpegProvider, useFfmpeg, useFfmpegSupport, useMediaInfo, useMediaFrames, useMediaPeaks, releaseMedia,
} from './lib/ffmpeg/react';
export type { FfmpegProviderProps, MediaFrameURL, AsyncResult } from './lib/ffmpeg/react';
export {
  clipDuration, clipEnd, sourceTime, timelineDuration, quantize, clipsAt,
  layoutTrack, updateClip, updateTrack, removeClips, splitClip, trimClip, moveClip, insertClip,
  sliceTimeline, snapTargets, snapTime, formatTimecode, parseTimecode,
} from './lib/video-timeline-model';
export type {
  Timeline, TimelineTrack, TimelineClip, TimelineFormat, TimelineLook, TrackKind, ClipFrame, TrimLimits, PlaceOptions,
} from './lib/video-timeline-model';
export { buildRender, renderTimeline } from './lib/video-render';
export type { RenderMedia, RenderContainer, RenderQuality, RenderOptions, RenderPlan, RenderTimelineOptions } from './lib/video-render';
export { createPlayback, usePlaybackClock, usePlaybackState } from './lib/playback';
export type { Playback, PlaybackState } from './lib/playback';
export { VideoTimeline, timelineMediaType, fitTimelineZoom } from './components/video-timeline';
export type {
  VideoTimelineProps, TimelineMediaInfo, TimelineDrop, TimelineDropDetails, VideoTimelineAction, VideoTimelineChangeDetails, VideoTimelineChangeReason,
  VideoTimelineSelectionReason, VideoTimelineZoomReason,
} from './components/video-timeline';
export { VideoPreview, VideoPreviewControls, VideoPreviewTimecode } from './components/video-preview';
export type { VideoPreviewProps, PreviewMedia, VideoPreviewControlsProps, VideoPreviewTimecodeProps } from './components/video-preview';
export { Filmstrip } from './components/filmstrip';
export type { FilmstripProps, FilmstripFrame } from './components/filmstrip';
export { Waveform, waveformVariants } from './components/waveform';
export type { WaveformProps } from './components/waveform';

export { TuiPreview } from './components/tui-preview';
export type { TuiPreviewProps, TuiPreviewOptions, TuiPreviewState, TuiTheme } from './components/tui-preview';
export { OpenCode, openCodeVariants } from './components/open-code';
export type { OpenCodeProps, OpenCodeBaseProps, OpenCodeHostProps, OpenCodeState } from './components/open-code';
export { createAlmostNodeOpenCodeHost, createAgentWasmOpenCodeHost } from './lib/open-code-host';
export type { OpenCodeHostBridge, OpenCodePort, OpenCodeWorkspaceBridge, OpenCodeProcessBridge, OpenCodeCommand, OpenCodeMcpServer, OpenCodeRuntime, OpenCodeRuntimeSession, AlmostNodeOpenCodeContainer, AlmostNodeOpenCodeOptions } from './lib/open-code-host';

export type { OpenCodeCredentialStore, OpenCodeConnectionStore, OpenCodeKeychainStore } from './lib/open-code-host';

export {
  Workspace, WorkspaceTab, WorkspaceTabTrigger, WorkspaceTabClose, WorkspaceToolbar, WorkspaceMaximize,
  createWorkspaceController,
} from './components/workspace';
export type {
  WorkspaceProps, WorkspaceTabProps, WorkspaceTabTriggerProps, WorkspaceTabCloseProps, WorkspaceToolbarProps, WorkspaceMaximizeProps,
  WorkspaceLayout, WorkspaceLayoutInput, WorkspaceNode, WorkspaceNodeInput, TabNode, TabsetNode, SplitNode,
  TabDropTarget, TabDropRegion, WorkspaceOrientation, WorkspaceTabSide, WorkspaceMinSize,
  WorkspaceController, WorkspaceChangeOptions, WorkspaceAction,
  WorkspaceLayoutChangeReason, WorkspaceLayoutChangeDetails, WorkspaceLayoutCommitDetails,
  WorkspaceState, WorkspaceTabsetState, WorkspaceTabState, WorkspaceTabContentState, WorkspaceClassNames, WorkspacePresentation,
} from './components/workspace';

// Debugging parts
export { DebugToolbar, DebugToolbarButton, debugToolbarActions } from './components/debug-toolbar';
export type { DebugToolbarAction, DebugToolbarActionDetails, DebugToolbarProps, DebugToolbarButtonProps } from './components/debug-toolbar';
export { TraceTimeline, TraceTimelinePreview, traceTimelineVariants } from './components/trace-timeline';
export type { TraceTimelineProps, TraceTimelinePreviewProps, TraceTimelineHandle, TraceValueChangeDetails, TraceValueChangeReason, TraceValueCommitDetails, TraceViewChangeDetails, TraceViewChangeReason, TracePickReason, TraceFocusedLaneChangeDetails, TraceSelectedThreadChangeDetails, TraceSelectedRequestChangeDetails, TraceDrawStats, TraceFetchActivity } from './components/trace-timeline';
export { linearAxis, stopAxis, advanceAlong, selectStops, formatTraceTime } from './lib/trace-timeline-model';
export type { TraceActivity, TraceAxis, TraceDensity, TraceDiamonds, TraceKey, TraceLane, TraceMarkSeries, TraceRange, TraceRequest, TraceScrubSpeed, TraceStop, TraceStopMark, TraceThread, TraceTone, TraceWindow } from './lib/trace-timeline-model';
export {
  CodeEditor, CodeEditorHeader, CodeEditorTitle, CodeEditorCopyButton, CodeEditorContent, useCodeEditor, SyntaxTokens, useSyntaxTokens,
  codeEditorVariants, codeEditorLineVariants, codeEditorGutterCellVariants,
} from './components/code-editor';
export type {
  CodeEditorProps, CodeEditorContentProps, CodeEditorCopyButtonProps, CodeEditorDisplayProps, CodeEditorLineNumbers, CodeEditorHandle, CodeEditorChangeReason, CodeEditorEdit, CodeEditorValueChangeDetails,
  CodeEditorSelectionChangeReason, CodeEditorSelectionChangeDetails, CodeEditorGutterClickDetails, CodeEditorMarkerClickDetails, CodeEditorCopy, CodeEditorGutter, CodeEditorMarker,
  CodeEditorLineDecoration, CodeEditorScrollOptions, CodeEditorScrollTarget, CodeEditorPosition, CodeEditorSelection, CodeEditorAlign, CodeHighlight, CodeHighlightContext, CodeLineRange,
  UseSyntaxTokensOptions, SyntaxTokensState,
} from './components/code-editor';
export { splitCodeLines, lexCodeLine, tooBigForPage, MAX_PAGE_LINES, MAX_PAGE_LINE_LENGTH, MAX_PAGE_CHARS } from './lib/code-editor-model';
export { splitEditorLines, lineAfterEdit } from './lib/code-document';
export { createGpuCodeHighlight } from './lib/code-editor-gpu';
export type { GpuCodeHighlightOptions } from './lib/code-editor-gpu';
export { ObjectTree } from './components/object-tree';
export type { ObjectTreeProps, ObjectTreeValueChangeDetails } from './components/object-tree';
export { ObjectValue } from './components/object-value';
export type { ObjectValueProps } from './components/object-value';
export { nodeFromValue, objectTreeKey } from './lib/object-tree-model';
export type { ObjectTreeGetterResult, ObjectTreeNode, ObjectTreeRoot } from './lib/object-tree-model';
export { copyTextOf, previewFromValue, previewText, previewTokens } from './lib/object-tree-value';
export type { ValueMapEntry, ValuePreview, ValuePreviewOptions, ValueProperty, ValueTokenType, ValueToken, ValueType } from './lib/object-tree-value';
export { CallStack } from './components/call-stack';
export type { CallStackProps, CallStackValueChangeDetails } from './components/call-stack';
export type { CallStackFrame, CallStackFrameKind, CallStackLocation } from './lib/call-stack-model';
export { LogList, LogListRowContent, logListVariants, createLogListController } from './components/log-list';
export type {
  LogListProps, LogListController, LogListActionDetails, LogListValueChangeReason, LogListExpandedChangeReason,
  LogListFollowingChangeReason, LogListRowContentProps, LogRowState,
} from './components/log-list';
export { LOG_LEVELS, countLogLevels, formatLogTime, logRowText, nodeText, normalizeLogLevel } from './lib/log-list-model';
export type { LogLevel, LogLevelCounts, LogRow, RowId } from './lib/log-list-model';
export { DataTable, DataTableCell, dataTableVariants, createDataTableController } from './components/data-table';
export type {
  DataTableProps, DataTableColumn, DataTableDensity, DataTableOverlayState, DataTableRowAttributes, DataTableRow, DataTableController,
  DataTableActionDetails, DataTableValueChangeReason, DataTableSortChangeReason, DataTableColumnWidthsChangeReason, DataTableBreakpoints,
  DataTableColumnSize, DataTableSort, DataTableSortDirection, DataTableSortValue, DataTableTimeRange,
} from './components/data-table';
export { sortDataTableRows } from './lib/data-table-model';
export { RequestTableLink, RequestTable, REQUEST_COLUMNS } from './components/request-table';
export type { RequestColumnId, RequestTableLinkProps, RequestTableProps } from './components/request-table';
export { isRequestFailed, requestDurationText, requestName, requestSizeText, requestStatusText, requestTimeRange } from './lib/request-table-model';
export type { RequestRow, RequestTone } from './lib/request-table-model';
export { Terminal, terminalVariants } from './components/terminal';
export type { TerminalProps, TerminalHandle } from './components/terminal';
export { createTerminalShell, applyKey, applyCompletion, readKeys, renderLine } from './lib/terminal-line';
export type { TerminalCommandHandler, TerminalCommandIO, TerminalCompleter, TerminalShell, TerminalShellOptions, TerminalSink } from './lib/terminal-line';
