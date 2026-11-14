import './styles.css';

// lib
export { cn, FONT, BARH, pressable, brandTile } from './lib/utils';
export {
  springs, springCss, direction, useDirection, fades, useSpringTransition, useReducedMotion, type SpringName,
  prefersReducedMotion, flipSnapshot, flipPlay, type FlipSnapshot,
} from './lib/motion';
export { usePresence, usePresenceList, useEnterExit } from './lib/presence';
export type { Presence, PresenceEntry, PresenceOptions } from './lib/presence';
export { TextMorph } from './components/text-morph';
export type { TextMorphProps } from './components/text-morph';
export { NumberMorph } from './components/number-morph';
export type { NumberMorphProps } from './components/number-morph';
export { IconSwap, Chevron } from './components/icon-swap';
export type { IconSwapProps, ChevronProps, ChevronDirection } from './components/icon-swap';
export { AnimatedHeight, ContentSwap } from './components/animated-height';
export { Canvas, CanvasFrame, CanvasHandles, CanvasMarquee, CanvasGuides, CanvasMiniMap, useCanvas, createCanvasController } from './components/canvas';
export type {
  CanvasProps, CanvasPointerInfo, CanvasContextValue, CanvasController, CanvasFitOptions, CanvasViewportChangeDetails, CanvasViewportReason,
  CanvasFrameProps, CanvasMiniMapProps, CanvasMiniMapItem,
} from './components/canvas';
export {
  toBoard, toScreen, MIN_SIZE,
  rotatePt, centerOf, dist, cornersOf, rectOf, unionRect, intersects, inFrame, distToSegment, distToPolyline,
  frameHandles, handleCursor, resizeFrame, rotateFrame, snapMove, HANDLE_DIR, ALL_HANDLES, EDGE_HANDLES,
} from './lib/canvas-math';
export type { Viewport, Frame, Guide, Handle, HandleId, Pt, Rect } from './lib/canvas-math';
export type { AnimatedHeightProps, ContentSwapProps } from './components/animated-height';
export { Celebrate } from './components/celebrate';
export type { CelebrateProps } from './components/celebrate';
export {
  BLProvider, BLSafeCtx, BLStickyCtx, chromeStore, useChromeHidden, chromeOffset,
  AppearanceContext, AppearanceProvider, useAppearance,
  ThemeScope, ThemeScopeContext, useThemeScopeProps, themeScopeProps, themeScopeClass, tintVars, themeVarStyle, readThemeVars, THEME_VARS,
  useLayerHost,
} from './lib/theme';
export type { BLProviderProps, Appearance, ThemeScopeProps, ThemeScopeName, ThemeScopeState, ThemeVars, ThemeVar } from './lib/theme';
export { useContainerWidth, useContainerSize, useSizeClass, useSizeClassScope, SizeClassProvider, usePresentation, useMountPresentationKey, defineSlot, collectSlots } from './lib/container';
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
export { bindScrollEdge } from './lib/scroll-edge';
export type { BindScrollEdgeOptions } from './lib/scroll-edge';
export { LocalStreams, StreamFullError, pack, unpack } from './lib/append-stream';
export { DurableStreamsClient, CloudSync, useCloud, deviceId } from './lib/durable-streams';
export type { DurableStreamsConfig, CloudSettings, CloudStatus } from './lib/durable-streams';
export { useSessionRecording, startSessionRecording, useSessions, useSessionCloud, sessionCloud, readSession, deleteSession, clearSessions, currentSessionId, storageUsage } from './lib/session-recorder';
export type { SessionInfo, SessionRecordingOptions, RecordedEvent, IndexRecord } from './lib/session-recorder';
export { usePersistentState, loadJSON, saveJSON } from './lib/persistent-state';
export { useControllableChange } from './lib/controllable-state';
export type { SlotComponent, SlotProps, ContainerSize, UseSizeClassOptions } from './lib/container';
export { Icon, IC, ICON_NAMES, ICON_ALIASES, ICON_CATEGORIES, ICON_KEYWORDS, ICON_WEIGHTS } from './lib/icon';
export type { IconProps, IconName, IconCanonicalName, IconShape, IconWeight, IconCategory } from './lib/icon';

// components
export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, avatarVariants, avatarStatusVariants, avatarGroupVariants } from './components/avatar';
export type { AvatarProps, AvatarGroupProps, AvatarStatus } from './components/avatar';
export { Switch, SwitchThumb, createSwitchController } from './components/switch';
export type { SwitchProps } from './components/switch';
export { Segmented, SegmentedItem, createSegmentedControlController } from './components/segmented';
export type { SegmentedProps, SegmentedItemProps } from './components/segmented';
export { Spinner, spinnerAnimations } from './components/spinner';
export type { SpinnerProps, SpinnerAnimation, SpinnerVariant, SpinnerAnimationInfo } from './components/spinner';
export { SearchField } from './components/search-field';
export type { SearchFieldProps, SearchFieldSubmitDetails } from './components/search-field';
export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';
export { QRSvg } from './components/qr-svg';
export type { QRSvgProps } from './components/qr-svg';
export { List, ListSection, ListRow, listRowVariants, createListRowController } from './components/list';
export type {
  ListProps, ListSectionProps, ListRowProps, ListRowAction, ListRowActionDetails, ListRowActionReason, ListRowController,
  ListRowFullSwipe, ListSectionOrderChangeDetails, ListSectionOrderChangeReason,
} from './components/list';
export { IndexBar, AL, indexBarVariants } from './components/index-bar';
export type { IndexBarProps, IndexBarItem, IndexBarKey, IndexBarJumpReason } from './components/index-bar';
export { TabBar } from './components/tab-bar';
export type { TabBarProps, TabBarItem } from './components/tab-bar';
export {
  TabView, TabViewBar, TabViewList, TabViewTab, TabViewIndicator, TabViewPill, TabViewSeparator, TabViewAction,
  TabViewHeader, TabViewFooter, TabViewPanels, TabViewPanel, useTabView, useTabViewTab,
  tabViewVariants, tabViewBarVariants, tabViewListVariants, tabViewTabVariants, tabViewIndicatorVariants,
  tabViewPillVariants, tabViewActionVariants,
} from './components/tab-view';
export type {
  TabViewProps, TabViewBarProps, TabViewListProps, TabViewTabProps, TabViewIndicatorProps, TabViewPillProps,
  TabViewSeparatorProps, TabViewActionProps, TabViewPanelProps,
  TabViewPlacement, TabViewOrientation, TabViewBarVariant,
} from './components/tab-view';
export { EditBar } from './components/edit-bar';
export type { EditBarProps } from './components/edit-bar';
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
  SplitView, SplitViewSidebar, SplitViewSupplementary, SplitViewDetail, SplitViewHeader, SplitViewContent, SplitViewToggle,
  SplitViewItem, SplitViewEmpty, useSplitView, useSplitViewColumn, useSplitViewBack,
  SplitViewSection, SplitViewStack, useSplitViewStack, splitViewItemVariants, splitViewSectionLabelVariants,
  createSplitViewController, createSplitViewStackController,
} from './components/split-view';
export type {
  SplitViewProps, SplitViewColumnProps, SplitViewHeaderProps, SplitViewToggleProps, SplitViewItemProps, SplitViewEmptyProps,
  SplitViewState, SplitViewContextValue, SplitViewColumn, SplitViewSizeClass, SplitViewSidebarBehavior, SplitViewValue,
  SplitViewSectionProps, SplitViewStackProps, SplitViewStackApi, SplitViewItemTint,
  SplitViewController, SplitViewColumnWidths, SplitViewDefaultSidebarOpen, SplitViewColumnState, SplitViewItemState, SplitViewHeaderState,
  SplitViewSidebarOpenChangeDetails, SplitViewSidebarOpenChangeReason, SplitViewValueChangeDetails, SplitViewValueChangeReason,
  SplitViewCompactColumnChangeDetails, SplitViewCompactColumnChangeReason, SplitViewSupplementaryOpenChangeDetails,
  SplitViewSupplementaryOpenChangeReason, SplitViewColumnWidthsChangeDetails, SplitViewColumnWidthsChangeReason,
  SplitViewStackPagesChangeDetails, SplitViewStackPagesChangeReason, SplitViewStackController,
} from './components/split-view';
export {
  Credenza,
  CredenzaTrigger,
  CredenzaBackdrop,
  CredenzaContent,
  CredenzaHeader,
  CredenzaBack,
  CredenzaTitle,
  CredenzaClose,
  CredenzaView,
  createCredenzaController,
  credenzaVariants,
} from './components/credenza';
export type { CredenzaProps, CredenzaContentProps, CredenzaBackProps, CredenzaViewProps, CredenzaController } from './components/credenza';
export { SideDrawer, sideDrawerVariants, sideDrawerPageClass, createSideDrawerController, sideDrawerPresentation } from './components/side-drawer';
export type {
  SideDrawerProps, SideDrawerController, SideDrawerOpenChangeDetails, SideDrawerOpenChangeReason, SideDrawerPresentation,
} from './components/side-drawer';
export { AdaptivePane, createAdaptivePaneController } from './components/adaptive-pane';
export {
  Sidebar, SidebarProvider, SidebarHeader, SidebarContent, SidebarFooter, SidebarWorkspace, SidebarSearch,
  SidebarSection, SidebarItem, SidebarTrigger, SidebarInset, SidebarNav, useSidebar, useSidebarCollapsed, SIDEBAR_ICONS,
  createSidebarController,
} from './components/sidebar';
export type {
  SidebarContextValue, SidebarProviderProps, SidebarVariant, SidebarProps, SidebarWorkspaceProps, SidebarSearchProps,
  SidebarSectionProps, SidebarItemProps, SidebarNavProps, SidebarController, SidebarOpenChangeDetails, SidebarOpenChangeReason,
} from './components/sidebar';
export type {
  AdaptivePaneProps, AdaptivePanePresentation, AdaptivePaneController, AdaptivePaneOpenChangeDetails,
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
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants } from './components/card';
export type { CardProps } from './components/card';
export { Separator, separatorVariants } from './components/separator';
export type { SeparatorProps } from './components/separator';
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
  ScrollAreaProps, ScrollAreaViewportProps, ScrollAreaScrollbarProps, ScrollAreaThumbProps, ScrollAreaScrollToEndProps,
} from './components/scroll-area';
export { Input, inputVariants, createInputController } from './components/input';
export type { InputProps, InputController } from './components/input';
export { Textarea, textareaVariants } from './components/textarea';
export type { TextareaProps } from './components/textarea';
export { MarkdownEditor, markdownEditorVariants, looksLikeMarkdown, insertMarkdown } from './components/markdown-editor';
export type {
  MarkdownEditorProps, MarkdownEditorHandle, MarkdownEditorInstance, MarkdownEditorAttachment, MarkdownEditorClassNames,
  MarkdownEditorValueChangeDetails, MarkdownEditorValueChangeReason,
} from './components/markdown-editor';
export { Field, FieldLabel, FieldDescription, FieldError, FieldSet, FieldLegend, FieldGroup, FieldControl, useFieldControl } from './components/field';
export type { FieldLabelProps } from './components/field';
export { Checkbox, CheckboxIndicator, CheckboxGroup, checkboxVariants, createCheckboxController, createCheckboxGroupController } from './components/checkbox';
export type { CheckboxProps, CheckboxIndicatorProps, CheckboxGroupProps } from './components/checkbox';
export { RadioGroup, Radio, RadioIndicator, radioGroupVariants, radioVariants, createRadioGroupController } from './components/radio-group';
export type { RadioGroupProps, RadioProps } from './components/radio-group';
export { Toggle, ToggleIcon, toggleVariants, createToggleController } from './components/toggle';
export type { ToggleProps } from './components/toggle';
export { ToggleGroup, ToggleGroupItem, toggleGroupVariants, createToggleGroupController } from './components/toggle-group';
export type { ToggleGroupProps, ToggleGroupItemProps } from './components/toggle-group';
export {
  Tabs, TabsList, TabsTab, TabsTabIcon, TabsPanel, tabsListVariants, tabsTabVariants, tabsIndicatorVariants,
  createTabsController,
} from './components/tabs';
export type {
  TabsProps, TabsListProps, TabsTabProps, TabsTabIconProps, TabsPanelProps, TabsController, TabsValueChangeReason,
} from './components/tabs';
export {
  Dialog, DialogTrigger, DialogBackdrop, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
  DialogClose, dialogVariants, createDialogController,
  AlertDialog, AlertDialogTrigger, AlertDialogBackdrop, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogClose, alertDialogCloseVariants, createAlertDialogController, createConfirm,
} from './components/dialog';
export type {
  DialogProps, DialogContentProps, DialogController,
  AlertDialogProps, AlertDialogContentProps, AlertDialogFooterProps, AlertDialogCloseProps, AlertDialogController,
} from './components/dialog';
export {
  Sheet, SheetTrigger, SheetBackdrop, SheetContent, SheetHandle, SheetHeader, SheetTitle, SheetDescription, SheetBody,
  SheetFooter, SheetClose, sheetVariants, createSheetController,
} from './components/sheet';
export type { SheetProps, SheetContentProps, SheetController } from './components/sheet';
export {
  Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverTitle, PopoverDescription, PopoverClose,
  popoverContentVariants, createPopoverController,
} from './components/popover';
export type { PopoverProps, PopoverContentProps, PopoverController } from './components/popover';
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuGroup, DropdownMenuGroupLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuItems, dropdownMenuItemVariants, createMenuController,
} from './components/dropdown-menu';
export type {
  DropdownMenuProps, DropdownMenuTriggerProps, DropdownMenuContentProps, DropdownMenuItemProps, DropdownMenuCheckboxItemProps,
  DropdownMenuRadioGroupProps, DropdownMenuRadioItemProps, DropdownMenuGroupProps, DropdownMenuSubProps, DropdownMenuSubTriggerProps,
  MenuController, MenuData, MenuDataItem,
} from './components/dropdown-menu';
export {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioGroup,
  ContextMenuRadioItem, ContextMenuGroup, ContextMenuGroupLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub,
  ContextMenuSubTrigger, ContextMenuSubContent,
} from './components/context-menu';
export type { ContextMenuProps, ContextMenuTriggerProps, ContextMenuContentProps } from './components/context-menu';
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
  Combobox, ComboboxLabel, ComboboxInput, ComboboxContent, ComboboxList, ComboboxEmpty, ComboboxItem, ComboboxGroup,
  ComboboxGroupLabel, ComboboxSeparator, ComboboxChip, ComboboxChipRemove, ComboboxStatus, createComboboxController,
} from './components/combobox';
export type {
  ComboboxProps, ComboboxLabelProps, ComboboxInputProps, ComboboxContentProps, ComboboxItemProps, ComboboxChipProps, ComboboxController,
} from './components/combobox';
export { Slider, SliderValue, SliderControl, SliderTrack, SliderIndicator, SliderThumb, sliderVariants, createSliderController } from './components/slider';
export type { SliderProps, SliderTone } from './components/slider';
export {
  Listbox, ListboxItem, ListboxGroup, ListboxGroupLabel, ListboxSeparator, listboxVariants, listboxItemVariants, createListboxController,
} from './components/list-box';
export type { ListboxProps, ListboxItemProps, ListData, ListboxController } from './components/list-box';
export {
  Tree, TreeItem, TreeItemLabel, TreeItemIndicator, TreeItemCheckbox, TreeGroup, treeVariants, treeRowVariants,
  createTreeController, treeFromPaths, visibleTreeRows, TreeFolderIcon, TreeFileIcon,
} from './components/tree';
export type {
  TreeProps, TreeNode, TreeDensity, TreeDropTarget, TreeGitStatus, TreeEditDetails, TreeEditingChangeDetails, TreeController, TreeItemData, TreeMode,
} from './components/tree';
export {
  Disclosure, DisclosureTrigger, DisclosurePanel,
  DisclosureGroup, DisclosureGroupItem, DisclosureGroupHeader, DisclosureGroupTrigger, DisclosureGroupPanel,
  disclosureGroupVariants,
  createCollapsibleController, createAccordionController,
} from './components/disclosure';
export type {
  DisclosureProps, DisclosureTriggerProps, DisclosurePanelProps,
  DisclosureGroupProps, DisclosureGroupItemProps, DisclosureGroupHeaderProps, DisclosureGroupTriggerProps,
  DisclosureGroupPanelProps,
} from './components/disclosure';
export { Progress, ProgressLabel, ProgressValue, ProgressTrack, ProgressIndicator, progressVariants, progressIndicatorVariants } from './components/progress';
export type { ProgressProps } from './components/progress';
export { Form } from './components/form';
export { lexSyntax, webgpuSupported, probeWebGPU, languageFromPath, tokenizeLines } from './lib/syntax';
export type { CodeToken, CodeTokenType, SyntaxToken, SyntaxTokenType, SyntaxSpan, SyntaxHighlighter, SyntaxResult, SyntaxEngine, WebGPUProbe } from './lib/syntax';
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
  type ComposerOutletProps,
  type ComposerCardProps,
  type ComposerAddonProps,
  type ComposerButtonProps,
  type ComposerSelectProps,
  type ComposerSelectOption,
  type ComposerSelectChangeDetails,
  type ComposerMenuItemProps,
  type ComposerSendProps,
  type ComposerStopProps,
  type ComposerInputProps,
  type ComposerBumpProps,
  type ComposerBumpProgress,
  type ComposerBumpContextValue,
  type ComposerBumpHandleProps,
  type ComposerBumpContentProps,
  type ComposerValueChangeReason,
  type ComposerValueChangeDetails,
  type ComposerAttachmentsChangeReason,
  type ComposerAttachmentsChangeDetails,
  type ComposerExpandedChangeReason,
  type ComposerExpandedChangeDetails,
  type ComposerCollapsedChangeReason,
  type ComposerCollapsedChangeDetails,
  type ComposerBumpOpenChangeReason,
  type ComposerBumpOpenChangeDetails,
  type ComposerBumpMinimizedChangeReason,
  type ComposerBumpMinimizedChangeDetails,
  type AnnotateLightboxProps,
} from './components/composer/composer';
export {
  ComposerAnnotatorProvider,
  useComposerAnnotator,
  type ComposerAnnotator,
  type ComposerAnnotatorProps,
  type ComposerAnnotatorSurface,
} from './components/composer/annotator';
export {
  WbPopoverContent, useSurfacePalette, type WbPopoverContentProps, type SurfacePalette,
} from './components/composer/composer-popover';
export {
  ComposerCards,
  ComposerMorphCard,
  ComposerQueue,
  type ComposerCardsProps,
  type ComposerMorphCardProps,
  type ComposerQueueProps,
  type ComposerQueueItem,
  type ComposerQueueActions,
  type ComposerQueueItemsChangeReason,
  type ComposerQueueItemsChangeDetails,
} from './components/composer/composer-cards';

// ── Chat: floating/artifact chat containers (ChatShell and the Discord-style parts live in the discord-clone block) ──
export {
  FloatingSheet,
  useFloatingSheet,
  useHideOnScroll,
  type FloatingSheetChangeDetails,
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
  type FloatingChatOpenChangeDetails,
  type FloatingChatOpenChangeReason,
  type FloatingChatMinimizedChangeDetails,
  type FloatingChatMinimizedChangeReason,
  type FloatingChatComposingChangeDetails,
  type FloatingChatComposingChangeReason,
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
export type { PencilCanvasProps, PencilStrokesChangeDetails, PencilStrokesChangeReason } from './components/pencilkit/pencil-canvas';
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
  ToastRegion, Toast, ToastIcon, ToastTitle, ToastDescription, ToastAction, ToastClose, ToastProvider, toast, createToaster, hud, createHud,
  useToast, toastRegionVariants, toastVariants, toastIconVariants,
} from './components/toast';
export type {
  ToastRegionProps, ToastProps, ToastIconProps, ToastVariant, ToastExtras, Hud, Toaster, ToastData, ToastOptions, ToastType, ToastItem,
  ToastState, ToastRegionState, ToastActionData, ToastCancel, ToastDismissDetails, ToastDismissReason,
} from './components/toast';
export { ProgressRing, CountdownRing, useCountdown, progressRingVariants, countdownRingLabelVariants } from './components/progress-ring';
export type { ProgressRingProps, ProgressRingTone, CountdownRingProps, CountdownRingLabelSize, UseCountdownOptions, Countdown } from './components/progress-ring';
// ReplayPreview lives in docstream; re-exported here (see components/replay-preview.tsx)
export {
  ReplayPreview, formatReplayTime, replayDemoEvents, getReplayMarkers, getReplayMeta, getReplayPointerTrack, replayPointerAt,
  getReplayDevtools, replayDevtoolsAt, ReplayStage, preloadReplayStage,
} from './components/replay-preview';
export type {
  ReplayPreviewHandle, ReplayPreviewProps, ReplayEvent, ReplayMarker, ReplayMarkerKind, ReplayMeta, ReplayPointerTrack,
  ReplayConsoleEntry, ReplayConsoleLevel, ReplayDevtools, ReplayDevtoolsState, ReplayDevtoolsTab, ReplayRequest,
  ReplayStageHandle, ReplayStageLayout, ReplayStageProps,
} from './components/replay-preview';
// The STL viewer lives in docstream; re-exported here (see components/stl-viewer.tsx)
export { StlViewer, parseStl, isStlUrl } from './components/stl-viewer';
export type { StlViewerProps, StlMesh } from './components/stl-viewer';
// The Strudel player, rack and syntax tree live in docstream; re-exported here (see components/strudel-*.tsx)
export {
  StrudelPlayer, DEFAULT_SAMPLES, playStrudel, stopStrudel, updateStrudel, subscribeStrudel, getStrudelSnapshot, strudelNow,
} from './components/strudel-player';
export type { StrudelPlayerProps, StrudelPattern, StrudelHap, StrudelSnapshot } from './components/strudel-player';
export { StrudelRack, RackGrid, StepGrid, Knob, Fader, STRUDEL_PARAMS, trackName } from './components/strudel-rack';
export type { StrudelRackProps, RackGridProps, GridItem, GridLayout, StepGridProps, ControlProps } from './components/strudel-rack';
export {
  parseStrudel, parseMini, miniAtoms, miniLayers, chainCalls, findCall, StrudelSyntaxError, MiniSyntaxError,
  applyEdits, formatNumber, setArg, setMethod, removeMethod, setTempo, setMiniAtom, setMiniSource, mixCode, isAudible,
} from './components/strudel-syntax';
export type {
  StrudelSong, StrudelTrack, StrudelChain, StrudelCall, StrudelArg, StrudelTempo, StrudelTrackKind, StrudelMix, CodeEdit,
  MiniGroup, MiniSequence, MiniLayers, MiniStep, MiniSlice, MiniAtom, MiniOp, MiniNode, MiniSubcycle, MiniAlternation, MiniPolymeter,
} from './components/strudel-syntax';
export { NowPlayingBars } from './components/now-playing-bars';
export type { NowPlayingBarsProps } from './components/now-playing-bars';
export { MorphGroup, Morph, MorphPresence, useMorphTransition } from './components/morph';
export type { MorphGroupProps, MorphProps, MorphPresenceProps } from './components/morph';
export { encodeQR } from './lib/qr';
export type { QRCode, QRLevel, QROptions } from './lib/qr';
export {
  CommandMenu, CommandMenuInput, CommandMenuList, CommandMenuPage, CommandMenuGroup, CommandMenuGroupLabel, CommandMenuItem,
  CommandMenuItemIcon, CommandMenuItemText, CommandMenuItemDescription, CommandMenuShortcut, CommandMenuItems, CommandMenuEmpty,
  CommandMenuStatus, CommandMenuSeparator, CommandMenuFooter, CommandMenuDialog, CommandMenuDialogTrigger, CommandMenuDialogContent,
  createCommandMenuController, useCommandMenu, useCommandMenuValue,
} from './components/command-menu';
export type {
  CommandMenuProps, CommandMenuInputProps, CommandMenuListProps, CommandMenuPageProps, CommandMenuGroupProps, CommandMenuItemProps,
  CommandMenuFooterProps, CommandMenuLegendItem, CommandMenuDialogProps, CommandMenuDialogContentProps, CommandMenuController,
  CommandMenuState, CommandMenuData, CommandMenuDataItem, CommandMenuDataGroup,
} from './components/command-menu';

// ── Workbench surface theme and AI transcript parts (used by the Composer, FloatingChat and several blocks) ──
export { useWorkbenchAppearance, WorkbenchTheme, WorkbenchAppearanceProvider, type WorkbenchThemeProps } from './components/workbench-theme';
export {
  Conversation, ConversationEmpty, ConversationGreeting, ConversationMessages, ConversationComposer, ConversationSuggestions,
  Suggestion, UserMessage, AssistantMessage, MessageMarkdown, ConversationTyping, WorkLog, ToolCall, SettledBanner,
  type ConversationProps, type ConversationGreetingProps, type ConversationMessagesProps, type UserMessageProps,
  type SuggestionProps, type WorkLogProps, type ToolCallProps, type SettledBannerProps,
} from './components/conversation';

// ── Calendar / DateField / DatePicker / ColorField / ColorPicker ──
export {
  Calendar, CalendarHeader, CalendarHeading, CalendarPrevious, CalendarNext, CalendarMonthSelect, CalendarYearSelect,
  CalendarGrid, CalendarWeekdays, CalendarWeekday, CalendarWeeks, CalendarDay, calendarVariants, createCalendarController,
  type CalendarProps, type CalendarDayProps, type CalendarController, type CalendarDayState, type CalendarGridCell,
  type CalendarMode, type CalendarValue, type DateMatcher, type DateMatchers,
} from './components/calendar';
export {
  DateField, DateFieldSegment, TimeField, TimeFieldSegment, dateFieldVariants, createDateFieldController, createTimeFieldController,
  type DateFieldProps, type TimeFieldProps, type DateFieldController, type TimeFieldController, type DateFieldSegmentData, type DateFieldState,
} from './components/date-field';
export {
  DatePicker, DatePickerField, DatePickerInput, DatePickerTrigger, DatePickerClear, DatePickerHint, DatePickerPreset, DatePickerContent,
  datePickerFieldVariants, createDatePickerController,
  type DatePickerProps, type DatePickerFieldProps, type DatePickerContentProps, type DatePickerController, type DatePickerMode, type DatePickerValue,
} from './components/date-picker';
export {
  ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldChannelInput, ColorFieldSwatch, ColorSwatch, colorFieldVariants,
  type ColorFieldProps, type ColorFieldGroupProps, type ColorSwatchProps,
} from './components/color-field';
export {
  ColorPicker, ColorPickerTrigger, ColorPickerContent, ColorPickerArea, ColorPickerAreaThumb, ColorPickerAreaCanvas,
  ColorPickerSlider, ColorPickerSliderThumb, ColorPickerSwatches, ColorPickerSwatchItem,
  ColorPickerEyeDropper, createColorPickerController,
  type ColorPickerProps, type ColorPickerTriggerProps, type ColorPickerContentProps, type ColorPickerSliderProps,
  type ColorPickerController,
} from './components/color-picker';
export {
  FontPicker, FontList, FontStackPicker, fontPickerTriggerVariants, fontListItemVariants, fontStackPickerVariants,
  type FontPickerProps, type FontListProps, type FontStackPickerProps, type FontPickerChangeDetails, type FontPickerReason,
} from './components/font-picker';
export {
  GOOGLE_FONTS, FONT_CATEGORIES, findGoogleFont, fontStack, googleFontsUrl, loadGoogleFont, useGoogleFont, useGoogleFontStatus,
  type GoogleFont, type FontCategory, type GoogleFontOptions, type GoogleFontStatus,
} from './lib/google-fonts';

// ── TimeInput / CronEditor ──
export { TimeInput, timeInputVariants, type TimeInputProps, type TimeInputChange } from './components/time-input';
export { CronEditor, cronEditorVariants, CRON_PRESETS, type CronEditorProps, type CronPreset, type CronEditorChangeDetails, type CronEditorChangeReason } from './components/cron-editor';
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
export type { ResultTableProps, ResultSet, ResultField, ResultTableColumnWidthsChangeReason } from './components/result-table';
export { SchemaTree, schemaTreeVariants } from './components/schema-tree';
export type { SchemaTreeActionDetails, SchemaTreeProps } from './components/schema-tree';
export { SqlConsole, sqlConsoleVariants } from './components/sql-console';
export type { SqlConsoleProps } from './components/sql-console';

// Spreadsheet: a virtualized grid with GPU sorting and histograms, and the CSV reader it pairs with
export { Spreadsheet, spreadsheetVariants, columnName, createSpreadsheetController } from './components/spreadsheet';
export type {
  SpreadsheetProps, SpreadsheetController, SpreadsheetSortInfo, SpreadsheetValueChangeReason, SpreadsheetColumnWidthsChangeReason,
} from './components/spreadsheet';
export {
  parseCellNumber, parseCellDate, inferColumnType, columnNumbers, sortKeys, sortPermutationCpu, sortTextPermutation, sortRows,
  selectionStats, columnHistogram, histogramCpu, binScale, GPU_MIN_ROWS, MAX_BINS,
} from './lib/spreadsheet-model';
export type {
  SpreadsheetColumnType, SpreadsheetSortDirection, SpreadsheetSort, SpreadsheetEngine, SpreadsheetRanOn, SpreadsheetSortResult,
  SpreadsheetEngineOptions, SelectionStats, SpreadsheetHistogram,
} from './lib/spreadsheet-model';
export { parseCsv, stringifyCsv, csvField, detectDelimiter, delimiterForPath } from './lib/csv';
export type { CsvDelimiter, CsvFormat, CsvParseResult, CsvParseOptions } from './lib/csv';


// ── Filters ──
export {
  DATE_PRESETS, FILTER_OPERATORS, RELATIVE_UNITS, coerceFilter, createFilter, createFilterId, dateRange, defaultOperator, describeFilter, describeValue,
  emptyValue, isDateValue, isFilterComplete, matchFilters, matchesFilters, operatorLabel, operatorsFor, parseFilters, serializeFilters, toTime,
  withOperator, withValue,
} from './lib/filter-model';
export type {
  DateOptions, DatePreset, DateValue, Filter, FilterField, FilterKind, FilterOperator, FilterOption, FilterValue, MatchOptions, RelativeUnit,
} from './lib/filter-model';
export {
  FilterBar, FilterToolbar, FilterMenu, FilterList, FilterChip, FilterClear, FilterMatch, FilterValueEditor, useFilters, useFilterBar, useOptionalFilterBar,
  filterBarVariants, filterToolbarVariants, filterChipVariants,
} from './components/filter';
export type {
  FilterBarProps, FilterToolbarProps, FilterMenuProps, FilterListProps, FilterChipProps, FilterClearProps, FilterValueEditorProps,
  FilterBarContextValue, FilterState, FilterActions, UseFiltersOptions, FilterChangeDetails, FilterChangeReason, FilterMatchChangeDetails,
  FilterMatchChangeReason, FilterChangeOptions,
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
  FileUploadProps, FileDropZoneProps, FileUploadButtonProps, FileListProps, FileItemProps, FileUploadContextValue, OnFiles,
} from './components/file-upload';
export { xhrUpload, describeAccept, describeRules, fileKind, rejectionMessage } from './lib/file-upload-model';
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


// ── Video: FFmpeg, the timeline model, render, playback and the editing parts ──
export {
  createFfmpeg, ffmpegUnsupportedReason, FfmpegError, parseProbe, parseRate, mediaFileName,
} from './lib/ffmpeg';
export type {
  Ffmpeg, FfmpegOptions, FfmpegJob, FfmpegResult, FfmpegProgress, FfmpegInput, FfmpegTool, FfmpegErrorCode, ProbeOptions,
  MediaInfo, MediaKind, VideoStreamInfo, AudioStreamInfo,
} from './lib/ffmpeg';
export { extractFrames, extractPeaks, frameTimes, wavPeaks } from './lib/ffmpeg/media';
export type { MediaFrame, FramesOptions, MediaPeaks, PeaksOptions } from './lib/ffmpeg/media';
export {
  FfmpegProvider, useFfmpeg, useFfmpegSupport, useMediaInfo, useMediaFrames, useMediaPeaks, probeMedia, mediaFrames, mediaPeaks, releaseMedia,
} from './lib/ffmpeg/react';
export type { FfmpegProviderProps, MediaFrameURL, AsyncResult } from './lib/ffmpeg/react';
export {
  clipDuration, clipEnd, sourceTime, trackDuration, timelineDuration, quantize, clipsAt, findClip, timelineId,
  layoutTrack, updateClip, updateTrack, removeClips, splitClip, trimClip, moveClip, insertClip, magneticIndex,
  sliceTimeline, snapTargets, snapTime, formatTimecode, parseTimecode, timelineLooks, lookCss, lookFfmpeg,
} from './lib/video-timeline-model';
export type {
  Timeline, TimelineTrack, TimelineClip, TimelineFormat, TimelineLook, TrackKind, ClipFrame, TrimLimits, PlaceOptions,
} from './lib/video-timeline-model';
export { buildRender, renderTimeline, renderMime } from './lib/video-render';
export type { RenderMedia, RenderContainer, RenderQuality, RenderOptions, RenderPlan, RenderTimelineOptions } from './lib/video-render';
export { createPlayback, usePlaybackClock, usePlaybackState } from './lib/playback';
export type { Playback, PlaybackState } from './lib/playback';
export { VideoTimeline, timelineMediaType, fitTimelineZoom, timelineZoomRange, rulerSteps } from './components/video-timeline';
export type {
  VideoTimelineProps, TimelineMediaInfo, TimelineDrop, TimelineDropDetails, VideoTimelineAction, VideoTimelineChangeDetails, VideoTimelineChangeReason,
  VideoTimelineSelectionReason, VideoTimelineZoomReason,
} from './components/video-timeline';
export { VideoPreview, PlaybackControls, PlaybackTimecode } from './components/video-preview';
export type { VideoPreviewProps, PreviewMedia, PlaybackControlsProps, PlaybackTimecodeProps } from './components/video-preview';
export { Filmstrip } from './components/filmstrip';
export type { FilmstripProps, FilmstripFrame } from './components/filmstrip';
export { Waveform, waveformVariants } from './components/waveform';
export type { WaveformProps } from './components/waveform';

export { TuiPreview, TuiEmbed, DEFAULT_TUI_RUNTIME_URL, isTuiCodeBlock } from './components/tui-preview';
export type { TuiPreviewProps, TuiPreviewOptions, TuiPreviewState, TuiTheme } from './components/tui-preview';
export { OpenCode } from './components/open-code';
export { DEFAULT_OPENCODE_PREVIEW_URL } from './lib/open-code-preview';
export type { OpenCodeProps, OpenCodeState } from './components/open-code';
export { createAlmostNodeOpenCodeHost, createAgentWasmOpenCodeHost, loadOpenCodeRuntime, DEFAULT_OPENCODE_RUNTIME_URL } from './lib/open-code-host';
export type { OpenCodeHostBridge, OpenCodePort, OpenCodeWorkspaceBridge, OpenCodeProcessBridge, OpenCodeCommand, OpenCodeMcpServer, OpenCodeRuntime, OpenCodeRuntimeSession, AlmostNodeOpenCodeContainer, AlmostNodeOpenCodeOptions } from './lib/open-code-host';

export { createVaultOpenCodeCredentialStore, createVaultOpenCodeConnectionStore, OPENCODE_CREDENTIAL_SLOT, OPENCODE_CONNECTION_SLOT } from './lib/open-code-keychain';
export type { OpenCodeCredentialStore, OpenCodeConnectionStore, OpenCodeKeychainStore } from './lib/open-code-host';

export {
  Workspace, WorkspaceTab, WorkspaceTabTrigger, WorkspaceTabClose, WorkspaceToolbar, WorkspaceMaximize,
  createWorkspaceController, workspaceTabsets,
} from './components/workspace';
export type {
  WorkspaceProps, WorkspaceTabProps, WorkspaceTabTriggerProps, WorkspaceTabCloseProps, WorkspaceToolbarProps, WorkspaceMaximizeProps,
  WorkspaceLayout, WorkspaceLayoutInput, WorkspaceNode, WorkspaceNodeInput, TabNode, TabsetNode, SplitNode,
  TabDropTarget, TabDropRegion, WorkspaceOrientation, WorkspaceTabPlacement, WorkspaceMinSize,
  WorkspaceController, WorkspaceChangeOptions, WorkspaceAction,
  WorkspaceLayoutChangeReason, WorkspaceLayoutChangeDetails, WorkspaceLayoutCommitDetails,
  WorkspaceState, WorkspaceTabsetState, WorkspaceTabState, WorkspaceTabContentState, WorkspaceClassNames,
} from './components/workspace';

// Debugging parts
export { DebugToolbar } from './components/debug-toolbar';
export type { DebugToolbarAction, DebugToolbarProps } from './components/debug-toolbar';
export { TraceTimeline, traceTimelineVariants } from './components/trace-timeline';
export type { TraceTimelineProps, TraceTimelineHandle, TraceValueChangeDetails, TraceValueChangeReason, TraceValueCommitDetails, TraceViewChangeDetails, TraceViewChangeReason, TracePickReason, TraceFocusedLaneChangeDetails, TraceSelectedThreadChangeDetails, TraceSelectedRequestChangeDetails, TraceDrawStats, TraceFetchActivity } from './components/trace-timeline';
export { linearAxis, stopAxis, advanceAlong, selectStops, formatTraceTime, TRACE_SCRUB_SPEEDS } from './lib/trace-timeline-model';
export type { TraceActivity, TraceAxis, TraceDensity, TraceDiamonds, TraceKey, TraceLane, TraceMarkSeries, TraceRange, TraceRequest, TraceScrubSpeed, TraceStop, TraceStopMark, TraceThread, TraceTone, TraceWindow } from './lib/trace-timeline-model';
export {
  CodeEditor, CodeEditorHeader, CodeEditorTitle, CodeEditorCopyButton, CodeEditorContent, useCodeEditor, SyntaxTokens, useSyntaxTokens,
  codeEditorVariants, codeEditorLineVariants, codeEditorGutterCellVariants,
} from './components/code-editor';
export type {
  CodeEditorProps, CodeEditorContentProps, CodeEditorCopyButtonProps, CodeEditorDisplayProps, CodeEditorHandle, CodeEditorChangeReason, CodeEditorEdit, CodeEditorValueChangeDetails,
  CodeEditorSelectionChangeReason, CodeEditorSelectionChangeDetails, CodeEditorGutterClickDetails, CodeEditorMarkerClickDetails, CodeEditorCopy, CodeEditorGutter, CodeEditorMarker,
  CodeEditorLineDecoration, CodeEditorScrollOptions, CodeEditorScrollTarget, CodeEditorPosition, CodeEditorSelection, CodeEditorAlign, CodeHighlight, CodeHighlightContext, CodeLineRange,
  UseSyntaxTokensOptions, SyntaxTokensState,
} from './components/code-editor';
export { splitCodeLines, lexCodeLine, tooBigForPage, MAX_PAGE_LINES, MAX_PAGE_LINE_LENGTH, MAX_PAGE_CHARS } from './lib/code-editor-model';
export { splitEditorLines, lineAfterEdit } from './lib/code-document';
export { createGpuCodeHighlight } from './lib/code-editor-gpu';
export type { GpuCodeHighlightOptions } from './lib/code-editor-gpu';
export { ObjectTree, objectTreeRowVariants } from './components/object-tree';
export type { ObjectTreeProps, ObjectTreeValueChangeDetails } from './components/object-tree';
export { ObjectValue } from './components/object-value';
export type { ObjectValueProps } from './components/object-value';
export { childrenOfValue, nodeFromValue, objectTreeKey } from './lib/object-tree-model';
export type { ObjectTreeGetterResult, ObjectTreeNode, ObjectTreeRoot } from './lib/object-tree-model';
export { copyTextOf, previewFromValue, previewText, previewTokens } from './lib/object-tree-value';
export type { ValueMapEntry, ValuePreview, ValuePreviewOptions, ValueProperty, ValueTint, ValueToken, ValueType } from './lib/object-tree-value';
export { CallStack, callStackRowVariants } from './components/call-stack';
export type { CallStackProps, CallStackValueChangeDetails } from './components/call-stack';
export { fileBaseName, fullLocation, shortLocation } from './lib/call-stack-model';
export type { CallStackFrame, CallStackFrameKind, CallStackLocation } from './lib/call-stack-model';
export { LogList, LogRowContent, logListVariants, createLogListController } from './components/log-list';
export type {
  LogListProps, LogListController, LogListActionDetails, LogListValueChangeReason, LogListExpandedChangeReason,
  LogListFollowingChangeReason, LogRowContentProps, LogRowState,
} from './components/log-list';
export { LOG_LEVELS, countLogLevels, formatLogTime, logRowText, nodeText, normalizeLogLevel } from './lib/log-list-model';
export type { LogLevel, LogLevelCounts, LogRow, RowId } from './lib/log-list-model';
export { RequestLink, RequestTable, REQUEST_COLUMNS, requestTableVariants, createRequestTableController } from './components/request-table';
export type {
  RequestColumn, RequestColumnId, RequestLinkProps, RequestTableProps, RequestTableController, RequestTableActionDetails,
  RequestTableValueChangeReason, RequestTableSortChangeReason, RequestTableColumnWidthsChangeReason, RequestTableBreakpoints,
} from './components/request-table';
export { isRequestFailed, requestDisplayName, requestDurationText, requestName, requestSizeText, requestStatusText, requestTimeRange, requestTone, sortRequests } from './lib/request-table-model';
export type { RequestRow, RequestSort, RequestSortDirection, RequestSortValue, RequestColumnSize, RequestTimeRange, RequestTone } from './lib/request-table-model';
export { Terminal, terminalVariants } from './components/terminal';
export type { TerminalProps, TerminalHandle } from './components/terminal';
export { createTerminalShell, createLineState, applyKey, applyCompletion, readKeys, renderLine, eraseLine, wordAtCursor, formatColumns, cellWidth, textWidth, stripAnsi, advance, toTerminalNewlines, trimTranscript, MAX_HISTORY } from './lib/terminal-line';
export type { CellPosition, CompletionStep, LineEvent, LineState, LineStep, RenderedLine, TerminalCommandHandler, TerminalCommandIO, TerminalCompleter, TerminalShell, TerminalShellOptions, TerminalSink } from './lib/terminal-line';
