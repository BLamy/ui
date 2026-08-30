import './styles.css';

export { WFONT, MONO, EASE } from './lib/util';
export { workbenchVars, WorkbenchTheme, type WorkbenchThemeProps } from './lib/theme';
export { vib, tick } from './lib/haptics';
export { WIcon, IconBtn, type WIconName, type WIconProps, type IconBtnProps } from './lib/icons';
export { MarkdownView, FbMd, HlPre, hlTokens, type MarkdownViewProps } from './lib/markdown';
export { MessageScroller, type MessageScrollerProps, type MessageScrollerItem } from './lib/message-scroller';
export { SnapSheet, type SnapSheetProps } from './lib/snap-sheet';
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
export { Composer, Pill, AnnotateLightbox, type ComposerProps, type PillProps, type AnnotateLightboxProps } from './lib/composer';
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
