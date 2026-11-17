import './styles.css';

// lib
export { cn, cx } from './lib/utils';
export {
  springs, springCss, motionDirection, useDirection, motionFades, useSpringTransition, useReducedMotion, type SpringName,
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
  CanvasProps, CanvasPointerInfo, CanvasContextValue, CanvasController, CanvasFitOptions, CanvasInsets, CanvasViewportChangeDetails, CanvasViewportReason,
  CanvasFrameProps, CanvasHandlesProps, CanvasMarqueeProps, CanvasGuidesProps, CanvasMiniMapProps, CanvasMiniMapItem, CanvasPointerLayer,
} from './components/canvas';
export {
  Diagram, DiagramNodeBody, DiagramNodeHeader, DiagramSections, DiagramEntryMarker, DiagramToolbar, useDiagram, useDiagramHistory, createDiagramController,
  diagramEdgeVariants, diagramNodeVariants, diagramItemVariants, diagramEdgeLabelVariants,
} from './components/diagram';
export type {
  DiagramProps, DiagramNodeBodyProps, DiagramNodeHeaderProps, DiagramSectionsProps, DiagramToolbarProps, DiagramContextValue, DiagramController, DiagramData, DiagramItem,
  DiagramDataChangeDetails, DiagramDataChangeReason, DiagramSelectionChangeDetails, DiagramSelectionChangeReason,
  DiagramHistory, DiagramHistoryChangeDetails, DiagramHistoryOptions, UseDiagramHistory,
} from './components/diagram';
export {
  DiagramFrame, DiagramFrameBoard, DiagramFramePanel, DiagramFrameBar, DiagramFrameTrigger, DiagramFrameCover, DiagramFrameCoverHeader, DiagramFrameSection,
  useDiagramFrame,
} from './components/diagram-frame';
export type {
  DiagramFrameProps, DiagramFrameBoardProps, DiagramFramePanelProps, DiagramFrameBarProps, DiagramFrameTriggerProps, DiagramFrameCoverProps,
  DiagramFrameCoverHeaderProps, DiagramFrameSectionProps,
} from './components/diagram-frame';
export { StateDiagram } from './components/state-diagram';
export type { StateDiagramProps, StateDiagramConfigChangeDetails, StateDiagramConfigChangeReason } from './components/state-diagram';
// The diagram's data types, which Diagram's props take; the operations on them are on `@brett_lamy/ui/lib/diagram-model`.
export type {
  DiagramConnection, DiagramEdge, DiagramEdgeTone, DiagramEdgeVariant, DiagramGlyph, DiagramNode, DiagramNodeKind, DiagramNodeVariant, DiagramPort,
  DiagramSection, DiagramSectionItem, DiagramSelection, DiagramSide, DiagramTone,
} from './lib/diagram-model';
// StateDiagram's machine types; its logic (parseXState, machineToDraft, the simulation, the edits) is on
// `@brett_lamy/ui/lib/state-diagram-*`.
export type { StateMachineLike } from './lib/state-diagram-model';
export type { StateMachineConfig, StateMachineImplementations } from './lib/state-diagram-edit';
export type { SimulationStandIns } from './lib/state-diagram-simulation';
export type { AnimatedHeightProps } from './components/animated-height';
export { Celebrate } from './components/celebrate';
export type { CelebrateProps } from './components/celebrate';
export {
  BLProvider, useChromeHidden, setChromeHidden,
  AppearanceProvider, useAppearance,
  ThemeScope, useThemeScope, useScopeAppearance, useThemeScopeProps, themeScopeProps, readThemeVars, tintForeground, THEME_VARS,
  useLayerHost,
} from './lib/theme';
export type { BLProviderProps, Appearance, AppearancePreference, ThemeScopeProps, ThemeScopeName, ThemeScopeState, ThemeVars, ThemeVar } from './lib/theme';
export { useContainerWidth, useContainerSize, useSizeClass, useSizeClassScope, SizeClassProvider, usePresentation } from './lib/container';
export { bindSizeClass, sizeClassOf } from './lib/size-class';
export type { SizeClass, SizeClassBreakpoints, BindSizeClassOptions } from './lib/size-class';
export { createPageStack } from './lib/stack';
export type { PageStack, PageStackExit, PageStackOptions, PageStackReason, PageStackChangeOptions } from './lib/stack';
export { bindBack } from './lib/back';
export type { BindBackOptions } from './lib/back';
export { bindEdgeSwipe } from './lib/edge-swipe';
export type { BindEdgeSwipeOptions, EdgeSwipeDetails, EdgeSwipeEndDetails } from './lib/edge-swipe';
export { bindPullToRefresh } from './lib/pull-to-refresh';
export type { BindPullToRefreshOptions, PullToRefreshDetails, PullToRefresh } from './lib/pull-to-refresh';
export { bindScrollEdge, useHideOnScroll } from './lib/scroll-edge';
export type { BindScrollEdgeOptions } from './lib/scroll-edge';
// The hooks of the storage engines; the engines are on their own entries (`@brett_lamy/ui/lib/append-stream`,
// `lib/durable-streams`, `lib/session-recorder`, `lib/persistent-state`).
export { useSessionRecording, useSessions, useSessionCloud } from './lib/session-recorder';
export type { SessionInfo, SessionRecordingOptions } from './lib/session-recorder';
export { usePersistentState } from './lib/persistent-state';
export { useControllableChange } from './lib/controllable-state';
export type { ContainerSize, UseSizeClassOptions } from './lib/container';
export { Icon, Chevron, isIconName, ICON_NAMES, ICON_ALIASES, ICON_CATEGORIES, ICON_KEYWORDS } from './lib/icon';
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
export { IndexBar, indexBarAlphabetItems, indexBarVariants } from './components/index-bar';
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
  AdaptivePane, AdaptivePaneHeader, AdaptivePaneTitle, AdaptivePaneClose, AdaptivePaneTrigger, adaptivePanePageClass, createAdaptivePaneController, resolveAdaptivePanePresentation,
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
  AdaptivePaneProps, AdaptivePaneState, AdaptivePaneCloseProps, AdaptivePaneTriggerProps, AdaptivePanePresentation, AdaptivePaneController, AdaptivePaneOpenChangeDetails,
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
export type { InputProps, InputController, InputValueCommitDetails } from './components/input';
export { Textarea, textareaVariants } from './components/textarea';
export type { TextareaProps } from './components/textarea';
export { MarkdownEditor, MarkdownEditorToolbarButton, markdownEditorVariants, looksLikeMarkdown, insertMarkdown } from './components/markdown-editor';
export type {
  MarkdownEditorProps, MarkdownEditorHandle, MarkdownEditorInstance, MarkdownEditorAttachment, MarkdownEditorClassNames,
  MarkdownEditorValueChangeDetails, MarkdownEditorValueChangeReason, MarkdownEditorToolbarButtonProps, MarkdownEditorDemo,
} from './components/markdown-editor';
export { Field, FieldLabel, FieldDescription, FieldError, FieldSet, FieldLegend, FieldGroup, FieldControl, useFieldControl } from './components/field';
export type { FieldProps, FieldLabelProps } from './components/field';
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
// The token vocabulary CodeEditor's props use; the lexer is on `@brett_lamy/ui/lib/syntax` (and `lib/syntax-lexer`).
export type { CodeToken } from './lib/syntax';
export type { CodeTokenType } from './lib/syntax-lexer';
// ── end shadcn primitives ──

// ── Workbench: IDE-style agent workspace — composer, chat, terminal dock, surface panel, WorkbenchShell ──
export {
  MarkdownView,
  type MarkdownViewProps,
  type MarkdownViewDemo,
  type ReferenceNode,
  type CodeBlockNode,
  type CodeBlockRenderDetails,
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
  type ComposerFooterProps,
  type ComposerSpacerProps,
  type ComposerSeparatorProps,
  type ComposerTextProps,
  type ComposerAttachmentsProps,
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
} from './components/composer';
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
} from './components/composer';

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
  type ArtifactChatContainerMinimizedChangeDetails,
  type ArtifactChatContainerComposingChangeDetails,
  type ArtifactChatContainerComposingChangeReason,
  type ArtifactChatContainerPresentation,
  type ArtifactChatContainerSide,
} from './components/artifact-chat-container';
export {
  ProgressStepper, ProgressStepperItem, ProgressStepperItemIcon, ProgressStepperItemTrack, ProgressStepperItemLabel, ProgressStepperItemDescription, progressStepperVariants,
  type ProgressStepperProps, type ProgressStepperItemProps, type ProgressStepperStep, type ProgressStepperItemState,
} from './components/progress-stepper';

// PencilKit — freehand drawing on perfect-freehand (formerly @brett_lamy/pencilkit)
export type {
  PencilTool,
  PencilDrawTool,
  PencilPoint,
  PencilStroke,
  PencilInk,
  PencilWidth,
} from './components/pencilkit';
export { StrokePath } from './components/pencilkit';
export type { StrokePathProps } from './components/pencilkit';
export { PencilCanvas } from './components/pencilkit';
export type { PencilCanvasProps, PencilStrokesChangeDetails, PencilStrokesChangeReason } from './components/pencilkit';
export {
  PencilToolbar,
  PencilToolPicker,
  PencilInkPicker,
  PencilWidthPicker,
  PencilActions,
} from './components/pencilkit';
export type {
  PencilToolbarProps,
  PencilToolPickerProps,
  PencilInkPickerProps,
  PencilWidthPickerProps,
  PencilActionsProps,
  PencilPickerPresentation,
} from './components/pencilkit';
export { usePencilHistory } from './components/pencilkit';
export type { PencilHistory } from './components/pencilkit';
export { PencilKitAnnotator } from './components/pencilkit';
export { ImageAnnotator, ImageAnnotatorProvider } from './components/pencilkit';
export type {
  ImageAnnotatorProps, ImageAnnotatorProviderProps, ImageAnnotatorEngine, ImageAnnotatorEngineProps, ImageAnnotatorSurface,
} from './components/pencilkit';

// ── feedback, media and morph primitives ──
export {
  ToastRegion, Toast, ToastIcon, ToastTitle, ToastDescription, ToastAction, ToastClose, ToastProvider, toast, createToaster, hud, createHud,
  useToast, toastRegionVariants, toastVariants, toastIconVariants,
} from './components/toast';
export type {
  ToastRegionProps, ToastProps, ToastIconProps, ToastVariant, ToastExtras, ToastHud, Toaster, ToastData, ToastOptions, ToastType, ToastItem,
  ToastState, ToastRegionState, ToastActionData, ToastCancel, ToastDismissDetails, ToastDismissReason,
} from './components/toast';
export { ProgressRing, CountdownRing, useCountdown, progressRingVariants, countdownRingValueVariants } from './components/progress-ring';
export type { ProgressRingProps, ProgressRingSize, ProgressRingTone, CountdownRingProps, UseCountdownOptions, UseCountdown } from './components/progress-ring';
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
export type { StrudelPlayerProps, StrudelCodeChangeDetails, StrudelPanelChangeReason, StrudelSnapshot } from './components/strudel-player';
export { NowPlayingBars } from './components/now-playing-bars';
export type { NowPlayingBarsProps } from './components/now-playing-bars';
export { MorphGroup, Morph, MorphPresence, useMorphTransition } from './components/morph';
export type { MorphGroupProps, MorphProps, MorphPresenceProps } from './components/morph';
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
  CalendarMonths, CalendarGrid, CalendarGridHeading, CalendarWeekdays, CalendarWeekday, CalendarWeeks, CalendarDay, calendarVariants, createCalendarController,
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
  useGoogleFont, useGoogleFontStatus, type GoogleFontOptions, type GoogleFontStatus,
} from './lib/google-fonts';

// ── NaturalTimeInput / CronEditor ──
export { NaturalTimeInput, type NaturalTimeInputProps, type NaturalTimeInputChange, type NaturalTimeInputParseOptions } from './components/natural-time-input';
export { CronEditor, CRON_PRESETS, type CronEditorProps, type CronPreset, type CronEditorChangeDetails, type CronEditorChangeReason } from './components/cron-editor';
// The parsers' hooks; the parsers and the cron functions are on `@brett_lamy/ui/lib/gpu-time`, `lib/gpu-cron`, `lib/cron`.
export { useTimeParse, type UseTimeParseOptions, type TimeParseState } from './lib/gpu-time';
export { useCronParse, type UseCronParseOptions, type CronParseState } from './lib/gpu-cron';

// ── Passkey vault ──
export {
  VaultGate, VaultUnlock, VaultSetup, VaultUnsupported, VaultStatusBadge, VaultEnrollDialog, VaultRecoveryKey, vaultRecoveryKeyVariants,
  vaultUnsupportedMessage,
} from './components/vault-gate';
export type {
  VaultGateProps, VaultGateScreens, VaultUnlockProps, VaultSetupProps, VaultUnsupportedProps, VaultStatusBadgeProps, VaultEnrollDialogProps,
  VaultRecoveryKeyProps,
} from './components/vault-gate';

// ── SqlConsole (the PGlite engine is on its own entries: @brett_lamy/ui/lib/pglite, lib/pglite-core, …) ──
export {
  SqlConsole, SqlConsoleHeader, SqlConsoleDatabaseMenu, SqlConsoleSidebar, SqlConsoleEditor, SqlConsoleEditorFooter, SqlConsoleEditorRun,
  SqlConsoleResults, useSqlHistory,
} from './components/sql-console';
export type {
  SqlConsoleProps, SqlConsoleHeaderProps, SqlConsoleEditorProps, SqlConsoleEditorFooterProps, SqlConsoleEditorRunProps, SqlConsoleEditorHandle,
  SqlHistory,
} from './components/sql-console';

// Spreadsheet: a virtualized grid with GPU sorting and histograms (its model and the CSV reader: @brett_lamy/ui/lib/spreadsheet-model, lib/csv)
export { Spreadsheet, spreadsheetVariants, createSpreadsheetController } from './components/spreadsheet';
export type {
  SpreadsheetProps, SpreadsheetController, SpreadsheetSortInfo, SpreadsheetSortChangeReason, SpreadsheetValueChangeReason, SpreadsheetColumnWidthsChangeReason,
} from './components/spreadsheet';


// ── Filters ──
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


// ── FileUpload ──
export {
  FileUpload, FileUploadDropzone, FileUploadTrigger, FileUploadList, FileUploadItem, FileUploadThumbnail, fileUploadDropzoneVariants, fileUploadItemVariants,
} from './components/file-upload';
export type {
  FileUploadProps, FileUploadDropzoneProps, FileUploadTriggerProps, FileUploadListProps, FileUploadItemProps, FileUploadThumbnailProps, FileUploadContextValue, FileUploadFilesHandler,
} from './components/file-upload';


// ── Tailscale ──
export {
  TailscaleLoginButton, TailscaleStatusBadge, TailscaleMark, TailscaleSummary, TailscaleExitNodes, tailscaleStatusBadgeVariants,
} from './components/tailscale-controls';
export type {
  TailscaleLoginButtonProps, TailscaleLoginButtonLabels, TailscaleStatusBadgeProps, TailscaleSummaryProps, TailscaleMarkProps,
  TailscaleExitNodesProps, TailscaleExitNodeLabels, TailscaleExitNodeState, TailscaleExitNodeChangeDetails,
} from './components/tailscale-controls';


// ── Video: the editing parts (FFmpeg, the timeline model, render and playback are on @brett_lamy/ui/lib/ffmpeg, lib/video-timeline-model, …) ──
export { VideoTimeline, timelineMediaType, fitTimelineZoom } from './components/video-timeline';
export type {
  VideoTimelineProps, TimelineMedia, TimelineDrop, TimelineDropDetails, VideoTimelineAction, VideoTimelineChangeDetails, VideoTimelineChangeReason,
  VideoTimelineSelectionReason, VideoTimelineZoomReason,
} from './components/video-timeline';
export { VideoPreview, VideoPreviewControls, VideoPreviewTimecode } from './components/video-preview';
export type { VideoPreviewProps, VideoPreviewControlsProps, VideoPreviewTimecodeProps } from './components/video-preview';
export { Filmstrip } from './components/filmstrip';
export type { FilmstripProps, FilmstripFrame } from './components/filmstrip';
export { Waveform, waveformVariants } from './components/waveform';
export type { WaveformProps } from './components/waveform';

export { TuiPreview } from './components/tui-preview';
export type { TuiPreviewProps, TuiPreviewOptions, TuiPreviewState, TuiAppearance, TuiTheme } from './components/tui-preview';
export { OpenCode, openCodeVariants } from './components/open-code';
export type { OpenCodeProps, OpenCodeBaseProps, OpenCodeHostProps, OpenCodeState } from './components/open-code';


export {
  Workspace, WorkspaceTab, WorkspaceTabTrigger, WorkspaceTabClose, WorkspaceToolbar, WorkspaceMaximize,
  createWorkspaceController,
} from './components/workspace';
export type {
  WorkspaceProps, WorkspaceTabProps, WorkspaceTabTriggerProps, WorkspaceTabCloseProps, WorkspaceToolbarProps, WorkspaceMaximizeProps,
  WorkspaceLayout, WorkspaceLayoutInput, WorkspaceNode, WorkspaceNodeInput, WorkspaceTabNode, WorkspaceTabsetNode, WorkspaceSplitNode,
  WorkspaceDropTarget, WorkspaceDropRegion, WorkspaceOrientation, WorkspaceTabSide, WorkspaceMinSize,
  WorkspaceController, WorkspaceChangeOptions, WorkspaceAction,
  WorkspaceLayoutChangeReason, WorkspaceLayoutChangeDetails, WorkspaceLayoutCommitDetails,
  WorkspaceState, WorkspaceTabsetState, WorkspaceTabState, WorkspaceTabContentState, WorkspaceClassNames, WorkspacePresentation,
} from './components/workspace';

// Debugging parts
export { DebugToolbar, DebugToolbarButton, debugToolbarActions } from './components/debug-toolbar';
export type { DebugToolbarAction, DebugToolbarActionDetails, DebugToolbarProps, DebugToolbarButtonProps } from './components/debug-toolbar';
export { TraceTimeline, TraceTimelinePreview, traceTimelineVariants } from './components/trace-timeline';
export type { TraceTimelineProps, TraceTimelinePreviewProps, TraceTimelineHandle, TraceValueChangeDetails, TraceValueChangeReason, TraceValueCommitDetails, TraceViewChangeDetails, TraceViewChangeReason, TracePickReason, TraceFocusedLaneChangeDetails, TraceSelectedThreadChangeDetails, TraceSelectedRequestChangeDetails, TraceDrawStats, TraceFetchActivity } from './components/trace-timeline';
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
export { ObjectTree } from './components/object-tree';
export type { ObjectTreeProps, ObjectTreeValueChangeDetails } from './components/object-tree';
export { ObjectValue } from './components/object-value';
export type { ObjectValueProps } from './components/object-value';
export { CallStack } from './components/call-stack';
export type { CallStackProps, CallStackValueChangeDetails } from './components/call-stack';
export { LogList, LogListRowContent, logListVariants, createLogListController } from './components/log-list';
export type {
  LogListProps, LogListController, LogListActionDetails, LogListValueChangeReason, LogListExpandedChangeReason,
  LogListFollowingChangeReason, LogListRowContentProps, LogListRowState,
} from './components/log-list';
export { DataTable, DataTableCell, dataTableVariants, createDataTableController } from './components/data-table';
export type {
  DataTableProps, DataTableColumn, DataTableDensity, DataTableOverlayState, DataTableRowAttributes, DataTableRow, DataTableController,
  DataTableActionDetails, DataTableValueChangeReason, DataTableSortChangeReason, DataTableColumnWidthsChangeReason, DataTableBreakpoints,
  DataTableColumnSize, DataTableSort, DataTableSortDirection, DataTableSortValue, DataTableTimeRange,
} from './components/data-table';
export { RequestTableLink, RequestTable, REQUEST_TABLE_COLUMNS } from './components/request-table';
export type { RequestTableColumnId, RequestTableLinkProps, RequestTableProps } from './components/request-table';
export { Terminal, terminalVariants } from './components/terminal';
export type { TerminalProps, TerminalHandle } from './components/terminal';
