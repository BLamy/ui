import './styles.css';

export { WFONT, MONO, EASE } from './lib/util';
export {
  workbenchVars,
  workbenchAppearanceClass,
  useWorkbenchAppearance,
  WorkbenchTheme,
  type WorkbenchThemeProps,
} from './lib/theme';
export { vib, tick } from './lib/haptics';
export { WIcon, IconBtn, iconBtnVariants, type WIconName, type WIconProps, type IconBtnProps } from './lib/icons';
export {
  MarkdownView,
  FbMd,
  HlPre,
  hlTokens,
  DocstreamRefContext,
  type MarkdownViewProps,
  type DocstreamRefContextValue,
  type ReferenceNode,
} from './lib/markdown';
export { MessageScroller, type MessageScrollerProps, type MessageScrollerItem } from './lib/message-scroller';
export { SnapSheet, type SnapSheetProps } from './lib/snap-sheet';
export { useSpringSheetDrag, MorphText, type SpringSheetDragOptions, type SpringSheetDragState, type MorphTextProps } from './lib/motion';
export {
  ThreadSidebar,
  type ThreadSidebarProps,
  type WorkbenchThread,
  type WorkbenchMessage,
  type WorkbenchTrace,
} from './lib/thread-sidebar';
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
} from './lib/terminal';
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
} from './lib/surfaces';
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
} from './lib/composer';
export { ModelPicker, modelRowVariants, type ModelPickerProps } from './lib/model-picker';
export {
  AnthropicGlyph,
  OpenAIGlyph,
  SparkleGlyph,
  WORKBENCH_MODELS,
  WORKBENCH_PROVIDERS,
  type ModelOption,
  type ModelProvider,
} from './lib/models';
export {
  WorkbenchComposer,
  WORKBENCH_EFFORTS,
  WORKBENCH_ACCESS,
  stripAttachmentRefs,
  type WorkbenchComposerProps,
} from './lib/workbench-composer';
export { WbPopover, readWbTokens, type WbPopoverProps } from './lib/wb-popover';
export {
  ChatView,
  EmptyThread,
  SettledBanner,
  WorkTrace,
  type ChatViewProps,
  type EmptyThreadProps,
  type SettledBannerProps,
  type WorkTraceProps,
} from './lib/chat';
export {
  WorkbenchShell,
  useWorkbenchShell,
  workbenchWidthClass,
  type WorkbenchShellProps,
  type WorkbenchShellContextValue,
  type WorkbenchWidthClass,
} from './lib/workbench-shell';
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
} from './lib/slots';
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
